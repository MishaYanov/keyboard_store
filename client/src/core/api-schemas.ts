import { z } from 'zod';

const money = z.object({ amount: z.string().regex(/^\d+(\.\d+)?$/), currencyCode: z.string().regex(/^[A-Z]{3}$/) });
export const availabilitySchema = z.object({ configured: z.boolean(), mock: z.boolean().optional() });
export const catalogSchema = z.object({ variants: z.array(z.object({ id: z.string(), title: z.string(), price: money, availableForSale: z.boolean() })) });
export const checkoutSchema = z.object({ checkoutUrl: z.string().url(), cost: z.object({ subtotalAmount: money, totalAmount: money }), configurationIds: z.array(z.string()) });
export const accountSchema = z.object({
    firstName: z.string(), memberSince: z.string(),
    orders: z.array(z.object({ id: z.string(), placedAt: z.iso.date(), status: z.enum(['Delivered', 'In production', 'Processing']), name: z.string(), details: z.string(), itemCount: z.number().int().nonnegative(), totalCents: z.number().int().nonnegative() })),
    saved: z.array(z.object({ id: z.string(), name: z.string(), details: z.string(), priceCents: z.number().int().nonnegative(), color: z.enum(['ivory', 'graphite', 'blue']) })),
    shipping: z.object({ recipient: z.string(), lines: z.array(z.string()), locality: z.string(), country: z.string() }).nullable(),
});
export const dashboardSchema = z.object({
    updatedAt: z.iso.datetime(),
    metrics: z.array(z.object({ label: z.string(), value: z.string(), change: z.string(), direction: z.enum(['up', 'down', 'flat']) })),
    sales: z.array(z.object({ label: z.string(), value: z.number().nonnegative() })),
    stages: z.array(z.object({ label: z.string(), count: z.number().int().nonnegative(), tone: z.enum(['new', 'work', 'done']) })),
    orders: z.array(z.object({ id: z.string(), customer: z.string(), configuration: z.string(), total: z.string(), status: z.string() })),
    activity: z.array(z.object({ time: z.string(), title: z.string(), detail: z.string() })),
});
