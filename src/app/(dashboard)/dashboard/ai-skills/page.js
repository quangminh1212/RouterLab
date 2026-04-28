import dynamic from "next/dynamic";

const AISkillsPageClient = dynamic(() => import("./AISkillsPageClient"), {
  loading: () => <div className="p-6 text-sm text-text-muted">Loading AI skills...</div>,
});

export default function AISkillsPage() {
  return <AISkillsPageClient />;
}
