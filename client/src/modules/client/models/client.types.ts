export interface PurchaseRecord {
    readonly id: string;
    readonly placedAt: string;
    readonly status: 'Delivered' | 'In production' | 'Processing';
    readonly name: string;
    readonly details: string;
    readonly itemCount: number;
    readonly totalCents: number;
}

export interface SavedConfiguration {
    readonly id: string;
    readonly name: string;
    readonly details: string;
    readonly priceCents: number;
    readonly color: 'ivory' | 'graphite' | 'blue';
}

export interface ShippingAddress {
    readonly recipient: string;
    readonly lines: readonly string[];
    readonly locality: string;
    readonly country: string;
}

export interface UserSpaceData {
    readonly firstName: string;
    readonly memberSince: string;
    readonly orders: readonly PurchaseRecord[];
    readonly saved: readonly SavedConfiguration[];
    readonly shipping: ShippingAddress | null;
}

export interface UserSpaceResult {
    readonly data: UserSpaceData;
    readonly source: 'api' | 'demo';
}
