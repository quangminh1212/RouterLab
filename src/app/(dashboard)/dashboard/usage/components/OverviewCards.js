"use client";

import { memo } from "react";
import PropTypes from "prop-types";
import Card from "@/shared/components/Card";

const fmt = (n) => new Intl.NumberFormat().format(n || 0);
const fmtCost = (n) => `$${(n || 0).toFixed(2)}`;
const fmtRpm = (n) => (n || 0).toFixed(2);
const fmtSavedTokens = (bytes) => fmt(Math.ceil((bytes || 0) / 4));

function OverviewCards({ stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
      <Card className="px-4 py-3 flex flex-col items-center text-center gap-1">
        <span className="text-text-muted text-sm uppercase font-semibold">Total Requests</span>
        <span className="text-2xl font-bold">{fmt(stats.totalRequests)}</span>
      </Card>
      <Card className="px-4 py-3 flex flex-col items-center text-center gap-1">
        <span className="text-text-muted text-sm uppercase font-semibold">RPM</span>
        <span className="text-2xl font-bold text-info">{fmtRpm(stats.rpm)}</span>
      </Card>
      <Card className="px-4 py-3 flex flex-col items-center text-center gap-1">
        <span className="text-text-muted text-sm uppercase font-semibold">Total Input Tokens</span>
        <span className="text-2xl font-bold text-primary">{fmt(stats.totalPromptTokens)}</span>
      </Card>
      <Card className="px-4 py-3 flex flex-col items-center text-center gap-1">
        <span className="text-text-muted text-sm uppercase font-semibold">Output Tokens</span>
        <span className="text-2xl font-bold text-success">{fmt(stats.totalCompletionTokens)}</span>
      </Card>
      <Card className="px-4 py-3 flex flex-col items-center text-center gap-1">
        <span className="text-text-muted text-sm uppercase font-semibold">Est. Cost</span>
        <span className="text-2xl font-bold text-warning">~{fmtCost(stats.totalCost)}</span>
        <span className="text-[10px] text-text-muted">Estimated, not actual billing</span>
      </Card>
      <Card className="px-4 py-3 flex flex-col items-center text-center gap-1">
        <span className="text-text-muted text-sm uppercase font-semibold">Compression Saved</span>
        <span className="text-2xl font-bold text-primary">{fmtSavedTokens(stats.compressionSavedBytes)}</span>
        <span className="text-[10px] text-text-muted">Est. input tokens, {fmt(stats.compressionHits)} hits</span>
      </Card>
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

export default memo(OverviewCards, areEqualOverviewCardsProps);

OverviewCards.propTypes = {
  stats: PropTypes.object.isRequired,
};
