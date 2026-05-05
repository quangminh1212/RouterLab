import { CardSkeleton } from "@/shared/components/Loading";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 h-6 w-40 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
        <div className="space-y-3">
          <div className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
          <div className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
          <div className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
