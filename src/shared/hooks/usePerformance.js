"use client";

import { useCallback, useRef, useEffect } from "react";

export function useDebounce(callback, delay) {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}

export function useThrottle(callback, delay) {
  const lastRan = useRef(Date.now());
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args) => {
      const now = Date.now();
      if (now - lastRan.current >= delay) {
        callbackRef.current(...args);
        lastRan.current = now;
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(
          () => {
            callbackRef.current(...args);
            lastRan.current = Date.now();
          },
          delay - (now - lastRan.current)
        );
      }
    },
    [delay]
  );
}

export function useIntersectionObserver(options = {}) {
  const elementRef = useRef(null);
  const observerRef = useRef(null);
  const callbackRef = useRef(options.onIntersect);

  useEffect(() => {
    callbackRef.current = options.onIntersect;
  }, [options.onIntersect]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && callbackRef.current) {
            callbackRef.current(entry);
          }
        });
      },
      {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || "0px",
      }
    );

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [options.threshold, options.rootMargin]);

  return elementRef;
}