import { NextResponse } from "next/server";
import { getDb } from "@/lib/localDb.js";
import { optimizeCombos } from "open-sse/services/comboSelfHeal.js";

/**
 * POST /api/management/combo-self-heal
 * Run OmniRoute-style combo self-healing using live latency/failure stats.
 * Body: { dryRun?: boolean, minSamples?: number, comboName?: string }
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body?.dryRun !== false ? true : false; // default dry-run safe
    const minSamples = Number(body?.minSamples) || 6;
    const only = body?.comboName ? String(body.comboName) : null;

    const db = await getDb();
    let combos = Array.isArray(db.data.combos) ? db.data.combos : [];
    if (only) combos = combos.filter((c) => c?.name === only);

    const results = await optimizeCombos(combos, {
      minSamples,
      apply: dryRun
        ? undefined
        : async (name, models) => {
            const combo = db.data.combos.find((c) => c?.name === name);
            if (!combo) return;
            combo.models = models;
            combo.updatedAt = new Date().toISOString();
            await db.write();
          },
    });

    return NextResponse.json({
      ok: true,
      dryRun,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error?.message || String(error) },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/management/combo-self-heal",
    body: { dryRun: true, minSamples: 6, comboName: "XLab" },
  });
}
