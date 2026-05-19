"use client";

import { memo } from "react";
import PropTypes from "prop-types";
import Card from "@/shared/components/Card";

const fmt = (n) => new Intl.NumberFormat().format(n || 0);
const fmtCost = (n) => `$${(n || 0).toFixed(2)}`;
const fmtRpm = (n) => (n || 0).toFixed(2);
const fmtSavedTokens = (bytes) => fmt(Math.ceil((bytes || 0) / 4));
const compactFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 2,
});
const fmtCompact = (n) => compactFormatter.format(n || 0);
const fmtSavedTokensCompact = (bytes) => fmtCompact(Math.ceil((bytes || 0) / 4));

function StatCard({ label, value, valueClass = "", title, hint }) {
  return (
    <Card className="px-3 py-3 flex flex-col items-center text-center gap-0.5">
      <span className="text-[11px] tracking-wide text-text-muted uppercase font-semibold whitespace-nowrap">{label}</span>
      <span className={`text-2xl font-bold leading-tight ${valueClass}`} title={title}>{value}</span>
      {hint ? <span className="text-[10px] text-text-muted leading-tight">{hint}</span> : null}
    </Card>
  );
}

function OverviewCards({ stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
      <StatCard label="Requests" value={fmtCompact(stats.totalRequests)} title={fmt(stats.totalRequests)} />
      <StatCard label="RPM" value={fmtRpm(stats.rpm)} valueClass="text-info" />
      <StatCard label="Input Tokens" value={fmtCompact(stats.totalPromptTokens)} valueClass="text-primary" title={fmt(stats.totalPromptTokens)} />
      <StatCard label="Output Tokens" value={fmtCompact(stats.totalCompletionTokens)} valueClass="text-success" title={fmt(stats.totalCompletionTokens)} />
      <StatCard label="Est. Cost" value={`~${fmtCost(stats.totalCost)}`} valueClass="text-warning" hint="Estimated, not billed" />
      <StatCard
        label="Saved Tokens"
        value={fmtSavedTokensCompact(stats.compressionSavedBytes)}
        valueClass="text-primary"
        title={fmtSavedTokens(stats.compressionSavedBytes)}
        hint={`${fmt(stats.compressionHits)} hits`}
      />
    </div>
  );
}

function areEqualOverviewCardsProps(prevProps, nextProps) {
  const prevStats = prevProps.stats || {};
  const nextStats = nextProps.stats || {};

  return prevStats.totalRequests === nextStats.totalRequests
    && prevStats.rpm === nextStats.rpm
    && prevStats.totalPromptTokens === nextStats.totalPromptTokens
    && prevStats.totalCompletionTokens === nextStats.totalCompletionTokens
    && prevStats.totalCost === nextStats.totalCost
    && prevStats.compressionSavedBytes === nextStats.compressionSavedBytes
    && prevStats.compressionHits === nextStats.compressionHits;
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  valueClass: PropTypes.string,
  title: PropTypes.string,
  hint: PropTypes.node,
};

export default memo(OverviewCards, areEqualOverviewCardsProps);

OverviewCards.propTypes = {
  stats: PropTypes.object.isRequired,
};
