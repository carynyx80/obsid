// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IBalanceOf {
    function balanceOf(address) external view returns (uint256);
}

/// @title ObsidStaking
/// @notice Stake $OBSID to earn a tier. Wallets at or above `gateTier` get access to every gated sale.
/// @dev Doubles as the sale access gate: SaleFactory.setBabt(address(this)) makes every sale created with
///      `babtRequired = true` call `balanceOf(bidder)` here, which returns 1 for wallets with access and 0 otherwise.
///      Optionally also requires the wallet to hold Binance's BABT (KYC) when `requireBabt` is on.
///      Unstaking has a cooldown so stake cannot be flashed in and out around a sale.
contract ObsidStaking is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_TIERS = 10;
    uint64 public constant MAX_COOLDOWN = 30 days;

    struct Pending {
        uint256 amount;
        uint64 readyAt;
    }

    IERC20 public immutable token;
    uint256 public totalStaked;
    mapping(address => uint256) public staked;
    mapping(address => Pending) public pendingUnstake;

    uint256[] internal _thresholds; // ascending; tier n requires staked >= _thresholds[n-1]
    uint8 public gateTier = 1;
    uint64 public cooldown = 7 days;
    address public babt;
    bool public requireBabt;

    event Staked(address indexed user, uint256 amount);
    event UnstakeRequested(address indexed user, uint256 amount, uint64 readyAt);
    event UnstakeCancelled(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, address indexed to, uint256 amount);
    event TiersUpdated(uint256[] thresholds);
    event GateTierUpdated(uint8 tier);
    event CooldownUpdated(uint64 cooldown);
    event BabtUpdated(address babt, bool required);

    error ZeroAmount();
    error ZeroAddress();
    error InsufficientStake();
    error NothingPending();
    error CooldownActive();
    error InvalidTiers();
    error InvalidGateTier();
    error InvalidCooldown();
    error FeeOnTransferNotSupported();

    constructor(address owner_, address token_, uint256[] memory thresholds_) Ownable(owner_) {
        if (token_ == address(0)) revert ZeroAddress();
        token = IERC20(token_);
        _setTiers(thresholds_);
    }

    // ================================================================ users

    function stake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) - before != amount) revert FeeOnTransferNotSupported();
        staked[msg.sender] += amount;
        totalStaked += amount;
        emit Staked(msg.sender, amount);
    }

    /// @notice Move stake into the cooldown queue. It stops counting toward your tier immediately.
    function requestUnstake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (staked[msg.sender] < amount) revert InsufficientStake();
        staked[msg.sender] -= amount;
        totalStaked -= amount;
        Pending storage p = pendingUnstake[msg.sender];
        p.amount += amount;
        p.readyAt = uint64(block.timestamp) + cooldown;
        emit UnstakeRequested(msg.sender, amount, p.readyAt);
    }

    /// @notice Put everything in the cooldown queue back into stake.
    function cancelUnstake() external nonReentrant whenNotPaused {
        Pending storage p = pendingUnstake[msg.sender];
        uint256 amount = p.amount;
        if (amount == 0) revert NothingPending();
        delete pendingUnstake[msg.sender];
        staked[msg.sender] += amount;
        totalStaked += amount;
        emit UnstakeCancelled(msg.sender, amount);
    }

    /// @notice Withdraw tokens whose cooldown has ended. Works even while paused.
    function withdraw(address to) external nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        Pending memory p = pendingUnstake[msg.sender];
        if (p.amount == 0) revert NothingPending();
        if (block.timestamp < p.readyAt) revert CooldownActive();
        delete pendingUnstake[msg.sender];
        token.safeTransfer(to, p.amount);
        emit Withdrawn(msg.sender, to, p.amount);
    }

    // ================================================================ views

    function tierOf(address user) public view returns (uint8 tier) {
        uint256 s = staked[user];
        uint256 n = _thresholds.length;
        for (uint256 i; i < n; ++i) {
            if (s >= _thresholds[i]) tier = uint8(i + 1);
            else break;
        }
    }

    function hasAccess(address user) public view returns (bool) {
        if (tierOf(user) < gateTier) return false;
        if (requireBabt && IBalanceOf(babt).balanceOf(user) == 0) return false;
        return true;
    }

    /// @notice Gate interface used by SealedBidSale: 1 when the wallet has sale access, else 0.
    function balanceOf(address user) external view returns (uint256) {
        return hasAccess(user) ? 1 : 0;
    }

    function thresholds() external view returns (uint256[] memory) {
        return _thresholds;
    }

    // ================================================================ admin

    function setTiers(uint256[] calldata thresholds_) external onlyOwner {
        _setTiers(thresholds_);
    }

    function setGateTier(uint8 tier) external onlyOwner {
        if (tier == 0 || tier > _thresholds.length) revert InvalidGateTier();
        gateTier = tier;
        emit GateTierUpdated(tier);
    }

    function setCooldown(uint64 cooldown_) external onlyOwner {
        if (cooldown_ > MAX_COOLDOWN) revert InvalidCooldown();
        cooldown = cooldown_;
        emit CooldownUpdated(cooldown_);
    }

    function setBabt(address babt_, bool required) external onlyOwner {
        if (required && babt_ == address(0)) revert ZeroAddress();
        babt = babt_;
        requireBabt = required;
        emit BabtUpdated(babt_, required);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _setTiers(uint256[] memory t) internal {
        uint256 n = t.length;
        if (n == 0 || n > MAX_TIERS) revert InvalidTiers();
        for (uint256 i; i < n; ++i) {
            if (t[i] == 0 || (i > 0 && t[i] <= t[i - 1])) revert InvalidTiers();
        }
        _thresholds = t;
        if (gateTier > n) gateTier = uint8(n);
        emit TiersUpdated(t);
    }
}
