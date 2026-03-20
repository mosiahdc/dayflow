import { useRef, useCallback } from 'react';

interface SwipeOptions {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  /** Minimum horizontal distance in px to trigger a swipe. Default: 50 */
  threshold?: number;
  /** Max vertical drift allowed before the gesture is ignored. Default: 80 */
  maxVertical?: number;
}

/**
 * useSwipe — attaches touch listeners to any element and fires
 * onSwipeLeft / onSwipeRight when the user drags horizontally.
 *
 * Usage:
 *   const handlers = useSwipe({ onSwipeLeft: nextDay, onSwipeRight: prevDay });
 *   <div {...handlers}>...</div>
 */
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  maxVertical = 80,
}: SwipeOptions) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startX.current = touch.clientX;
    startY.current = touch.clientY;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (startX.current === null || startY.current === null) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - startX.current;
      const dy = Math.abs(touch.clientY - startY.current);

      startX.current = null;
      startY.current = null;

      // Ignore if vertical movement is too large (user is scrolling)
      if (dy > maxVertical) return;

      if (dx < -threshold) {
        onSwipeLeft();
      } else if (dx > threshold) {
        onSwipeRight();
      }
    },
    [onSwipeLeft, onSwipeRight, threshold, maxVertical]
  );

  return { onTouchStart, onTouchEnd };
}
