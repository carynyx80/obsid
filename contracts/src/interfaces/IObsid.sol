// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Binance Account Bound Token (BABT) minimal interface.
interface IBABT {
    function balanceOf(address owner) external view returns (uint256);
}

interface ISaleFactory {
    function owner() external view returns (address);
    function isSale(address sale) external view returns (bool);
    function saleIdOf(address sale) external view returns (uint256);
}

interface IVestingVault {
    function registerSale(
        address sale,
        address token,
        address escrow,
        uint64 tgeTime,
        uint16 tgeBps,
        uint64 cliff,
        uint64 duration
    ) external;
    function addPosition(address beneficiary, uint256 amount) external;
    function positionTotal(address sale, address holder) external view returns (uint256);
    function transferPosition(address sale, address from, address to, uint256 amount) external;
}

interface IMilestoneEscrow {
    function fund(uint256 totalWeight) external payable;
    function refundMode() external view returns (bool);
    function votedWeight(address voter) external view returns (uint256);
}

interface IParticipationBadge {
    function mint(address to) external returns (uint256 tokenId);
}

interface ISealedBidSale {
    function isSucceeded() external view returns (bool);
}
