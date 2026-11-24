// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SaleFactory} from "../src/SaleFactory.sol";
import {SealedBidSale} from "../src/SealedBidSale.sol";
import {MilestoneEscrow} from "../src/MilestoneEscrow.sol";
import {VestingVault} from "../src/VestingVault.sol";
import {ParticipationBadge} from "../src/ParticipationBadge.sol";
import {AllocationMarket} from "../src/AllocationMarket.sol";
import {LiquidityLocker} from "../src/LiquidityLocker.sol";

/// @notice Deploys the full Obsid stack with `ADMIN` as owner and wires the contracts together.
/// No private keys are read by this script. Sign with a hardware wallet / keystore, e.g.:
///   forge script script/Deploy.s.sol --rpc-url https://bsc-dataseed.bnbchain.org --ledger --sender <ADMIN> --broadcast
/// The wiring calls (setFactory / setMarket) are owner-only, so they are executed only when the broadcaster IS
/// the admin; otherwise the script prints the calls the admin must make.
/// Env overrides (all optional): ADMIN, FEE_RECIPIENT, BABT, PLATFORM_FEE_BPS, MARKET_FEE_BPS, MAX_HARD_CAP_WEI
contract Deploy is Script {
    address constant DEFAULT_ADMIN = 0x7d6b84648Fe791b2a2623b8B4D6fbB00ce7daB76;
    address constant DEFAULT_BABT = 0x2B09d47D550061f995A3b5C6F0Fd58005215D7c8; // BSC mainnet BABT (verify!)

    struct Config {
        address admin;
        address feeRecipient;
        address babt;
        uint16 platformFeeBps;
        uint16 marketFeeBps;
        uint256 maxHardCap;
    }

    struct Deployed {
        VestingVault vault;
        ParticipationBadge badge;
        AllocationMarket market;
        LiquidityLocker locker;
        SealedBidSale saleImpl;
        MilestoneEscrow escrowImpl;
        SaleFactory factory;
    }

    function config() public view returns (Config memory c) {
        c.admin = vm.envOr("ADMIN", DEFAULT_ADMIN);
        c.feeRecipient = vm.envOr("FEE_RECIPIENT", c.admin);
        c.babt = vm.envOr("BABT", DEFAULT_BABT);
        c.platformFeeBps = uint16(vm.envOr("PLATFORM_FEE_BPS", uint256(200)));
        c.marketFeeBps = uint16(vm.envOr("MARKET_FEE_BPS", uint256(100)));
        c.maxHardCap = vm.envOr("MAX_HARD_CAP_WEI", uint256(500 ether));
    }

    function run() external returns (Deployed memory d) {
        Config memory c = config();
        vm.startBroadcast();
        d = _deploy(c);
        bool wired = msg.sender == c.admin;
        if (wired) {
            d.vault.setFactory(address(d.factory));
            d.vault.setMarket(address(d.market));
            d.badge.setFactory(address(d.factory));
        }
        vm.stopBroadcast();
        _log(d, wired);
    }

    function _deploy(Config memory c) internal returns (Deployed memory d) {
        d.vault = new VestingVault(c.admin);
        d.badge = new ParticipationBadge(c.admin);
        d.market = new AllocationMarket(c.admin, address(d.vault), c.feeRecipient, c.marketFeeBps);
        d.locker = new LiquidityLocker(c.admin);
        d.saleImpl = new SealedBidSale();
        d.escrowImpl = new MilestoneEscrow();
        d.factory = new SaleFactory(
            c.admin,
            address(d.saleImpl),
            address(d.escrowImpl),
            address(d.vault),
            address(d.badge),
            c.babt,
            c.feeRecipient,
            c.platformFeeBps,
            c.maxHardCap
        );
    }

    function _log(Deployed memory d, bool wired) internal pure {
        console2.log("VestingVault        ", address(d.vault));
        console2.log("ParticipationBadge  ", address(d.badge));
        console2.log("AllocationMarket    ", address(d.market));
        console2.log("LiquidityLocker     ", address(d.locker));
        console2.log("SealedBidSale impl  ", address(d.saleImpl));
        console2.log("MilestoneEscrow impl", address(d.escrowImpl));
        console2.log("SaleFactory         ", address(d.factory));
        if (!wired) {
            console2.log("Broadcaster is not ADMIN. ADMIN must now call:");
            console2.log("  VestingVault.setFactory(factory)");
            console2.log("  VestingVault.setMarket(market)");
            console2.log("  ParticipationBadge.setFactory(factory)");
        }
    }
}
