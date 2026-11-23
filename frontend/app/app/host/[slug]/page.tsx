'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/ui/AppShell';
import Button from '@/components/ui/Button';
import HostProfile from '@/components/hostbuyer/HostProfile';
import { getHost } from '@/components/hostbuyer/client';
import { DemoNote, Gate } from '@/components/hostbuyer/kit';
import type { Host } from '@/lib/types';

export default function HostPage({ params }: { params: { slug: string } }) {
  const [host, setHost] = useState<Host | null | undefined>(undefined);
  useEffect(() => { getHost(decodeURIComponent(params.slug)).then((h) => setHost(h ?? null)); }, [params.slug]);
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6">
        <DemoNote />
        {host === undefined ? (
          <div className="h-80 animate-pulse rounded-blob bg-chalk" />
        ) : host === null ? (
          <Gate title="No host by that name" body="This profile does not exist or has not been approved yet." cta={<Button href="/app" variant="ink">Back to app</Button>} />
        ) : (
          <HostProfile host={host} />
        )}
      </div>
    </AppShell>
  );
}
