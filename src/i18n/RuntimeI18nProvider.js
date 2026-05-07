"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { initRuntimeI18n, reloadTranslations } from "./runtime";

export function RuntimeI18nProvider({ children }) {
  const pathname = usePathname();
  const hasInitializedRef = useRef(false);
  const initialPathHandledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        initRuntimeI18n();
        hasInitializedRef.current = true;
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Re-process DOM when route changes
  useEffect(() => {
    if (!pathname || !hasInitializedRef.current) return;
    if (!initialPathHandledRef.current) {
      initialPathHandledRef.current = true;
      return;
    }

    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        reloadTranslations();
      });
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return <>{children}</>;
}
