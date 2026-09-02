const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
    throw new Error('Missing #app element');
}

const canvas = document.createElement('canvas');
root.appendChild(canvas);

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Failed to acquire 2D canvas context');
    }

    return context;
}

const context = getCanvasContext(canvas);


if (!context) {
    throw new Error('Failed to acquire 2D canvas context');
}

function resize(): void {
    const dpr = window.devicePixelRatio || 1;

    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function render(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    context.clearRect(0, 0, width, height);

    context.fillStyle = '#111827';
    context.fillRect(0, 0, width, height);

    context.fillStyle = '#ffffff';
    context.font = '20px sans-serif';
    context.fillText('Hello Canvas UI', 32, 48);
}

function frame(): void {
    render();

    requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);

resize();
frame();