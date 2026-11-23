import { randomBytes } from 'node:crypto';
import type { RequestHandler } from 'express';
import { getAddress, isAddress, verifyMessage } from 'viem';
import type { Config } from './config.js';
import { HttpError } from './http.js';
import type { Store } from './store/types.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { address: `0x${string}`; isAdmin: boolean };
    }
  }
}

export function buildSignInMessage(address: string, nonce: string): string {
  return `Sign in to Obsid\nAddress: ${address}\nNonce: ${nonce}`;
}

export function newNonce(): string {
  return randomBytes(16).toString('hex');
}

export function parseAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) return null;
  return getAddress(value);
}

export const sameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Verifies x-address / x-signature / x-nonce. The nonce is consumed (single use) before the
 * signature is checked, so a captured header set can never be replayed and failed attempts burn it.
 */
export function requireAuth(store: Store, config: Config): RequestHandler {
  return async (req, _res, next) => {
    const rawAddress = req.header('x-address');
    const signature = req.header('x-signature');
    const nonce = req.header('x-nonce');
    if (!rawAddress || !signature || !nonce) throw new HttpError(401, 'missing auth headers (x-address, x-signature, x-nonce)');
    const address = parseAddress(rawAddress);
    if (!address) throw new HttpError(401, 'invalid x-address');
    if (!/^0x[0-9a-fA-F]+$/.test(signature) || nonce.length > 128) throw new HttpError(401, 'invalid signature');

    const consumed = await store.consumeNonce(address, nonce);
    if (!consumed) throw new HttpError(401, 'invalid or expired nonce');

    let valid = false;
    try {
      valid = await verifyMessage({
        address,
        message: buildSignInMessage(address, nonce),
        signature: signature as `0x${string}`,
      });
    } catch {
      valid = false;
    }
    if (!valid) throw new HttpError(401, 'invalid signature');

    req.auth = { address, isAdmin: sameAddress(address, config.adminWallet) };
    next();
  };
}

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.auth) throw new HttpError(401, 'unauthenticated');
  if (!req.auth.isAdmin) throw new HttpError(403, 'admin only');
  next();
};
