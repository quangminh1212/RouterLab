import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { parseCockpitExport, summarizeEntries } from "@/lib/usage/cockpitImport";
import { mergeCockpitUsage } from "@/lib/usageDb";
import { logger } from "@/lib/logger";

/**
 * POST /api/usage/cockpit-import
 *
 * Body: the Cockpit / Antigravity "Data Export" JSON, optionally wrapped:
 *   { export: <exportPayload>, preview?: boolean, label?: string }
 * or the raw export object/array itself.
 *
 * - preview=true  -> parse + compute totals, do NOT write (dry-run).
 * - otherwise     -> merge additively into dailySummary (idempotent by content hash).
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || (typeof body !== "object")) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Allow either a wrapped request or the raw export.
    const hasWrapper = !Array.isArray(body) && (body.export !== undefined || body.preview !== undefined || body.label !== undefined);
    const exportPayload = hasWrapper ? body.export : body;
    const preview = hasWrapper ? body.preview === true : false;
    const label = hasWrapper && typeof body.label === "string" ? body.label : "cockpit-export";

    if (exportPayload === undefined || exportPayload === null) {
      return NextResponse.json({ error: "Missing export payload" }, { status: 400 });
    }

    const { entries, shape, exportedAt, warnings } = parseCockpitExport(exportPayload);

    if (!entries.length) {
      return NextResponse.json(
        { error: "No usage data recognized in export", shape, warnings },
        { status: 422 }
      );
    }

    const totals = summarizeEntries(entries);

    if (preview) {
      return NextResponse.json({
        success: true,
        preview: true,
        shape,
        exportedAt,
        totals,
        warnings,
      });
    }

    // Stable content hash for idempotent re-imports.
    const importKey = crypto
      .createHash("sha256")
      .update(JSON.stringify(exportPayload))
      .digest("hex")
      .slice(0, 32);

    const result = await mergeCockpitUsage(entries, { importKey, label });

    logger.info("API:USAGE", "Cockpit usage import", {
      shape,
      imported: result.imported,
      alreadyImported: result.alreadyImported || false,
      addedRequests: result.addedRequests,
    });

    return NextResponse.json({
      success: true,
      preview: false,
      shape,
      exportedAt,
      totals,
      warnings,
      result,
    });
  } catch (error) {
    logger.error("API:USAGE", "Cockpit usage import failed", error);
    return NextResponse.json(
      { error: error?.message || "Failed to import Cockpit usage" },
      { status: 500 }
    );
  }
}
