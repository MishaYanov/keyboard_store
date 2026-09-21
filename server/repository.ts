import type { CheckoutRecord, CheckoutResult, Specification, OrderRecord, OrderState, FulfillmentJob } from './models';

export class DuplicateRequestError extends Error {}
export interface WebhookTransaction {
    hasEvent(id: string): Promise<boolean>;
    insertEvent(id: string): Promise<void>;
    order(id: string): Promise<OrderRecord | null>;
    checkout(id: string): Promise<CheckoutRecord | null>;
    blockOrder(id: string, reason: string): Promise<void>;
    insertOrder(order: OrderRecord): Promise<void>;
    claimCheckout(id: string, orderId: string): Promise<void>;
    insertJob(job: FulfillmentJob): Promise<void>;
}
export interface CommerceRepository {
    findRequest(owner: string, key: string): Promise<CheckoutRecord | null>;
    checkout(id: string): Promise<CheckoutRecord | null>;
    insertCheckout(value: { id: string; owner: string; key: string; fingerprint: string; specification: Specification[] }): Promise<void>;
    setSpecification(id: string, value: Specification[]): Promise<void>;
    finishCheckout(id: string, result: CheckoutResult): Promise<void>;
    failCheckout(id: string): Promise<void>;
    transaction<T>(fn: (transaction: WebhookTransaction) => Promise<T>): Promise<T>;
    fulfillmentOverview(): Promise<{ jobs: Pick<FulfillmentJob, 'id' | 'order_id' | 'state' | 'created_at'>[]; reviews: Pick<OrderRecord, 'id' | 'reason' | 'created_at'>[] }>;
    job(id: string): Promise<FulfillmentJob | null>;
    countOrders(state: OrderState): Promise<number>;
    countJobs(): Promise<number>;
    ping(): Promise<void>;
    close(): Promise<void>;
}
