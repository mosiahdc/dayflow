import { useState, useRef, useCallback, useEffect } from 'react';
import type { TimerState, TimerMode } from '@/types';

export function useTimer(
    durationMins: number,
    mode: TimerMode = 'countdown',
    onComplete?: () => void
) {
    const totalSeconds = mode === 'pomodoro' ? 25 * 60 : durationMins * 60;

    const [state, setState] = useState<TimerState>('idle');
    const [remaining, setRemaining] = useState(totalSeconds);
    const workerRef = useRef<Worker | null>(null);
    const onCompleteRef = useRef(onComplete);

    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

    useEffect(() => {
        Notification.requestPermission();
        return () => workerRef.current?.terminate();
    }, []);

    const initWorker = useCallback(() => {
        if (workerRef.current) workerRef.current.terminate();
        workerRef.current = new Worker(
            new URL('../workers/timer.worker.ts', import.meta.url),
            { type: 'module' }
        );
        workerRef.current.onmessage = (e: MessageEvent) => {
            const { type, remaining: r } = e.data as { type: string; remaining?: number };
            if (type === 'TICK') setRemaining(r ?? 0);
            if (type === 'DONE') {
                setState('done');
                setRemaining(0);
                if (Notification.permission === 'granted') {
                    new Notification('DayFlow ✓', { body: 'Timer complete! Task checked.' });
                }
                onCompleteRef.current?.();
            }
        };
    }, []);

    const start = useCallback(() => {
        initWorker();
        setRemaining(totalSeconds);
        setState('running');
        workerRef.current?.postMessage({ type: 'START', duration: totalSeconds });
    }, [initWorker, totalSeconds]);

    const pause = useCallback(() => {
        setState('paused');
        workerRef.current?.postMessage({ type: 'PAUSE' });
    }, []);

    const resume = useCallback(() => {
        setState('running');
        workerRef.current?.postMessage({ type: 'RESUME' });
    }, []);

    const stop = useCallback(() => {
        setState('idle');
        setRemaining(totalSeconds);
        workerRef.current?.postMessage({ type: 'STOP' });
        workerRef.current?.terminate();
        workerRef.current = null;
    }, [totalSeconds]);

    const progress = totalSeconds === 0 ? 0 : 1 - remaining / totalSeconds;

    const display = (() => {
        const m = Math.floor(remaining / 60).toString().padStart(2, '0');
        const sec = (remaining % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    })();

    return { state, remaining, progress, display, start, pause, resume, stop };
}