// $OBSID token config. Set on Vercel (no code change needed):
//   NEXT_PUBLIC_OBSID_CA       token contract address on BNB Smart Chain
//   NEXT_PUBLIC_OBSID_BUY_URL  link to buy $OBSID (DEX / launchpad page)
const ca = process.env.NEXT_PUBLIC_OBSID_CA || '';
export const OBSID_CA = /^0x[0-9a-fA-F]{40}$/.test(ca) ? (ca as `0x${string}`) : null;
export const OBSID_BUY_URL = process.env.NEXT_PUBLIC_OBSID_BUY_URL || null;
export const OBSID_SYMBOL = 'OBSID';
