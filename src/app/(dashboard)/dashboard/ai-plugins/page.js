import dynamic from "next/dynamic";

const AIPluginsPageClient = dynamic(() => import("./AIPluginsPageClient"), {
  loading: () => <div className="p-6 text-sm text-text-muted">Loading AI plugins...</div>,
});

export default function AIPluginsPage() {
  return <AIPluginsPageClient />;
}
