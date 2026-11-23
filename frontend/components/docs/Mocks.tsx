/* Small illustrative UI mocks drawn in HTML and CSS for the how to guides. */
import type { ReactNode } from 'react';

function Frame({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 ${dark ? 'border-ink bg-ink text-chalk' : 'border-frost bg-chalk'}`}>
      <div className="mb-3 flex gap-1.5">
        <span className={`h-2 w-2 rounded-full ${dark ? 'bg-chalk/25' : 'bg-ink/15'}`} />
        <span className={`h-2 w-2 rounded-full ${dark ? 'bg-chalk/25' : 'bg-ink/15'}`} />
        <span className={`h-2 w-2 rounded-full ${dark ? 'bg-chalk/25' : 'bg-ink/15'}`} />
      </div>
      {children}
    </div>
  );
}

const Btn = ({ children, tone = 'lemon' }: { children: ReactNode; tone?: 'lemon' | 'ink' | 'ghost' }) => (
  <span
    className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 font-label text-[11px] font-bold ${
      tone === 'lemon' ? 'bg-lemon text-ink' : tone === 'ink' ? 'bg-ink text-lemon' : 'border border-ink/20 text-ink'
    }`}
  >
    {children}
  </span>
);

const Field = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="rounded-xl border border-frost bg-paper px-3 py-2">
    <p className="font-label text-[9px] font-bold uppercase tracking-widest text-ink-mute">{label}</p>
    <p className={`truncate text-xs text-ink ${mono ? 'font-mono' : 'font-semibold'}`}>{value}</p>
  </div>
);

export type MockKind =
  | 'roleHost'
  | 'roleBuyer'
  | 'wallet'
  | 'walletChain'
  | 'profile'
  | 'apply'
  | 'approval'
  | 'runSale'
  | 'escrow'
  | 'vestingSetup'
  | 'browse'
  | 'bid'
  | 'reveal'
  | 'claim'
  | 'fresh'
  | 'trade'
  | 'badge';

