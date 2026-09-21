import { batch } from '../reactive/batch';
import { computed } from '../reactive/computed';
import { signal, type ReadonlySignal, type WritableSignal } from '../reactive/signal';

export type ApiRequestStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ApiRequestContext {
    readonly signal: AbortSignal;
}

export type ApiRequestExecutor<TData, TVariables> = (
    variables: TVariables,
    context: ApiRequestContext,
) => Promise<TData>;

export interface ApiRequestSnapshot<TData> {
    readonly data: TData | null;
    readonly error: Error | null;
    readonly status: ApiRequestStatus;
    readonly loading: boolean;
    readonly hasData: boolean;
}

export interface ApiRequestOptions<TData> {
    readonly initialData?: TData | null;
}

export class ApiResponseError extends Error {
    public constructor(
        message: string,
        public readonly status: number,
        public readonly statusText: string,
        public readonly body: unknown,
    ) {
        super(message);
        this.name = 'ApiResponseError';
    }
}

function normalizeError(value: unknown): Error {
    return value instanceof Error ? value : new Error('The API request failed', { cause: value });
}

/**
 * A take-latest asynchronous resource backed by the engine's reactive graph.
 * Reading any public signal from an effect or computed value tracks it normally.
 */
export class ApiRequest<TData, TVariables = void> {
    private readonly initialData: TData | null;
    private readonly dataState: WritableSignal<TData | null>;
    private readonly errorState = signal<Error | null>(null);
    private readonly statusState = signal<ApiRequestStatus>('idle');
    private controller: AbortController | null = null;
    private requestVersion = 0;

    public readonly data: ReadonlySignal<TData | null>;
    public readonly error: ReadonlySignal<Error | null> = this.errorState;
    public readonly status: ReadonlySignal<ApiRequestStatus> = this.statusState;
    public readonly loading: ReadonlySignal<boolean>;
    public readonly successful: ReadonlySignal<boolean>;
    public readonly failed: ReadonlySignal<boolean>;
    public readonly hasData: ReadonlySignal<boolean>;
    public readonly snapshot: ReadonlySignal<ApiRequestSnapshot<TData>>;

    public constructor(
        private readonly executor: ApiRequestExecutor<TData, TVariables>,
        options: ApiRequestOptions<TData> = {},
    ) {
        this.initialData = options.initialData ?? null;
        this.dataState = signal<TData | null>(this.initialData);
        this.data = this.dataState;
        this.loading = computed(() => this.statusState.get() === 'loading');
        this.successful = computed(() => this.statusState.get() === 'success');
        this.failed = computed(() => this.statusState.get() === 'error');
        this.hasData = computed(() => this.dataState.get() !== null);
        this.snapshot = computed(() => ({
            data: this.dataState.get(),
            error: this.errorState.get(),
            status: this.statusState.get(),
            loading: this.loading.get(),
            hasData: this.hasData.get(),
        }));
    }

    public execute(): Promise<TData | undefined>;
    public execute(variables: TVariables): Promise<TData | undefined>;
    public async execute(variables?: TVariables): Promise<TData | undefined> {
        this.controller?.abort();
        const controller = new AbortController();
        const version = ++this.requestVersion;
        this.controller = controller;
        batch(() => {
            this.errorState.set(null);
            this.statusState.set('loading');
        });

        try {
            const data = await this.executor(variables as TVariables, { signal: controller.signal });
            if (controller.signal.aborted || version !== this.requestVersion) return undefined;
            batch(() => {
                this.dataState.set(data);
                this.statusState.set('success');
            });
            return data;
        } catch (value: unknown) {
            if (controller.signal.aborted || version !== this.requestVersion) return undefined;
            const error = normalizeError(value);
            batch(() => {
                this.errorState.set(error);
                this.statusState.set('error');
            });
            throw error;
        } finally {
            if (version === this.requestVersion) this.controller = null;
        }
    }

    public cancel(): void {
        if (!this.controller) return;
        this.requestVersion += 1;
        this.controller.abort();
        this.controller = null;
        this.statusState.set(this.dataState.get() === null ? 'idle' : 'success');
    }

    public reset(): void {
        this.cancel();
        batch(() => {
            this.dataState.set(this.initialData);
            this.errorState.set(null);
            this.statusState.set('idle');
        });
    }

    public dispose(): void { this.cancel(); }
}

export function createApiRequest<TData, TVariables = void>(
    executor: ApiRequestExecutor<TData, TVariables>,
    options?: ApiRequestOptions<TData>,
): ApiRequest<TData, TVariables> {
    return new ApiRequest(executor, options);
}

/** Fetches and parses JSON, throwing a structured error for HTTP or content failures. */
export async function requestJson<TData>(input: RequestInfo | URL, init: RequestInit = {}): Promise<TData> {
    const headers = new Headers(init.headers);
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');
    const response = await fetch(input, { credentials: 'same-origin', ...init, headers });
    const text = response.status === 204 ? '' : await response.text();
    const jsonResponse = response.headers.get('content-type')?.includes('application/json') ?? false;
    let body: unknown = null;
    if (text) {
        if (jsonResponse) {
            try { body = JSON.parse(text) as unknown; }
            catch (cause) { throw new ApiResponseError('The API returned invalid JSON', response.status, response.statusText, cause); }
        } else {
            body = text;
        }
    }
    if (!response.ok) throw new ApiResponseError(`API request failed with status ${response.status}`, response.status, response.statusText, body);
    if (response.status !== 204 && !jsonResponse) throw new ApiResponseError('The API did not return JSON', response.status, response.statusText, body);
    return body as TData;
}
