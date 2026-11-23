'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/ui/AppShell';
import Button from '@/components/ui/Button';
import ConnectWallet from '@/components/ui/ConnectWallet';
import HostProfile from '@/components/hostbuyer/HostProfile';
import { getMyHost } from '@/components/hostbuyer/client';
import { DemoNote, Gate, Tag, useAuth } from '@/components/hostbuyer/kit';
import { useRole } from '@/lib/role';
import type { Host } from '@/lib/types';

export default function ProfilePage() {
  const { role } = useRole();
  const { address, isConnected } = useAuth();
  const [host, setHost] = useState<Host | null | undefined>(undefined);
  useEffect(() => { if (address) getMyHost(address).then((h) => setHost(h ?? null)); }, [address]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6">
        <DemoNote />
        {role === 'buyer' ? (
          <Gate title="Buyers have no profile" body="That is the point. Private buyers leave no public trace here. Your bids live in your dashboard." cta={<Button href="/app/dashboard" variant="ink">Open dashboard</Button>} />
        ) : !isConnected ? (
          <Gate title="Connect your host wallet" body="Your public profile is tied to the wallet that signs your sales." cta={<ConnectWallet />} />
        ) : host === undefined ? (
          <div className="h-80 animate-pulse rounded-blob bg-chalk" />
        ) : host === null ? (
          <Gate title="Make your mark" body="You have no host profile yet. Create one so buyers know who stands behind your sale." cta={<Button href="/app/profile/edit" variant="lemon">Create profile</Button>} />
        ) : (
          <HostProfile
            host={host}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Button href="/app/profile/edit" variant="ink" size="sm">Edit profile</Button>
                <Button href={`/app/host/${host.slug}`} variant="ghost" size="sm">Public view</Button>
                {!host.verified && <Tag tone="mute">Awaiting verification</Tag>}
              </div>
            }
          />
        )}
      </div>
    </AppShell>
  );
}
