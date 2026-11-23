import type { Metadata, Viewport } from 'next';
import './globals.css';
import { fontVars } from '@/lib/fonts';
import Providers from './providers';
export const metadata: Metadata = { title: 'Obsid', description: 'Public hosts. Private buyers. The sealed bid launchpad on BNB Chain.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#D4FF3A' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={fontVars}><body className="min-h-screen"><Providers>{children}</Providers></body></html>;
}
