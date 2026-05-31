// OpenAI-compatible Files API: GET /v1/files/:id/content (raw file download)
import { getFile, getFileContent } from "@/lib/agentJobsDb.js";
import { ensureAuthorized, corsHeaders, openAiError, preflight } from "../../../_lib/apiAuth.js";

export async function OPTIONS() {
  return preflight();
}

export async function GET(request, { params }) {
  const denied = await ensureAuthorized(request);
  if (denied) return denied;
  const { id } = await params;
  const file = await getFile(id);
  if (!file) return openAiError(`No such file: ${id}`, 404, "invalid_request_error", "file_not_found");
  const content = await getFileContent(id);
  return new Response(content || "", {
    status: 200,
    headers: corsHeaders({
      "Content-Type": "application/jsonl",
      "Content-Disposition": `attachment; filename="${file.filename || id}"`,
    }),
  });
}
