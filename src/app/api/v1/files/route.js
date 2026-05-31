// OpenAI-compatible Files API: POST /v1/files (multipart upload), GET /v1/files (list)
// Backs the Batch API. Files are stored in agent-jobs.json.
import { withRouteGuard } from "@/lib/runtimeGuard";
import { createFile, listFiles } from "@/lib/agentJobsDb.js";
import { ensureAuthorized, jsonResponse, openAiError, preflight } from "../_lib/apiAuth.js";

export async function OPTIONS() {
  return preflight();
}

const VALID_PURPOSES = new Set(["batch", "fine-tune", "assistants", "user_data", "vision", "batch_output"]);

async function postHandler(request) {
  const denied = await ensureAuthorized(request);
  if (denied) return denied;

  const contentType = request.headers.get("content-type") || "";
  let content = "";
  let filename = "upload.jsonl";
  let purpose = "batch";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      purpose = String(form.get("purpose") || "batch");
      if (!file || typeof file === "string") {
        return openAiError("Missing 'file' field in multipart form", 400);
      }
      content = await file.text();
      filename = file.name || filename;
    } else if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") return openAiError("Invalid JSON body", 400);
      content = typeof body.content === "string" ? body.content : "";
      filename = body.filename || filename;
      purpose = body.purpose || "batch";
    } else {
      // Treat raw body as file content.
      content = await request.text();
    }
  } catch (err) {
    return openAiError(`Failed to read upload: ${err?.message || "unknown error"}`, 400);
  }

  if (!VALID_PURPOSES.has(purpose)) {
    return openAiError(`Invalid purpose '${purpose}'`, 400);
  }
  if (!content) {
    return openAiError("Uploaded file is empty", 400);
  }

  try {
    const file = await createFile({ content, filename, purpose });
    return jsonResponse(file, 200);
  } catch (err) {
    if (err?.code === "file_too_large") return openAiError(err.message, 413, "invalid_request_error", "file_too_large");
    return openAiError(err?.message || "Failed to store file", 500, "server_error");
  }
}

async function getHandler(request) {
  const denied = await ensureAuthorized(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const purpose = url.searchParams.get("purpose");
  const files = await listFiles(purpose || null);
  return jsonResponse({ object: "list", data: files, has_more: false });
}

export const POST = withRouteGuard("v1/files", postHandler, { timeoutMs: 30000 });
export const GET = withRouteGuard("v1/files:list", getHandler, { timeoutMs: 15000 });
