// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Vesting schedule applied to every allocation of a sale.
/// vested(t) = 0                                  if t < tgeTime
///           = total * tgeBps / 10000             if tgeTime <= t < tgeTime + cliff
///           = tgePart + (total - tgePart) * min(t - (tgeTime + cliff), duration) / duration  otherwise
/// (duration == 0 means everything unlocks at tgeTime + cliff)
struct VestingParams {
    uint64 tgeTime;
    uint16 tgeBps;
    uint64 cliff;
    uint64 duration;
}

/// @notice Parameters passed by the admin to SaleFactory.createSale.
struct SaleParams {
    address host; // project owner: receives escrowed BNB + unsold tokens
    address saleToken; // ERC20 being sold (no fee-on-transfer / rebasing tokens)
    uint256 supply; // token wei offered in the sale
    uint256 minPrice; // wei of BNB per 1e18 token units at tick 0
    uint256 tickSize; // price increment per tick (wei per 1e18 token units)
    uint16 numTicks; // 1..200; price(t) = minPrice + t * tickSize, t in [0, numTicks)
    uint256 softCap; // minimum gross BNB raise (wei) for success
    uint64 startTime; // commit phase [startTime, endTime)
    uint64 endTime; // reveal phase [endTime, revealEndTime)
    uint64 revealEndTime; // finalize allowed at/after this
    bool babtRequired; // gate commits on BABT balance > 0
    VestingParams vesting;
    uint16 atCloseBps; // share of net raise released to host at finalize
    string[] milestoneLabels;
    uint16[] milestoneBps; // atCloseBps + sum(milestoneBps) must equal 10000
}
