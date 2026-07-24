/**
 * Combo self-healing optimizer (OmniRoute parity).
 *
 * Periodically reorders combo.models using live performance so slow/failing
 * backends (e.g. flash models) drop toward the end without a full restart.
 *
 * Does not rewrite settings unless a persister is provided.
 */
import { getComboPerformanceSnapshot, suggestOptimizedComboOrder } from "./combo.js";

/**
 * @param {Array<{name:string, models:string[]}>} combos
 * @param {{ minSamples?: number, apply?: (name:string, models:string[]) => void|Promise<void> }} [opts]
 * @returns {Promise<Array<{name:string, before:string[], after:string[], changed:boolean}>>}
 */
export async function optimizeCombos(combos, opts = {}) {
  const minSamples = Number(opts.minSamples) || 3;
  const apply = opts.apply;
  const snap = getComboPerformanceSnapshot();
  const results = [];

  for (const combo of combos || []) {
    if (!combo?.name || !Array.isArray(combo.models) || combo.models.length <= 1) continue;
    const perfList = snap.combos?.[combo.name] || [];
    const totalSamples = perfList.reduce((n, p) => n + (p.samples || 0), 0);
    if (totalSamples < minSamples) {
      results.push({
        name: combo.name,
        before: [...combo.models],
        after: [...combo.models],
        changed: false,
        skipped: "insufficient_samples",
      });
      continue;
    }

    const after = suggestOptimizedComboOrder(combo.name, combo.models);
    const changed = after.join("|") !== combo.models.join("|");
    if (changed && typeof apply === "function") {
      await apply(combo.name, after);
    }
    results.push({
      name: combo.name,
      before: [...combo.models],
      after,
      changed,
    });
  }
  return results;
}

export function shouldSelfHeal(comboName, { minSamples = 6 } = {}) {
  const snap = getComboPerformanceSnapshot();
  const perfList = snap.combos?.[comboName] || [];
  const totalSamples = perfList.reduce((n, p) => n + (p.samples || 0), 0);
  if (totalSamples < minSamples) return false;
  // heal if any model is under slow cooldown or has recent failures
  const now = Date.now();
  return perfList.some(
    (p) => (p.slowCooldownUntil && p.slowCooldownUntil > now) || (p.failures || 0) >= 2,
  );
}
