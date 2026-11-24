// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title LiquidityLocker
/// @notice Time-locks any ERC20 (typically LP tokens). The lock owner can withdraw after unlockTime.
/// Unlock time can only be extended. Pausing blocks new locks and extensions but never withdrawals,
/// so the admin cannot freeze locked funds.
contract LiquidityLocker is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Lock {
        address token;
        address owner;
        uint256 amount;
        uint64 unlockTime;
        bool withdrawn;
    }

    Lock[] internal _locks;

    error ZeroAddress();
    error ZeroAmount();
    error InvalidUnlockTime();
    error NotLockOwner();
    error StillLocked();
    error AlreadyWithdrawn();
    error InvalidLock();

    event Locked(
        uint256 indexed lockId, address indexed token, address indexed owner, uint256 amount, uint64 unlockTime
    );
    event Extended(uint256 indexed lockId, uint64 oldUnlockTime, uint64 newUnlockTime);
    event LockOwnershipTransferred(uint256 indexed lockId, address indexed from, address indexed to);
    event Withdrawn(uint256 indexed lockId, address indexed to, uint256 amount);

    constructor(address admin) Ownable(admin) {}

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function lockCount() external view returns (uint256) {
        return _locks.length;
    }

    function getLock(uint256 lockId) external view returns (Lock memory) {
        if (lockId >= _locks.length) revert InvalidLock();
        return _locks[lockId];
    }

    /// @notice Lock `amount` of `token` (pulled from msg.sender) for `lockOwner` until `unlockTime`.
    /// The recorded amount is the actual balance received (fee-on-transfer safe).
    function lock(address token, uint256 amount, uint64 unlockTime, address lockOwner)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 lockId)
    {
        if (token == address(0) || lockOwner == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (unlockTime <= block.timestamp) revert InvalidUnlockTime();
        uint256 before = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();
        lockId = _locks.length;
        _locks.push(Lock({token: token, owner: lockOwner, amount: received, unlockTime: unlockTime, withdrawn: false}));
        emit Locked(lockId, token, lockOwner, received, unlockTime);
    }

    function extend(uint256 lockId, uint64 newUnlockTime) external whenNotPaused {
        Lock storage l = _get(lockId);
        if (msg.sender != l.owner) revert NotLockOwner();
        if (l.withdrawn) revert AlreadyWithdrawn();
        if (newUnlockTime <= l.unlockTime) revert InvalidUnlockTime();
        emit Extended(lockId, l.unlockTime, newUnlockTime);
        l.unlockTime = newUnlockTime;
    }

    function transferLockOwnership(uint256 lockId, address newOwner) external {
        Lock storage l = _get(lockId);
        if (msg.sender != l.owner) revert NotLockOwner();
        if (newOwner == address(0)) revert ZeroAddress();
        if (l.withdrawn) revert AlreadyWithdrawn();
        l.owner = newOwner;
        emit LockOwnershipTransferred(lockId, msg.sender, newOwner);
    }

    function withdraw(uint256 lockId, address to) external nonReentrant {
        Lock storage l = _get(lockId);
        if (msg.sender != l.owner) revert NotLockOwner();
        if (to == address(0)) revert ZeroAddress();
        if (l.withdrawn) revert AlreadyWithdrawn();
        if (block.timestamp < l.unlockTime) revert StillLocked();
        l.withdrawn = true;
        emit Withdrawn(lockId, to, l.amount);
        IERC20(l.token).safeTransfer(to, l.amount);
    }

    function _get(uint256 lockId) private view returns (Lock storage) {
        if (lockId >= _locks.length) revert InvalidLock();
        return _locks[lockId];
    }
}
