// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SealedBidSale} from "./SealedBidSale.sol";
import {MilestoneEscrow} from "./MilestoneEscrow.sol";
import {IVestingVault} from "./interfaces/IObsid.sol";
import {SaleParams} from "./ObsidTypes.sol";

/// @title SaleFactory
/// @notice Admin-curated registry and deployer of Obsid sales. Each sale is a pair of EIP-1167 clones
/// (SealedBidSale + MilestoneEscrow). Admin of every clone = this factory's owner.
contract SaleFactory is Ownable2Step, Pausable {
    uint256 public constant MAX_FEE_BPS = 1000;
    uint256 public constant MAX_TICKS = 200;
    uint256 public constant MAX_MILESTONES = 20;
    uint256 private constant BPS = 10_000;

    address public saleImplementation;
    address public escrowImplementation;
    address public immutable vault;
    address public immutable badge;
    address public babt;
    address public feeRecipient;
    uint16 public platformFeeBps;
    uint256 public maxHardCap; // max gross BNB raise per sale (supply * maxTickPrice / 1e18)

    address[] public allSales;
    mapping(address => bool) public isSale;
    mapping(address => uint256) public saleIdOf;
    mapping(address => address) public escrowOf;

    error ZeroAddress();
    error FeeTooHigh();
    error InvalidParams(string reason);

    event SaleCreated(
        uint256 indexed saleId,
        address indexed sale,
        address indexed escrow,
        address host,
        address saleToken,
        uint256 supply,
        uint256 maxRaise
    );
    event ImplementationsUpdated(address saleImplementation, address escrowImplementation);
    event MaxHardCapUpdated(uint256 maxHardCap);
    event PlatformFeeUpdated(uint16 feeBps, address indexed feeRecipient);
    event BabtUpdated(address indexed babt);

    constructor(
        address admin,
        address saleImpl,
        address escrowImpl,
        address vault_,
        address badge_,
        address babt_,
        address feeRecipient_,
        uint16 feeBps_,
        uint256 maxHardCap_
    ) Ownable(admin) {
        if (
            saleImpl == address(0) || escrowImpl == address(0) || vault_ == address(0) || badge_ == address(0)
                || feeRecipient_ == address(0)
        ) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        saleImplementation = saleImpl;
        escrowImplementation = escrowImpl;
        vault = vault_;
        badge = badge_;
        babt = babt_;
        feeRecipient = feeRecipient_;
        platformFeeBps = feeBps_;
        maxHardCap = maxHardCap_;
        emit ImplementationsUpdated(saleImpl, escrowImpl);
        emit PlatformFeeUpdated(feeBps_, feeRecipient_);
        emit MaxHardCapUpdated(maxHardCap_);
        emit BabtUpdated(babt_);
    }

    // ================================================================ admin settings

    function setMaxHardCap(uint256 cap) external onlyOwner {
        maxHardCap = cap;
        emit MaxHardCapUpdated(cap);
    }

    /// @notice Applies to sales created afterwards (each sale snapshots fee settings at creation).
    function setPlatformFee(uint16 feeBps_, address feeRecipient_) external onlyOwner {
        if (feeRecipient_ == address(0)) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        platformFeeBps = feeBps_;
        feeRecipient = feeRecipient_;
        emit PlatformFeeUpdated(feeBps_, feeRecipient_);
    }

    function setBabt(address babt_) external onlyOwner {
        babt = babt_;
        emit BabtUpdated(babt_);
    }

    /// @notice Applies to sales created afterwards only.
    function setImplementations(address saleImpl, address escrowImpl) external onlyOwner {
        if (saleImpl == address(0) || escrowImpl == address(0)) revert ZeroAddress();
        saleImplementation = saleImpl;
        escrowImplementation = escrowImpl;
        emit ImplementationsUpdated(saleImpl, escrowImpl);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ================================================================ views

    function salesCount() external view returns (uint256) {
        return allSales.length;
    }

    function getSales(uint256 offset, uint256 limit) external view returns (address[] memory out) {
        uint256 n = allSales.length;
        if (offset >= n) return new address[](0);
        uint256 end = Math.min(n, offset + limit);
        out = new address[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            out[i - offset] = allSales[i];
        }
    }

    // ================================================================ create

    function createSale(SaleParams calldata p) external onlyOwner whenNotPaused returns (address sale, address escrow) {
        uint256 maxRaise = _validate(p);

        uint256 saleId = allSales.length;
        sale = Clones.clone(saleImplementation);
        escrow = Clones.clone(escrowImplementation);

        allSales.push(sale);
        isSale[sale] = true;
        saleIdOf[sale] = saleId;
        escrowOf[sale] = escrow;

        MilestoneEscrow(escrow).initialize(
            address(this), sale, p.host, vault, p.atCloseBps, p.milestoneLabels, p.milestoneBps
        );

        SealedBidSale(sale).initialize(
            SealedBidSale.InitParams({
                factory: address(this),
                saleId: saleId,
                host: p.host,
                saleToken: p.saleToken,
                escrow: escrow,
                vault: vault,
                badge: badge,
                babt: babt,
                babtRequired: p.babtRequired,
                feeRecipient: feeRecipient,
                feeBps: platformFeeBps,
                supply: p.supply,
                minPrice: p.minPrice,
                tickSize: p.tickSize,
                numTicks: p.numTicks,
                softCap: p.softCap,
                startTime: p.startTime,
                endTime: p.endTime,
                revealEndTime: p.revealEndTime
            })
        );

        IVestingVault(vault).registerSale(
            sale, p.saleToken, escrow, p.vesting.tgeTime, p.vesting.tgeBps, p.vesting.cliff, p.vesting.duration
        );

        emit SaleCreated(saleId, sale, escrow, p.host, p.saleToken, p.supply, maxRaise);
    }

    function _validate(SaleParams calldata p) private view returns (uint256 maxRaise) {
        if (p.host == address(0) || p.saleToken == address(0)) revert ZeroAddress();
        if (p.supply == 0) revert InvalidParams("supply");
        if (p.minPrice == 0) revert InvalidParams("minPrice");
        if (p.numTicks == 0 || p.numTicks > MAX_TICKS) revert InvalidParams("numTicks");
        if (p.numTicks > 1 && p.tickSize == 0) revert InvalidParams("tickSize");
        if (p.startTime < block.timestamp) revert InvalidParams("startTime");
        if (p.endTime <= p.startTime || p.revealEndTime <= p.endTime) revert InvalidParams("times");
        if (p.vesting.tgeTime < p.revealEndTime) revert InvalidParams("tgeTime");
        if (p.vesting.tgeBps > BPS) revert InvalidParams("tgeBps");
        if (p.babtRequired && babt == address(0)) revert InvalidParams("babt");

        uint256 maxPrice = p.minPrice + uint256(p.numTicks - 1) * p.tickSize;
        maxRaise = Math.mulDiv(p.supply, maxPrice, 1e18);
        if (maxRaise > maxHardCap) revert InvalidParams("hardCap");
        if (p.softCap > maxRaise) revert InvalidParams("softCap");

        uint256 n = p.milestoneLabels.length;
        if (n != p.milestoneBps.length || n > MAX_MILESTONES) revert InvalidParams("milestones");
        uint256 sum = p.atCloseBps;
        for (uint256 i; i < n; ++i) {
            if (p.milestoneBps[i] == 0) revert InvalidParams("milestoneBps");
            sum += p.milestoneBps[i];
        }
        if (sum != BPS) revert InvalidParams("bpsSum");
    }
}
