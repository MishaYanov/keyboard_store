/** Lightly damped spring: preserve velocity on scroll changes, then settle exactly. */
export class KeycapMotion {
    public x = 0;
    public y = 0;
    public vx = 0;
    public vy = 0;
    private ready = false;
    private time = 0;

    public reset(): void { this.ready = false; }

    public snap(x: number, y: number, time: number): void {
        this.x = x; this.y = y; this.vx = 0; this.vy = 0;
        this.time = time; this.ready = true;
    }

    public follow(x: number, y: number, time: number): void {
        if (!this.ready) {
            this.snap(x, y, time); return;
        }
        let remaining = Math.min(.05, Math.max(0, (time-this.time)/1000));
        this.time = time;
        while (remaining > 0) {
            const dt = Math.min(1/120, remaining);
            this.vx += ((x-this.x)*150-this.vx*15)*dt;
            this.vy += ((y-this.y)*150-this.vy*15)*dt;
            this.x += this.vx*dt; this.y += this.vy*dt;
            remaining -= dt;
        }
        if (Math.hypot(this.x-x, this.y-y) < .08 && this.speed < .5) this.snap(x, y, time);
    }

    public get speed(): number { return Math.hypot(this.vx, this.vy); }
}
