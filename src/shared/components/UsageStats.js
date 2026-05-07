"use client";

import { memo, useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FREE_PROVIDERS } from "@/shared/constants/providers";
import Badge from "./Badge";
import Card from "./Card";
import OverviewCards from "@/app/(dashboard)/dashboard/usage/components/OverviewCards";
import UsageTable, { fmt, fmtTime } from "@/app/(dashboard)/dashboard/usage/components/UsageTable";
import ProviderTopology from "@/app/(dashboard)/dashboard/usage/components/ProviderTopology";
import UsageChart from "@/app/(dashboard)/dashboard/usage/components/UsageChart";
import { fetchWithTimeout } from "@/shared/utils/fetchWithTimeout";

function fmtCost(value) {
  return `$${Number(value || 0).toFixed(4)}`;
}

function timeAgo(timestamp, nowTs = Date.now()) {
  const diff = Math.floor((nowTs - new Date(timestamp)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function TimeAgo({ timestamp, now }) {
  return <>{timeAgo(timestamp, now)}</>;
}

const RecentRequests = memo(function RecentRequests({ requests = [] }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card className="flex flex-col overflow-hidden" padding="sm" style={{ height: 480 }}>
      {/* Header */}
      <div className="px-1 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Recent Requests</span>
      </div>

      {!requests.length ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">No requests yet.</div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-bg z-10">
              <tr className="border-b border-border">
                <th className="py-1.5 text-left font-semibold text-text-muted w-2"></th>
                <th className="py-1.5 text-left font-semibold text-text-muted">Model</th>
                <th className="py-1.5 text-right font-semibold text-text-muted whitespace-nowrap">In / Out</th>
                <th className="py-1.5 text-right font-semibold text-text-muted whitespace-nowrap">Cost</th>
                <th className="py-1.5 text-right font-semibold text-text-muted">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {requests.map((r, i) => {
                const ok = !r.status || r.status === "ok" || r.status === "success";
                return (
                  <tr key={`${r.timestamp || i}-${r.model || ""}-${r.promptTokens || 0}-${r.completionTokens || 0}`} className="hover:bg-bg-subtle transition-colors">
                    <td className="py-1.5">
                      <span className={`block w-1.5 h-1.5 rounded-full ${ok ? "bg-success" : "bg-error"}`} />
                    </td>
                    <td className="py-1.5 font-mono truncate max-w-[120px]" title={r.model}>{r.model}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      <span className="text-primary">{fmt(r.promptTokens)}{"\u2191"}</span>
                      {" "}
                      <span className="text-success">{fmt(r.completionTokens)}{"\u2193"}</span>
                    </td>
                    <td className="py-1.5 text-right whitespace-nowrap text-warning font-medium">
                      {fmtCost(r.cost || r.totalCost)}
                    </td>
                    <td className="py-1.5 text-right text-text-muted whitespace-nowrap"><TimeAgo timestamp={r.timestamp} now={now} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
});

const EMPTY_REALTIME_STATS = {
  activeRequests: [],
  recentRequests: [],
  errorProvider: "",
  pending: {},
};

function isSameRealtimeStats(prev, next) {
  return prev.activeRequests === next.activeRequests
    && prev.recentRequests === next.recentRequests
    && prev.errorProvider === next.errorProvider
    && prev.pending === next.pending;
}

function sortData(dataMap, pendingMap = {}, sortBy, sortOrder) {
  return Object.entries(dataMap || {})
    .map(([key, data]) => {
      const totalTokens = (data.promptTokens || 0) + (data.completionTokens || 0);
      const totalCost = data.cost || 0;
      const inputCost = totalTokens > 0 ? (data.promptTokens || 0) * (totalCost / totalTokens) : 0;
      const outputCost = totalTokens > 0 ? (data.completionTokens || 0) * (totalCost / totalTokens) : 0;
      return { ...data, key, totalTokens, totalCost, inputCost, outputCost, pending: pendingMap[key] || 0 };
    })
    .sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
}

function getGroupKey(item, keyField) {
  switch (keyField) {
    case "rawModel": return item.rawModel || "Unknown Model";
    case "accountName": return item.accountName || `Account ${item.connectionId?.slice(0, 8)}...` || "Unknown Account";
    case "keyName": return item.keyName || "Unknown Key";
    case "endpoint": return item.endpoint || "Unknown Endpoint";
    default: return item[keyField] || "Unknown";
  }
}

function groupDataByKey(data, keyField) {
  if (!Array.isArray(data)) return [];
  const groups = {};
  data.forEach((item) => {
    const gk = getGroupKey(item, keyField);
    if (!groups[gk]) {
      groups[gk] = {
        groupKey: gk,
        summary: { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0, inputCost: 0, outputCost: 0, lastUsed: null, pending: 0 },
        items: [],
      };
    }
    const s = groups[gk].summary;
    s.requests += item.requests || 0;
    s.promptTokens += item.promptTokens || 0;
    s.completionTokens += item.completionTokens || 0;
    s.totalTokens += item.totalTokens || 0;
    s.cost += item.cost || 0;
    s.inputCost += item.inputCost || 0;
    s.outputCost += item.outputCost || 0;
    s.pending += item.pending || 0;
    if (item.lastUsed && (!s.lastUsed || new Date(item.lastUsed) > new Date(s.lastUsed))) {
      s.lastUsed = item.lastUsed;
    }
    groups[gk].items.push(item);
  });
  return Object.values(groups);
}

const MODEL_COLUMNS = [
  { field: "rawModel", label: "Model" },
  { field: "provider", label: "Provider" },
  { field: "requests", label: "Requests", align: "right" },
  { field: "lastUsed", label: "Last Used", align: "right" },
];

const ACCOUNT_COLUMNS = [
  { field: "rawModel", label: "Model" },
  { field: "provider", label: "Provider" },
  { field: "accountName", label: "Account" },
  { field: "requests", label: "Requests", align: "right" },
  { field: "lastUsed", label: "Last Used", align: "right" },
];

const API_KEY_COLUMNS = [
  { field: "keyName", label: "API Key Name" },
  { field: "rawModel", label: "Model" },
  { field: "provider", label: "Provider" },
  { field: "requests", label: "Requests", align: "right" },
  { field: "lastUsed", label: "Last Used", align: "right" },
];

const ENDPOINT_COLUMNS = [
  { field: "endpoint", label: "Endpoint" },
  { field: "rawModel", label: "Model" },
  { field: "provider", label: "Provider" },
  { field: "requests", label: "Requests", align: "right" },
  { field: "lastUsed", label: "Last Used", align: "right" },
];

const TABLE_OPTIONS = [
  { value: "model", label: "Usage by Model" },
  { value: "account", label: "Usage by Account" },
  { value: "apiKey", label: "Usage by API Key" },
  { value: "endpoint", label: "Usage by Endpoint" },
];

const PERIODS = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "all", label: "All Time" },
];

const SOURCE_LABELS = {
  history: "History",
  dailySummary: "Summary",
  "history-fallback": "History fallback",
  empty: "Empty",
};

const USAGE_FAST_FETCH_TIMEOUT_MS = 4500;

export default function UsageStats() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sortBy = searchParams.get("sortBy") || "rawModel";
  const sortOrder = searchParams.get("sortOrder") || "asc";

  const [stats, setStats] = useState(null);
  const [realtimeStats, setRealtimeStats] = useState(EMPTY_REALTIME_STATS);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [tableView, setTableView] = useState("model");
  const [viewMode, setViewMode] = useState("costs");
  const [providers, setProviders] = useState([]);
  const [period, setPeriod] = useState("7d");
  const [debugInfo, setDebugInfo] = useState(null);

  const pendingStats = useMemo(() => {
    if (realtimeStats.pending && Object.keys(realtimeStats.pending).length > 0) {
      return realtimeStats.pending;
    }
    return stats?.pending || {};
  }, [realtimeStats.pending, stats]);

  const activeRequests = realtimeStats.activeRequests.length > 0
    ? realtimeStats.activeRequests
    : (stats?.activeRequests || []);

  const recentRequests = realtimeStats.recentRequests.length > 0
    ? realtimeStats.recentRequests
    : (stats?.recentRequests || []);

  const errorProvider = realtimeStats.errorProvider || stats?.errorProvider || "";

  // Fetch connected providers once, deduplicate by provider type
  // Always include noAuth free providers (e.g. opencode) regardless of connections
  useEffect(() => {
    const start = Date.now();
    fetchWithTimeout("/api/providers", { cache: "no-store" }, USAGE_FAST_FETCH_TIMEOUT_MS, "Loading providers timed out")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const durationMs = Date.now() - start;
        if (durationMs > 500 || (typeof window !== "undefined" && window.DEBUG_DASHBOARD_PERF)) {
          console.log("[DASHBOARD_CLIENT] usageStats:fetchProviders", { durationMs, count: d?.connections?.length || 0 });
        }
        const seen = new Set();
        const unique = (d?.connections || []).filter((c) => {
          if (seen.has(c.provider)) return false;
          seen.add(c.provider);
          return true;
        });
        const noAuthProviders = Object.values(FREE_PROVIDERS)
          .filter((p) => p.noAuth && !seen.has(p.id))
          .map((p) => ({ provider: p.id, name: p.name }));
        setProviders([...unique, ...noAuthProviders]);
      })
      .catch(() => {});
  }, []);

  // Fetch filtered stats via REST when period changes
  useEffect(() => {
    const start = Date.now();
    const shouldFetchDebug = typeof window !== "undefined" && window.DEBUG_DASHBOARD_PERF;
    const statsRequests = [
      fetchWithTimeout(`/api/usage/stats?period=${period}`, { cache: "no-store" }, USAGE_FAST_FETCH_TIMEOUT_MS, "Loading usage stats timed out")
        .then((r) => (r.ok ? r.json() : null)),
      shouldFetchDebug
        ? fetchWithTimeout(`/api/usage/debug?period=${period}`, { cache: "no-store" }, USAGE_FAST_FETCH_TIMEOUT_MS, "Loading usage debug timed out")
          .then((r) => (r.ok ? r.json() : null))
        : Promise.resolve(null),
    ];

    Promise.allSettled(statsRequests)
      .then(([statsResult, debugResult]) => {
        const data = statsResult.status === "fulfilled" ? statsResult.value : null;
        const debug = debugResult.status === "fulfilled" ? debugResult.value : null;
        const durationMs = Date.now() - start;
        if (durationMs > 1000 || (typeof window !== "undefined" && window.DEBUG_DASHBOARD_PERF)) {
          console.log("[DASHBOARD_CLIENT] usageStats:fetchStats", { period, durationMs, source: debug?.source });
        }
        if (data) setStats((prev) => ({ ...prev, ...data }));
        if (debug) setDebugInfo(debug);
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setFetching(false);
      });
  }, [period]);

  // SSE connection - real-time updates for activeRequests + recentRequests only
  useEffect(() => {
    const connectStart = Date.now();
    const es = new EventSource("/api/usage/stream");
    let messageCount = 0;

    es.onopen = () => {
      const durationMs = Date.now() - connectStart;
      if (typeof window !== "undefined" && window.DEBUG_DASHBOARD_PERF) {
        console.log("[DASHBOARD_CLIENT] usageStats:sse:open", { durationMs });
      }
    };

    es.onmessage = (e) => {
      try {
        messageCount++;
        const data = JSON.parse(e.data);
        const nextRealtimeStats = {
          activeRequests: data.activeRequests,
          recentRequests: data.recentRequests,
          errorProvider: data.errorProvider,
          pending: data.pending,
        };
        setRealtimeStats((prev) => (isSameRealtimeStats(prev, nextRealtimeStats) ? prev : nextRealtimeStats));
        setLoading(false);
      } catch (err) {
        console.error("[SSE CLIENT] parse error:", err);
      }
    };

    es.onerror = (err) => {
      if (typeof window !== "undefined" && window.DEBUG_DASHBOARD_PERF) {
        console.warn("[DASHBOARD_CLIENT] usageStats:sse:error", { messageCount, readyState: es.readyState });
      }
      setLoading(false);
    };

    return () => {
      if (typeof window !== "undefined" && window.DEBUG_DASHBOARD_PERF) {
        console.log("[DASHBOARD_CLIENT] usageStats:sse:close", { messageCount, durationMs: Date.now() - connectStart });
      }
      es.close();
    };
  }, []);

  const toggleSort = useCallback((tableType, field) => {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("sortBy") === field) {
      params.set("sortOrder", params.get("sortOrder") === "asc" ? "desc" : "asc");
    } else {
      params.set("sortBy", field);
      params.set("sortOrder", "asc");
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Compute active table data
  const activeTableConfig = useMemo(() => {
    if (!stats) return null;
    switch (tableView) {
      case "model": {
        const pendingMap = pendingStats.byModel || {};
        return {
          columns: MODEL_COLUMNS,
          groupedData: groupDataByKey(sortData(stats.byModel, pendingMap, sortBy, sortOrder), "rawModel"),
          storageKey: "usage-stats:expanded-models",
          emptyMessage: "No usage recorded yet.",
          renderSummaryCells: (group) => (
            <>
              <td className="px-6 py-3 text-text-muted">Ã¢â‚¬â€</td>
              <td className="px-6 py-3 text-right">{fmt(group.summary.requests)}</td>
              <td className="px-6 py-3 text-right text-text-muted whitespace-nowrap">{fmtTime(group.summary.lastUsed)}</td>
            </>
          ),
          renderDetailCells: (item) => (
            <>
              <td className={`px-6 py-3 font-medium transition-colors ${item.pending > 0 ? "text-primary" : ""}`}>{item.rawModel}</td>
              <td className="px-6 py-3"><Badge variant={item.pending > 0 ? "primary" : "neutral"} size="sm">{item.provider}</Badge></td>
              <td className="px-6 py-3 text-right">{fmt(item.requests)}</td>
              <td className="px-6 py-3 text-right text-text-muted whitespace-nowrap">{fmtTime(item.lastUsed)}</td>
            </>
          ),
        };
      }
      case "account": {
        const pendingMap = {};
        if (pendingStats.byAccount) {
          Object.entries(stats.byAccount || {}).forEach(([accountKey, data]) => {
            const connPending = pendingStats.byAccount[data.connectionId];
            if (connPending) {
              const modelKey = data.provider ? `${data.rawModel} (${data.provider})` : data.rawModel;
              pendingMap[accountKey] = connPending[modelKey] || 0;
            }
          });
        }
        return {
          columns: ACCOUNT_COLUMNS,
          groupedData: groupDataByKey(sortData(stats.byAccount, pendingMap, sortBy, sortOrder), "accountName"),
          storageKey: "usage-stats:expanded-accounts",
          emptyMessage: "No account-specific usage recorded yet.",
          renderSummaryCells: (group) => (
            <>
              <td className="px-6 py-3 text-text-muted">Ã¢â‚¬â€</td>
              <td className="px-6 py-3 text-text-muted">Ã¢â‚¬â€</td>
              <td className="px-6 py-3 text-right">{fmt(group.summary.requests)}</td>
              <td className="px-6 py-3 text-right text-text-muted whitespace-nowrap">{fmtTime(group.summary.lastUsed)}</td>
            </>
          ),
          renderDetailCells: (item) => (
            <>
              <td className={`px-6 py-3 font-medium transition-colors ${item.pending > 0 ? "text-primary" : ""}`}>{item.accountName || `Account ${item.connectionId?.slice(0, 8)}...`}</td>
              <td className={`px-6 py-3 font-medium transition-colors ${item.pending > 0 ? "text-primary" : ""}`}>{item.rawModel}</td>
              <td className="px-6 py-3"><Badge variant={item.pending > 0 ? "primary" : "neutral"} size="sm">{item.provider}</Badge></td>
              <td className="px-6 py-3 text-right">{fmt(item.requests)}</td>
              <td className="px-6 py-3 text-right text-text-muted whitespace-nowrap">{fmtTime(item.lastUsed)}</td>
            </>
          ),
        };
      }
      case "apiKey": {
        return {
          columns: API_KEY_COLUMNS,
          groupedData: groupDataByKey(sortData(stats.byApiKey, {}, sortBy, sortOrder), "keyName"),
          storageKey: "usage-stats:expanded-apikeys",
          emptyMessage: "No API key usage recorded yet.",
          renderSummaryCells: (group) => (
            <>
              <td className="px-6 py-3 text-text-muted">Ã¢â‚¬â€</td>
              <td className="px-6 py-3 text-text-muted">Ã¢â‚¬â€</td>
              <td className="px-6 py-3 text-right">{fmt(group.summary.requests)}</td>
              <td className="px-6 py-3 text-right text-text-muted whitespace-nowrap">{fmtTime(group.summary.lastUsed)}</td>
            </>
          ),
          renderDetailCells: (item) => (
            <>
              <td className="px-6 py-3 font-medium">{item.keyName}</td>
              <td className="px-6 py-3">{item.rawModel}</td>
              <td className="px-6 py-3"><Badge variant="neutral" size="sm">{item.provider}</Badge></td>
              <td className="px-6 py-3 text-right">{fmt(item.requests)}</td>
              <td className="px-6 py-3 text-right text-text-muted whitespace-nowrap">{fmtTime(item.lastUsed)}</td>
            </>
          ),
        };
      }
      case "endpoint":
      default: {
        return {
          columns: ENDPOINT_COLUMNS,
          groupedData: groupDataByKey(sortData(stats.byEndpoint, {}, sortBy, sortOrder), "endpoint"),
          storageKey: "usage-stats:expanded-endpoints",
          emptyMessage: "No endpoint usage recorded yet.",
          renderSummaryCells: (group) => (
            <>
              <td className="px-6 py-3 text-text-muted">Ã¢â‚¬â€</td>
              <td className="px-6 py-3 text-text-muted">Ã¢â‚¬â€</td>
              <td className="px-6 py-3 text-right">{fmt(group.summary.requests)}</td>
              <td className="px-6 py-3 text-right text-text-muted whitespace-nowrap">{fmtTime(group.summary.lastUsed)}</td>
            </>
          ),
          renderDetailCells: (item) => (
            <>
              <td className="px-6 py-3 font-medium font-mono text-sm">{item.endpoint}</td>
              <td className="px-6 py-3">{item.rawModel}</td>
              <td className="px-6 py-3"><Badge variant="neutral" size="sm">{item.provider}</Badge></td>
              <td className="px-6 py-3 text-right">{fmt(item.requests)}</td>
              <td className="px-6 py-3 text-right text-text-muted whitespace-nowrap">{fmtTime(item.lastUsed)}</td>
            </>
          ),
        };
      }
    }
  }, [pendingStats, stats, tableView, sortBy, sortOrder]);

  if (!stats && !loading) return <div className="text-text-muted">Failed to load usage statistics.</div>;

  const spinner = (
    <div className="flex items-center justify-center py-12 text-text-muted">
      <span className="material-symbols-outlined text-[32px] animate-spin">progress_activity</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Period selector */}
      <div className="flex items-center gap-2 self-end">
        {debugInfo && debugInfo.source !== "empty" && (
          <span
            className={`px-2 py-1 rounded-md border text-xs font-medium ${debugInfo.source === "history-fallback" ? "border-warning/40 text-warning bg-warning/10" : "border-border text-text-muted bg-bg-subtle"}`}
            title={`history=${debugInfo.relevantHistoryCount}/${debugInfo.historyCount}, summaryDays=${debugInfo.relevantSummaryDays}/${debugInfo.dailySummaryDays}`}
          >
            Source: {SOURCE_LABELS[debugInfo.source] || debugInfo.source}
          </span>
        )}
        <div className="flex items-center gap-1 bg-bg-subtle rounded-lg p-1 border border-border">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => {
                if (period === p.value) return;
                setFetching(true);
                setPeriod(p.value);
              }}
              disabled={fetching}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${period === p.value ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text hover:bg-bg-hover"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {fetching && (
          <span className="material-symbols-outlined text-[16px] text-text-muted animate-spin">progress_activity</span>
        )}
      </div>

      {/* Overview cards */}
      {loading ? spinner : <OverviewCards stats={stats} />}

      {/* Provider topology + Recent Requests */}
      {loading ? spinner : (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-2 items-stretch">
          <ProviderTopology
            providers={providers}
            activeRequests={activeRequests}
            lastProvider={recentRequests?.[0]?.provider || ""}
            errorProvider={errorProvider}
          />
          <RecentRequests requests={recentRequests} />
        </div>
      )}

      {/* Token / Cost chart - sync period */}
      {loading ? spinner : <UsageChart period={period} />}

      {/* Table with dropdown selector */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <select
            value={tableView}
            onChange={(e) => setTableView(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-bg text-text text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 [&>option]:bg-bg [&>option]:text-text"
          >
            {TABLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-1 bg-bg-subtle rounded-lg p-1 border border-border">
            <button
              onClick={() => setViewMode("costs")}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === "costs" ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text hover:bg-bg-hover"}`}
            >
              Costs
            </button>
            <button
              onClick={() => setViewMode("tokens")}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === "tokens" ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text hover:bg-bg-hover"}`}
            >
              Tokens
            </button>
          </div>
        </div>
        {loading ? spinner : activeTableConfig && (
          <UsageTable
            title=""
            columns={activeTableConfig.columns}
            groupedData={activeTableConfig.groupedData}
            tableType={tableView}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onToggleSort={toggleSort}
            viewMode={viewMode}
            storageKey={activeTableConfig.storageKey}
            renderSummaryCells={activeTableConfig.renderSummaryCells}
            renderDetailCells={activeTableConfig.renderDetailCells}
            emptyMessage={activeTableConfig.emptyMessage}
          />
        )}
      </div>
    </div>
  );
}
