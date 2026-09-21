export interface DashboardMetric {
    readonly label: string;
    readonly value: string;
    readonly change: string;
    readonly direction: 'up' | 'down' | 'flat';
}

export interface SalesPoint { readonly label: string; readonly value: number }
export interface OrderStage { readonly label: string; readonly count: number; readonly tone: 'new' | 'work' | 'done' }
export interface AdminOrder { readonly id: string; readonly customer: string; readonly configuration: string; readonly total: string; readonly status: string }
export interface ActivityItem { readonly time: string; readonly title: string; readonly detail: string }

export interface AdminDashboardData {
    readonly updatedAt: string;
    readonly metrics: readonly DashboardMetric[];
    readonly sales: readonly SalesPoint[];
    readonly stages: readonly OrderStage[];
    readonly orders: readonly AdminOrder[];
    readonly activity: readonly ActivityItem[];
}

export interface AdminDashboardResult {
    readonly data: AdminDashboardData;
    readonly source: 'api' | 'demo';
}
