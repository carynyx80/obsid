import { z } from 'zod';
import { getAddress, isAddress } from 'viem';
import { SALE_STATUSES, SALE_TYPES } from './types.js';

export const addressSchema = z
  .string()
  .trim()
  .refine((v) => isAddress(v, { strict: false }), 'invalid address')
  .transform((v) => getAddress(v));

const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .url('must be a URL')
  .refine((v) => /^https?:\/\//i.test(v), 'must be an http(s) URL');
const optionalUrl = z.union([httpUrl, z.literal('')]).optional();
const linkText = z.string().trim().max(512).optional();

export const hostInputSchema = z
  .object({
    name: z.string().trim().min(2, 'name must be at least 2 characters').max(64),
    logo: optionalUrl,
    banner: optionalUrl,
    bio: z.string().trim().max(4000).optional(),
    links: z
      .object({ website: optionalUrl, x: linkText, telegram: linkText, discord: linkText, docs: optionalUrl })
      .strict()
      .optional(),
    team: z
      .array(z.object({ name: z.string().trim().min(1).max(80), role: z.string().trim().max(80).default('') }).strict())
      .max(50)
      .optional(),
    wallet: addressSchema.optional(),
  })
  .strict()
  .partial({ name: true });
export type HostInput = z.infer<typeof hostInputSchema>;

const positiveNumber = (label: string) =>
  z.coerce.number({ invalid_type_error: `${label} must be a number` }).finite().positive(`${label} must be greater than 0`);

const dateInput = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v, ctx) => {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be a valid date` });
        return z.NEVER;
      }
      return d;
    });

const pct = z.coerce.number().finite().min(0).max(100);

export function applicationInputSchema(now = Date.now()) {
  return z
    .object({
      type: z.string().transform((v, ctx) => {
        const t = v.trim().toUpperCase();
        if (t === 'IPO') {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'IPO sales are coming soon' });
          return z.NEVER;
        }
        if (!(SALE_TYPES as string[]).includes(t)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'type must be ICO, IDO or PRESALE' });
          return z.NEVER;
        }
        return t as (typeof SALE_TYPES)[number];
      }),
      tokenName: z.string().trim().min(1).max(64),
      tokenSymbol: z
        .string()
        .trim()
        .min(1)
        .max(16)
        .regex(/^[A-Za-z0-9$._-]+$/, 'tokenSymbol has invalid characters'),
      tokenAddress: z.union([addressSchema, z.literal('')]).optional(),
      supply: positiveNumber('supply'),
      minPrice: positiveNumber('minPrice'),
      softCapBnb: positiveNumber('softCapBnb'),
      hardCapBnb: positiveNumber('hardCapBnb'),
      start: dateInput('start'),
      end: dateInput('end'),
      revealEnd: dateInput('revealEnd'),
      escrowAtClosePct: pct,
      milestones: z
        .array(z.object({ label: z.string().trim().min(1).max(120), pct: z.coerce.number().finite().gt(0).max(100) }).strict())
        .max(20)
        .default([]),
      summary: z.string().trim().max(4000).default(''),
    })
    .strict()
    .superRefine((a, ctx) => {
      if (a.hardCapBnb <= a.softCapBnb) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hardCapBnb'], message: 'hardCapBnb must be greater than softCapBnb' });
      }
      if (a.start.getTime() <= now) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['start'], message: 'start must be in the future' });
      }
      if (a.end.getTime() <= a.start.getTime()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['end'], message: 'end must be after start' });
      }
      if (a.revealEnd.getTime() <= a.end.getTime()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['revealEnd'], message: 'revealEnd must be after end' });
      }
      const total = a.escrowAtClosePct + a.milestones.reduce((s, m) => s + m.pct, 0);
      if (Math.abs(total - 100) > 1e-9) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['milestones'],
          message: `escrowAtClosePct plus milestone pcts must sum to 100 (got ${total})`,
        });
      }
    });
}

export const reviewStatusQuery = z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional() });

export const salesQuery = z.object({
  type: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .pipe(z.enum(['ICO', 'IDO', 'PRESALE', 'IPO']))
    .optional(),
  hostId: z.string().max(64).optional(),
});

export const approveBody = z.object({ contractAddress: addressSchema.optional() }).strict();
export const rejectBody = z.object({ reason: z.string().trim().min(1, 'reason is required').max(1000) }).strict();
export const optionalRejectBody = z.object({ reason: z.string().trim().max(1000).optional() }).strict();

export const salePatchBody = z
  .object({
    contractAddress: z.union([addressSchema, z.null()]).optional(),
    status: z.enum(SALE_STATUSES as [string, ...string[]]).optional(),
    totalCommittedBnb: z.coerce.number().finite().min(0).optional(),
    bidCount: z.coerce.number().int().min(0).optional(),
    clearingPrice: z.union([z.coerce.number().finite().positive(), z.null()]).optional(),
    milestonesReleased: z.array(z.boolean()).optional(),
  })
  .strict();
