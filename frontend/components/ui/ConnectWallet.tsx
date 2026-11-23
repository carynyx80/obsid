'use client';
import { useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { bsc } from 'wagmi/chains';

export const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

export default function ConnectWallet({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [noWallet, setNoWallet] = useState(false);

  const h = size === 'lg' ? 'h-16 px-8 text-sm' : size === 'sm' ? 'h-9 px-4 text-[11px]' : 'h-12 px-6 text-xs';
  const base = `inline-flex items-center justify-center gap-2 rounded-full font-label font-bold uppercase tracking-wide transition-all duration-300 active:scale-[0.97] whitespace-nowrap ${h} ${className}`;

  if (!mounted) return <button className={`${base} bg-ink text-paper`} disabled>Connect wallet</button>;

  if (isConnected && chainId !== bsc.id) {
    return (
      <button onClick={() => switchChain({ chainId: bsc.id })} className={`${base} bg-orange-400 text-ink hover:bg-ink hover:text-lemon`}>
        {switching ? 'Switching…' : 'Switch to BSC'}
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <button onClick={() => disconnect()} title="Disconnect" className={`${base} group bg-paper text-ink ring-1 ring-ink/15 hover:bg-ink hover:text-paper`}>
        <span className="h-2 w-2 rounded-full bg-lemon ring-1 ring-ink/50" />
        <span className="font-mono normal-case tracking-normal group-hover:hidden">{shortAddr(address)}</span>
        <span className="hidden group-hover:inline">Disconnect</span>
      </button>
    );
  }

  const onConnect = () => {
    const c = connectors[0];
    if (typeof window !== 'undefined' && !(window as unknown as { ethereum?: unknown }).ethereum) { setNoWallet(true); return; }
    if (c) connect({ connector: c, chainId: bsc.id });
  };

  return (
    <span className="inline-flex flex-col items-center gap-1">
      <button onClick={onConnect} className={`${base} bg-ink text-paper hover:bg-lemon hover:text-ink`}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M16 12.5h2" strokeLinecap="round" /><path d="M3 9h18" /></svg>
        {isPending ? 'Connecting…' : 'Connect wallet'}
      </button>
      {(noWallet || error) && <span className="font-body text-[11px] text-ink-mute">{noWallet ? 'No browser wallet found. Install MetaMask or Trust Wallet.' : 'Connection was cancelled.'}</span>}
    </span>
  );
}
