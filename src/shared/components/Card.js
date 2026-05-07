"use client";

import { memo } from "react";
import { cn } from "@/shared/utils/cn";

function Card({
  children,
  title,
  subtitle,
  icon,
  action,
  padding = "md",
  hover = false,
  className,
  ...props
}) {
  const paddings = {
    none: "",
    xs: "p-3",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div
      className={cn(
        "bg-surface",
        "border border-black/5 dark:border-white/5",
        "rounded-lg shadow-sm",
        hover && "hover:shadow-md hover:border-primary/30 transition-all cursor-pointer",
        paddings[padding],
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="p-2 rounded-lg bg-bg text-text-muted">
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
              </div>
            )}
            <div>
              {title && (
                <h3 className="text-text-main font-semibold">{title}</h3>
              )}
              {subtitle && (
                <p className="text-sm text-text-muted">{subtitle}</p>
              )}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export default memo(Card);

export function CardSkeleton({ className }) {
  return (
    <div
      className={cn(
        "bg-surface border border-black/5 dark:border-white/5 rounded-lg shadow-sm p-6 animate-pulse",
        className
      )}
    >
      <div className="h-4 bg-black/5 dark:bg-white/5 rounded w-1/3 mb-4" />
      <div className="h-3 bg-black/5 dark:bg-white/5 rounded w-2/3 mb-2" />
      <div className="h-3 bg-black/5 dark:bg-white/5 rounded w-1/2" />
    </div>
  );
}