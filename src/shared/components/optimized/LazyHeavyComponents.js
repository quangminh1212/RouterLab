"use client";

import dynamic from "next/dynamic";
import { memo } from "react";

const DynamicMonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-black/5 dark:bg-white/5 rounded-lg">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-text-muted">Loading editor...</span>
      </div>
    </div>
  ),
});

const DynamicReactFlow = dynamic(() => import("@xyflow/react").then(mod => mod.ReactFlow), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-black/5 dark:bg-white/5 rounded-lg">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const DynamicRecharts = dynamic(() => import("recharts"), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
  ),
});

export const LazyMonacoEditor = memo(DynamicMonacoEditor);
export const LazyReactFlow = memo(DynamicReactFlow);
export const LazyRecharts = memo(DynamicRecharts);