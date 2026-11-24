// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SaleFactory} from "../../src/SaleFactory.sol";
import {SealedBidSale} from "../../src/SealedBidSale.sol";
import {MilestoneEscrow} from "../../src/MilestoneEscrow.sol";
import {VestingVault} from "../../src/VestingVault.sol";
import {ParticipationBadge} from "../../src/ParticipationBadge.sol";
import {AllocationMarket} from "../../src/AllocationMarket.sol";
import {LiquidityLocker} from "../../src/LiquidityLocker.sol";
import {SaleParams, VestingParams} from "../../src/ObsidTypes.sol";
import {MockERC20, MockBABT} from "./Mocks.sol";

abstract contract BaseTest is Test {
    address constant ADMIN = 0x7d6b84648Fe791b2a2623b8B4D6fbB00ce7daB76;
    address feeRecipient = makeAddr("feeRecipient");
    address host = makeAddr("host");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave");
    address erin = makeAddr("erin");
    address mallory = makeAddr("mallory");

    uint16 constant FEE_BPS = 200; // 2%
    uint16 constant MARKET_FEE_BPS = 100; // 1%

    SaleFactory factory;
    VestingVault vault;
    ParticipationBadge badge;
    AllocationMarket market;
    LiquidityLocker locker;
    MockBABT babt;
    MockERC20 token;

    SealedBidSale sale;
    MilestoneEscrow escrow;

    uint256 constant SUPPLY = 1000e18;
    uint256 constant MIN_PRICE = 0.01 ether;
    uint256 constant TICK = 0.001 ether;
    uint16 constant NUM_TICKS = 100;
    uint256 constant SOFT_CAP = 2 ether;

    uint64 startT;
    uint64 endT;
    uint64 revealEndT;
    uint64 tgeT;

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        babt = new MockBABT();
        vault = new VestingVault(ADMIN);
        badge = new ParticipationBadge(ADMIN);
        market = new AllocationMarket(ADMIN, address(vault), feeRecipient, MARKET_FEE_BPS);
        locker = new LiquidityLocker(ADMIN);
        SealedBidSale saleImpl = new SealedBidSale();
        MilestoneEscrow escrowImpl = new MilestoneEscrow();
        factory = new SaleFactory(
            ADMIN,
            address(saleImpl),
            address(escrowImpl),
            address(vault),
            address(badge),
            address(babt),
            feeRecipient,
            FEE_BPS,
            1000 ether
        );
        vm.startPrank(ADMIN);
        vault.setFactory(address(factory));
        vault.setMarket(address(market));
        badge.setFactory(address(factory));
        vm.stopPrank();

        token = new MockERC20("Project", "PRJ");
        token.mint(host, 10_000_000e18);

        address[8] memory people = [alice, bob, carol, dave, erin, mallory, host, ADMIN];
        for (uint256 i; i < people.length; ++i) {
            vm.deal(people[i], 1000 ether);
        }

        (sale, escrow) = _createSale(_defaultParams());
        _fund(sale);
    }

    function _defaultParams() internal returns (SaleParams memory p) {
        startT = uint64(block.timestamp + 1 hours);
        endT = startT + 1 days;
        revealEndT = endT + 1 days;
        tgeT = revealEndT + 1 hours;
        string[] memory labels = new string[](2);
        labels[0] = "Mainnet launch";
        labels[1] = "Audit";
        uint16[] memory bps = new uint16[](2);
        bps[0] = 3000;
        bps[1] = 3000;
        p = SaleParams({
            host: host,
            saleToken: address(token),
            supply: SUPPLY,
            minPrice: MIN_PRICE,
            tickSize: TICK,
            numTicks: NUM_TICKS,
            softCap: SOFT_CAP,
            startTime: startT,
            endTime: endT,
            revealEndTime: revealEndT,
            babtRequired: false,
            vesting: VestingParams({tgeTime: tgeT, tgeBps: 1000, cliff: 30 days, duration: 90 days}),
            atCloseBps: 4000,
            milestoneLabels: labels,
            milestoneBps: bps
        });
    }

    function _createSale(SaleParams memory p) internal returns (SealedBidSale s, MilestoneEscrow e) {
        vm.prank(ADMIN);
        (address sa, address ea) = factory.createSale(p);
        s = SealedBidSale(sa);
        e = MilestoneEscrow(ea);
    }

    function _fund(SealedBidSale s) internal {
        vm.startPrank(host);
        token.approve(address(s), s.supply());
        s.fund();
        vm.stopPrank();
    }

    function _salt(address who) internal pure returns (bytes32) {
        return keccak256(abi.encode("salt", who));
    }

    function _commit(SealedBidSale s, address who, uint256 tick, uint256 amount, uint256 deposit) internal {
        bytes32 c = keccak256(abi.encodePacked(tick, amount, _salt(who), who));
        vm.prank(who);
        s.commit{value: deposit}(c);
    }

    function _reveal(SealedBidSale s, address who, uint256 tick, uint256 amount) internal {
        vm.prank(who);
        s.reveal(tick, amount, _salt(who));
    }

    function _toReveal(SealedBidSale s) internal {
        vm.warp(s.endTime());
    }

    function _toCommit(SealedBidSale s) internal {
        vm.warp(s.startTime());
    }

    function _toFinalize(SealedBidSale s) internal {
        vm.warp(s.revealEndTime());
    }

    /// Oversubscribed scenario used by several tests. Clearing tick 30 (0.04 BNB), marginal pro rata.
    function _runOversubscribed() internal {
        _toCommit(sale);
        _commit(sale, alice, 50, 400e18, 30 ether);
        _commit(sale, bob, 40, 400e18, 20 ether);
        _commit(sale, carol, 30, 300e18, 15 ether);
        _commit(sale, dave, 30, 600e18, 24 ether);
        _commit(sale, erin, 10, 500e18, 10 ether);
        _toReveal(sale);
        _reveal(sale, alice, 50, 400e18);
        _reveal(sale, bob, 40, 400e18);
        _reveal(sale, carol, 30, 300e18);
        _reveal(sale, dave, 30, 600e18);
        _reveal(sale, erin, 10, 500e18);
        _toFinalize(sale);
        sale.finalize();
    }
}
