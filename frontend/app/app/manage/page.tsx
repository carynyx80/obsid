'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/ui/AppShell';
import Button from '@/components/ui/Button';
import ConnectWallet from '@/components/ui/ConnectWallet';
import HostSalePanel from '@/components/hostbuyer/HostSalePanel';
import { saleAddress } from '@/components/core/contracts';
import { Gate, PageHead, Rise, Tag, fmtDate, useAuth } from '@/components/hostbuyer/kit';
import { fetchHosts, fetchSales } from '@/lib/api';
import { useRole } from '@/lib/role';
import type { Host, Sale } from '@/lib/types';

export default function ManagePage() {
  const { role } = useRole();
  const { isConnected, address } = useAuth();
  const [hosts, setHosts] = useState<Host[] | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  useEffect(() => { Promise.all([fetchHosts(), fetchSales()]).then(([h, s]) => { setHosts(h); setSales(s); }); }, []);

  const me = hosts?.find((h) => address && h.wallet.toLowerCase() === address.toLowerCase());
  const mine = me ? sales.filter((s) => s.hostId === me.id) : [];

  let body: React.ReactNode;
  if (role !== 'host') body = <Gate title="Hosts only" body="Switch to host mode to manage your sales." cta={<Button href="/app">Switch role</Button>} />;
  else if (!isConnected) body = <Gate title="Connect your host wallet" body="Funding and withdrawals are signed by the wallet on your host profile." cta={<ConnectWallet />} />;
  else if (hosts === null) body = <p className="py-16 text-center font-body text-ink-mute">Loading your sales…</p>;
  else if (!me) body = <Gate title="No host profile for this wallet" body="Create your profile, then apply to run a sale." cta={<Button href="/app/profile/edit">Create profile</Button>} />;
  else if (mine.length === 0) body = <Gate title="No approved sales yet" body="Once the admin approves your application it shows up here, ready to fund." cta={<Button href="/app/apply">Apply</Button>} />;
  else
    body = (
      <div className="flex flex-col gap-6">
        {mine.map((s, i) => {
          const addr = saleAddress(s);
          return (
            <Rise key={s.id} delay={i * 0.05}>
              {addr ? (
                <HostSalePanel sale={s} saleAddr={addr} />
              ) : (
                <section className="rounded-[2.5rem] border border-dashed border-ink/20 bg-chalk p-6 sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-label text-xs font-bold uppercase tracking-[0.3em] text-ink-mute">{s.type} · {s.tokenSymbol}</p>
                      <h3 className="mt-1 font-display text-2xl font-extrabold">{s.tokenName}</h3>
                    </div>
                    <Tag tone="line">Awaiting onchain launch</Tag>
                  </div>
                  <p className="mt-3 font-body text-ink-soft">Approved. The admin is creating the sale contract. Once it exists you can fund it here before {fmtDate(s.start)}.</p>
                </section>
              )}
            </Rise>
          );
        })}
      </div>
    );

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <PageHead
          kicker="Host console"
          title={<>Run your<br />sale.</>}
          accent="fund it, then collect what you earned."
          aside={<p className="max-w-xs font-body text-ink-soft">Deposit tokens before bids open, withdraw BNB as milestones are released, reclaim unsold tokens and lock IDO liquidity.</p>}
        />
        {body}
      </div>
    </AppShell>
  );
}
