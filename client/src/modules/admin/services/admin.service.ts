import type { AdminDashboardData, AdminDashboardResult } from '../models/admin.types';
import { createApiRequest, requestJson } from '../../../engine';
import { dashboardSchema } from '../../../core/api-schemas';

const DEMO_DASHBOARD: AdminDashboardData = {
    updatedAt: new Date().toISOString(),
    metrics: [
        { label: 'Revenue', value: '$48,260', change: '+12.8%', direction: 'up' },
        { label: 'Orders', value: '284', change: '+8.4%', direction: 'up' },
        { label: 'Conversion', value: '3.62%', change: '+0.31%', direction: 'up' },
        { label: 'Avg. order', value: '$169.93', change: '-1.6%', direction: 'down' },
    ],
    sales: [
        { label: 'Mon', value: 42 }, { label: 'Tue', value: 57 }, { label: 'Wed', value: 48 },
        { label: 'Thu', value: 76 }, { label: 'Fri', value: 66 }, { label: 'Sat', value: 91 }, { label: 'Sun', value: 82 },
    ],
    stages: [
        { label: 'New', count: 18, tone: 'new' },
        { label: 'In production', count: 31, tone: 'work' },
        { label: 'Ready to ship', count: 12, tone: 'done' },
    ],
    orders: [
        { id: 'CK-24027', customer: 'M. Cohen', configuration: '75% · ISO · 84 keys', total: '$174.00', status: 'Production' },
        { id: 'CK-24026', customer: 'A. Novak', configuration: 'TKL · ANSI · 87 keys', total: '$192.00', status: 'Review' },
        { id: 'CK-24025', customer: 'J. Kim', configuration: '65% · ANSI · 68 keys', total: '$136.00', status: 'Ready' },
        { id: 'CK-24024', customer: 'S. Levi', configuration: '60% · ISO · 61 keys', total: '$124.00', status: 'Production' },
    ],
    activity: [
        { time: '11:42', title: 'Order approved', detail: 'CK-24027 moved into production.' },
        { time: '10:18', title: 'Low stock signal', detail: 'Ivory 1.25u blanks reached 18 units.' },
        { time: '09:36', title: 'New configuration', detail: 'A multilingual TKL set entered review.' },
        { time: '08:05', title: 'Batch completed', detail: 'Seven orders are ready for packing.' },
    ],
};

/** Typed gateway for the future admin backend. */
export class AdminService {
    public constructor(private readonly mode: 'live' | 'demo' = 'live') {}
    public readonly dashboard = createApiRequest<AdminDashboardResult>(async (_variables, { signal }) => {
        if (this.mode === 'demo') return { data: structuredClone(DEMO_DASHBOARD), source: 'demo' };
        return { data: dashboardSchema.parse(await requestJson<unknown>('/api/admin/dashboard', { signal })), source: 'api' };
    });
}
