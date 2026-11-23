import type { Metadata } from 'next';
import Link from 'next/link';
import DocsHeader from '@/components/docs/DocsHeader';
import ReadingProgress from '@/components/docs/ReadingProgress';
import { TocDesktop, TocMobile, type TocItem } from '@/components/docs/Toc';
import DemandChart from '@/components/docs/DemandChart';
import { Section, P, H3, Pull, List, Callout, B, Mono, DocsFooter } from '@/components/docs/Prose';

export const metadata: Metadata = {
  title: 'Whitepaper · Obsid',
  description: 'The Obsid whitepaper: sealed bid uniform price token launches on BNB Chain. Public hosts, private buyers.',
};

const toc: TocItem[] = [
  { id: 'abstract', n: '01', title: 'Abstract' },
  { id: 'problem', n: '02', title: 'The problem' },
  { id: 'model', n: '03', title: 'The Obsid model' },
  { id: 'auction', n: '04', title: 'Sealed bid uniform price auction' },
  { id: 'privacy', n: '05', title: 'Privacy model' },
  { id: 'sale-types', n: '06', title: 'Sale types' },
  { id: 'escrow', n: '07', title: 'Rug proof escrow' },
  { id: 'gauge', n: '08', title: 'Demand gauge' },
  { id: 'badge', n: '09', title: 'Proof of participation' },
  { id: 'vesting', n: '10', title: 'Claim and vesting' },
  { id: 'trading', n: '11', title: 'Allocation trading' },
  { id: 'governance', n: '12', title: 'Host verification and governance' },
  { id: 'kyc', n: '13', title: 'KYC via BABT' },
  { id: 'architecture', n: '14', title: 'Smart contract architecture' },
  { id: 'security', n: '15', title: 'Security' },
  { id: 'fees', n: '16', title: 'Fees' },
  { id: 'roadmap', n: '17', title: 'Roadmap' },
  { id: 'risks', n: '18', title: 'Risk disclosures' },
  { id: 'glossary', n: '19', title: 'Glossary' },
];

const bids = [
  { who: 'Bidder A', price: '0.00018', qty: '300,000', fill: '300,000', pays: '42.0', note: 'Full fill' },
  { who: 'Bidder B', price: '0.00016', qty: '250,000', fill: '250,000', pays: '35.0', note: 'Full fill' },
  { who: 'Bidder C', price: '0.00016', qty: '200,000', fill: '200,000', pays: '28.0', note: 'Full fill' },
  { who: 'Bidder D', price: '0.00014', qty: '400,000', fill: '200,000', pays: '28.0', note: 'Pro rata 50%' },
  { who: 'Bidder G', price: '0.00014', qty: '100,000', fill: '50,000', pays: '7.0', note: 'Pro rata 50%' },
  { who: 'Bidder E', price: '0.00012', qty: '300,000', fill: '0', pays: '0', note: 'Full refund' },
  { who: 'Bidder F', price: '0.00010', qty: '200,000', fill: '0', pays: '0', note: 'Full refund' },
];

const privacyRows: [string, string, string][] = [
  ['Your bid price and quantity while bidding is open', 'Hidden', 'Only a hash is stored. Nobody, including the host and the platform, can read it.'],
  ['Your deposit amount', 'Visible in v1', 'The BNB you lock is an ordinary transfer. Overfunding masks the real bid inside a larger number.'],
  ['Your bid after you reveal', 'Visible in v1', 'Reveal publishes price and quantity so the contract can compute the clearing price. Hidden in v2 through FHE.'],
  ['Number of bids', 'Publicly provable', 'A counter on the sale contract, readable by anyone at any time.'],
  ['Total committed BNB', 'Publicly provable', 'The sum of deposits held by the sale contract.'],
  ['Caps respected', 'Publicly provable', 'Hard cap, per wallet limits and supply are enforced by contract code.'],
  ['Clearing price', 'Publicly provable', 'Computed onchain at close from revealed bids. Anyone can recompute it.'],
  ['Your identity behind the wallet', 'Never collected', 'The backend stores nothing about buyers. No email, no profile, no history.'],
  ['Host identity, wallet, terms', 'Fully public', 'Hosts are verified, profiled and accountable by design.'],
];

const contracts = [
  { name: 'SaleFactory', role: 'Deploys a fresh SealedBidSale for every approved application, wires it to its escrow, vesting vault and badge, and records the registry of all sales. Only admin approved hosts can trigger a deployment.' },
  { name: 'SealedBidSale', role: 'Holds commitments and deposits, enforces the commit window and reveal window, verifies each reveal against its hash, sorts demand into price ticks, computes the uniform clearing price, allocates pro rata at the marginal tick and pays out refunds.' },
  { name: 'MilestoneEscrow', role: 'Receives raised funds at close. Releases the upfront percentage to the host immediately, then releases each milestone tranche only after admin approval. Supports a buyer refund vote over whatever remains.' },
  { name: 'LiquidityLocker', role: 'For IDOs, pairs the configured share of raised BNB with tokens on a DEX and locks the resulting LP tokens for the stated period. Nobody, including the host and the platform, can withdraw early.' },
  { name: 'VestingVault', role: 'Holds purchased tokens and releases them on a cliff plus linear schedule. Lets a buyer direct any claim to a different, fresh wallet.' },
  { name: 'ParticipationBadge', role: 'Mints a non transferable badge per sale to each participant. The badge carries the sale reference and nothing about amounts, prices or allocation.' },
  { name: 'AllocationMarket', role: 'Escrowed peer to peer market for unclaimed allocations before token launch. Seller allocation and buyer BNB settle atomically, or not at all.' },
];

