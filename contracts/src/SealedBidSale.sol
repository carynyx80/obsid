// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {
    IBABT,
    ISaleFactory,
    IVestingVault,
    IMilestoneEscrow,
    IParticipationBadge
} from "./interfaces/IObsid.sol";

/// @title SealedBidSale
/// @notice Uniform-price sealed-bid (commit/reveal) token sale on a bounded price-tick grid.
/// Deployed as an EIP-1167 clone by SaleFactory; admin = SaleFactory.owner().
///
/// Lifecycle:
///   fund()      host deposits `supply` sale tokens before startTime
///   commit()    [startTime, endTime)      bidder posts commitment + BNB deposit (one commitment per bidder,
///                                         may be replaced and deposit topped up during the commit phase)
///   reveal()    [endTime, revealEndTime)  bidder opens commitment; demand is added to its price tick
///   finalize()  >= revealEndTime          anyone; computes clearing price, routes BNB to fee + escrow
///   settle()    after finalize            per bidder: allocation -> VestingVault, excess BNB refunded
contract SealedBidSale is Initializable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_TICKS = 200;
    uint256 private constant ONE = 1e18;
    uint256 private constant BPS = 10_000;

    enum State {
        Pending,
        Succeeded,
        Failed
    }

    struct Bid {
        bytes32 commitment;
        uint256 deposit;
        uint256 amount;
        uint16 tick;
        bool revealed;
        bool settled;
    }

    struct InitParams {
        address factory;
        uint256 saleId;
        address host;
        address saleToken;
        address escrow;
        address vault;
        address badge;
        address babt;
        bool babtRequired;
        address feeRecipient;
        uint16 feeBps;
        uint256 supply;
        uint256 minPrice;
        uint256 tickSize;
        uint16 numTicks;
        uint256 softCap;
        uint64 startTime;
        uint64 endTime;
        uint64 revealEndTime;
    }

    // ---------------------------------------------------------------- config
    address public factory;
    uint256 public saleId;
    address public host;
    IERC20 public saleToken;
    address public escrow;
    address public vault;
    address public badge;
    address public babt;
    bool public babtRequired;
    address public feeRecipient;
    uint16 public feeBps;
    uint256 public supply;
    uint256 public minPrice;
    uint256 public tickSize;
    uint16 public numTicks;
    uint256 public softCap;
    uint64 public startTime;
    uint64 public endTime;
    uint64 public revealEndTime;

    // ---------------------------------------------------------------- state
    State public state;
    bool public funded;
    bool public unsoldWithdrawn;
    uint256 public totalDeposits; // BNB currently owed to bidders + raise (decreases on settle)
    uint256 public numBidders;
    uint256 public numRevealed;
    mapping(address => Bid) public bids;
    mapping(uint256 => uint256) public demandAtTick; // token wei demanded at tick
    mapping(uint256 => uint256) public biddersAtTick;

    // ---------------------------------------------------------------- results
    uint16 public clearingTick;
    uint256 public clearingPrice;
    uint256 public totalSold; // token wei sold (upper bound of sum of allocations; marginal rounding dust stays here)
    uint256 public marginalFill; // token wei filled at the clearing tick
    uint256 public marginalDemand; // token wei demanded at the clearing tick
    uint256 public raised; // gross BNB routed out of this contract (fee + escrow)
    uint256 public platformFee;

    // ---------------------------------------------------------------- errors
    error NotAdmin();
    error NotHost();
    error WrongPhase();
    error AlreadyFunded();
    error NotFunded();
    error ZeroValue();
    error ZeroCommitment();
    error NotBABTHolder();
    error NoCommitment();
    error AlreadyRevealed();
    error InvalidReveal();
    error InvalidTick();
    error ZeroAmount();
    error DepositTooSmall(uint256 required, uint256 deposit);
    error AlreadyFinalized();
    error NotFinalized();
    error AlreadySettled();
    error AlreadyWithdrawn();
    error FeeOnTransferNotSupported();

    // ---------------------------------------------------------------- events
    event Initialized(uint256 indexed saleId, address indexed host, address indexed saleToken, address escrow);
    event Funded(address indexed from, uint256 amount);
    event Committed(address indexed bidder, bytes32 commitment, uint256 added, uint256 totalDeposit);
    event Revealed(address indexed bidder, uint16 tick, uint256 amount);
    event BadgeMintFailed(address indexed bidder);
    event Finalized(
        bool succeeded, uint16 clearingTick, uint256 clearingPrice, uint256 totalSold, uint256 raised, uint256 fee
    );
    event Cancelled(address indexed by);
    event Settled(address indexed bidder, uint256 allocation, uint256 payment, uint256 refund);
    event UnsoldWithdrawn(address indexed host, uint256 amount);

    modifier onlyAdmin() {
        if (msg.sender != ISaleFactory(factory).owner()) revert NotAdmin();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    /// @notice Called exactly once by SaleFactory in the clone-creation transaction.
    function initialize(InitParams calldata p) external initializer {
        factory = p.factory;
        saleId = p.saleId;
        host = p.host;
        saleToken = IERC20(p.saleToken);
        escrow = p.escrow;
        vault = p.vault;
        badge = p.badge;
        babt = p.babt;
        babtRequired = p.babtRequired;
        feeRecipient = p.feeRecipient;
        feeBps = p.feeBps;
        supply = p.supply;
        minPrice = p.minPrice;
        tickSize = p.tickSize;
        numTicks = p.numTicks;
        softCap = p.softCap;
        startTime = p.startTime;
        endTime = p.endTime;
        revealEndTime = p.revealEndTime;
        emit Initialized(p.saleId, p.host, p.saleToken, p.escrow);
    }

    // ================================================================ views

    function priceAt(uint256 tick) public view returns (uint256) {
        if (tick >= numTicks) revert InvalidTick();
        return minPrice + tick * tickSize;
    }

    /// @notice Commitment helper (identical to the on-chain check).
    function computeCommitment(uint256 priceTick, uint256 amount, bytes32 salt, address bidder)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(priceTick, amount, salt, bidder));
    }

    function isSucceeded() external view returns (bool) {
        return state == State.Succeeded;
    }

    /// @notice Allocation (token wei), payment (BNB wei) and refund (BNB wei) for `bidder`.
    /// Valid once the sale is finalized/cancelled; before that returns zeros.
    function allocationOf(address bidder) public view returns (uint256 allocation, uint256 payment, uint256 refund) {
        Bid storage b = bids[bidder];
        (allocation, payment) = _allocation(b);
        refund = b.settled ? 0 : b.deposit - payment;
    }

    // ================================================================ host

    /// @notice Deposit exactly `supply` sale tokens. Pulls from msg.sender (normally the host).
    function fund() external nonReentrant whenNotPaused {
        if (funded) revert AlreadyFunded();
        if (state != State.Pending || block.timestamp >= startTime) revert WrongPhase();
        funded = true;
        uint256 before = saleToken.balanceOf(address(this));
        saleToken.safeTransferFrom(msg.sender, address(this), supply);
        if (saleToken.balanceOf(address(this)) - before != supply) revert FeeOnTransferNotSupported();
        emit Funded(msg.sender, supply);
    }

    /// @notice Host withdraws unsold tokens (or the full supply if the sale failed/was cancelled).
    function withdrawUnsold() external nonReentrant {
        if (msg.sender != host) revert NotHost();
        if (state == State.Pending) revert NotFinalized();
        if (unsoldWithdrawn) revert AlreadyWithdrawn();
        unsoldWithdrawn = true;
        uint256 amount = funded ? (state == State.Failed ? supply : supply - totalSold) : 0;
        if (amount > 0) saleToken.safeTransfer(host, amount);
        emit UnsoldWithdrawn(host, amount);
    }

    // ================================================================ bidders

    /// @notice Post (or replace) a sealed commitment and add BNB to the deposit.
    /// commitment = keccak256(abi.encodePacked(uint256 priceTick, uint256 amount, bytes32 salt, address bidder))
    /// NOTE: the deposit is public; deposit more than the bid needs to hide the bid size.
    function commit(bytes32 commitment) external payable nonReentrant whenNotPaused {
        if (state != State.Pending || block.timestamp < startTime || block.timestamp >= endTime) revert WrongPhase();
        if (!funded) revert NotFunded();
        if (msg.value == 0) revert ZeroValue();
        if (commitment == bytes32(0)) revert ZeroCommitment();
        if (babtRequired && IBABT(babt).balanceOf(msg.sender) == 0) revert NotBABTHolder();

        Bid storage b = bids[msg.sender];
        if (b.commitment == bytes32(0)) numBidders++;
        b.commitment = commitment;
        b.deposit += msg.value;
        totalDeposits += msg.value;
        emit Committed(msg.sender, commitment, msg.value, b.deposit);
    }

    /// @notice Open the commitment. `amount` is in token wei; price(priceTick) is wei per 1e18 token units.
    function reveal(uint256 priceTick, uint256 amount, bytes32 salt) external nonReentrant whenNotPaused {
        if (state != State.Pending || block.timestamp < endTime || block.timestamp >= revealEndTime) {
            revert WrongPhase();
        }
        Bid storage b = bids[msg.sender];
        if (b.commitment == bytes32(0)) revert NoCommitment();
        if (b.revealed) revert AlreadyRevealed();
        if (computeCommitment(priceTick, amount, salt, msg.sender) != b.commitment) revert InvalidReveal();
        if (priceTick >= numTicks) revert InvalidTick();
        if (amount == 0) revert ZeroAmount();
        uint256 cost = Math.mulDiv(priceAt(priceTick), amount, ONE, Math.Rounding.Ceil);
        if (cost > b.deposit) revert DepositTooSmall(cost, b.deposit);

        b.revealed = true;
        b.amount = amount;
        b.tick = uint16(priceTick);
        demandAtTick[priceTick] += amount;
        biddersAtTick[priceTick] += 1;
        numRevealed++;
        emit Revealed(msg.sender, uint16(priceTick), amount);

        // Badge is cosmetic: never let it block a reveal.
        try IParticipationBadge(badge).mint(msg.sender) {}
        catch {
            emit BadgeMintFailed(msg.sender);
        }
    }

    /// @notice Compute the clearing price and route proceeds. Callable by anyone after revealEndTime.
    function finalize() external nonReentrant whenNotPaused {
        if (state != State.Pending) revert AlreadyFinalized();
        if (block.timestamp < revealEndTime) revert WrongPhase();

        if (!funded) {
            _fail();
            return;
        }

        uint256 cum;
        uint256 n = numTicks;
        bool filled;
        uint256 lowestTick = type(uint256).max;
        for (uint256 i = n; i > 0;) {
            uint256 t = i - 1;
            uint256 d = demandAtTick[t];
            if (d > 0) {
                lowestTick = t;
                if (cum + d >= supply) {
                    // oversubscribed (or exactly filled): t is the marginal tick
                    clearingTick = uint16(t);
                    marginalDemand = d;
                    marginalFill = supply - cum;
                    totalSold = supply;
                    filled = true;
                    break;
                }
                cum += d;
            }
            unchecked {
                --i;
            }
        }

        if (!filled) {
            if (cum == 0) {
                _fail();
                return;
            }
            // undersubscribed: everyone filled in full at the lowest revealed tick
            clearingTick = uint16(lowestTick);
            marginalDemand = demandAtTick[lowestTick];
            marginalFill = marginalDemand;
            totalSold = cum;
        }

        uint256 price = minPrice + uint256(clearingTick) * tickSize;
        clearingPrice = price;

        // Each marginal allocation is rounded down by < 1 token wei, so the true sum of allocations is
        // >= totalSold - biddersAtTick[clearingTick] (only when pro rata applies). Every payment is rounded up,
        // so routing price * lowerBound / 1e18 (rounded down) out keeps the contract solvent for refunds.
        uint256 lowerBound = totalSold;
        if (marginalFill < marginalDemand) {
            uint256 dust = biddersAtTick[clearingTick];
            lowerBound = lowerBound > dust ? lowerBound - dust : 0;
        }
        uint256 gross = Math.mulDiv(price, lowerBound, ONE);

        if (gross == 0 || gross < softCap) {
            _fail();
            return;
        }

        state = State.Succeeded;
        raised = gross;
        uint256 fee = gross * feeBps / BPS;
        platformFee = fee;
        totalDeposits -= gross;

        emit Finalized(true, clearingTick, price, totalSold, gross, fee);

        if (fee > 0) Address.sendValue(payable(feeRecipient), fee);
        IMilestoneEscrow(escrow).fund{value: gross - fee}(totalSold);
    }

    /// @notice Settle `bidder`: allocation goes to the VestingVault, unused deposit is refunded in BNB.
    /// Callable by anyone (funds always go to the bidder).
    function settle(address bidder) external nonReentrant whenNotPaused {
        if (state == State.Pending) revert NotFinalized();
        Bid storage b = bids[bidder];
        if (b.commitment == bytes32(0)) revert NoCommitment();
        if (b.settled) revert AlreadySettled();

        (uint256 allocation, uint256 payment) = _allocation(b);
        uint256 refund = b.deposit - payment;
        b.settled = true;
        if (refund > 0) totalDeposits -= refund;

        emit Settled(bidder, allocation, payment, refund);

        if (allocation > 0) {
            saleToken.forceApprove(vault, allocation);
            IVestingVault(vault).addPosition(bidder, allocation);
        }
        if (refund > 0) Address.sendValue(payable(bidder), refund);
    }

    // ================================================================ admin

    /// @notice Admin cancels before finalization; every bidder can then reclaim their full deposit.
    function cancel() external onlyAdmin {
        if (state != State.Pending) revert AlreadyFinalized();
        state = State.Failed;
        emit Cancelled(msg.sender);
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    // ================================================================ internal

    function _fail() private {
        state = State.Failed;
        emit Finalized(false, 0, 0, 0, 0, 0);
    }

    function _allocation(Bid storage b) private view returns (uint256 allocation, uint256 payment) {
        if (state != State.Succeeded || !b.revealed) return (0, 0);
        uint16 ct = clearingTick;
        if (b.tick > ct) {
            allocation = b.amount;
        } else if (b.tick == ct) {
            allocation = marginalFill == marginalDemand ? b.amount : Math.mulDiv(b.amount, marginalFill, marginalDemand);
        } else {
            return (0, 0);
        }
        payment = Math.mulDiv(allocation, clearingPrice, ONE, Math.Rounding.Ceil);
    }
}
