export type ScheduledJob = () => void;

export type SchedulerErrorHandler = (
    error: unknown,
    job: ScheduledJob,
) => void;

export interface SchedulerOptions {
    onError?: SchedulerErrorHandler;
}

function reportUnhandledError(error: unknown): void {
    queueMicrotask(() => {
        throw error;
    });
}

/**
 * Batches jobs into microtasks and deduplicates them by function identity.
 *
 * Jobs queued while a flush is running are handled as follows:
 * - a job still waiting in the current flush is not queued again;
 * - a job that has already run is queued for the next microtask.
 */
export class Scheduler {
    private readonly jobs = new Set<ScheduledJob>();
    private readonly onError: SchedulerErrorHandler;

    private activeJobs: Set<ScheduledJob> | null = null;
    private flushPending = false;
    private flushing = false;

    public constructor(options: SchedulerOptions = {}) {
        this.onError = options.onError ?? reportUnhandledError;
    }

    /**
     * Queues a job to run once during the next available flush.
     */
    public queue(job: ScheduledJob): void {
        if (this.activeJobs?.has(job)) {
            return;
        }

        this.jobs.add(job);

        if (!this.flushing) {
            this.requestFlush();
        }
    }

    /**
     * Cancels a queued job, including one still waiting in the active flush.
     */
    public cancel(job: ScheduledJob): void {
        this.jobs.delete(job);
        this.activeJobs?.delete(job);
    }

    /**
     * Cancels every job that has not started yet.
     */
    public clear(): void {
        this.jobs.clear();
        this.activeJobs?.clear();
    }

    /**
     * Flushes queued work synchronously. Intended primarily for tests.
     */
    public flushNow(): void {
        if (this.flushing) {
            return;
        }

        this.flush();
    }

    public hasPendingJobs(): boolean {
        return this.jobs.size > 0 || (this.activeJobs?.size ?? 0) > 0;
    }

    private requestFlush(): void {
        if (this.flushPending) {
            return;
        }

        this.flushPending = true;

        queueMicrotask(() => {
            this.flush();
        });
    }

    private flush(): void {
        if (this.flushing) {
            return;
        }

        this.flushPending = false;

        if (this.jobs.size === 0) {
            return;
        }

        this.flushing = true;
        this.activeJobs = new Set(this.jobs);
        this.jobs.clear();

        try {
            while (this.activeJobs.size > 0) {
                const job = this.activeJobs.values().next().value;

                if (job === undefined) {
                    break;
                }

                this.activeJobs.delete(job);

                try {
                    job();
                } catch (error: unknown) {
                    this.onError(error, job);
                }
            }
        } finally {
            this.activeJobs = null;
            this.flushing = false;

            if (this.jobs.size > 0) {
                this.requestFlush();
            }
        }
    }
}
