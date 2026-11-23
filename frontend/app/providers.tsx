'use client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { config } from '@/lib/wagmi';
import { RoleProvider } from '@/lib/role';
export default function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return <WagmiProvider config={config}><QueryClientProvider client={qc}><RoleProvider>{children}</RoleProvider></QueryClientProvider></WagmiProvider>;
}
