import type { UserSpaceData, UserSpaceResult } from '../models/client.types';
import { createApiRequest, requestJson, ApiResponseError } from '../../../engine';

const DEMO_USER: UserSpaceData = {
    firstName: 'Keycap enthusiast',
    memberSince: '2026',
    orders: [
        { id: 'CK-24018', placedAt: '2026-08-28', status: 'In production', name: 'Midnight bilingual set', details: '75% · ISO · 84 keys', itemCount: 1, totalCents: 16400 },
        { id: 'CK-23841', placedAt: '2026-06-14', status: 'Delivered', name: 'Warm grey essentials', details: '65% · ANSI · 68 keys', itemCount: 1, totalCents: 12900 },
    ],
    saved: [
        { id: 'draft-01', name: 'Deep ocean', details: '75% · English / Hebrew · 84 keys', priceCents: 17200, color: 'blue' },
        { id: 'draft-02', name: 'Paper & ink', details: '60% · English · 61 keys', priceCents: 11800, color: 'ivory' },
        { id: 'draft-03', name: 'Graphite workbench', details: 'TKL · English / Arabic · 87 keys', priceCents: 18900, color: 'graphite' },
    ],
    shipping: {
        recipient: 'Your default recipient',
        lines: ['Shipping address will appear here', 'after it is provided at checkout'],
        locality: 'City · Postal code',
        country: 'Country',
    },
};

/** Backend boundary for the account page. Replace the endpoint without touching the view. */
export class ClientService {
    public readonly overview = createApiRequest<UserSpaceResult>(async (_variables, { signal }) => {
        try {
            return { data: await requestJson<UserSpaceData>('/api/account/overview', { signal }), source: 'api' };
        } catch (error) {
            if (signal.aborted) throw error;
            if (error instanceof ApiResponseError && [401, 403].includes(error.status)) throw error;
            return { data: DEMO_USER, source: 'demo' };
        }
    });
}
