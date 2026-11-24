// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IVestingVault} from "./interfaces/IObsid.sol";

/// @title AllocationMarket
/// @notice Fixed-price OTC market for VestingVault positions. The listed portion is escrowed (moved to this
/// contract's vault position) until bought or cancelled. v1: listing price is public on-chain.
contract AllocationMarket is Ownable2Step, Pausable, ReentrancyGuard {
    uint256 public constant MAX_FEE_BPS = 1000;
    uint256 private constant BPS = 10_000;

    struct Listing {
        address seller;
        address sale;
        uint256 amount; // token wei of vesting position
        uint256 price; // total price in BNB wei
        bool active;
    }

    IVestingVault public immutable vault;
    uint16 public feeBps;
    address public feeRecipient;
    Listing[] internal _listings;

    error ZeroAddress();
    error ZeroAmount();
    error FeeTooHigh();
    error InvalidListing();
    error NotActive();
    error NotSeller();
    error WrongPayment(uint256 expected, uint256 sent);

    event FeeUpdated(uint16 feeBps, address indexed feeRecipient);
    event Listed(uint256 indexed listingId, address indexed seller, address indexed sale, uint256 amount, uint256 price);
    event Bought(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price, uint256 fee);
    event Cancelled(uint256 indexed listingId, address indexed seller);

    constructor(address admin, address vault_, address feeRecipient_, uint16 feeBps_) Ownable(admin) {
        if (vault_ == address(0) || feeRecipient_ == address(0)) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        vault = IVestingVault(vault_);
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
        emit FeeUpdated(feeBps_, feeRecipient_);
    }

    function setFee(uint16 feeBps_, address feeRecipient_) external onlyOwner {
        if (feeRecipient_ == address(0)) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
        emit FeeUpdated(feeBps_, feeRecipient_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function listingCount() external view returns (uint256) {
        return _listings.length;
    }

    function getListing(uint256 id) external view returns (Listing memory) {
        if (id >= _listings.length) revert InvalidListing();
        return _listings[id];
    }

    /// @notice List `amount` of your (never-claimed) vesting position in `sale` for `price` BNB wei.
    function list(address sale, uint256 amount, uint256 price) external nonReentrant whenNotPaused returns (uint256 id) {
        if (amount == 0 || price == 0) revert ZeroAmount();
        id = _listings.length;
        _listings.push(Listing({seller: msg.sender, sale: sale, amount: amount, price: price, active: true}));
        emit Listed(id, msg.sender, sale, amount, price);
        vault.transferPosition(sale, msg.sender, address(this), amount);
    }

    /// @notice Buy a listing by paying exactly its price.
    function buy(uint256 id) external payable nonReentrant whenNotPaused {
        Listing storage l = _get(id);
        if (!l.active) revert NotActive();
        if (msg.value != l.price) revert WrongPayment(l.price, msg.value);
        l.active = false;
        uint256 fee = msg.value * feeBps / BPS;
        emit Bought(id, msg.sender, l.seller, msg.value, fee);
        vault.transferPosition(l.sale, address(this), msg.sender, l.amount);
        if (fee > 0) Address.sendValue(payable(feeRecipient), fee);
        Address.sendValue(payable(l.seller), msg.value - fee);
    }

    /// @notice Seller cancels and gets the escrowed position back. Not pausable on the market side.
    function cancel(uint256 id) external nonReentrant {
        Listing storage l = _get(id);
        if (!l.active) revert NotActive();
        if (msg.sender != l.seller) revert NotSeller();
        l.active = false;
        emit Cancelled(id, msg.sender);
        vault.transferPosition(l.sale, address(this), l.seller, l.amount);
    }

    function _get(uint256 id) private view returns (Listing storage) {
        if (id >= _listings.length) revert InvalidListing();
        return _listings[id];
    }
}
