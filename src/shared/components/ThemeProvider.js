"use client";

import { useEffect, memo } from "react";
import useThemeStore from "@/store/themeStore";

function ThemeProviderComponent({ children }) {
  const initTheme = useThemeStore((state) => state.initTheme);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return <>{children}</>;
}

export const ThemeProvider = memo(ThemeProviderComponent);