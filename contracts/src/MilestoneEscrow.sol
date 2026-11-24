// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ISaleFactory, IVestingVault} from "./interfaces/IObsid.sol";

/// @title MilestoneEscrow
/// @notice Holds the net BNB raise of one sale. `atCloseBps` becomes withdrawable by the host at finalize;
/// the rest is released per milestone by the admin. Buyers (weight = vesting position total in the
/// VestingVault) can vote for refund mode; > 50% of total sold weight (or the admin) switches the escrow into
/// refund mode, after which all unreleased BNB is claimable pro rata by position holders.
/// Deployed as an EIP-1167 clone by SaleFactory; admin = SaleFactory.owner().
contract MilestoneEscrow is Initializable, Pausable, ReentrancyGuard {
    uint256 private constant BPS = 10_000;

    struct Milestone {
        string label;
        uint16 bps;
        uint256 amount;
        bool released;
    }

    address public factory;
    address public sale;
    address public host;
    address public vault;
    uint16 public atCloseBps;
    Milestone[] internal _milestones;

    bool public funded;
    bool public refundMode;
    uint256 public totalFunded;
    uint256 public totalWeight; // = tokens sold in the sale
    uint256 public lockedAmount; // unreleased milestone BNB
    uint256 public hostClaimable; // released, not yet withdrawn by host
    uint256 public votesFor;
    mapping(address => uint256) public votedWeight;
    uint256 public refundPool;
    mapping(address => bool) public refundClaimed;

    error NotAdmin();
    error NotSale();
    error NotHost();
    error AlreadyFunded();
    error NotFunded();
    error InRefundMode();
    error NotRefundMode();
    error InvalidMilestone();
    error AlreadyReleased();
    error NothingLocked();
    error NoWeight();
    error AlreadyVoted();
    error NotVoted();
    error AlreadyClaimed();
    error NothingToClaim();

    event Initialized(address indexed sale, address indexed host, uint16 atCloseBps, uint256 milestoneCount);
    event Funded(uint256 amount, uint256 atCloseAmount, uint256 totalWeight);
    event MilestoneReleased(uint256 indexed index, string label, uint256 amount);
    event HostWithdrawn(address indexed host, uint256 amount);
    event RefundVoted(address indexed voter, uint256 weight, uint256 votesFor);
    event RefundVoteRevoked(address indexed voter, uint256 weight, uint256 votesFor);
    event RefundModeEnabled(address indexed trigger, uint256 refundPool);
    event RefundClaimed(address indexed holder, uint256 weight, uint256 amount);

    modifier onlyAdmin() {
        if (msg.sender != ISaleFactory(factory).owner()) revert NotAdmin();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address factory_,
        address sale_,
        address host_,
        address vault_,
        uint16 atCloseBps_,
        string[] calldata labels,
        uint16[] calldata bps
    ) external initializer {
        factory = factory_;
        sale = sale_;
        host = host_;
        vault = vault_;
        atCloseBps = atCloseBps_;
        for (uint256 i; i < labels.length; ++i) {
            _milestones.push(Milestone({label: labels[i], bps: bps[i], amount: 0, released: false}));
        }
        emit Initialized(sale_, host_, atCloseBps_, labels.length);
    }

    // ================================================================ views

    function milestoneCount() external view returns (uint256) {
        return _milestones.length;
    }

    function milestone(uint256 i)
        external
        view
        returns (string memory label, uint16 bps, uint256 amount, bool released)
    {
        Milestone storage m = _milestones[i];
        return (m.label, m.bps, m.amount, m.released);
    }

    function refundableOf(address holder) public view returns (uint256) {
        if (!refundMode || refundClaimed[holder] || totalWeight == 0) return 0;
        return refundPool * IVestingVault(vault).positionTotal(sale, holder) / totalWeight;
    }

    // ================================================================ sale

    /// @notice Called once by the sale at successful finalization. Intentionally not pausable so that
    /// finalization can never be blocked by the escrow.
    function fund(uint256 totalWeight_) external payable {
        if (msg.sender != sale) revert NotSale();
        if (funded) revert AlreadyFunded();
        funded = true;
        totalFunded = msg.value;
        totalWeight = totalWeight_;
        uint256 locked;
        uint256 n = _milestones.length;
        for (uint256 i; i < n; ++i) {
            uint256 a = msg.value * _milestones[i].bps / BPS;
            _milestones[i].amount = a;
            locked += a;
        }
        lockedAmount = locked;
        uint256 atClose = msg.value - locked; // absorbs rounding dust
        hostClaimable += atClose;
        emit Funded(msg.value, atClose, totalWeight_);
    }

    // ================================================================ host

    function withdrawHost() external nonReentrant whenNotPaused {
        if (msg.sender != host) revert NotHost();
        uint256 amount = hostClaimable;
        if (amount == 0) revert NothingToClaim();
        hostClaimable = 0;
        emit HostWithdrawn(host, amount);
        Address.sendValue(payable(host), amount);
    }

    // ================================================================ admin

    function releaseMilestone(uint256 i) external onlyAdmin whenNotPaused {
        if (!funded) revert NotFunded();
        if (refundMode) revert InRefundMode();
        if (i >= _milestones.length) revert InvalidMilestone();
        Milestone storage m = _milestones[i];
        if (m.released) revert AlreadyReleased();
        m.released = true;
        lockedAmount -= m.amount;
        hostClaimable += m.amount;
        emit MilestoneReleased(i, m.label, m.amount);
    }

    function triggerRefundMode() external onlyAdmin {
        if (!funded) revert NotFunded();
        if (refundMode) revert InRefundMode();
        if (lockedAmount == 0) revert NothingLocked();
        _enterRefundMode();
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    // ================================================================ buyers

    /// @notice Vote for refund mode with your full vesting position weight. While a vote is active the
    /// VestingVault blocks transfers of your position (revoke first to transfer).
    function voteRefund() external whenNotPaused {
        if (!funded) revert NotFunded();
        if (refundMode) revert InRefundMode();
        if (lockedAmount == 0) revert NothingLocked();
        if (votedWeight[msg.sender] != 0) revert AlreadyVoted();
        uint256 w = IVestingVault(vault).positionTotal(sale, msg.sender);
        if (w == 0) revert NoWeight();
        votedWeight[msg.sender] = w;
        votesFor += w;
        emit RefundVoted(msg.sender, w, votesFor);
        if (votesFor * 2 > totalWeight) _enterRefundMode();
    }

    function revokeRefundVote() external whenNotPaused {
        if (refundMode) revert InRefundMode();
        uint256 w = votedWeight[msg.sender];
        if (w == 0) revert NotVoted();
        votedWeight[msg.sender] = 0;
        votesFor -= w;
        emit RefundVoteRevoked(msg.sender, w, votesFor);
    }

    function claimRefund() external nonReentrant whenNotPaused {
        if (!refundMode) revert NotRefundMode();
        if (refundClaimed[msg.sender]) revert AlreadyClaimed();
        uint256 w = IVestingVault(vault).positionTotal(sale, msg.sender);
        if (w == 0) revert NoWeight();
        uint256 amount = refundPool * w / totalWeight;
        if (amount == 0) revert NothingToClaim();
        refundClaimed[msg.sender] = true;
        emit RefundClaimed(msg.sender, w, amount);
        Address.sendValue(payable(msg.sender), amount);
    }

    function _enterRefundMode() private {
        refundMode = true;
        refundPool = lockedAmount;
        lockedAmount = 0;
        emit RefundModeEnabled(msg.sender, refundPool);
    }
}
