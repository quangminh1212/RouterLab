"use client";

import dynamic from "next/dynamic";
import { CardSkeleton } from "@/shared/components/Loading";

const DeferredEndpointPageClient = dynamic(() => import("./endpoint/EndpointPageClient"), {
  ssr: true,
  loading: () => (
    <div className="space-y-4">
      <CardSkeleton className="h-40 rounded-2xl" />
      <CardSkeleton className="h-64 rounded-2xl" />
      <CardSkeleton className="h-56 rounded-2xl" />
    </div>
  ),
});

export default function DashboardPage() {
  return <DeferredEndpointPageClient />;
}
