import { useEffect, useRef, useState } from "react";

interface UsePullToRefreshOptions {
  threshold?: number;
  maxPull?: number;
  onRefresh?: () => void | Promise<void>;
}

function hasScrollableParentWithOffset(target: EventTarget | null): boolean {
  let el = target instanceof HTMLElement ? target : null;
  while (el && el !== document.body) {
    if (el.scrollTop > 0) {
      const style = window.getComputedStyle(el);
      if (style.overflowY === "auto" || style.overflowY === "scroll") {
        return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}

export function usePullToRefresh({
  threshold = 68,
  maxPull = 104,
  onRefresh,
}: UsePullToRefreshOptions = {}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current || e.touches.length !== 1) return;
      if (window.scrollY > 2) return;
      if (document.body.style.overflow === "hidden") return;
      if (document.querySelector('[role="dialog"]')) return;
      if (hasScrollableParentWithOffset(e.target)) return;

      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || startYRef.current === null || isRefreshingRef.current) return;
      if (window.scrollY > 2) {
        pullingRef.current = false;
        startYRef.current = null;
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }

      const deltaY = e.touches[0].clientY - startYRef.current;
      if (deltaY <= 0) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }

      // Giảm chấn lực kéo để tạo cảm giác tự nhiên
      const damped = Math.min(maxPull, Math.round(deltaY * 0.45));
      pullDistanceRef.current = damped;
      setPullDistance(damped);
    };

    const handleTouchEnd = async () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      startYRef.current = null;

      if (pullDistanceRef.current >= threshold && !isRefreshingRef.current) {
        isRefreshingRef.current = true;
        setIsRefreshing(true);
        setPullDistance(56);
        try {
          if (onRefresh) {
            await onRefresh();
          } else {
            window.location.reload();
          }
        } finally {
          isRefreshingRef.current = false;
          setIsRefreshing(false);
          pullDistanceRef.current = 0;
          setPullDistance(0);
        }
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [threshold, maxPull, onRefresh]);

  return {
    pullDistance,
    isRefreshing,
    isReadyToRefresh: pullDistance >= threshold,
  };
}
