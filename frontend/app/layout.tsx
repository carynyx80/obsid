import type { Metadata, Viewport } from 'next';
import './globals.css';
import { fontVars } from '@/lib/fonts';
import Providers from './providers';
const title = 'Obsid';
const description = 'Public hosts. Private buyers. The sealed bid launchpad on BNB Chain.';
export const metadata: Metadata = {
  metadataBase: new URL('https://www.obsid.site'),
  title,
  description,
  openGraph: { title, description, siteName: 'Obsid', type: 'website', url: '/' },
  twitter: { card: 'summary_large_image', title, description },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#D4FF3A' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={fontVars}><body className="min-h-screen"><Providers>{children}</Providers></body></html>;
}
