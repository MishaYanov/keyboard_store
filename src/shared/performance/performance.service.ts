export interface PerformanceSample {
    fps: number;
    frameMs: number;
    heapMiB: number | null;
    longTasks: number | null;
    nodes: number;
    canvasMegapixels: number;
}

/** Opt-in browser telemetry. FPS measures animation-frame cadence, not GPU throughput. */
export class PerformanceService {
    private frame: number | null = null;
    private observer: PerformanceObserver | null = null;

    public start(onSample: (sample: PerformanceSample) => void): void {
        this.stop();
        let start = performance.now();
        let frames = 0;
        let tasks: number | null = null;
        if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask')) {
            try {
                this.observer = new PerformanceObserver(list => { tasks = (tasks ?? 0) + list.getEntries().length; });
                this.observer.observe({ type: 'longtask' });
                tasks = 0;
            } catch { this.observer?.disconnect(); this.observer = null; }
        }
        const tick = (time: number) => {
            frames++;
            const elapsed = time - start;
            if (elapsed >= 1000) {
                const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
                const bytes = memory?.usedJSHeapSize;
                let pixels = 0;
                for (const canvas of document.querySelectorAll('canvas')) pixels += canvas.width * canvas.height;
                onSample({
                    fps: frames * 1000 / elapsed,
                    frameMs: elapsed / frames,
                    heapMiB: typeof bytes === 'number' && Number.isFinite(bytes) ? bytes / 1048576 : null,
                    longTasks: tasks,
                    nodes: document.getElementsByTagName('*').length,
                    canvasMegapixels: pixels / 1000000,
                });
                frames = 0;
                start = time;
            }
            this.frame = requestAnimationFrame(tick);
        };
        this.frame = requestAnimationFrame(tick);
    }

    public stop(): void {
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
        this.observer?.disconnect();
        this.observer = null;
    }
}
