// Caveman injector: appends a caveman-style instruction into the system message
// of the final request body, just before it is dispatched to the provider executor.
// Dispatches by format so it works for both translated and native-passthrough flows.

import { FORMATS } from "../translator/formats.js";
import { CAVEMAN_PROMPTS } from "./cavemanPrompts.js";

const SEP = "\n\n";

export function injectCaveman(body, format, level) {
  const prompt = CAVEMAN_PROMPTS[level];
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
    body.instructions = body.instructions ? `${body.instructions}${SEP}${prompt}` : prompt;
    return;
  }

  const arr = Array.isArray(body.messages)
    ? body.messages
    : Array.isArray(body.input)
      ? body.input
      : null;
  if (!arr) return;

  const idx = arr.findIndex((message) => message && (message.role === "system" || message.role === "developer"));
  if (idx >= 0) {
    appendToOpenAIMessage(arr[idx], prompt);
  } else {
    arr.unshift({ role: "system", content: prompt });
  }
}

function appendToOpenAIMessage(message, prompt) {
  if (typeof message.content === "string") {
    message.content = `${message.content}${SEP}${prompt}`;
  } else if (Array.isArray(message.content)) {
    message.content.push({ type: "input_text", text: prompt });
  } else {
    message.content = prompt;
  }
}

function injectClaudeSystem(body, prompt) {
  if (typeof body.system === "string" && body.system.length > 0) {
    body.system = `${body.system}${SEP}${prompt}`;
    return;
  }

  if (Array.isArray(body.system)) {
    const block = { type: "text", text: prompt };
    let lastCacheIdx = -1;
    for (let index = body.system.length - 1; index >= 0; index -= 1) {
      if (body.system[index]?.cache_control) {
        lastCacheIdx = index;
        break;
      }
    }
    if (lastCacheIdx >= 0) {
      body.system.splice(lastCacheIdx, 0, block);
    } else {
      body.system.push(block);
    }
    return;
  }

  body.system = prompt;
}

function injectGeminiSystem(body, prompt) {
  const target = body.request && typeof body.request === "object" ? body.request : body;
  const useSnake = Object.prototype.hasOwnProperty.call(target, "system_instruction");
  const key = useSnake ? "system_instruction" : "systemInstruction";
  const sys = target[key];
  if (sys && Array.isArray(sys.parts)) {
    sys.parts.push({ text: prompt });
    return;
  }
  target[key] = { parts: [{ text: prompt }] };
}
