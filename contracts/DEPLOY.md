# Obsid contracts: BNB Smart Chain mainnet deployment

Target: BNB Smart Chain mainnet, chainId **56**. Compiler settings: solc **0.8.24**, optimizer **on** (200 runs),
EVM version **paris**, no via-IR. Use these exact settings when you verify on BscScan.

The admin signs every transaction from MetaMask in the browser. **Do not put private keys anywhere.**

Admin / owner: `0x7d6b84648Fe791b2a2623b8B4D6fbB00ce7daB76`

## Artifacts

Run `./scripts/export-abis.sh` from `obsid/contracts`. It rebuilds the contracts and writes
`obsid/frontend/lib/contracts/<Name>.json` with the shape `{ "abi": [...], "bytecode": "0x..." }` for:
`VestingVault`, `ParticipationBadge`, `AllocationMarket`, `LiquidityLocker`, `SealedBidSale`, `MilestoneEscrow`, `SaleFactory`.

To deploy from the browser, send a transaction with no `to`, `data = bytecode ++ abi.encode(constructorArgs)` and
`value = 0`. For example, with viem: `walletClient.deployContract({ abi, bytecode, args })`. Wait for each receipt
and record `contractAddress` before you start the next step.

## Deployment order (7 deployments, then 3 wiring calls)

| # | Contract | Constructor signature | Args (defaults) |
|---|----------|----------------------|-----------------|
| 1 | `VestingVault` | `(address admin)` | `ADMIN` |
| 2 | `ParticipationBadge` | `(address admin)` | `ADMIN` |
| 3 | `AllocationMarket` | `(address admin, address vault, address feeRecipient, uint16 feeBps)` | `ADMIN`, `#1`, `ADMIN`, `100` (1%, max 1000) |
| 4 | `LiquidityLocker` | `(address admin)` | `ADMIN` |
| 5 | `SealedBidSale` (implementation) | `()` | none |
| 6 | `MilestoneEscrow` (implementation) | `()` | none |
| 7 | `SaleFactory` | `(address admin, address saleImpl, address escrowImpl, address vault, address badge, address babt, address feeRecipient, uint16 platformFeeBps, uint256 maxHardCap)` | `ADMIN`, `#5`, `#6`, `#1`, `#2`, `0x2B09d47D550061f995A3b5C6F0Fd58005215D7c8`, `ADMIN`, `200` (2%, max 1000), `500000000000000000000` (500 BNB in wei) |

The fee and hard-cap values above are suggested defaults. Change them as needed. `babt` may be `0x0000…0000` if
BABT gating will not be used, and it can be changed later with `SaleFactory.setBabt`.
**Before deploying, confirm the BABT address on BscScan.** `0x2B09d47D550061f995A3b5C6F0Fd58005215D7c8` is believed
to be the BSC mainnet Binance Account Bound Token, but it has not been verified here.

### Wiring calls (must be sent from ADMIN, after #7)

| # | Call | Args |
|---|------|------|
| 8 | `VestingVault.setFactory(address)` | `#7` (one-time only, cannot be changed) |
| 9 | `VestingVault.setMarket(address)` | `#3` |
| 10 | `ParticipationBadge.setFactory(address)` | `#7` (one-time only) |

The admin owns all four singletons (`Ownable2Step`). Each sale clone treats `SaleFactory.owner()` as its admin.
Ownership transfer is two-step: `transferOwnership(new)` followed by `acceptOwnership()` from the new address.

### Post-deploy checks (read calls)
- `SaleFactory.owner() == ADMIN`. Check `saleImplementation`, `escrowImplementation`, `vault`, `badge`, `babt`, `platformFeeBps`, `feeRecipient` and `maxHardCap`.
- `VestingVault.factory() == #7`, `VestingVault.market() == #3`, `ParticipationBadge.factory() == #7`.
- `AllocationMarket.vault() == #1`.

## Creating a sale (admin, per approved application)

`SaleFactory.createSale(SaleParams)` deploys an EIP-1167 clone of `SealedBidSale` and one of `MilestoneEscrow`. It
registers the sale in the registry and the VestingVault and emits `SaleCreated(saleId, sale, escrow, ...)`.

```
struct SaleParams {
  address host;             // project wallet: receives escrowed BNB + unsold tokens
  address saleToken;        // plain ERC20 (no fee-on-transfer / rebasing)
  uint256 supply;           // token wei for sale
  uint256 minPrice;         // wei of BNB per 1e18 token units at tick 0 (> 0)
  uint256 tickSize;         // wei per tick (> 0 if numTicks > 1)
  uint16  numTicks;         // 1..200; price(t) = minPrice + t*tickSize
  uint256 softCap;          // min gross raise in wei (<= maxRaise)
  uint64  startTime;        // >= now
  uint64  endTime;          // > startTime   (commit: [start, end))
  uint64  revealEndTime;    // > endTime     (reveal: [end, revealEnd))
  bool    babtRequired;
  VestingParams vesting;    // (uint64 tgeTime >= revealEndTime, uint16 tgeBps <= 10000, uint64 cliff, uint64 duration)
  uint16  atCloseBps;       // released to host at finalize
  string[] milestoneLabels; // <= 20
  uint16[] milestoneBps;    // each > 0; atCloseBps + sum == 10000
}
```

Constraint: `maxRaise = supply * (minPrice + (numTicks-1)*tickSize) / 1e18 <= maxHardCap`.

Sale lifecycle (all times are unix seconds):
1. The host calls `saleToken.approve(sale, supply)` and then `sale.fund()` **before `startTime`**. Bidders cannot commit to an unfunded sale, and an unfunded sale fails at finalize.
2. Bidders call `commit(bytes32)` with BNB, where `commitment = keccak256(abi.encodePacked(uint256 tick, uint256 amount, bytes32 salt, address bidder))`. The frontend must keep `salt` safe for the bidder. A bidder can replace the commitment and top up the deposit while the commit phase is open.
3. Bidders call `reveal(tick, amount, salt)` during the reveal phase. The deposit must cover `ceil(price(tick) * amount / 1e18)`. Each reveal mints a soulbound badge.
4. Anyone can call `finalize()` once `revealEndTime` has passed.
5. Anyone can call `settle(bidder)`. The allocation goes into the VestingVault and the unused BNB is refunded. Unrevealed bidders, and everyone in a failed or cancelled sale, get their full deposit back.
6. The host calls `withdrawUnsold()` once, and `escrow.withdrawHost()` whenever BNB has been released.
7. The admin calls `escrow.releaseMilestone(i)`. Buyers can call `escrow.voteRefund()`; once votes exceed 50% of tokens sold, or the admin calls `triggerRefundMode()`, buyers can call `claimRefund()`.
8. Buyers call `VestingVault.claim(sale, to)`, where `to` can be any wallet.

LP lock for IDO liquidity: the host approves the LP token and calls
`LiquidityLocker.lock(lpToken, amount, unlockTime, owner)`.

## Foundry script alternative (no keys in files)

```
forge script script/Deploy.s.sol --rpc-url https://bsc-dataseed.bnbchain.org \
  --ledger --sender 0x7d6b84648Fe791b2a2623b8B4D6fbB00ce7daB76 --broadcast
```
Optional env overrides: `ADMIN`, `FEE_RECIPIENT`, `BABT`, `PLATFORM_FEE_BPS`, `MARKET_FEE_BPS`, `MAX_HARD_CAP_WEI`.
The script runs the wiring calls only when the broadcaster is `ADMIN`. A dry run without `--broadcast` and without
an RPC simulates everything locally. The full stack uses about 11.2M gas.
