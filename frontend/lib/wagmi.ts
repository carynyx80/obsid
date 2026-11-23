import { http, createConfig } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
export const config = createConfig({ chains: [bsc], connectors: [injected()], transports: { [bsc.id]: http('https://bsc-dataseed.bnbchain.org') }, ssr: true });
export const ADMIN_WALLET = '0x7d6b84648Fe791b2a2623b8B4D6fbB00ce7daB76' as const;
