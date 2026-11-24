// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IMilestoneEscrow} from "./interfaces/IObsid.sol";

/// @title VestingVault
/// @notice Holds allocated sale tokens for all Obsid sales and vests them per sale schedule.
/// Positions are keyed by (sale, holder). Holders may claim to any address (e.g. a fresh wallet).
/// The AllocationMarket can move unclaimed portions of positions between holders.
contract VestingVault is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;

    struct Schedule {
        address token;
        address escrow;
        uint64 tgeTime;
        uint16 tgeBps;
        uint64 cliff;
        uint64 duration;
        bool registered;
    }

    struct Position {
        uint256 total; // allocation weight (includes claimed part)
        uint256 claimed;
    }

    address public factory;
    address public market;
    mapping(address sale => Schedule) public schedules;
    mapping(address sale => mapping(address holder => Position)) public positions;
    mapping(address sale => uint256) public totalAllocated;

    error NotFactory();
    error NotMarket();
    error NotRegisteredSale();
    error AlreadyRegistered();
    error FactoryAlreadySet();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientPosition();
    error PositionAlreadyClaimed();
    error NothingToClaim();
    error TransfersLocked();
    error FeeOnTransferNotSupported();

    event FactorySet(address indexed factory);
    event MarketSet(address indexed market);
    event SaleRegistered(
        address indexed sale, address indexed token, address escrow, uint64 tgeTime, uint16 tgeBps, uint64 cliff, uint64 duration
    );
    event PositionAdded(address indexed sale, address indexed beneficiary, uint256 amount);
    event Claimed(address indexed sale, address indexed holder, address indexed to, uint256 amount);
    event PositionTransferred(address indexed sale, address indexed from, address indexed to, uint256 amount);

    constructor(address admin) Ownable(admin) {}

    // ================================================================ admin

    /// @notice One-time wiring of the SaleFactory.
    function setFactory(address factory_) external onlyOwner {
        if (factory != address(0)) revert FactoryAlreadySet();
        if (factory_ == address(0)) revert ZeroAddress();
        factory = factory_;
        emit FactorySet(factory_);
    }

    function setMarket(address market_) external onlyOwner {
        market = market_;
        emit MarketSet(market_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ================================================================ factory / sale

    function registerSale(
        address sale,
        address token,
        address escrow,
        uint64 tgeTime,
        uint16 tgeBps,
        uint64 cliff,
        uint64 duration
    ) external {
        if (msg.sender != factory) revert NotFactory();
        if (schedules[sale].registered) revert AlreadyRegistered();
        schedules[sale] = Schedule(token, escrow, tgeTime, tgeBps, cliff, duration, true);
        emit SaleRegistered(sale, token, escrow, tgeTime, tgeBps, cliff, duration);
    }

    /// @notice Called by a registered sale during settlement; pulls `amount` sale tokens from the sale.
    /// Not pausable so settlement cannot be blocked by the vault.
    function addPosition(address beneficiary, uint256 amount) external nonReentrant {
        Schedule storage s = schedules[msg.sender];
        if (!s.registered) revert NotRegisteredSale();
        if (amount == 0) revert ZeroAmount();
        IERC20 token = IERC20(s.token);
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) - before != amount) revert FeeOnTransferNotSupported();
        positions[msg.sender][beneficiary].total += amount;
        totalAllocated[msg.sender] += amount;
        emit PositionAdded(msg.sender, beneficiary, amount);
    }

    // ================================================================ views

    function positionTotal(address sale, address holder) external view returns (uint256) {
        return positions[sale][holder].total;
    }

    function vestedAmount(address sale, address holder) public view returns (uint256) {
        return _vested(schedules[sale], positions[sale][holder].total, block.timestamp);
    }

    function vestedAt(address sale, uint256 total, uint256 timestamp) external view returns (uint256) {
        return _vested(schedules[sale], total, timestamp);
    }

    function claimable(address sale, address holder) public view returns (uint256) {
        Position storage p = positions[sale][holder];
        uint256 v = _vested(schedules[sale], p.total, block.timestamp);
        return v > p.claimed ? v - p.claimed : 0;
    }

    // ================================================================ holders

    /// @notice Claim all currently vested tokens of `sale` to `to` (any address, e.g. a fresh wallet).
    function claim(address sale, address to) external nonReentrant whenNotPaused returns (uint256 amount) {
        if (to == address(0)) revert ZeroAddress();
        amount = claimable(sale, msg.sender);
        if (amount == 0) revert NothingToClaim();
        positions[sale][msg.sender].claimed += amount;
        emit Claimed(sale, msg.sender, to, amount);
        IERC20(schedules[sale].token).safeTransfer(to, amount);
    }

    // ================================================================ market

    /// @notice Move `amount` of `from`'s position to `to`. Only callable by the AllocationMarket.
    /// Only positions that have never been claimed from (claimed == 0) can be moved: this keeps the invariant
    /// claimed <= vested(total) for every position, so transfers can never accelerate vesting. The recipient's
    /// slice vests on the same schedule. Blocked (except out of the market itself) while `from` has an active
    /// refund vote or the sale escrow is in refund mode, to prevent double voting / double refunds.
    function transferPosition(address sale, address from, address to, uint256 amount) external whenNotPaused {
        if (msg.sender != market) revert NotMarket();
        Schedule storage s = schedules[sale];
        if (!s.registered) revert NotRegisteredSale();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (from != market) {
            IMilestoneEscrow e = IMilestoneEscrow(s.escrow);
            if (e.refundMode() || e.votedWeight(from) != 0) revert TransfersLocked();
        }
        Position storage pf = positions[sale][from];
        if (pf.claimed != 0) revert PositionAlreadyClaimed();
        if (pf.total < amount) revert InsufficientPosition();
        pf.total -= amount;
        positions[sale][to].total += amount;
        emit PositionTransferred(sale, from, to, amount);
    }

    // ================================================================ internal

    function _vested(Schedule storage s, uint256 total, uint256 t) private view returns (uint256) {
        if (total == 0 || t < s.tgeTime) return 0;
        uint256 tgePart = total * s.tgeBps / BPS;
        uint256 linearStart = uint256(s.tgeTime) + s.cliff;
        if (t < linearStart) return tgePart;
        if (s.duration == 0) return total;
        uint256 elapsed = Math.min(t - linearStart, s.duration);
        return tgePart + Math.mulDiv(total - tgePart, elapsed, s.duration);
    }
}
