'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AppShell from '@/components/ui/AppShell';
import Button from '@/components/ui/Button';
import ConnectWallet from '@/components/ui/ConnectWallet';
import { getMyHost, saveHost, type HostInput } from '@/components/hostbuyer/client';
import { DemoNote, Field, Gate, Input, Kicker, PageHead, Rise, Textarea, ease, useAuth } from '@/components/hostbuyer/kit';
import { useRole } from '@/lib/role';
import type { Host } from '@/lib/types';

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const LINKS: { k: keyof Host['links']; label: string; ph: string }[] = [
  { k: 'website', label: 'Website', ph: 'https://' }, { k: 'x', label: 'X', ph: 'https://x.com/' }, { k: 'telegram', label: 'Telegram', ph: 'https://t.me/' },
  { k: 'discord', label: 'Discord', ph: 'https://discord.gg/' }, { k: 'docs', label: 'Docs', ph: 'https://' },
];

export default function EditProfilePage() {
  const { role } = useRole();
  const router = useRouter();
  const { address, isConnected, auth } = useAuth();
  const [prev, setPrev] = useState<Host | undefined>();
  const [f, setF] = useState<HostInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!address) return;
    getMyHost(address).then((h) => {
      setPrev(h);
      setF(h ? { name: h.name, slug: h.slug, logo: h.logo, banner: h.banner, bio: h.bio, wallet: h.wallet, links: { ...h.links }, team: h.team.map((t) => ({ ...t })) }
        : { name: '', slug: '', logo: '', banner: '', bio: '', wallet: address, links: {}, team: [{ name: '', role: '' }] });
    });
  }, [address]);

  const set = <K extends keyof HostInput>(k: K, v: HostInput[K]) => setF((p) => (p ? { ...p, [k]: v } : p));
  const nameChanged = !!prev && !!f && prev.name !== f.name;
  const walletChanged = !!prev && !!f && prev.wallet.toLowerCase() !== f.wallet.toLowerCase();
  const valid = !!f && f.name.trim().length > 1 && /^0x[0-9a-fA-F]{40}$/.test(f.wallet) && f.bio.trim().length > 10;

  async function save() {
    if (!f) return;
    setBusy(true); setErr('');
    try {
      const clean: HostInput = { ...f, name: f.name.trim(), slug: f.slug || slugify(f.name), logo: f.logo.trim() || f.name.trim().charAt(0).toUpperCase(), team: f.team.filter((t) => t.name.trim()) };
      await saveHost(clean, await auth(), prev);
      router.push('/app/profile');
    } catch (e) { setErr(e instanceof Error ? e.message.slice(0, 200) : 'Could not save'); setBusy(false); }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <PageHead kicker="Host profile" title={prev ? 'Edit profile' : 'Create profile'} accent="what the world sees before it bids." />
        <DemoNote />
        {role === 'buyer' ? (
          <Gate title="Buyers stay unlisted" body="Switch to host mode to manage a public profile." cta={<Button href="/app" variant="ink">Back to app</Button>} />
        ) : !isConnected ? (
          <Gate title="Connect your host wallet" body="Edits are signed by your wallet." cta={<ConnectWallet />} />
        ) : !f ? (
          <div className="h-80 animate-pulse rounded-blob bg-chalk" />
        ) : (
          <div className="grid gap-10 lg:grid-cols-12">
            <Rise className="space-y-6 lg:col-span-7">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Project name" hint={nameChanged ? 'needs review' : undefined}>
                  <Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Verdant Labs" />
                </Field>
                <Field label="Handle" hint="your profile url">
                  <Input mono value={f.slug} onChange={(e) => set('slug', slugify(e.target.value))} placeholder={slugify(f.name) || 'verdant'} />
                </Field>
              </div>
              <Field label="Bio"><Textarea value={f.bio} onChange={(e) => set('bio', e.target.value)} placeholder="What you build and why it matters." /></Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Logo" hint="image url or a letter"><Input value={f.logo} onChange={(e) => set('logo', e.target.value)} placeholder="V" /></Field>
                <Field label="Banner" hint="image url"><Input value={f.banner ?? ''} onChange={(e) => set('banner', e.target.value)} placeholder="https://" /></Field>
              </div>
              <Field label="Public host wallet" hint={walletChanged ? 'needs review' : 'receives escrow releases'}>
                <Input mono value={f.wallet} onChange={(e) => set('wallet', e.target.value.trim())} />
              </Field>

              <AnimatePresence>
                {(nameChanged || walletChanged) && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ ease }} className="overflow-hidden">
                    <div className="flex items-start gap-4 rounded-3xl bg-ink p-5 text-paper">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lemon font-display text-ink">!</span>
                      <div>
                        <p className="font-display text-lg font-semibold">Goes back to admin for re approval</p>
                        <p className="mt-1 font-body text-sm text-paper/70">Changing your {[nameChanged && 'name', walletChanged && 'wallet'].filter(Boolean).join(' and ')} removes the verified badge until the desk signs off again.</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <Kicker>Links</Kicker>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {LINKS.map((l) => (
                    <Field key={l.k} label={l.label}>
                      <Input value={f.links[l.k] ?? ''} onChange={(e) => set('links', { ...f.links, [l.k]: e.target.value || undefined })} placeholder={l.ph} />
                    </Field>
                  ))}
                </div>
              </div>

              <div>
                <Kicker>Team</Kicker>
                <div className="mt-3 space-y-3">
                  {f.team.map((t, i) => (
                    <div key={i} className="flex flex-wrap gap-3 sm:flex-nowrap">
                      <Input className="min-w-0 flex-1" value={t.name} onChange={(e) => set('team', f.team.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Name" />
                      <Input className="min-w-0 flex-1" value={t.role} onChange={(e) => set('team', f.team.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} placeholder="Role" />
                      <button type="button" onClick={() => set('team', f.team.filter((_, j) => j !== i))} className="px-2 font-label text-[10px] uppercase tracking-[0.18em] text-ink-mute hover:text-ink">Remove</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => set('team', [...f.team, { name: '', role: '' }])} className="w-full rounded-2xl border border-dashed border-ink/25 py-3 font-label text-xs uppercase tracking-[0.16em] text-ink-soft hover:border-ink hover:text-ink">Add person</button>
                </div>
              </div>

              {err && <p className="rounded-2xl bg-ink p-4 font-body text-sm text-lemon">{err}</p>}
              <div className="flex flex-wrap gap-3">
                <Button variant="lemon" disabled={!valid || busy} onClick={save}>{busy ? 'Signing…' : 'Sign and save'}</Button>
                <Button variant="ghost" href="/app/profile">Cancel</Button>
              </div>
            </Rise>

            {/* live preview card */}
            <Rise delay={0.15} className="lg:col-span-5">
              <div className="sticky top-24">
                <Kicker>Live preview</Kicker>
                <motion.div layout className="mt-3 overflow-hidden rounded-blob border border-ink/10 bg-paper shadow-[12px_12px_0_#D4FF3A]">
                  <div className="grain relative h-28 bg-lemon">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {f.banner && /^https?:/.test(f.banner) && <img src={f.banner} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="p-6 pt-0">
                    <div className="-mt-10 grid h-20 w-20 place-items-center overflow-hidden rounded-3xl border-4 border-paper bg-ink font-display text-3xl font-bold text-lemon">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {/^https?:/.test(f.logo) ? <img src={f.logo} alt="" className="h-full w-full object-cover" /> : (f.logo || f.name.charAt(0) || '?').slice(0, 2)}
                    </div>
                    <h3 className="mt-4 font-display text-3xl font-semibold leading-none">{f.name || 'Your project'}</h3>
                    <p className="mt-1 font-mono text-xs text-ink-mute">/app/host/{f.slug || slugify(f.name) || 'handle'}</p>
                    <p className="mt-4 font-body text-ink-soft">{f.bio || 'Your bio appears here.'}</p>
                  </div>
                </motion.div>
              </div>
            </Rise>
          </div>
        )}
      </div>
    </AppShell>
  );
}
