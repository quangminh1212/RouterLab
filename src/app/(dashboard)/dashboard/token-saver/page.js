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

export default function TokenSaverPage() {
  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-text-main">Token Saver</h1>
        <p className="text-sm text-text-muted">Danh sách repo tham khảo cho mục tiêu tiết kiệm token.</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-black/10 p-4 md:p-5 space-y-3">
        <h2 className="text-base font-semibold text-text-main">10 GitHub repos nên tham khảo</h2>
        <div className="grid grid-cols-1 gap-3">
          {REPOS.map((repo) => (
            <a key={repo.url} href={repo.url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/10 bg-white/[0.02] p-3 hover:border-primary/40 transition-colors">
              <p className="font-medium text-text-main">{repo.name}</p>
              <p className="text-sm text-text-muted mt-1">{repo.note}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

