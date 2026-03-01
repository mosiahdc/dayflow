let interval: ReturnType<typeof setInterval> | null = null;
let remaining = 0;

self.onmessage = (e: MessageEvent) => {
    const { type, duration } = e.data as { type: string; duration?: number };

    if (type === 'START') {
        remaining = duration ?? 0;
        interval = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                self.postMessage({ type: 'DONE' });
                if (interval) clearInterval(interval);
            } else {
                self.postMessage({ type: 'TICK', remaining });
            }
        }, 1000);
    }

    if (type === 'PAUSE' && interval) {
        clearInterval(interval);
        interval = null;
    }

    if (type === 'RESUME') {
        interval = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                self.postMessage({ type: 'DONE' });
                if (interval) clearInterval(interval);
            } else {
                self.postMessage({ type: 'TICK', remaining });
            }
        }, 1000);
    }

    if (type === 'STOP') {
        if (interval) clearInterval(interval);
        remaining = 0;
    }
};