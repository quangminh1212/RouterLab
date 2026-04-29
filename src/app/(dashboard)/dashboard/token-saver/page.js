import Link from "next/link";

const REPOS = [
  { name: "RTK (Rust Token Killer)", url: "https://github.com/rtk-ai/rtk", note: "Giảm token output terminal/log/build/test." },
  { name: "Context Mode", url: "https://github.com/mksglu/context-mode", note: "Đẩy output tool vào SQLite, chỉ đọc bản tóm tắt." },
  { name: "code-review-graph", url: "https://github.com/tirth8205/code-review-graph", note: "Knowledge graph local cho codebase lớn/monorepo." },
  { name: "Token Savior", url: "https://github.com/Mibayy/token-savior", note: "Đi theo symbol thay vì mở full file." },
  { name: "Caveman Claude", url: "https://github.com/JuliusBrussee/caveman-claude", note: "Rút gọn output text nhưng vẫn giữ ý chính." },
  { name: "claude-token-efficient", url: "https://github.com/drona23/claude-token-efficient", note: "Drop-in prompt/CLAUDE.md để phản hồi ngắn gọn." },
  { name: "token-optimizer-mcp", url: "https://github.com/ooples/token-optimizer-mcp", note: "MCP có caching + nén + giảm lặp output." },
  { name: "claude-token-optimizer", url: "https://github.com/nadimtuhin/claude-token-optimizer", note: "Bộ setup/prompt tái sử dụng để tối ưu token." },
  { name: "token-optimizer", url: "https://github.com/alexgreensh/token-optimizer", note: "Giảm ghost tokens và giữ chất lượng context." },
  { name: "claude-context (Zilliz)", url: "https://github.com/zilliztech/claude-context", note: "Code search + retrieval thông minh để giảm context." },
];

function getOwnerAvatar(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const owner = parts[0];
    if (!owner) return "/topup.png";
    return `https://github.com/${owner}.png`;
  } catch {
    return "/topup.png";
  }
}

export default function TokenSaverPage() {
  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-text-main">Token Saver</h1>
        <p className="text-sm text-text-muted">Danh sách repo tham khảo cho mục tiêu tiết kiệm token.</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-black/10 p-4 md:p-5 space-y-3">
        <div className="grid grid-cols-1 gap-3">
          {REPOS.map((repo) => (
            <div key={repo.url} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 hover:border-primary/40 transition-colors flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-3">
                <img
                  src={getOwnerAvatar(repo.url)}
                  alt={`${repo.name} owner avatar`}
                  className="size-9 shrink-0 rounded-lg bg-white object-cover"
                  loading="lazy"
                />

                <div className="min-w-0">
                <a href={repo.url} target="_blank" rel="noopener noreferrer" className="font-medium text-text-main hover:text-primary transition-colors truncate block">
                  {repo.name}
                </a>
                <p className="text-sm text-text-muted mt-1 truncate">{repo.note}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/dashboard/mcp-servers"
                  className="size-9 rounded-full border border-white/15 hover:border-primary/50 hover:bg-primary/10 transition-colors flex items-center justify-center"
                  title="Cài đặt / tích hợp"
                >
                  <span className="material-symbols-outlined text-[20px]">settings</span>
                </Link>
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="size-9 rounded-full border border-white/15 hover:border-primary/50 hover:bg-primary/10 transition-colors flex items-center justify-center"
                  title="Thêm / mở repo"
                >
                  <span className="material-symbols-outlined text-[22px]">add</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
