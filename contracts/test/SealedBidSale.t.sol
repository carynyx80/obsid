// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseTest} from "./utils/Base.t.sol";
import {SealedBidSale} from "../src/SealedBidSale.sol";
import {MilestoneEscrow} from "../src/MilestoneEscrow.sol";
import {SaleFactory} from "../src/SaleFactory.sol";
import {SaleParams} from "../src/ObsidTypes.sol";
import {ReentrantBidder, FeeOnTransferToken} from "./utils/Mocks.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract SealedBidSaleTest is BaseTest {
    // ------------------------------------------------------------ happy path

    function test_HappyPath_Oversubscribed_ProRataAtMarginalTick() public {
        uint256 feeBefore = feeRecipient.balance;
        _runOversubscribed();

        assertEq(uint8(sale.state()), uint8(SealedBidSale.State.Succeeded));
        assertEq(sale.clearingTick(), 30);
        assertEq(sale.clearingPrice(), 0.04 ether);
        assertEq(sale.totalSold(), SUPPLY);
        assertEq(sale.marginalFill(), 200e18);
        assertEq(sale.marginalDemand(), 900e18);

        uint256 gross = 39999999999999999999; // floor(0.04 * (1000e18 - 2 marginal bidders) / 1e18)
        assertEq(sale.raised(), gross);
        uint256 fee = gross * FEE_BPS / 10_000;
        assertEq(feeRecipient.balance - feeBefore, fee);
        assertEq(address(escrow).balance, gross - fee);
        assertEq(escrow.totalFunded(), gross - fee);
        assertEq(escrow.totalWeight(), SUPPLY);
        // 40% at close, two 30% milestones locked
        (,, uint256 m0,) = escrow.milestone(0);
        (,, uint256 m1,) = escrow.milestone(1);
        assertEq(m0, (gross - fee) * 3000 / 10_000);
        assertEq(escrow.hostClaimable(), gross - fee - m0 - m1);

        // allocations
        (uint256 aA, uint256 pA, uint256 rA) = sale.allocationOf(alice);
        assertEq(aA, 400e18);
        assertEq(pA, 16 ether);
        assertEq(rA, 14 ether);
        (uint256 aC, uint256 pC,) = sale.allocationOf(carol);
        assertEq(aC, uint256(300e18) * 200e18 / 900e18);
        assertEq(pC, 2666666666666666667);
        (uint256 aD,,) = sale.allocationOf(dave);
        assertEq(aD, uint256(600e18) * 200e18 / 900e18);
        (uint256 aE, uint256 pE, uint256 rE) = sale.allocationOf(erin);
        assertEq(aE, 0);
        assertEq(pE, 0);
        assertEq(rE, 10 ether);

        // settle everyone
        uint256 aliceBal = alice.balance;
        sale.settle(alice);
        assertEq(alice.balance - aliceBal, 14 ether);
        assertEq(vault.positionTotal(address(sale), alice), 400e18);

        address[4] memory rest = [bob, carol, dave, erin];
        for (uint256 i; i < rest.length; ++i) {
            sale.settle(rest[i]);
        }
        assertEq(vault.positionTotal(address(sale), carol), aC);
        assertEq(vault.positionTotal(address(sale), dave), aD);
        assertEq(vault.positionTotal(address(sale), erin), 0);
        assertEq(token.balanceOf(address(vault)), 400e18 + 400e18 + aC + aD);

        // solvency: sale keeps only rounding dust
        assertLe(address(sale).balance, 10);
        assertEq(address(sale).balance, sale.totalDeposits());

        // badges minted on reveal
        assertEq(badge.balanceOf(alice), 1);
        assertEq(badge.balanceOf(erin), 1);

        // host withdraws unsold (= marginal rounding dust is 1 wei of tokens, stays in sale)
        vm.prank(host);
        sale.withdrawUnsold();
        assertEq(token.balanceOf(address(sale)), SUPPLY - (400e18 + 400e18 + aC + aD));
        assertLe(token.balanceOf(address(sale)), 2);
    }

    function test_Undersubscribed_AllFilledAtLowestRevealedTick() public {
        _toCommit(sale);
        _commit(sale, alice, 80, 100e18, 10 ether);
        _commit(sale, bob, 20, 200e18, 10 ether);
        _toReveal(sale);
        _reveal(sale, alice, 80, 100e18);
        _reveal(sale, bob, 20, 200e18);
        _toFinalize(sale);
        sale.finalize();

        assertEq(uint8(sale.state()), uint8(SealedBidSale.State.Succeeded));
        assertEq(sale.clearingTick(), 20);
        uint256 price = MIN_PRICE + 20 * TICK; // 0.03
        assertEq(sale.clearingPrice(), price);
        assertEq(sale.totalSold(), 300e18);
        assertEq(sale.raised(), 9 ether);

        (uint256 a, uint256 p, uint256 r) = sale.allocationOf(alice);
        assertEq(a, 100e18);
        assertEq(p, 3 ether);
        assertEq(r, 7 ether);
        sale.settle(alice);
        sale.settle(bob);
        assertEq(address(sale).balance, 0);

        uint256 hostBal = token.balanceOf(host);
        vm.prank(host);
        sale.withdrawUnsold();
        assertEq(token.balanceOf(host) - hostBal, SUPPLY - 300e18);
        vm.prank(host);
        vm.expectRevert(SealedBidSale.AlreadyWithdrawn.selector);
        sale.withdrawUnsold();
    }

    function test_FailedSoftCap_EveryoneRefundedInFull() public {
        _toCommit(sale);
        _commit(sale, alice, 0, 100e18, 5 ether); // 0.01 * 100 = 1 BNB < softcap 2
        _commit(sale, bob, 0, 50e18, 1 ether);
        _commit(sale, carol, 0, 1e18, 1 ether); // never reveals
        _toReveal(sale);
        _reveal(sale, alice, 0, 100e18);
        _reveal(sale, bob, 0, 50e18);
        _toFinalize(sale);
        sale.finalize();
        assertEq(uint8(sale.state()), uint8(SealedBidSale.State.Failed));
        assertEq(address(escrow).balance, 0);

        uint256 a0 = alice.balance;
        uint256 b0 = bob.balance;
        uint256 c0 = carol.balance;
        sale.settle(alice);
        sale.settle(bob);
        sale.settle(carol);
        assertEq(alice.balance - a0, 5 ether);
        assertEq(bob.balance - b0, 1 ether);
        assertEq(carol.balance - c0, 1 ether);
        assertEq(address(sale).balance, 0);
        assertEq(vault.positionTotal(address(sale), alice), 0);

        uint256 h0 = token.balanceOf(host);
        vm.prank(host);
        sale.withdrawUnsold();
        assertEq(token.balanceOf(host) - h0, SUPPLY);
    }

    function test_NoBids_Fails() public {
        _toFinalize(sale);
        sale.finalize();
        assertEq(uint8(sale.state()), uint8(SealedBidSale.State.Failed));
    }

    function test_Unfunded_CannotCommit_FinalizeFails() public {
        (SealedBidSale s,) = _createSale(_defaultParams());
        _toCommit(s);
        bytes32 c = keccak256("x");
        vm.prank(alice);
        vm.expectRevert(SealedBidSale.NotFunded.selector);
        s.commit{value: 1 ether}(c);
        // cannot fund after start
        vm.startPrank(host);
        token.approve(address(s), SUPPLY);
        vm.expectRevert(SealedBidSale.WrongPhase.selector);
        s.fund();
        vm.stopPrank();
        _toFinalize(s);
        s.finalize();
        assertEq(uint8(s.state()), uint8(SealedBidSale.State.Failed));
    }

    function test_Fund_RejectsDoubleAndFeeOnTransfer() public {
        vm.prank(host);
        vm.expectRevert(SealedBidSale.AlreadyFunded.selector);
        sale.fund();

        FeeOnTransferToken fot = new FeeOnTransferToken();
        fot.mint(host, SUPPLY);
        SaleParams memory p = _defaultParams();
        p.saleToken = address(fot);
        (SealedBidSale s,) = _createSale(p);
        vm.startPrank(host);
        fot.approve(address(s), SUPPLY);
        vm.expectRevert(SealedBidSale.FeeOnTransferNotSupported.selector);
        s.fund();
        vm.stopPrank();
    }

    // ------------------------------------------------------------ reveal checks

    function test_Reveal_WrongHashReverts() public {
        _toCommit(sale);
        _commit(sale, alice, 50, 100e18, 10 ether);
        _toReveal(sale);
        vm.startPrank(alice);
        vm.expectRevert(SealedBidSale.InvalidReveal.selector);
        sale.reveal(51, 100e18, _salt(alice)); // wrong tick
        vm.expectRevert(SealedBidSale.InvalidReveal.selector);
        sale.reveal(50, 101e18, _salt(alice)); // wrong amount
        vm.expectRevert(SealedBidSale.InvalidReveal.selector);
        sale.reveal(50, 100e18, bytes32(uint256(1))); // wrong salt
        vm.stopPrank();
        // someone else cannot reveal alice's commitment (bidder bound into hash)
        bytes32 c = keccak256(abi.encodePacked(uint256(50), uint256(100e18), _salt(alice), alice));
        vm.prank(bob);
        vm.expectRevert(SealedBidSale.NoCommitment.selector);
        sale.reveal(50, 100e18, _salt(alice));
        assertEq(c, sale.computeCommitment(50, 100e18, _salt(alice), alice));
        // correct reveal works, second reveal fails
        _reveal(sale, alice, 50, 100e18);
        vm.prank(alice);
        vm.expectRevert(SealedBidSale.AlreadyRevealed.selector);
        sale.reveal(50, 100e18, _salt(alice));
    }

    function test_Reveal_DepositTooSmallReverts() public {
        _toCommit(sale);
        // price tick 50 = 0.06 BNB/token, 100 tokens = 6 BNB but deposit only 5
        _commit(sale, alice, 50, 100e18, 5 ether);
        _toReveal(sale);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SealedBidSale.DepositTooSmall.selector, 6 ether, 5 ether));
        sale.reveal(50, 100e18, _salt(alice));
    }

    function test_Reveal_InvalidTickAndZeroAmount() public {
        _toCommit(sale);
        _commit(sale, alice, NUM_TICKS, 1e18, 1 ether);
        _commit(sale, bob, 1, 0, 1 ether);
        _toReveal(sale);
        vm.prank(alice);
        vm.expectRevert(SealedBidSale.InvalidTick.selector);
        sale.reveal(NUM_TICKS, 1e18, _salt(alice));
        vm.prank(bob);
        vm.expectRevert(SealedBidSale.ZeroAmount.selector);
        sale.reveal(1, 0, _salt(bob));
    }

    function test_Phases_Enforced() public {
        bytes32 c = keccak256("c");
        vm.prank(alice);
        vm.expectRevert(SealedBidSale.WrongPhase.selector);
        sale.commit{value: 1 ether}(c); // before start
        _toCommit(sale);
        _commit(sale, alice, 1, 1e18, 1 ether);
        vm.prank(alice);
        vm.expectRevert(SealedBidSale.WrongPhase.selector);
        sale.reveal(1, 1e18, _salt(alice)); // too early
        vm.expectRevert(SealedBidSale.WrongPhase.selector);
        sale.finalize();
        vm.expectRevert(SealedBidSale.NotFinalized.selector);
        sale.settle(alice);
        _toReveal(sale);
        vm.prank(bob);
        vm.expectRevert(SealedBidSale.WrongPhase.selector);
        sale.commit{value: 1 ether}(c); // commit closed
        _toFinalize(sale);
        vm.prank(alice);
        vm.expectRevert(SealedBidSale.WrongPhase.selector);
        sale.reveal(1, 1e18, _salt(alice)); // reveal closed
        sale.finalize();
        vm.expectRevert(SealedBidSale.AlreadyFinalized.selector);
        sale.finalize();
    }

    function test_Commit_ZeroValueZeroCommitmentAndTopUp() public {
        _toCommit(sale);
        vm.startPrank(alice);
        vm.expectRevert(SealedBidSale.ZeroValue.selector);
        sale.commit(keccak256("a"));
        vm.expectRevert(SealedBidSale.ZeroCommitment.selector);
        sale.commit{value: 1 ether}(bytes32(0));
        vm.stopPrank();

        // first commitment too small for the bid, then top up and replace commitment
        _commit(sale, alice, 0, 1e18, 0.001 ether);
        _commit(sale, alice, 50, 100e18, 6 ether);
        (bytes32 c, uint256 dep,,,,) = sale.bids(alice);
        assertEq(dep, 6.001 ether);
        assertEq(c, sale.computeCommitment(50, 100e18, _salt(alice), alice));
        assertEq(sale.numBidders(), 1);
        _toReveal(sale);
        _reveal(sale, alice, 50, 100e18);
    }

    // ------------------------------------------------------------ settlement

    function test_UnrevealedBidder_GetsFullRefundInSuccessfulSale() public {
        _toCommit(sale);
        _commit(sale, alice, 50, 400e18, 30 ether);
        _commit(sale, bob, 60, 900e18, 100 ether); // never reveals
        _toReveal(sale);
        _reveal(sale, alice, 50, 400e18);
        _toFinalize(sale);
        sale.finalize();
        assertEq(uint8(sale.state()), uint8(SealedBidSale.State.Succeeded));
        (uint256 a, uint256 p, uint256 r) = sale.allocationOf(bob);
        assertEq(a, 0);
        assertEq(p, 0);
        assertEq(r, 100 ether);
        uint256 b0 = bob.balance;
        sale.settle(bob);
        assertEq(bob.balance - b0, 100 ether);
        assertEq(badge.balanceOf(bob), 0);
    }

    function test_DoubleSettle_Reverts() public {
        _runOversubscribed();
        sale.settle(alice);
        vm.expectRevert(SealedBidSale.AlreadySettled.selector);
        sale.settle(alice);
        vm.expectRevert(SealedBidSale.NoCommitment.selector);
        sale.settle(mallory);
    }

    function test_Cancel_ByAdmin_RefundsAll() public {
        _toCommit(sale);
        _commit(sale, alice, 50, 100e18, 10 ether);
        vm.prank(mallory);
        vm.expectRevert(SealedBidSale.NotAdmin.selector);
        sale.cancel();
        vm.prank(ADMIN);
        sale.cancel();
        assertEq(uint8(sale.state()), uint8(SealedBidSale.State.Failed));
        uint256 a0 = alice.balance;
        sale.settle(alice);
        assertEq(alice.balance - a0, 10 ether);
        vm.prank(host);
        sale.withdrawUnsold();
        assertEq(token.balanceOf(address(sale)), 0);
    }

    function test_BABTGating() public {
        SaleParams memory p = _defaultParams();
        p.babtRequired = true;
        (SealedBidSale s,) = _createSale(p);
        _fund(s);
        _toCommit(s);
        bytes32 c = keccak256(abi.encodePacked(uint256(1), uint256(1e18), _salt(alice), alice));
        vm.prank(alice);
        vm.expectRevert(SealedBidSale.NotBABTHolder.selector);
        s.commit{value: 1 ether}(c);
        babt.set(alice, 1);
        vm.prank(alice);
        s.commit{value: 1 ether}(c);
    }

    // ------------------------------------------------------------ pause

    function test_Pause_BlocksSaleActions() public {
        vm.prank(mallory);
        vm.expectRevert(SealedBidSale.NotAdmin.selector);
        sale.pause();

        _toCommit(sale);
        vm.prank(ADMIN);
        sale.pause();
        bytes32 c = keccak256(abi.encodePacked(uint256(50), uint256(100e18), _salt(alice), alice));
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        sale.commit{value: 10 ether}(c);
        vm.prank(ADMIN);
        sale.unpause();
        _commit(sale, alice, 50, 100e18, 10 ether);

        _toReveal(sale);
        vm.prank(ADMIN);
        sale.pause();
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        sale.reveal(50, 100e18, _salt(alice));
        vm.prank(ADMIN);
        sale.unpause();
        _reveal(sale, alice, 50, 100e18);

        _toFinalize(sale);
        vm.prank(ADMIN);
        sale.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        sale.finalize();
        vm.prank(ADMIN);
        sale.unpause();
        sale.finalize();

        vm.prank(ADMIN);
        sale.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        sale.settle(alice);
        vm.prank(ADMIN);
        sale.unpause();
        sale.settle(alice);
    }

    function test_Pause_FactoryBlocksCreate() public {
        vm.prank(ADMIN);
        factory.pause();
        SaleParams memory p = _defaultParams();
        vm.prank(ADMIN);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        factory.createSale(p);
    }

    // ------------------------------------------------------------ reentrancy

    function test_Reentrancy_SettleCannotBeReentered() public {
        ReentrantBidder attacker = new ReentrantBidder(sale);
        vm.deal(address(attacker), 0);
        _toCommit(sale);
        bytes32 c = keccak256(abi.encodePacked(uint256(50), uint256(100e18), bytes32("s"), address(attacker)));
        attacker.commit{value: 10 ether}(c);
        _commit(sale, alice, 50, 100e18, 10 ether);
        _toReveal(sale);
        attacker.reveal(50, 100e18, bytes32("s"));
        _reveal(sale, alice, 50, 100e18);
        _toFinalize(sale);
        sale.finalize();

        sale.settle(address(attacker));
        assertTrue(attacker.reentryAttempted());
        assertFalse(attacker.reentrySucceeded());
        // paid 100 * 0.06 = 6 BNB, refund exactly 4 once
        assertEq(attacker.received(), 4 ether);
        assertEq(address(attacker).balance, 4 ether);
        vm.expectRevert(SealedBidSale.AlreadySettled.selector);
        sale.settle(address(attacker));
        // alice still fully served
        uint256 a0 = alice.balance;
        sale.settle(alice);
        assertEq(alice.balance - a0, 4 ether);
    }

    // ------------------------------------------------------------ factory guards

    function test_OnlyOwner_FactoryGuards() public {
        SaleParams memory p = _defaultParams();
        vm.startPrank(mallory);
        vm.expectRevert();
        factory.createSale(p);
        vm.expectRevert();
        factory.setMaxHardCap(1);
        vm.expectRevert();
        factory.setPlatformFee(1, mallory);
        vm.expectRevert();
        factory.setBabt(mallory);
        vm.expectRevert();
        factory.setImplementations(mallory, mallory);
        vm.expectRevert();
        factory.pause();
        vm.stopPrank();

        vm.startPrank(ADMIN);
        vm.expectRevert(SaleFactory.FeeTooHigh.selector);
        factory.setPlatformFee(1001, feeRecipient);
        factory.setPlatformFee(1000, feeRecipient);
        factory.setMaxHardCap(500 ether);
        vm.stopPrank();
        assertEq(factory.maxHardCap(), 500 ether);
        assertEq(factory.platformFeeBps(), 1000);
    }

    function test_Factory_ValidatesParams() public {
        SaleParams memory p = _defaultParams();
        p.supply = 100_000e18; // max raise 10_900 BNB > 1000 cap
        vm.prank(ADMIN);
        vm.expectRevert(abi.encodeWithSelector(SaleFactory.InvalidParams.selector, "hardCap"));
        factory.createSale(p);

        p = _defaultParams();
        p.numTicks = 201;
        vm.prank(ADMIN);
        vm.expectRevert(abi.encodeWithSelector(SaleFactory.InvalidParams.selector, "numTicks"));
        factory.createSale(p);

        p = _defaultParams();
        p.atCloseBps = 5000;
        vm.prank(ADMIN);
        vm.expectRevert(abi.encodeWithSelector(SaleFactory.InvalidParams.selector, "bpsSum"));
        factory.createSale(p);

        p = _defaultParams();
        p.vesting.tgeTime = p.revealEndTime - 1;
        vm.prank(ADMIN);
        vm.expectRevert(abi.encodeWithSelector(SaleFactory.InvalidParams.selector, "tgeTime"));
        factory.createSale(p);

        p = _defaultParams();
        p.endTime = p.startTime;
        vm.prank(ADMIN);
        vm.expectRevert(abi.encodeWithSelector(SaleFactory.InvalidParams.selector, "times"));
        factory.createSale(p);
    }

    function test_Factory_Registry() public {
        assertEq(factory.salesCount(), 1);
        assertTrue(factory.isSale(address(sale)));
        assertEq(factory.escrowOf(address(sale)), address(escrow));
        assertEq(factory.saleIdOf(address(sale)), 0);
        (SealedBidSale s2,) = _createSale(_defaultParams());
        assertEq(factory.saleIdOf(address(s2)), 1);
        address[] memory list = factory.getSales(0, 10);
        assertEq(list.length, 2);
        assertEq(list[1], address(s2));
        // clones cannot be re-initialized
        SealedBidSale.InitParams memory ip;
        vm.expectRevert();
        sale.initialize(ip);
    }

    // ------------------------------------------------------------ fuzz: solvency

    function testFuzz_Solvency(uint256 seed) public {
        address[6] memory who = [alice, bob, carol, dave, erin, mallory];
        uint256[6] memory ticks;
        uint256[6] memory amts;
        _toCommit(sale);
        for (uint256 i; i < 6; ++i) {
            uint256 r = uint256(keccak256(abi.encode(seed, i)));
            ticks[i] = r % NUM_TICKS;
            amts[i] = 1 + (r >> 16) % 700e18;
            uint256 cost = ((MIN_PRICE + ticks[i] * TICK) * amts[i] + 1e18 - 1) / 1e18;
            _commit(sale, who[i], ticks[i], amts[i], cost + (r >> 200) % 1 ether);
        }
        _toReveal(sale);
        for (uint256 i; i < 6; ++i) {
            _reveal(sale, who[i], ticks[i], amts[i]);
        }
        _toFinalize(sale);
        sale.finalize();
        uint256 allocated;
        for (uint256 i; i < 6; ++i) {
            (uint256 a,,) = sale.allocationOf(who[i]);
            allocated += a;
            sale.settle(who[i]);
        }
        assertLe(allocated, sale.totalSold());
        assertEq(address(sale).balance, sale.totalDeposits());
        if (sale.state() == SealedBidSale.State.Succeeded) {
            assertLe(sale.totalSold() - allocated, 6);
            vm.prank(host);
            sale.withdrawUnsold();
            assertEq(token.balanceOf(address(sale)), sale.totalSold() - allocated);
        }
    }
}
