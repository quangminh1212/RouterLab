import { checkHeadroomHealth } from "open-sse/rtk/headroom.js";
import { getSettings } from "@/lib/localDb";

export const dynamic = "force-dynamic";

const DEFAULT_URL = "http://localhost:8787/v1/compress";

export async function GET() {
  try {
    const settings = await getSettings().catch(() => ({}));
    const url = settings?.headroomUrl || process.env.HEADROOM_URL || DEFAULT_URL;
    const status = await checkHeadroomHealth(url);
    return Response.json({
      ...status,
      url,
      managedPid: null,
      source: "open-sse/rtk/headroom",
    });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}
