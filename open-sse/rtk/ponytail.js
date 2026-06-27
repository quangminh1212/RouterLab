// Ponytail injector: appends a "lazy senior dev" instruction into the system message
// to reduce code output tokens by encouraging minimal, YAGNI-first responses.
// Same injection approach as caveman — dispatches by format.

import { FORMATS } from "../translator/formats.js";
import { PONYTAIL_PROMPTS } from "./ponytailPrompts.js";

const SEP = "\n\n";

export function injectPonytail(body, format, level) {
  const prompt = PONYTAIL_PROMPTS[level];
  if (!body || !prompt) return;

  switch (format) {
    case FORMATS.CLAUDE:
      injectClaudeSystem(body, prompt);
      return;
    case FORMATS.GEMINI:
    case FORMATS.GEMINI_CLI:
    case FORMATS.VERTEX:
    case FORMATS.ANTIGRAVITY:
      injectGeminiSystem(body, prompt);
      return;
    default:
      injectMessagesSystem(body, prompt);
  }
}

function injectMessagesSystem(body, prompt) {
  if (typeof body.instructions === "string") {
    body.instructions = body.instructions
      ? `${body.instructions}${SEP}${prompt}`
      : prompt;
    return;
  }

  const messages = body.messages || body.input;
  if (!Array.isArray(messages)) return;

  const systemMsg = messages.find((m) => m?.role === "system");
  if (systemMsg) {
    const content = typeof systemMsg.content === "string" ? systemMsg.content : "";
    systemMsg.content = content ? `${content}${SEP}${prompt}` : prompt;
  } else {
    messages.unshift({ role: "system", content: prompt });
  }
}

function injectClaudeSystem(body, prompt) {
  if (typeof body.system === "string") {
    body.system = body.system ? `${body.system}${SEP}${prompt}` : prompt;
  } else if (Array.isArray(body.system)) {
    body.system.push({ type: "text", text: prompt });
  } else {
    body.system = prompt;
  }
}

function injectGeminiSystem(body, prompt) {
  const target = body.request || body;
  if (target.system_instruction) {
    if (typeof target.system_instruction === "string") {
      target.system_instruction += `${SEP}${prompt}`;
    } else if (target.system_instruction?.parts) {
      target.system_instruction.parts.push({ text: prompt });
    }
  } else {
    target.system_instruction = { parts: [{ text: prompt }] };
  }
}