export default function Mock({ kind }: { kind: MockKind }) {
  switch (kind) {
    case 'roleHost':
    case 'roleBuyer': {
      const host = kind === 'roleHost';
      return (
        <Frame>
          <p className="mb-2 text-center font-display text-sm font-semibold">Sign in as</p>
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-xl p-3 text-center ${host ? 'bg-ink text-lemon ring-2 ring-lemon' : 'bg-paper text-ink-mute'}`}>
              <p className="font-display text-sm font-semibold">Host</p>
              <p className="text-[10px] opacity-80">Public profile</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${!host ? 'bg-ink text-lemon ring-2 ring-lemon' : 'bg-paper text-ink-mute'}`}>
              <p className="font-display text-sm font-semibold">Buyer</p>
              <p className="text-[10px] opacity-80">Private dashboard</p>
            </div>
          </div>
        </Frame>
      );
    }
    case 'wallet':
    case 'walletChain':
      return (
        <Frame>
          <div className="space-y-1.5">
            {['MetaMask', 'Trust Wallet', 'WalletConnect'].map((w, i) => (
              <div key={w} className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${i === 0 ? 'bg-paper ring-2 ring-ink' : 'bg-paper/60'}`}>
                <span className="flex items-center gap-2 font-semibold">
                  <span className={`h-4 w-4 rounded-md ${i === 0 ? 'bg-lemon' : 'bg-frost'}`} />
                  {w}
                </span>
                {i === 0 && <span className="font-mono text-[10px]">0x7a3f…91c2</span>}
              </div>
            ))}
          </div>
          {kind === 'walletChain' && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-ink px-3 py-2 text-[11px] text-chalk">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-lemon" />BNB Smart Chain</span>
              <span className="font-mono text-lemon">Chain 56</span>
            </div>
          )}
        </Frame>
      );
    case 'profile':
      return (
        <Frame>
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-2xl bg-lemon" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold">Nimbus Labs</p>
              <p className="text-[10px] text-ink-mute">nimbus.xyz · @nimbuslabs</p>
            </div>
            <Btn tone="ghost">Edit</Btn>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="Token" value="NIMB" />
            <Field label="Payout wallet" value="0x4c1e…a07b" mono />
          </div>
        </Frame>
      );
    case 'apply':
      return (
        <Frame>
          <div className="mb-2 flex gap-1">
            {['ICO', 'IDO', 'Presale', 'IPO'].map((t, i) => (
              <span key={t} className={`rounded-full px-2.5 py-1 font-label text-[10px] font-bold ${i === 1 ? 'bg-ink text-lemon' : t === 'IPO' ? 'bg-frost text-ink-mute line-through' : 'bg-paper'}`}>
                {t}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Supply" value="1,000,000" mono />
            <Field label="Ticks" value="0.00010 to 0.00018" mono />
            <Field label="Soft cap" value="60 BNB" mono />
            <Field label="Hard cap" value="200 BNB" mono />
          </div>
          <div className="mt-3 flex justify-end"><Btn>Submit application</Btn></div>
        </Frame>
      );
    case 'approval':
      return (
        <Frame>
          <div className="space-y-2">
            {[
              ['Profile', 'Approved', true],
              ['Sale application', 'In review', false],
            ].map(([l, s, ok]) => (
              <div key={l as string} className="flex items-center justify-between rounded-xl bg-paper px-3 py-2 text-xs">
                <span className="font-semibold">{l}</span>
                <span className={`rounded-full px-2 py-0.5 font-label text-[10px] font-bold ${ok ? 'bg-lemon' : 'bg-frost text-ink-soft'}`}>{s}</span>
              </div>
            ))}
            <p className="rounded-xl border border-dashed border-ink/20 px-3 py-2 text-[10px] text-ink-mute">Changing name or payout wallet sends your profile back for re approval.</p>
          </div>
        </Frame>
      );
    case 'runSale':
      return (
        <Frame dark>
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-semibold">NIMB IDO</p>
            <span className="rounded-full bg-lemon px-2 py-0.5 font-label text-[10px] font-bold text-ink">Bidding open</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[['Bids', '412'], ['Committed', '318 BNB'], ['Closes', '06:14:22']].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-chalk/10 p-2">
                <p className="font-mono text-xs text-lemon">{v}</p>
                <p className="text-[9px] uppercase tracking-widest text-chalk/60">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-chalk/15"><div className="h-full w-[78%] rounded-full bg-lemon" /></div>
          <p className="mt-1 text-right font-label text-[10px] font-bold text-lemon">Hot</p>
        </Frame>
      );
    case 'escrow':
      return (
        <Frame>
          <p className="mb-2 font-label text-[10px] font-bold uppercase tracking-widest text-ink-mute">Escrow · 140 BNB</p>
          <div className="flex h-3 overflow-hidden rounded-full bg-frost">
            <div className="w-[20%] bg-ink" />
            <div className="w-[30%] bg-lemon" />
          </div>
          <div className="mt-3 space-y-1.5 text-xs">
            {[
              ['Upfront at close', '20%', 'Released'],
              ['M1 · Mainnet', '30%', 'Approved'],
              ['M2 · Audit', '25%', 'Pending'],
              ['M3 · v2 launch', '25%', 'Locked'],
            ].map(([l, p, s]) => (
              <div key={l} className="flex items-center justify-between rounded-lg bg-paper px-2.5 py-1.5">
                <span>{l}</span>
                <span className="flex items-center gap-2"><span className="font-mono">{p}</span><span className="text-[10px] text-ink-mute">{s}</span></span>
              </div>
            ))}
          </div>
        </Frame>
      );
    case 'vestingSetup':
    case 'claim': {
      return (
        <Frame>
          <svg viewBox="0 0 200 70" className="h-20 w-full">
            <line x1="10" y1="60" x2="190" y2="60" stroke="#0B0F05" strokeOpacity=".2" />
            <polyline points="10,60 10,50 60,50 180,10 190,10" fill="none" stroke="#0B0F05" strokeWidth="2.5" strokeLinejoin="round" />
            <polygon points="10,60 10,50 60,50 110,33 110,60" fill="#D4FF3A" />
            <text x="35" y="45" fontSize="7" textAnchor="middle" fill="#7C8270" fontFamily="var(--f-mono)">cliff</text>
            <text x="140" y="45" fontSize="7" textAnchor="middle" fill="#7C8270" fontFamily="var(--f-mono)">linear</text>
          </svg>
          {kind === 'claim' ? (
            <div className="mt-2 flex items-center justify-between">
              <div>
                <p className="font-mono text-sm font-semibold">48,200 NIMB</p>
                <p className="text-[10px] text-ink-mute">Claimable now</p>
              </div>
              <Btn>Claim</Btn>
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Field label="At TGE" value="10%" mono />
              <Field label="Cliff" value="30 days" mono />
              <Field label="Linear" value="180 days" mono />
            </div>
          )}
        </Frame>
      );
    }
    case 'browse':
      return (
        <Frame>
          <div className="mb-2 flex gap-1">
            {['All', 'ICO', 'IDO', 'Presale'].map((t, i) => (
              <span key={t} className={`rounded-full px-2.5 py-1 font-label text-[10px] font-bold ${i === 0 ? 'bg-ink text-lemon' : 'bg-paper'}`}>{t}</span>
            ))}
          </div>
          <div className="space-y-1.5">
            {[['Nimbus', 'IDO', 'On fire'], ['Orbita', 'ICO', 'Warm'], ['Kelp', 'Presale', 'Cold']].map(([n, t, g]) => (
              <div key={n} className="flex items-center justify-between rounded-xl bg-paper px-3 py-2 text-xs">
                <span className="flex items-center gap-2 font-semibold"><span className="h-5 w-5 rounded-lg bg-frost" />{n}</span>
                <span className="flex items-center gap-2"><span className="text-[10px] text-ink-mute">{t}</span>
                  <span className={`rounded-full px-2 py-0.5 font-label text-[9px] font-bold ${g === 'On fire' ? 'bg-ink text-lemon' : g === 'Warm' ? 'bg-lemon-soft' : 'bg-frost'}`}>{g}</span>
                </span>
              </div>
            ))}
          </div>
        </Frame>
      );
    case 'bid':
      return (
        <Frame>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Max price" value="0.00016 BNB" mono />
            <Field label="Quantity" value="125,000" mono />
            <Field label="Bid value" value="20.0 BNB" mono />
            <Field label="Deposit (masked)" value="50.0 BNB" mono />
          </div>
          <div className="mt-3 rounded-xl bg-ink p-3 text-chalk">
            <p className="font-label text-[9px] font-bold uppercase tracking-widest text-lemon">Your secret, save it</p>
            <p className="mt-1 truncate font-mono text-[10px]">0x9f2c4e81b7d0a35c66e1…</p>
            <div className="mt-2 flex gap-1.5"><Btn>Download backup</Btn><Btn tone="ghost"><span className="text-chalk">Copy</span></Btn></div>
          </div>
        </Frame>
      );
    case 'reveal':
      return (
        <Frame>
          <div className="flex items-center justify-between rounded-xl bg-paper px-3 py-2">
            <span className="text-xs font-semibold">Reveal window</span>
            <span className="font-mono text-xs">11:42:07 left</span>
          </div>
          <div className="mt-2 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 rounded-lg bg-paper px-3 py-1.5"><span className="h-3 w-3 rounded-full bg-lemon ring-1 ring-ink" />Secret found on this device</div>
            <div className="flex items-center gap-2 rounded-lg bg-paper px-3 py-1.5"><span className="h-3 w-3 rounded-full bg-lemon ring-1 ring-ink" />Hash matches commitment</div>
          </div>
          <div className="mt-3 flex justify-end"><Btn tone="ink">Reveal bid</Btn></div>
        </Frame>
      );
    case 'fresh':
      return (
        <Frame>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex-1 rounded-xl bg-paper px-3 py-2">
              <p className="font-label text-[9px] font-bold uppercase tracking-widest text-ink-mute">Bid wallet</p>
              <p className="font-mono">0x7a3f…91c2</p>
            </div>
            <span className="font-display text-lg">→</span>
            <div className="flex-1 rounded-xl bg-lemon px-3 py-2">
              <p className="font-label text-[9px] font-bold uppercase tracking-widest">Fresh wallet</p>
              <p className="font-mono">0xe51b…3d08</p>
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[11px] text-ink-soft">
            <span className="flex h-4 w-4 items-center justify-center rounded bg-ink text-[9px] text-lemon">✓</span>
            I control this address
          </label>
          <div className="mt-2 flex justify-end"><Btn>Claim to fresh wallet</Btn></div>
        </Frame>
      );
    case 'trade':
      return (
        <Frame>
          <p className="mb-2 font-label text-[10px] font-bold uppercase tracking-widest text-ink-mute">Allocation market</p>
          <div className="space-y-1.5 text-xs">
            {[['50,000 NIMB', '8.4 BNB', 'Buy'], ['20,000 NIMB', '3.5 BNB', 'Buy']].map(([a, p, c]) => (
              <div key={a} className="flex items-center justify-between rounded-xl bg-paper px-3 py-2">
                <span className="font-mono">{a}</span>
                <span className="flex items-center gap-2"><span className="font-mono text-ink-mute">{p}</span><Btn tone="ink">{c}</Btn></span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-end"><Btn tone="ghost">List my allocation</Btn></div>
        </Frame>
      );
    case 'badge':
      return (
        <Frame dark>
          <div className="flex items-center gap-3">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-lemon">
              <div className="h-10 w-10 rounded-full border-2 border-dashed border-ink" />
              <span className="absolute font-display text-xs font-extrabold text-ink">N</span>
            </div>
            <div>
              <p className="font-serif text-lg italic text-lemon">I was there.</p>
              <p className="text-[11px] text-chalk/70">Nimbus IDO · Participant</p>
              <p className="mt-1 text-[10px] text-chalk/50">No amounts. No prices.</p>
            </div>
          </div>
          <div className="mt-3 flex gap-1.5"><Btn>Share to X</Btn><Btn tone="ghost"><span className="text-chalk">Copy link</span></Btn></div>
        </Frame>
      );
  }
}
