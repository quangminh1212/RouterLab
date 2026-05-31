// Payload Rules Engine — CLIProxyAPI-style declarative request-body editing.
//
// Lets operators rewrite the upstream request body via dot-path rules before
// dispatch, with conditions (provider/model/format/header/path match). This is
// the JS equivalent of CLIProxyAPI's gjson/sjson `payload:` rules.
//
// Rule shape:
// {
//   enabled: true,
//   when: {                       // all conditions must match (AND)
//     provider?: "openai" | ["openai","azure"],
//     model?: "gpt-5*" (glob) | ["..."],
//     format?: "openai" | "claude" | ...,
//     pathExists?: "temperature", // body has this dot-path
//     pathMissing?: "reasoning",  // body lacks this dot-path
//     pathEquals?: { path: "stream", value: true },
//   },
//   actions: [                    // applied in order
//     { op: "set",    path: "temperature", value: 0.7 },
//     { op: "default",path: "max_tokens",  value: 4096 }, // set only if missing
//     { op: "delete", path: "frequency_penalty" },
//     { op: "rename", path: "max_tokens", to: "max_completion_tokens" },
//   ],
// }

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

// Split "a.b.0.c" into ["a","b","0","c"]; supports bracket form a[0].b too.
function splitPath(path) {
  return String(path || "")
    .replace(/\[(\w+)\]/g, ".$1")
    .split(".")
    .filter((s) => s !== "");
}

export function getPath(obj, path) {
  const parts = splitPath(path);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function hasPath(obj, path) {
  const parts = splitPath(path);
  let cur = obj;
  for (const p of parts) {
    if (!isPlainObject(cur) && !Array.isArray(cur)) return false;
    if (!(p in cur)) return false;
    cur = cur[p];
  }
  return true;
}

export function setPath(obj, path, value) {
  const parts = splitPath(path);
  if (parts.length === 0) return obj;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!isPlainObject(cur[p]) && !Array.isArray(cur[p])) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

export function deletePath(obj, path) {
  const parts = splitPath(path);
  if (parts.length === 0) return obj;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!isPlainObject(cur[p]) && !Array.isArray(cur[p])) return obj;
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  if (Array.isArray(cur)) cur.splice(Number(last), 1);
  else delete cur[last];
  return obj;
}

// Simple glob matcher: * matches any run of chars. Anchored full match.
function globMatch(pattern, value) {
  const pat = String(pattern || "");
  const val = String(value || "");
  if (pat === "*" || pat === value) return true;
  if (!pat.includes("*")) return pat === val;
  const escaped = pat.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i").test(val);
}

function matchesList(patternOrList, value) {
  if (patternOrList == null) return true;
  const list = Array.isArray(patternOrList) ? patternOrList : [patternOrList];
  return list.some((p) => globMatch(p, value));
}

function ruleMatches(when, ctx) {
  if (!when) return true;
  if (!matchesList(when.provider, ctx.provider)) return false;
  if (!matchesList(when.model, ctx.model)) return false;
  if (when.format != null && !matchesList(when.format, ctx.format)) return false;
  if (when.pathExists && !hasPath(ctx.body, when.pathExists)) return false;
  if (when.pathMissing && hasPath(ctx.body, when.pathMissing)) return false;
  if (when.pathEquals && getPath(ctx.body, when.pathEquals.path) !== when.pathEquals.value) return false;
  return true;
}

function applyAction(body, action) {
  if (!action || typeof action !== "object") return;
  const { op, path } = action;
  switch (op) {
    case "set":
      if (path) setPath(body, path, action.value);
      break;
    case "default":
      if (path && !hasPath(body, path)) setPath(body, path, action.value);
      break;
    case "delete":
      if (path) deletePath(body, path);
      break;
    case "rename":
      if (path && action.to && hasPath(body, path)) {
        const v = getPath(body, path);
        deletePath(body, path);
        setPath(body, action.to, v);
      }
      break;
    default:
      break;
  }
}

/**
 * Apply payload rules to a request body in place.
 * @param {object} body - request body (mutated)
 * @param {Array} rules - array of rule objects
 * @param {object} ctx - { provider, model, format }
 * @returns {{ applied: number }}
 */
export function applyPayloadRules(body, rules, ctx = {}) {
  if (!isPlainObject(body) || !Array.isArray(rules) || rules.length === 0) {
    return { applied: 0 };
  }
  const fullCtx = { provider: ctx.provider || "", model: ctx.model || "", format: ctx.format || "", body };
  let applied = 0;
  for (const rule of rules) {
    if (!rule || rule.enabled === false) continue;
    if (!ruleMatches(rule.when, fullCtx)) continue;
    const actions = Array.isArray(rule.actions) ? rule.actions : [];
    for (const action of actions) applyAction(body, action);
    if (actions.length) applied += 1;
  }
  return { applied };
}

/** Validate + normalize a rules array (defensive; used by settings route). */
export function normalizePayloadRules(rules) {
  if (!Array.isArray(rules)) return [];
  const VALID_OPS = new Set(["set", "default", "delete", "rename"]);
  return rules
    .filter((r) => r && typeof r === "object" && !Array.isArray(r))
    .map((r) => ({
      enabled: r.enabled !== false,
      when: isPlainObject(r.when) ? r.when : {},
      actions: Array.isArray(r.actions)
        ? r.actions.filter((a) => isPlainObject(a) && VALID_OPS.has(a.op) && typeof a.path === "string" && a.path)
        : [],
    }))
    .filter((r) => r.actions.length > 0);
}
