// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {BaseTest} from "./utils/Base.t.sol";
import {MockERC20, FeeOnTransferToken} from "./utils/Mocks.sol";
import {ObsidStaking} from "../src/ObsidStaking.sol";
import {SealedBidSale} from "../src/SealedBidSale.sol";
import {SaleParams} from "../src/ObsidTypes.sol";

contract ObsidStakingTest is BaseTest {
    ObsidStaking staking;
    MockERC20 obsid;

    function _tiers() internal pure returns (uint256[] memory t) {
        t = new uint256[](4);
        t[0] = 10_000e18;
        t[1] = 50_000e18;
        t[2] = 250_000e18;
        t[3] = 1_000_000e18;
    }

    function setUp() public override {
        super.setUp();
        obsid = new MockERC20("Obsid", "OBSID");
        staking = new ObsidStaking(ADMIN, address(obsid), _tiers());
        address[3] memory users = [alice, bob, carol];
        for (uint256 i; i < users.length; ++i) {
            obsid.mint(users[i], 2_000_000e18);
            vm.prank(users[i]);
            obsid.approve(address(staking), type(uint256).max);
        }
    }

    function _stake(address who, uint256 amt) internal {
        vm.prank(who);
        staking.stake(amt);
    }

    function test_stake() public {
        _stake(alice, 10_000e18);
        assertEq(staking.staked(alice), 10_000e18);
        assertEq(staking.totalStaked(), 10_000e18);
        assertEq(obsid.balanceOf(address(staking)), 10_000e18);
        vm.prank(alice);
        vm.expectRevert(ObsidStaking.ZeroAmount.selector);
        staking.stake(0);
    }

    function test_tiers() public {
        assertEq(staking.tierOf(alice), 0);
        _stake(alice, 9_999e18);
        assertEq(staking.tierOf(alice), 0);
        _stake(alice, 1e18);
        assertEq(staking.tierOf(alice), 1);
        _stake(alice, 40_000e18);
        assertEq(staking.tierOf(alice), 2);
        _stake(alice, 200_000e18);
        assertEq(staking.tierOf(alice), 3);
        _stake(alice, 750_000e18);
        assertEq(staking.tierOf(alice), 4);
        assertEq(staking.thresholds().length, 4);
    }

    function test_balanceOfGate() public {
        assertEq(staking.balanceOf(alice), 0);
        _stake(alice, 10_000e18);
        assertEq(staking.balanceOf(alice), 1);
        vm.prank(ADMIN);
        staking.setGateTier(2);
        assertEq(staking.balanceOf(alice), 0);
        _stake(alice, 40_000e18);
        assertEq(staking.balanceOf(alice), 1);
    }

    function test_requestUnstakeReducesTierImmediately() public {
        _stake(alice, 50_000e18);
        assertEq(staking.tierOf(alice), 2);
        vm.prank(alice);
        staking.requestUnstake(45_000e18);
        assertEq(staking.tierOf(alice), 0);
        assertEq(staking.balanceOf(alice), 0);
        assertEq(staking.totalStaked(), 5_000e18);
        (uint256 amt, uint64 readyAt) = staking.pendingUnstake(alice);
        assertEq(amt, 45_000e18);
        assertEq(readyAt, block.timestamp + 7 days);
        vm.prank(alice);
        vm.expectRevert(ObsidStaking.InsufficientStake.selector);
        staking.requestUnstake(10_000e18);
    }

    function test_withdrawBeforeCooldownReverts() public {
        _stake(alice, 10_000e18);
        vm.prank(alice);
        staking.requestUnstake(10_000e18);
        vm.warp(block.timestamp + 7 days - 1);
        vm.prank(alice);
        vm.expectRevert(ObsidStaking.CooldownActive.selector);
        staking.withdraw(alice);
    }

    function test_withdrawAfterCooldown() public {
        _stake(alice, 10_000e18);
        vm.prank(alice);
        staking.requestUnstake(10_000e18);
        vm.warp(block.timestamp + 7 days);
        uint256 before = obsid.balanceOf(bob);
        vm.prank(alice);
        staking.withdraw(bob);
        assertEq(obsid.balanceOf(bob) - before, 10_000e18);
        (uint256 amt,) = staking.pendingUnstake(alice);
        assertEq(amt, 0);
        vm.prank(alice);
        vm.expectRevert(ObsidStaking.NothingPending.selector);
        staking.withdraw(alice);
        vm.prank(alice);
        vm.expectRevert(ObsidStaking.ZeroAddress.selector);
        staking.withdraw(address(0));
    }

    function test_cancelUnstake() public {
        _stake(alice, 50_000e18);
        vm.prank(alice);
        staking.requestUnstake(50_000e18);
        assertEq(staking.tierOf(alice), 0);
        vm.prank(alice);
        staking.cancelUnstake();
        assertEq(staking.staked(alice), 50_000e18);
        assertEq(staking.totalStaked(), 50_000e18);
        assertEq(staking.tierOf(alice), 2);
        vm.prank(alice);
        vm.expectRevert(ObsidStaking.NothingPending.selector);
        staking.cancelUnstake();
    }

    function test_requireBabtCombo() public {
        _stake(alice, 10_000e18);
        vm.prank(ADMIN);
        staking.setBabt(address(babt), true);
        assertEq(staking.balanceOf(alice), 0);
        babt.set(alice, 1);
        assertEq(staking.balanceOf(alice), 1);
        // BABT alone without stake is not enough
        babt.set(bob, 1);
        assertEq(staking.balanceOf(bob), 0);
        vm.prank(ADMIN);
        staking.setBabt(address(0), false);
        babt.set(alice, 0);
        assertEq(staking.balanceOf(alice), 1);
        vm.prank(ADMIN);
        vm.expectRevert(ObsidStaking.ZeroAddress.selector);
        staking.setBabt(address(0), true);
    }

    function test_pauseBlocksStakeNotWithdraw() public {
        _stake(alice, 20_000e18);
        vm.prank(alice);
        staking.requestUnstake(10_000e18);
        vm.prank(ADMIN);
        staking.pause();
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        staking.stake(1e18);
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        staking.cancelUnstake();
        vm.prank(alice);
        staking.requestUnstake(10_000e18);
        vm.warp(block.timestamp + 7 days);
        vm.prank(alice);
        staking.withdraw(alice);
        assertEq(staking.staked(alice), 0);
        vm.prank(ADMIN);
        staking.unpause();
        _stake(alice, 1e18);
    }

    function test_invalidTiers() public {
        uint256[] memory empty = new uint256[](0);
        vm.expectRevert(ObsidStaking.InvalidTiers.selector);
        new ObsidStaking(ADMIN, address(obsid), empty);

        uint256[] memory zero = new uint256[](1);
        vm.expectRevert(ObsidStaking.InvalidTiers.selector);
        new ObsidStaking(ADMIN, address(obsid), zero);

        uint256[] memory desc = new uint256[](2);
        desc[0] = 2;
        desc[1] = 1;
        vm.prank(ADMIN);
        vm.expectRevert(ObsidStaking.InvalidTiers.selector);
        staking.setTiers(desc);

        uint256[] memory eq = new uint256[](2);
        eq[0] = 1;
        eq[1] = 1;
        vm.prank(ADMIN);
        vm.expectRevert(ObsidStaking.InvalidTiers.selector);
        staking.setTiers(eq);

        uint256[] memory tooMany = new uint256[](11);
        for (uint256 i; i < 11; ++i) tooMany[i] = i + 1;
        vm.prank(ADMIN);
        vm.expectRevert(ObsidStaking.InvalidTiers.selector);
        staking.setTiers(tooMany);

        vm.expectRevert(ObsidStaking.ZeroAddress.selector);
        new ObsidStaking(ADMIN, address(0), _tiers());

        // shrinking tiers clamps gateTier
        vm.prank(ADMIN);
        staking.setGateTier(4);
        uint256[] memory two = new uint256[](2);
        two[0] = 1;
        two[1] = 2;
        vm.prank(ADMIN);
        staking.setTiers(two);
        assertEq(staking.gateTier(), 2);

        vm.startPrank(ADMIN);
        vm.expectRevert(ObsidStaking.InvalidGateTier.selector);
        staking.setGateTier(0);
        vm.expectRevert(ObsidStaking.InvalidGateTier.selector);
        staking.setGateTier(3);
        vm.expectRevert(ObsidStaking.InvalidCooldown.selector);
        staking.setCooldown(30 days + 1);
        staking.setCooldown(1 days);
        vm.stopPrank();
        assertEq(staking.cooldown(), 1 days);
    }

    function test_onlyOwner() public {
        vm.startPrank(mallory);
        bytes memory err = abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory);
        vm.expectRevert(err);
        staking.setTiers(_tiers());
        vm.expectRevert(err);
        staking.setGateTier(1);
        vm.expectRevert(err);
        staking.setCooldown(1);
        vm.expectRevert(err);
        staking.setBabt(address(babt), true);
        vm.expectRevert(err);
        staking.pause();
        vm.expectRevert(err);
        staking.unpause();
        vm.stopPrank();
    }

    function test_feeOnTransferRejected() public {
        FeeOnTransferToken fot = new FeeOnTransferToken();
        ObsidStaking s = new ObsidStaking(ADMIN, address(fot), _tiers());
        fot.mint(alice, 100e18);
        vm.startPrank(alice);
        fot.approve(address(s), type(uint256).max);
        vm.expectRevert(ObsidStaking.FeeOnTransferNotSupported.selector);
        s.stake(100e18);
        vm.stopPrank();
    }

    function test_integration_factoryGate() public {
        vm.prank(ADMIN);
        factory.setBabt(address(staking));
        SaleParams memory p = _defaultParams();
        p.babtRequired = true;
        (SealedBidSale s,) = _createSale(p);
        _fund(s);
        assertEq(s.babt(), address(staking));

        _stake(alice, 10_000e18);
        _toCommit(s);

        bytes32 c = keccak256(abi.encodePacked(uint256(10), uint256(100e18), _salt(bob), bob));
        vm.prank(bob);
        vm.expectRevert(SealedBidSale.NotBABTHolder.selector);
        s.commit{value: 1 ether}(c);

        _commit(s, alice, 10, 100e18, 1 ether);
        (bytes32 commitment,,,,,) = s.bids(alice);
        assertTrue(commitment != bytes32(0));

        // the sale created before setBabt still points at the old BABT
        assertEq(sale.babt(), address(babt));
    }
}