const glossary: [string, string][] = [
  ['BABT', 'Binance Account Bound Token. A soulbound token on BNB Chain issued to users who completed Binance KYC. Holding one proves verification without revealing personal data.'],
  ['Clearing price', 'The single price per token every winning bidder pays, set at the highest tick where cumulative demand covers supply.'],
  ['Cliff', 'A waiting period after the sale during which no tokens vest.'],
  ['Commit', 'The first phase of a sealed bid: you submit a hash of your bid plus a BNB deposit.'],
  ['FHE', 'Fully homomorphic encryption. Lets a contract compute on encrypted values without decrypting them.'],
  ['Hard cap', 'The maximum amount a sale can raise or the maximum supply it can sell.'],
  ['Host', 'A project approved to run a sale on Obsid. Always public.'],
  ['ICO', 'Initial coin offering. Tokens sold directly to buyers by the issuing project.'],
  ['IDO', 'Initial DEX offering. A sale whose proceeds partly seed a DEX liquidity pool that is locked automatically.'],
  ['IPO', 'On Obsid, a tokenized equity offering with KYC and jurisdiction gating. Coming soon.'],
  ['Marginal tick', 'The price tick at which supply runs out. Bids here are filled pro rata.'],
  ['Milestone', 'A deliverable the host commits to. Approval by the admin releases the next escrow tranche.'],
  ['Pro rata', 'In proportion. Each marginal bidder receives the same fraction of the quantity they asked for.'],
  ['Reveal', 'The second phase: you publish your bid and secret so the contract can check them against your commit.'],
  ['Salt or secret', 'A random value mixed into your commit hash so nobody can guess your bid by trying prices.'],
  ['Soft cap', 'The minimum raise. Below it, the sale fails and every deposit is refunded.'],
  ['Tick', 'A fixed price step. Bids must be placed on ticks so demand can be aggregated cleanly.'],
  ['Uniform price auction', 'An auction where all winners pay the same price, regardless of how high they bid.'],
  ['ZK proof', 'Zero knowledge proof. Proves a statement is true without revealing why.'],
];

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-paper">
      <ReadingProgress />
      <DocsHeader />

      {/* Hero */}
      <header className="relative overflow-hidden border-b border-frost bg-chalk grain">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-lemon blur-3xl opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-ink px-3 py-1 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-lemon">Whitepaper</span>
            <span className="rounded-full border border-ink/15 bg-paper px-3 py-1 font-mono text-[11px] text-ink-soft">v1.0 · BNB Chain mainnet</span>
          </div>
          <h1 className="mt-6 max-w-5xl font-display text-[2.6rem] font-extrabold leading-[0.95] tracking-tighter sm:text-7xl lg:text-8xl">
            Fair launches need <span className="font-serif font-normal italic tracking-normal">sealed</span> envelopes.
          </h1>
          <p className="mt-8 max-w-2xl font-body text-lg leading-relaxed text-ink-soft sm:text-xl">
            Obsid is a sealed bid token launchpad. Projects launch in public. Buyers bid in private. One uniform clearing price, computed by the contract, settles everyone fairly.
          </p>
          <div className="mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['19', 'sections'],
              ['7', 'contracts'],
              ['1', 'clearing price'],
              ['0', 'buyer data stored'],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl border border-ink/10 bg-paper p-4">
                <p className="font-mono text-2xl font-semibold">{v}</p>
                <p className="mt-1 font-label text-xs font-semibold uppercase tracking-widest text-ink-mute">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <TocMobile items={toc} />
        <div className="grid gap-12 py-12 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-16 lg:py-20">
          <aside className="hidden lg:block">
            <TocDesktop items={toc} />
          </aside>

          <article className="min-w-0 max-w-3xl">
            {/* 01 */}
            <Section id="abstract" n="01" title="Abstract" kicker="In one page">
              <P>
                Token launches on public blockchains have a structural flaw. Every bid is visible the moment it is broadcast, and every wallet is a public ledger. That turns a sale into a race won by whoever has the fastest bot, the deepest pocket, or the best view of the mempool. Ordinary buyers arrive late, pay more, and are tracked forever afterwards. Projects, meanwhile, face little accountability once the money arrives, and too many vanish with it.
              </P>
              <P>
                Obsid inverts the transparency of a launch. <B>Hosts are fully public:</B> every project is verified by the platform, has a public profile, publishes its terms, and has its funds held in milestone escrow. <B>Buyers are private:</B> they submit sealed bids using a commit and reveal scheme, mask their bid amount inside a larger deposit, and never hand the platform any personal data. The backend stores nothing about buyers at all.
              </P>
              <P>
                When bidding closes and bids are revealed, the sale contract computes a single uniform clearing price using fixed price ticks. Every winner pays that same price, the marginal tick is filled pro rata, and every unused BNB is refunded. The public sees only what it needs to trust the outcome: how many bids were placed, how much was committed, that caps were respected, and the clearing price at close.
              </P>
              <P>
                Around that core, Obsid adds rug proof escrow with milestone releases and a buyer refund vote, automatic liquidity locking for IDOs, a live demand gauge built from aggregates only, a private proof of participation badge, a claim and vesting portal that can deliver tokens to a fresh wallet, and a private market for allocations before launch. Optional KYC gating uses Binance’s BABT soulbound token. Version one is honest about its privacy limits; version two moves to fully encrypted bids with FHE and wallet hiding KYC with zero knowledge proofs.
              </P>
            </Section>

            {/* 02 */}
            <Section id="problem" n="02" title="The problem" kicker="Why launches feel rigged">
              <P>
                Most launchpads today run some variant of first come first served, a fixed price whitelist, or a lottery. All three share the same weakness: information leaks before allocation is decided, and the people best equipped to exploit leaked information are rarely the community a project hopes to reach.
              </P>
              <H3>Snipers and bots</H3>
              <P>
                In a first come first served sale, the winner is whoever lands a transaction earliest. That rewards infrastructure, not conviction. Bots watch for the sale contract to open, submit transactions with aggressive gas, and sometimes bundle them with validators to guarantee position. A sale that sells out in eight seconds is not a sign of a healthy community. It is a sign that a handful of scripts captured the allocation, often to dump it on the first available liquidity.
              </P>
              <H3>Whale tracking and copy trading</H3>
              <P>
                Every public bid is a signal. When a known fund wallet commits a large amount, followers pile in behind it. When the same wallet sells, they rush for the exit. Analytics dashboards label wallets, alert on their moves and sell that intelligence as a product. For a large buyer, participating in public means telegraphing a strategy to the whole market. For a small buyer, it means competing against a crowd that is reacting to signals it did not create. Either way, price discovery is distorted by visibility.
              </P>
              <H3>Front running and bid shading</H3>
              <P>
                When bids are visible before the sale closes, rational participants wait. They watch where demand settles, then bid just enough to win. This bid shading means the final price reflects tactics rather than true valuation. In auctions where each winner pays their own bid, buyers also have to guess what others will pay, which systematically punishes those who bid honestly.
              </P>
              <H3>Rugs and vanishing teams</H3>
              <P>
                On the other side of the table, buyers have historically had almost no protection once a sale closes. Funds land in a project wallet, liquidity can be pulled at will, and a team can disappear overnight. Audits and promises do not change the fact that the money is, in practice, fully controlled by the people who raised it. The asymmetry is stark: buyers are exposed, while hosts are often anonymous and unaccountable.
              </P>
              <Pull by="The core inversion">Launches today make buyers transparent and hosts opaque. It should be the other way around.</Pull>
            </Section>

            {/* 03 */}
            <Section id="model" n="03" title="The Obsid model" kicker="Public hosts, private buyers">
              <P>
                Obsid is built on a single principle: <B>transparency belongs to whoever holds the money and the responsibility.</B> A project raising funds from the public should be identifiable, reviewable and bound by enforceable terms. A person buying into a sale should be able to do so without broadcasting their strategy, their size, or their identity.
              </P>
              <H3>Hosts are public</H3>
              <P>
                A host is any project that applies to run a sale on Obsid. Before a host can launch anything, it builds a public profile with its name, team, links, token details and payout wallet, then submits an application describing the sale: type, supply, price ticks, soft and hard caps, escrow terms and milestones, vesting schedule and any KYC requirement. The platform admin reviews the application and either approves or rejects it. If a host later changes its name or payout wallet, the profile drops back into review and must be re approved before the next sale can go live. These rules exist so that a buyer can always answer one question with confidence: who am I sending money to, and what have they promised?
              </P>
              <H3>Buyers are private</H3>
              <P>
                Buyers have no public profile on Obsid. They sign in by connecting a wallet, and everything they see about their own activity lives in a private dashboard rendered from onchain data in their own browser. The Obsid backend does not store buyer emails, names, wallet lists, bid histories or allocation records. There is nothing to leak, subpoena or sell, because it was never collected. During bidding, a buyer’s price and quantity are sealed inside a cryptographic commitment, and the deposit can be larger than the bid so that the visible amount does not reveal the real one.
              </P>
              <H3>What everyone can verify</H3>
              <P>
                Privacy for buyers does not mean opacity for the sale. Anyone can read the sale contract and confirm the number of bids, the total committed, that every cap was respected, and the final clearing price. Anyone can recompute the clearing price from the revealed bids and check that the contract did its job. The goal is a launch that is private where it should be and provable everywhere else.
              </P>
            </Section>

            {/* 04 */}
            <Section id="auction" n="04" title="Sealed bid uniform price auction" kicker="How the price is found">
              <P>
                Obsid sales use a sealed bid, uniform price auction with discrete price ticks. It is the same family of mechanism used for government bond issuance in several countries, adapted to run entirely onchain. It has three phases: commit, reveal and settle.
              </P>
              <H3>Phase one: commit</H3>
              <P>
                While bidding is open, a buyer chooses a maximum price, which must sit on one of the sale’s published ticks, and a quantity of tokens. The app generates a random secret, then computes a hash of the price, quantity, secret and bidder address. Only that hash is sent to the contract, together with a BNB deposit. The deposit must be at least price times quantity, but it can be larger. A buyer who wants 20 BNB worth of tokens can deposit 50 BNB, so that observers cannot infer the real bid from the deposit. The secret is saved locally and offered to the buyer as a downloadable backup, because without it the bid cannot be revealed.
              </P>
              <H3>Phase two: reveal</H3>
              <P>
                When the commit window closes, the reveal window opens. Each buyer submits their price, quantity and secret. The contract recomputes the hash and checks it against the stored commitment. A matching reveal is accepted and its demand is added to the correct price tick. A reveal that does not match, or a commitment that is never revealed before the deadline, is excluded from the auction and its deposit becomes refundable, minus any small non reveal penalty the sale may specify to discourage spam commitments. Because nobody could see anyone else’s bid while committing, there was no information to react to.
              </P>
              <H3>Phase three: settle</H3>
              <P>
                After the reveal deadline, anyone can trigger settlement. The contract walks the price ticks from highest to lowest, accumulating demand. The <B>clearing price</B> is the highest tick at which cumulative demand meets or exceeds the tokens on offer. Every bid strictly above that tick is filled in full. Bids exactly at the clearing tick share whatever supply is left, <B>pro rata</B> to the quantity each asked for. Bids below the tick receive nothing. Every winner pays the clearing price, not their own bid, and the difference between each deposit and the amount owed is refunded.
              </P>
              <H3>A worked example</H3>
              <P>
                A host offers <Mono>1,000,000</Mono> tokens with ticks at <Mono>0.00010</Mono>, <Mono>0.00012</Mono>, <Mono>0.00014</Mono>, <Mono>0.00016</Mono> and <Mono>0.00018</Mono> BNB per token. Seven bids are revealed:
              </P>
              <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[560px] border-separate border-spacing-0 overflow-hidden rounded-2xl border border-frost text-left text-sm">
                  <thead className="bg-ink text-chalk">
                    <tr>
                      {['Bidder', 'Max price', 'Asked', 'Filled', 'Pays (BNB)', 'Result'].map((h) => (
                        <th key={h} className="px-4 py-3 font-label text-[11px] font-bold uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-mono text-[13px]">
                    {bids.map((b) => (
                      <tr key={b.who} className={b.price === '0.00014' ? 'bg-lemon-soft' : 'odd:bg-paper even:bg-chalk'}>
                        <td className="border-t border-frost px-4 py-3 font-body font-semibold">{b.who}</td>
                        <td className="border-t border-frost px-4 py-3">{b.price}</td>
                        <td className="border-t border-frost px-4 py-3">{b.qty}</td>
                        <td className="border-t border-frost px-4 py-3">{b.fill}</td>
                        <td className="border-t border-frost px-4 py-3">{b.pays}</td>
                        <td className="border-t border-frost px-4 py-3 font-body text-ink-soft">{b.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DemandChart />
              <P>
                Cumulative demand at <Mono>0.00018</Mono> is 300,000 tokens. At <Mono>0.00016</Mono> it reaches 750,000, still short of supply. At <Mono>0.00014</Mono> it jumps to 1,250,000, which covers the 1,000,000 on offer. So <B>0.00014 BNB is the clearing price.</B>
              </P>
              <P>
                Bidders A, B and C bid above the clearing tick and are filled in full, taking 750,000 tokens. That leaves 250,000 tokens for the marginal tick, where D asked for 400,000 and G asked for 100,000, a total of 500,000. Each receives 250,000 divided by 500,000, which is 50 percent of what they asked: D gets 200,000 and G gets 50,000. Bidders E and F bid below the clearing price and are refunded in full.
              </P>
              <P>
                Everyone who wins pays 0.00014 BNB per token. Bidder A was willing to pay 0.00018 but pays the same as everyone else: 300,000 tokens for 42 BNB. If A had deposited 70 BNB to disguise the bid, A receives 28 BNB back. The sale raises exactly 140 BNB, the supply sells out completely, and nobody who bid honestly is punished for it.
              </P>
              <Callout title="Why uniform pricing matters">
                <p>In a uniform price auction, your bid sets the most you are willing to pay, not what you will pay. That makes bidding your true valuation the sensible strategy. There is no reward for guessing what others will do, and no penalty for honesty. It also means a whale cannot push small buyers into overpaying: everyone settles at the same number.</p>
              </Callout>
              <H3>Edge cases</H3>
              <List
                items={[
                  <>If total demand at the lowest tick is below supply, the sale clears at the lowest tick, all valid bids are filled, and unsold tokens are returned to the host or handled as the published terms specify.</>,
                  <>If total raised would fall below the soft cap, the sale fails and every deposit is refundable in full.</>,
                  <>Per wallet maximums and the hard cap are enforced at commit and again at settlement. A bid that would breach them is trimmed or rejected by the contract.</>,
                  <>Pro rata rounding is done in the token’s smallest unit; any dust left over is assigned deterministically so totals always reconcile exactly.</>,
                ]}
              />
            </Section>

            {/* 05 */}
            <Section id="privacy" n="05" title="Privacy model" kicker="Honest about v1, ambitious about v2">
              <P>
                Privacy claims in crypto are often vague. Obsid prefers to be precise. The table below lists every piece of information related to a sale, and whether it is hidden, visible or publicly provable in version one.
              </P>
              <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[620px] border-separate border-spacing-0 overflow-hidden rounded-2xl border border-frost text-left text-sm">
                  <thead className="bg-chalk">
                    <tr>
                      {['Information', 'Status', 'How'].map((h) => (
                        <th key={h} className="px-4 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-ink-mute">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {privacyRows.map(([what, status, how]) => {
                      const pill =
                        status === 'Hidden' || status === 'Never collected'
                          ? 'bg-ink text-lemon'
                          : status.startsWith('Visible')
                          ? 'bg-frost text-ink-soft'
                          : 'bg-lemon text-ink';
                      return (
                        <tr key={what} className="align-top">
                          <td className="border-t border-frost px-4 py-3 font-semibold text-ink">{what}</td>
                          <td className="border-t border-frost px-4 py-3">
                            <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 font-label text-[11px] font-bold ${pill}`}>{status}</span>
                          </td>
                          <td className="border-t border-frost px-4 py-3 text-ink-soft">{how}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <H3>The honest limits of version one</H3>
              <P>
                Commit and reveal is a well understood, battle tested technique, and it does exactly one thing well: it hides bids while bidding is open. That is the window in which hidden information matters most, because it is when sniping, shading and copy trading happen. But it is not total privacy, and we will not pretend otherwise.
              </P>
              <List
                items={[
                  <><B>Deposits are visible.</B> Sending BNB to a contract is a public transfer. Overfunding hides the real bid inside a larger number, but an observer still sees that a wallet deposited something, and roughly how much it could at most have bid.</>,
                  <><B>Bids become public at reveal.</B> To compute the clearing price onchain, each bid must be revealed in plaintext. After the reveal window, anyone can see what each wallet bid. By then the auction is decided, so the information can no longer be used to game it, but it is still visible.</>,
                  <><B>Wallets are pseudonymous, not anonymous.</B> If your wallet is already linked to your identity elsewhere, Obsid cannot unlink it. Using a fresh wallet to bid, and claiming to another fresh wallet, meaningfully improves your privacy.</>,
                  <><B>Allocation trades show a price.</B> In version one, the price of an allocation trade is visible onchain.</>,
                ]}
              />
              <Pull>Private where it changes the outcome. Provable everywhere else.</Pull>
              <H3>Version two: FHE and zero knowledge</H3>
              <P>
                The roadmap closes these gaps with two technologies. <B>Fully homomorphic encryption</B> allows a contract to add, compare and sort numbers while they remain encrypted. With an FHE coprocessor, bids would be submitted encrypted, the clearing price would be computed over encrypted values, and only the final price and each buyer’s own allocation would ever be decrypted, the latter only to that buyer. There would be no plaintext reveal at all.
              </P>
              <P>
                <B>Zero knowledge proofs</B> address identity. Today, BABT gating checks that a wallet holds a verification token, which ties the bidding wallet to a verified Binance account. In version two, a buyer will be able to prove in zero knowledge that they control some wallet holding a valid BABT, without revealing which one, and bid from an unlinked address. KYC requirements would be met without creating a public link between identity and activity.
              </P>
            </Section>

            {/* 06 */}
            <Section id="sale-types" n="06" title="Sale types" kicker="ICO, IDO, Presale, and soon IPO">
              <P>
                Every sale on Obsid uses the same sealed bid engine. What differs is what happens to the funds and tokens afterwards, and who is allowed to participate.
              </P>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ['ICO', 'Initial coin offering', 'The host sells tokens directly to buyers. Raised funds flow into milestone escrow, and tokens vest according to the published schedule. Best for projects that need treasury funding to build.'],
                  ['IDO', 'Initial DEX offering', 'A configured share of the raise is paired with tokens and added as DEX liquidity at the clearing price. The LP tokens are locked automatically by the LiquidityLocker, so trading opens with guaranteed depth that cannot be pulled.'],
                  ['Presale', 'Before public launch', 'An earlier stage sale, often with a longer cliff and vesting. Tokens are delivered before or at listing, and escrow plus vesting align early buyers with the long term.'],
                  ['IPO', 'Coming soon', 'Tokenized equity with mandatory KYC and jurisdiction gating. Requires compliant issuers, eligibility checks per buyer and region, and transfer restrictions where the law requires them.'],
                ].map(([t, s, d]) => (
                  <div key={t} className={`rounded-3xl border p-6 ${t === 'IPO' ? 'border-dashed border-ink/25 bg-chalk' : 'border-frost bg-paper'}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-display text-3xl font-extrabold tracking-tight">{t}</p>
                      {t === 'IPO' && <span className="rounded-full bg-ink px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-lemon">Soon</span>}
                    </div>
                    <p className="mt-1 font-serif text-lg italic text-ink-mute">{s}</p>
                    <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{d}</p>
                  </div>
                ))}
              </div>
              <P>
                IPO support is deliberately not live. Offering tokenized equity involves securities law in every jurisdiction where a buyer might reside. Obsid will only enable it once the compliance layer, including verified issuer documentation, per jurisdiction eligibility and transfer rules, is ready and reviewed. Until then the option appears in the product as coming soon and cannot be selected.
              </P>
            </Section>

            {/* 07 */}
            <Section id="escrow" n="07" title="Rug proof escrow" kicker="The money waits for the work">
              <P>
                Raised funds never land directly in a host wallet. At settlement, the SealedBidSale contract forwards proceeds to a dedicated MilestoneEscrow contract created for that sale. The escrow terms are part of the approved application and are visible to every buyer before they bid.
              </P>
              <List
                items={[
                  <><B>Upfront release.</B> A fixed percentage, for example 20 percent, is released to the host at close so work can begin immediately.</>,
                  <><B>Milestone tranches.</B> The remainder is split into tranches tied to named deliverables such as a mainnet launch, an audit or a product release. When the host submits evidence, the admin reviews it and approves the release. The contract pays out only the approved tranche.</>,
                  <><B>Automatic liquidity lock.</B> For IDOs, the liquidity share is never part of the escrow payout. It goes straight into the LiquidityLocker as locked LP tokens for the stated period.</>,
                  <><B>Buyer refund vote.</B> If a host stops delivering or disappears, buyers of that sale can open a refund vote. Voting weight is based on each buyer’s allocation. If the vote passes its threshold, the escrow stops releasing to the host and the remaining balance becomes claimable by buyers pro rata.</>,
                ]}
              />
              <P>
                The upfront percentage is, by definition, at the host’s discretion once released, and no escrow can guarantee a project succeeds. What escrow does guarantee is that most of the money cannot leave without visible progress, and that buyers have an enforceable path to recover what remains.
              </P>
            </Section>

            {/* 08 */}
            <Section id="gauge" n="08" title="Demand gauge" kicker="Heat without leaks">
              <P>
                Buyers reasonably want to know whether a sale is attracting interest. Showing an order book would defeat the point of sealed bids, so Obsid shows a demand gauge instead. It has four states: <B>cold</B>, <B>warm</B>, <B>hot</B> and <B>on fire</B>.
              </P>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Cold', 'bg-frost', 'Under 25% of hard cap committed'],
                  ['Warm', 'bg-lemon-soft', '25% to 60%'],
                  ['Hot', 'bg-lemon', '60% to 90%'],
                  ['On fire', 'bg-ink text-lemon', 'Over 90%'],
                ].map(([l, c, d]) => (
                  <div key={l} className={`rounded-2xl p-4 ${c}`}>
                    <p className="font-display text-lg font-semibold">{l}</p>
                    <p className="mt-1 text-xs opacity-80">{d}</p>
                  </div>
                ))}
              </div>
              <P>
                The gauge is computed purely from public aggregates: total BNB committed relative to the hard cap, and the number of bids. Thresholds above are illustrative and may be tuned per sale. Because deposits can be overfunded, total committed is an upper bound on real demand, not an exact reading, and the gauge is labelled accordingly. It reveals nothing about any individual bid or any price level.
              </P>
            </Section>

            {/* 09 */}
            <Section id="badge" n="09" title="Proof of participation" kicker="A receipt that keeps your secrets">
              <P>
                Communities like to recognise early supporters, and projects often reward them later. But proving you were in a sale normally means pointing at a wallet and exposing everything in it. Obsid solves this with the ParticipationBadge: a non transferable token minted to each buyer who committed and revealed a valid bid in a sale.
              </P>
              <P>
                The badge records which sale you took part in and nothing else. It does not encode your bid, your deposit, your allocation or whether you won. You can show it to a project, a community or a future airdrop checker to prove participation. Share cards generated by the app display the sale name and badge art, never amounts.
              </P>
            </Section>

            {/* 10 */}
            <Section id="vesting" n="10" title="Claim and vesting" kicker="Tokens on a schedule you can read">
              <P>
                Purchased tokens are held in a VestingVault per sale. Each schedule has a <B>cliff</B>, a period after which vesting begins, followed by <B>linear vesting</B> over a set duration. A schedule might release 10 percent at listing, then nothing for a 30 day cliff, then the rest linearly over 180 days. The schedule is fixed at approval and cannot be changed by the host after the sale.
              </P>
              <P>
                The claim portal shows each buyer what has vested, what has been claimed and what remains, read directly from the vault. A buyer can claim at any time to the bidding wallet or to <B>a fresh wallet of their choice</B>. Claiming to a new address breaks the visible link between the wallet that bid and the wallet that holds the tokens, which is one of the most effective privacy steps available in version one.
              </P>
            </Section>

            {/* 11 */}
            <Section id="trading" n="11" title="Allocation trading" kicker="Liquidity before listing">
              <P>
                Between settlement and token launch, allocations are locked. Some buyers need to exit early; others want in after missing the auction. The AllocationMarket lets a buyer list all or part of an unclaimed allocation for a BNB price. Another participant can accept the offer, at which point the contract swaps the allocation rights and the BNB atomically. Neither side has to trust the other, and the platform never takes custody beyond the escrow contract.
              </P>
              <P>
                Trades happen privately in the sense that the app does not broadcast them, show a public order book, or link them to profiles. However, in version one <B>the trade price is visible onchain</B> to anyone who inspects the transaction. Version two will move trade terms under the same encryption as bids.
              </P>
            </Section>

            {/* 12 */}
            <Section id="governance" n="12" title="Host verification and governance" kicker="Who decides what">
              <P>
                Obsid uses a deliberately simple governance model in version one. A platform admin, operated as a multisig, holds a small set of clearly scoped powers:
              </P>
              <List
                items={[
                  'Approve or reject host profiles and sale applications.',
                  'Send a host back for re approval when its name or payout wallet changes.',
                  'Approve milestone releases from escrow after reviewing evidence.',
                  'Pause an individual contract in an emergency.',
                  'Set the platform fee for each sale before it launches.',
                ]}
              />
              <P>
                The admin cannot move buyer deposits, change a live sale’s terms, alter the clearing computation, mint badges arbitrarily, or withdraw locked liquidity. Those rules are enforced in contract code, not in policy. Every admin action emits an onchain event, so the full history of approvals, pauses and releases is auditable by anyone.
              </P>
              <P>
                The re approval rule matters more than it looks. A classic exit pattern is to build trust under one identity, then quietly swap the payout wallet. On Obsid, any change to a host’s name or wallet freezes new launches until the admin reviews it, and the change is shown on the host’s public profile.
              </P>
            </Section>

            {/* 13 */}
            <Section id="kyc" n="13" title="KYC via BABT" kicker="Verified without paperwork">
              <P>
                Some sales need to know that buyers are verified humans, for regulatory reasons or simply to limit sybil attacks. Obsid supports optional KYC gating using the <B>Binance Account Bound Token</B>, a soulbound token on BNB Chain issued to users who have completed identity verification with Binance.
              </P>
              <P>
                When a host enables BABT gating, the sale contract checks that the committing wallet holds a BABT. Obsid never sees or stores any identity document; verification was handled by Binance, and the token simply attests that it happened. Hosts can choose whether to require BABT, and future versions will add jurisdiction filters for IPO sales. In version one the check is wallet based, which means the bidding wallet is linked to a verified account. The ZK upgrade described in the privacy section removes that link.
              </P>
            </Section>

            {/* 14 */}
            <Section id="architecture" n="14" title="Smart contract architecture" kicker="Seven contracts, one job each">
              <P>
                The protocol is composed of small, single purpose contracts. Each sale gets its own instances, so a problem in one sale cannot spill into another, and each contract can be paused independently.
              </P>
              <div className="space-y-3">
                {contracts.map((c, i) => (
                  <div key={c.name} className="flex gap-4 rounded-2xl border border-frost bg-paper p-5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-xs text-lemon">{i + 1}</span>
                    <div>
                      <p className="font-mono text-sm font-semibold text-ink">{c.name}</p>
                      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{c.role}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Callout title="Lifecycle of a sale" tone="ink">
                <p>Admin approves application. SaleFactory deploys SealedBidSale, MilestoneEscrow, VestingVault and ParticipationBadge links. Buyers commit, then reveal. Anyone calls settle. Proceeds move to MilestoneEscrow and, for IDOs, LiquidityLocker. Tokens move to VestingVault. Badges are minted. AllocationMarket opens until claims begin.</p>
              </Callout>
            </Section>

            {/* 15 */}
            <Section id="security" n="15" title="Security" kicker="Defence in layers">
              <List
                items={[
                  <><B>Independent pause switches.</B> Every contract has its own pause control. Pausing a sale halts new commits without touching escrow; pausing a market halts new trades without touching claims. Refund and withdrawal paths stay open wherever safely possible.</>,
                  <><B>Launch caps.</B> Each sale has a hard cap and optional per wallet limits. During the early mainnet period, the platform also applies conservative caps on the size of any single sale to limit exposure while the system matures.</>,
                  <><B>Pull payments.</B> Refunds and claims are withdrawn by the recipient rather than pushed, which avoids reentrancy and failed transfer issues.</>,
                  <><B>Comprehensive tests.</B> The contracts ship with unit tests, property based fuzzing of the clearing algorithm and invariant tests asserting that tokens and BNB always reconcile.</>,
                  <><B>Audits planned.</B> Independent third party audits are planned before caps are raised. Reports will be published in full.</>,
                  <><B>Minimal backend.</B> The backend holds host profiles and application metadata only. With no buyer data stored, a breach exposes nothing about buyers.</>,
                ]}
              />
            </Section>

            {/* 16 */}
            <Section id="fees" n="16" title="Fees" kicker="Simple and disclosed">
              <P>
                Obsid charges a platform fee on funds raised by a sale. The fee is a percentage set per sale during approval and is shown clearly on the sale page before it launches, so every buyer and host knows the exact terms in advance. The fee is deducted at settlement from the raise, before proceeds enter escrow. Buyers pay the clearing price and normal network gas; there is no hidden spread on bids, and refunds are returned in full.
              </P>
            </Section>

            {/* 17 */}
            <Section id="roadmap" n="17" title="Roadmap" kicker="Where we are going">
              <ol className="relative space-y-6 border-l-2 border-ink/10 pl-6">
                {[
                  ['Now', 'v1 on BNB Chain mainnet', 'Sealed bid ICO, IDO and Presale. Milestone escrow, liquidity lock, demand gauge, badges, vesting with fresh wallet claims, allocation market, BABT gating, per contract pause and launch caps.'],
                  ['Next', 'Audits and raised caps', 'Publish third party audits, expand caps, add more DEX venues for IDO liquidity, richer host analytics.'],
                  ['Later', 'IPO with compliance', 'Tokenized equity with KYC, jurisdiction gating and transfer restrictions for compliant issuers.'],
                  ['v2', 'FHE encrypted bids', 'Bids, clearing and allocation trades computed over encrypted values. No plaintext reveal.'],
                  ['v2', 'ZK wallet hiding KYC', 'Prove BABT eligibility in zero knowledge and bid from an unlinked wallet.'],
                  ['Beyond', 'Decentralised governance', 'Move milestone review and parameter changes from the admin multisig toward community governance.'],
                ].map(([t, h, d], i) => (
                  <li key={i} className="relative">
                    <span className={`absolute -left-[33px] top-1 h-4 w-4 rounded-full border-2 border-ink ${i === 0 ? 'bg-lemon' : 'bg-paper'}`} />
                    <p className="font-mono text-xs text-ink-mute">{t}</p>
                    <p className="font-display text-lg font-semibold">{h}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{d}</p>
                  </li>
                ))}
              </ol>
            </Section>

            {/* 18 */}
            <Section id="risks" n="18" title="Risk disclosures" kicker="Read before you bid">
              <P>
                Participating in token sales is risky. Nothing on Obsid is investment advice, and Obsid does not vet the commercial merit of any project beyond its approval checks. Please consider at least the following:
              </P>
              <List
                items={[
                  <><B>Smart contract risk.</B> Despite testing and planned audits, contracts may contain bugs that lead to loss of funds.</>,
                  <><B>Project risk.</B> Hosts may fail to deliver. Escrow limits but does not eliminate loss; the upfront release is at the host’s discretion.</>,
                  <><B>Market risk.</B> Tokens may trade below the clearing price after launch, or have little liquidity.</>,
                  <><B>Secret loss.</B> If you lose your bid secret, you cannot reveal, and your bid will not count. Your deposit is refundable but the opportunity is lost.</>,
                  <><B>Missed reveal.</B> If you do not reveal before the deadline, your bid is excluded.</>,
                  <><B>Privacy limits.</B> Deposits and revealed bids are visible onchain in v1, as described in the privacy section.</>,
                  <><B>Regulatory risk.</B> Rules on token sales vary by jurisdiction and may change. You are responsible for complying with the laws that apply to you.</>,
                  <><B>Governance risk.</B> The admin multisig has scoped powers; misuse or key compromise could delay milestone releases or pause contracts.</>,
                  <><B>Network risk.</B> BNB Chain congestion, outages or wallet issues could prevent timely commits, reveals or claims.</>,
                ]}
              />
            </Section>

            {/* 19 */}
            <Section id="glossary" n="19" title="Glossary" kicker="Terms used in this paper">
              <dl className="divide-y divide-frost overflow-hidden rounded-3xl border border-frost">
                {glossary.map(([t, d]) => (
                  <div key={t} className="grid gap-1 px-5 py-4 sm:grid-cols-[180px_1fr] sm:gap-6">
                    <dt className="font-mono text-sm font-semibold text-ink">{t}</dt>
                    <dd className="text-[15px] leading-relaxed text-ink-soft">{d}</dd>
                  </div>
                ))}
              </dl>
            </Section>

            <div className="mt-16 rounded-blob bg-ink p-8 text-chalk sm:p-12">
              <p className="font-serif text-3xl italic leading-tight sm:text-4xl">Ready to see it in action?</p>
              <p className="mt-3 max-w-lg text-chalk/70">Read the step by step guides, or open the app and browse live sales on BNB Chain.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/how-to" className="rounded-full bg-lemon px-6 py-3 font-label font-bold text-ink">How to use Obsid</Link>
                <Link href="/app" className="rounded-full border border-chalk/30 px-6 py-3 font-label font-bold">Launch app</Link>
              </div>
            </div>
          </article>
        </div>
      </div>
      <DocsFooter />
    </div>
  );
}
