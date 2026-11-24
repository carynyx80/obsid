// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseTest} from "./utils/Base.t.sol";
import {SealedBidSale} from "../src/SealedBidSale.sol";
import {MilestoneEscrow} from "../src/MilestoneEscrow.sol";
import {VestingVault} from "../src/VestingVault.sol";
import {ParticipationBadge} from "../src/ParticipationBadge.sol";
import {AllocationMarket} from "../src/AllocationMarket.sol";
import {LiquidityLocker} from "../src/LiquidityLocker.sol";
import {MockERC20, ReentrantRefunder} from "./utils/Mocks.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

contract PostSaleTest is BaseTest {
    uint256 aC;
    uint256 aD;

    function _settled() internal {
        _runOversubscribed();
        sale.settle(alice);
        sale.settle(bob);
        sale.settle(carol);
        sale.settle(dave);
        sale.settle(erin);
        (aC,,) = sale.allocationOf(carol);
        (aD,,) = sale.allocationOf(dave);
    }

    // ============================================================ escrow

    function test_Escrow_MilestoneRelease() public {
        _settled();
        uint256 funded = escrow.totalFunded();
        (,, uint256 m0,) = escrow.milestone(0);
        (,, uint256 m1,) = escrow.milestone(1);
        uint256 atClose = funded - m0 - m1;
        assertEq(escrow.hostClaimable(), atClose);
        assertEq(escrow.lockedAmount(), m0 + m1);

        uint256 h0 = host.balance;
        vm.prank(host);
        escrow.withdrawHost();
        assertEq(host.balance - h0, atClose);
        vm.prank(host);
        vm.expectRevert(MilestoneEscrow.NothingToClaim.selector);
        escrow.withdrawHost();

        vm.prank(mallory);
        vm.expectRevert(MilestoneEscrow.NotAdmin.selector);
        escrow.releaseMilestone(0);
        vm.prank(mallory);
        vm.expectRevert(MilestoneEscrow.NotHost.selector);
        escrow.withdrawHost();

        vm.prank(ADMIN);
        escrow.releaseMilestone(1);
        vm.prank(ADMIN);
        vm.expectRevert(MilestoneEscrow.AlreadyReleased.selector);
        escrow.releaseMilestone(1);
        vm.prank(ADMIN);
        vm.expectRevert(MilestoneEscrow.InvalidMilestone.selector);
        escrow.releaseMilestone(2);
        assertEq(escrow.hostClaimable(), m1);
        assertEq(escrow.lockedAmount(), m0);
        (string memory label,,, bool released) = escrow.milestone(1);
        assertEq(label, "Audit");
        assertTrue(released);

        vm.prank(ADMIN);
        escrow.releaseMilestone(0);
        h0 = host.balance;
        vm.prank(host);
        escrow.withdrawHost();
        assertEq(host.balance - h0, m0 + m1);
        assertEq(address(escrow).balance, 0);

        // nothing left to protect: votes / refund mode rejected
        vm.prank(alice);
        vm.expectRevert(MilestoneEscrow.NothingLocked.selector);
        escrow.voteRefund();
        vm.prank(ADMIN);
        vm.expectRevert(MilestoneEscrow.NothingLocked.selector);
        escrow.triggerRefundMode();
    }

    function test_Escrow_OnlySaleCanFund() public {
        vm.prank(mallory);
        vm.expectRevert(MilestoneEscrow.NotSale.selector);
        escrow.fund{value: 1 ether}(1);
    }

    function test_Escrow_RefundVote_MajorityEntersRefundMode() public {
        _settled();
        // release one milestone first; only the other one is refundable
        vm.prank(ADMIN);
        escrow.releaseMilestone(0);
        uint256 pool = escrow.lockedAmount();

        // non buyer cannot vote
        vm.prank(erin);
        vm.expectRevert(MilestoneEscrow.NoWeight.selector);
        escrow.voteRefund();

        // alice 400 / 1000: not enough
        vm.prank(alice);
        escrow.voteRefund();
        assertFalse(escrow.refundMode());
        vm.prank(alice);
        vm.expectRevert(MilestoneEscrow.AlreadyVoted.selector);
        escrow.voteRefund();

        // voted position cannot be listed/transferred
        vm.prank(alice);
        vm.expectRevert(VestingVault.TransfersLocked.selector);
        market.list(address(sale), 1e18, 1 ether);

        // bob revokes test: vote, revoke, vote
        vm.prank(bob);
        escrow.voteRefund();
        // 800 / 1000 > 50% -> refund mode
        assertTrue(escrow.refundMode());
        assertEq(escrow.refundPool(), pool);
        assertEq(escrow.lockedAmount(), 0);

        vm.prank(ADMIN);
        vm.expectRevert(MilestoneEscrow.InRefundMode.selector);
        escrow.releaseMilestone(1);

        // pro rata claims by allocation weight
        uint256 a0 = alice.balance;
        vm.prank(alice);
        escrow.claimRefund();
        assertEq(alice.balance - a0, pool * 400e18 / SUPPLY);
        vm.prank(alice);
        vm.expectRevert(MilestoneEscrow.AlreadyClaimed.selector);
        escrow.claimRefund();

        uint256 c0 = carol.balance;
        vm.prank(carol); // carol did not vote but can still claim
        escrow.claimRefund();
        assertEq(carol.balance - c0, pool * aC / SUPPLY);

        vm.prank(bob);
        escrow.claimRefund();
        vm.prank(dave);
        escrow.claimRefund();
        assertLe(address(escrow).balance - escrow.hostClaimable(), 5); // only rounding dust beyond host's released share

        // host keeps what was already released (atClose + milestone 0)
        uint256 h0 = host.balance;
        uint256 owed = escrow.hostClaimable();
        vm.prank(host);
        escrow.withdrawHost();
        assertEq(host.balance - h0, owed);
        assertLe(address(escrow).balance, 5);
    }

    function test_Escrow_RevokeVote() public {
        _settled();
        vm.prank(alice);
        escrow.voteRefund();
        assertEq(escrow.votesFor(), 400e18);
        vm.prank(alice);
        escrow.revokeRefundVote();
        assertEq(escrow.votesFor(), 0);
        vm.prank(alice);
        vm.expectRevert(MilestoneEscrow.NotVoted.selector);
        escrow.revokeRefundVote();
        // after revoke, position is transferable again
        vm.prank(alice);
        market.list(address(sale), 1e18, 1 ether);
    }

    function test_Escrow_AdminTriggersRefundMode() public {
        _settled();
        vm.prank(mallory);
        vm.expectRevert(MilestoneEscrow.NotAdmin.selector);
        escrow.triggerRefundMode();
        uint256 locked = escrow.lockedAmount();
        vm.prank(ADMIN);
        escrow.triggerRefundMode();
        assertTrue(escrow.refundMode());
        assertEq(escrow.refundPool(), locked);
        assertEq(escrow.refundableOf(bob), locked * 400e18 / SUPPLY);
        // transfers locked in refund mode
        vm.prank(bob);
        vm.expectRevert(VestingVault.TransfersLocked.selector);
        market.list(address(sale), 1e18, 1 ether);
    }

    function test_Escrow_PauseBlocks() public {
        _settled();
        vm.prank(ADMIN);
        escrow.pause();
        vm.prank(ADMIN);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.releaseMilestone(0);
        vm.prank(host);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.withdrawHost();
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.voteRefund();
    }

    function test_Reentrancy_ClaimRefundCannotBeReentered() public {
        _settled();
        ReentrantRefunder attacker = new ReentrantRefunder(escrow);
        // attacker acquires part of alice's position via the market
        vm.prank(alice);
        uint256 id = market.list(address(sale), 100e18, 1 ether);
        attacker.exec{value: 1 ether}(address(market), abi.encodeCall(AllocationMarket.buy, (id)));
        assertEq(vault.positionTotal(address(sale), address(attacker)), 100e18);

        vm.prank(ADMIN);
        escrow.triggerRefundMode();
        uint256 pool = escrow.refundPool();
        attacker.claim();
        assertTrue(attacker.reentryAttempted());
        assertFalse(attacker.reentrySucceeded());
        assertEq(address(attacker).balance, pool * 100e18 / SUPPLY);
    }

    // ============================================================ vesting

    function test_Vesting_MathAndClaimToFreshWallet() public {
        _settled();
        address fresh = makeAddr("freshWallet");
        // before TGE nothing
        assertEq(vault.claimable(address(sale), alice), 0);
        vm.prank(alice);
        vm.expectRevert(VestingVault.NothingToClaim.selector);
        vault.claim(address(sale), fresh);

        // at TGE: 10%
        vm.warp(tgeT);
        assertEq(vault.vestedAmount(address(sale), alice), 40e18);
        // during cliff: still 10%
        vm.warp(tgeT + 30 days - 1);
        assertEq(vault.vestedAmount(address(sale), alice), 40e18);
        vm.prank(alice);
        vault.claim(address(sale), fresh);
        assertEq(token.balanceOf(fresh), 40e18);
        assertEq(token.balanceOf(alice), 0);

        // half way through linear: 10% + 90% * 1/2
        vm.warp(tgeT + 30 days + 45 days);
        assertEq(vault.vestedAmount(address(sale), alice), 40e18 + 180e18);
        assertEq(vault.claimable(address(sale), alice), 180e18);
        vm.prank(alice);
        vault.claim(address(sale), fresh);
        assertEq(token.balanceOf(fresh), 220e18);

        // end
        vm.warp(tgeT + 30 days + 90 days + 1);
        assertEq(vault.vestedAmount(address(sale), alice), 400e18);
        vm.prank(alice);
        vault.claim(address(sale), fresh);
        assertEq(token.balanceOf(fresh), 400e18);
        vm.prank(alice);
        vm.expectRevert(VestingVault.NothingToClaim.selector);
        vault.claim(address(sale), fresh);

        // pure schedule helper
        assertEq(vault.vestedAt(address(sale), 1000, tgeT + 30 days + 30 days), 100 + 300);

        // vault claim pausable
        vm.prank(ADMIN);
        vault.pause();
        vm.prank(bob);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.claim(address(sale), bob);
    }

    function test_Vault_Guards() public {
        vm.prank(mallory);
        vm.expectRevert(VestingVault.NotRegisteredSale.selector);
        vault.addPosition(mallory, 1);
        vm.prank(mallory);
        vm.expectRevert(VestingVault.NotFactory.selector);
        vault.registerSale(mallory, address(token), address(0), 0, 0, 0, 0);
        vm.prank(mallory);
        vm.expectRevert(VestingVault.NotMarket.selector);
        vault.transferPosition(address(sale), alice, mallory, 1);
        vm.prank(ADMIN);
        vm.expectRevert(VestingVault.FactoryAlreadySet.selector);
        vault.setFactory(mallory);
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory));
        vault.setMarket(mallory);
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory));
        vault.pause();
    }

    // ============================================================ market

    function test_Market_ListBuyCancel() public {
        _settled();
        // list 100 of alice's 400
        vm.prank(alice);
        uint256 id = market.list(address(sale), 100e18, 5 ether);
        assertEq(vault.positionTotal(address(sale), alice), 300e18);
        assertEq(vault.positionTotal(address(sale), address(market)), 100e18);

        vm.prank(erin);
        vm.expectRevert(abi.encodeWithSelector(AllocationMarket.WrongPayment.selector, 5 ether, 4 ether));
        market.buy{value: 4 ether}(id);

        uint256 s0 = alice.balance;
        uint256 f0 = feeRecipient.balance;
        vm.prank(erin);
        market.buy{value: 5 ether}(id);
        assertEq(vault.positionTotal(address(sale), erin), 100e18);
        assertEq(vault.positionTotal(address(sale), address(market)), 0);
        assertEq(feeRecipient.balance - f0, 0.05 ether);
        assertEq(alice.balance - s0, 4.95 ether);

        vm.prank(bob);
        vm.expectRevert(AllocationMarket.NotActive.selector);
        market.buy{value: 5 ether}(id);

        // buyer vests on the same schedule
        vm.warp(tgeT);
        assertEq(vault.claimable(address(sale), erin), 10e18);

        // cancel flow
        vm.prank(bob);
        uint256 id2 = market.list(address(sale), 50e18, 1 ether);
        vm.prank(mallory);
        vm.expectRevert(AllocationMarket.NotSeller.selector);
        market.cancel(id2);
        vm.prank(bob);
        market.cancel(id2);
        assertEq(vault.positionTotal(address(sale), bob), 400e18);
        vm.prank(bob);
        vm.expectRevert(AllocationMarket.NotActive.selector);
        market.cancel(id2);
        vm.prank(erin);
        vm.expectRevert(AllocationMarket.NotActive.selector);
        market.buy{value: 1 ether}(id2);
    }

    function test_Market_ListMoreThanPositionReverts() public {
        _settled();
        vm.prank(alice);
        vm.expectRevert(VestingVault.InsufficientPosition.selector);
        market.list(address(sale), 401e18, 1 ether);
        vm.prank(alice);
        vm.expectRevert(AllocationMarket.ZeroAmount.selector);
        market.list(address(sale), 1e18, 0);
    }

    function test_Market_CannotListAfterClaiming() public {
        _settled();
        vm.warp(tgeT);
        vm.prank(alice);
        vault.claim(address(sale), alice);
        vm.prank(alice);
        vm.expectRevert(VestingVault.PositionAlreadyClaimed.selector);
        market.list(address(sale), 1e18, 1 ether);
    }

    function test_Market_PauseAndOwnerGuards() public {
        _settled();
        vm.prank(alice);
        uint256 id = market.list(address(sale), 10e18, 1 ether);
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory));
        market.pause();
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory));
        market.setFee(0, mallory);
        vm.prank(ADMIN);
        vm.expectRevert(AllocationMarket.FeeTooHigh.selector);
        market.setFee(1001, feeRecipient);

        vm.prank(ADMIN);
        market.pause();
        vm.prank(bob);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        market.list(address(sale), 1e18, 1 ether);
        vm.prank(bob);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        market.buy{value: 1 ether}(id);
        // seller can still cancel while market is paused
        vm.prank(alice);
        market.cancel(id);
        assertEq(vault.positionTotal(address(sale), alice), 400e18);
    }

    // ============================================================ badge

    function test_Badge_SoulboundOnePerWalletSaleIdOnly() public {
        _runOversubscribed();
        assertEq(badge.balanceOf(alice), 1);
        uint256 id = badge.badgeOf(0, alice);
        assertEq(badge.ownerOf(id), alice);
        assertEq(badge.saleIdOfToken(id), 0);

        vm.startPrank(alice);
        vm.expectRevert(ParticipationBadge.Soulbound.selector);
        badge.transferFrom(alice, bob, id);
        vm.expectRevert(ParticipationBadge.Soulbound.selector);
        badge.safeTransferFrom(alice, bob, id);
        vm.expectRevert(ParticipationBadge.Soulbound.selector);
        badge.approve(bob, id);
        vm.expectRevert(ParticipationBadge.Soulbound.selector);
        badge.setApprovalForAll(bob, true);
        vm.stopPrank();

        // only sales can mint
        vm.prank(mallory);
        vm.expectRevert(ParticipationBadge.NotSale.selector);
        badge.mint(mallory);
        // idempotent per sale/wallet
        vm.prank(address(sale));
        uint256 again = badge.mint(alice);
        assertEq(again, id);
        assertEq(badge.balanceOf(alice), 1);

        // metadata reveals sale id only
        string memory uri = badge.tokenURI(id);
        string memory expectedJson = string.concat(
            '{"name":"Obsid Participation #',
            vm.toString(id),
            '","description":"Soulbound proof of participation in Obsid sale 0.","attributes":[{"trait_type":"Sale ID","value":0}]}'
        );
        assertEq(uri, string.concat("data:application/json;base64,", Base64.encode(bytes(expectedJson))));
    }

    function test_Badge_PausedDoesNotBlockReveal() public {
        vm.prank(ADMIN);
        badge.pause();
        _toCommit(sale);
        _commit(sale, alice, 50, 10e18, 1 ether);
        _toReveal(sale);
        _reveal(sale, alice, 50, 10e18);
        (,,,, bool revealed,) = sale.bids(alice);
        assertTrue(revealed);
        assertEq(badge.balanceOf(alice), 0);
    }

    function test_Badge_OwnerGuards() public {
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory));
        badge.setFactory(mallory);
        vm.prank(ADMIN);
        vm.expectRevert(ParticipationBadge.FactoryAlreadySet.selector);
        badge.setFactory(mallory);
    }

    // ============================================================ locker

    function test_Locker_LockExtendWithdraw() public {
        MockERC20 lp = new MockERC20("LP", "LP");
        lp.mint(host, 100e18);
        vm.startPrank(host);
        lp.approve(address(locker), 100e18);
        vm.expectRevert(LiquidityLocker.InvalidUnlockTime.selector);
        locker.lock(address(lp), 100e18, uint64(block.timestamp), host);
        uint256 id = locker.lock(address(lp), 100e18, uint64(block.timestamp + 365 days), host);
        vm.expectRevert(LiquidityLocker.StillLocked.selector);
        locker.withdraw(id, host);
        vm.expectRevert(LiquidityLocker.InvalidUnlockTime.selector);
        locker.extend(id, uint64(block.timestamp + 100 days)); // shorten not allowed
        locker.extend(id, uint64(block.timestamp + 400 days));
        vm.stopPrank();

        vm.prank(mallory);
        vm.expectRevert(LiquidityLocker.NotLockOwner.selector);
        locker.withdraw(id, mallory);

        vm.warp(block.timestamp + 365 days);
        vm.prank(host);
        vm.expectRevert(LiquidityLocker.StillLocked.selector);
        locker.withdraw(id, host);

        vm.prank(host);
        locker.transferLockOwnership(id, alice);
        vm.warp(block.timestamp + 36 days);
        vm.prank(alice);
        locker.withdraw(id, alice);
        assertEq(lp.balanceOf(alice), 100e18);
        vm.prank(alice);
        vm.expectRevert(LiquidityLocker.AlreadyWithdrawn.selector);
        locker.withdraw(id, alice);
    }

    function test_Locker_PauseBlocksNewLocksButNotWithdraw() public {
        MockERC20 lp = new MockERC20("LP", "LP");
        lp.mint(host, 100e18);
        vm.startPrank(host);
        lp.approve(address(locker), 100e18);
        uint256 id = locker.lock(address(lp), 50e18, uint64(block.timestamp + 1 days), host);
        vm.stopPrank();
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory));
        locker.pause();
        vm.prank(ADMIN);
        locker.pause();
        vm.prank(host);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        locker.lock(address(lp), 50e18, uint64(block.timestamp + 1 days), host);
        vm.warp(block.timestamp + 1 days);
        vm.prank(host);
        locker.withdraw(id, host);
        assertEq(lp.balanceOf(host), 100e18);
    }
}
