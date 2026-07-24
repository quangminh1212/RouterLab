/**
 * Comprehensive remote feature test for RouterLab VPS.
 * Run: node tester/remote-feature-test.mjs
 * Env: ROOT_BASE (default http://36.50.26.247:1212), API_KEY, TIMEOUT_MS
 */
const ROOT = (process.env.ROOT_BASE || 'http://36.50.26.247:1212').replace(/\/$/, '');
const V1 = `${ROOT}/v1`;
const API_KEY = process.env.API_KEY || '';
const TIMEOUT_MS = Math.max(3000, parseInt(process.env.TIMEOUT_MS || '45000', 10));
const MODEL = process.env.MODEL || 'gpt-5.5';

const results = [];
const authHeaders = () => {
  const h = { 'Content-Type': 'application/json' };
  if (API_KEY) h.Authorization = `Bearer ${API_KEY}`;
  return h;
};

async function req(name, method, url, { body, headers, expect, soft } = {}) {
  const start = Date.now();
  try {
    const defaultHeaders = API_KEY || body != null ? authHeaders() : undefined;
    const res = await fetch(url, {
      method,
      headers: headers || defaultHeaders,
      body: body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const latency = Date.now() - start;
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-json */ }
    const expected = expect || [200];
    const ok = expected.includes(res.status);
    const preview = (text || '').replace(/\s+/g, ' ').slice(0, 160);
    const row = {
      name, method, path: url.replace(ROOT, ''), status: ok ? 'OK' : 'FAIL',
      code: res.status, latency, preview, soft: !!soft, json, text,
    };
    results.push(row);
    const icon = ok ? 'OK  ' : (soft ? 'SOFT' : 'FAIL');
    console.log(`[${icon}] ${String(res.status).padStart(3)} ${String(latency).padStart(5)}ms  ${method.padEnd(6)} ${name.padEnd(42)} ${preview.slice(0, 80)}`);
    return row;
  } catch (e) {
    const latency = Date.now() - start;
    const row = {
      name, method, path: url.replace(ROOT, ''), status: soft ? 'SOFT' : 'FAIL',
      code: 0, latency, preview: String(e.message || e).slice(0, 180), soft: !!soft,
    };
    results.push(row);
    console.log(`[${row.status}]   0 ${String(latency).padStart(5)}ms  ${method.padEnd(6)} ${name.padEnd(42)} ${row.preview}`);
    return row;
  }
}

async function main() {
  console.log(`\n=== RouterLab remote feature test ===`);
  console.log(`Base: ${ROOT}`);
  console.log(`Model: ${MODEL}`);
  console.log(`API_KEY: ${API_KEY ? 'set' : 'none'}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  // --- Core ops ---
  await req('health', 'GET', `${ROOT}/api/health`, { expect: [200] });
  await req('health-public', 'GET', `${ROOT}/health`, { expect: [200, 404] });
  await req('version', 'GET', `${ROOT}/api/version`, { expect: [200] });
  await req('landing', 'GET', `${ROOT}/`, { expect: [200, 302, 307] });
  await req('login-page', 'GET', `${ROOT}/login`, { expect: [200] });
  await req('manifest', 'GET', `${ROOT}/manifest.webmanifest`, { expect: [200, 404] });
  await req('favicon', 'GET', `${ROOT}/favicon.ico`, { expect: [200, 204, 404] });

  // --- Models / discovery ---
  const models = await req('models-v1', 'GET', `${V1}/models`, { expect: [200] });
  await req('models-api', 'GET', `${ROOT}/api/v1/models`, { expect: [200] });
  await req('models-info', 'GET', `${ROOT}/api/v1/models/info`, { expect: [200] });
  await req('models-gemini', 'GET', `${ROOT}/api/v1beta/models`, { expect: [200] });
  await req('models-gemini-v1beta', 'GET', `${V1.replace('/v1', '')}/v1beta/models`, { expect: [200, 404] });

  // --- Auth / management protected ---
  await req('tunnel-status', 'GET', `${ROOT}/api/tunnel/status`, { expect: [200, 401] });
  await req('usage-summary', 'GET', `${ROOT}/api/usage/summary`, { expect: [200, 401] });
  await req('usage-stats', 'GET', `${ROOT}/api/usage/stats`, { expect: [200, 401] });
  await req('request-details', 'GET', `${ROOT}/api/usage/request-details`, { expect: [200, 401] });
  await req('providers-list', 'GET', `${ROOT}/api/providers`, { expect: [200, 401] });
  await req('combos-list', 'GET', `${ROOT}/api/combos`, { expect: [200, 401] });
  await req('settings', 'GET', `${ROOT}/api/settings`, { expect: [200, 401] });
  await req('proxy-systems', 'GET', `${ROOT}/api/proxy/systems/list`, { expect: [200, 401] });
  await req('api-keys', 'GET', `${ROOT}/api/keys`, { expect: [200, 401] });
  await req('auth-status', 'GET', `${ROOT}/api/auth/status`, { expect: [200, 401] });
  await req('auth-login-bad', 'POST', `${ROOT}/api/auth/login`, {
    body: { password: '__invalid_test__' },
    expect: [400, 401],
  });

  // --- Error handling ---
  await req('models-put-bad-json', 'PUT', `${ROOT}/api/v1/models`, {
    body: 'not-json',
    headers: { 'Content-Type': 'application/json' },
    expect: [400],
  });
  await req('not-found', 'GET', `${ROOT}/this-path-should-404`, { expect: [404] });

  // --- OpenAI-compatible chat ---
  const chatBody = {
    model: MODEL,
    messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
    max_tokens: 16,
    temperature: 0,
  };
  const chat = await req('chat-completions', 'POST', `${V1}/chat/completions`, {
    body: chatBody,
    expect: [200, 401, 402, 403, 429, 500, 502, 503],
    soft: true,
  });
  await req('chat-completions-stream', 'POST', `${V1}/chat/completions`, {
    body: { ...chatBody, stream: true },
    expect: [200, 401, 402, 403, 429, 500, 502, 503],
    soft: true,
  });
  await req('completions-legacy', 'POST', `${V1}/completions`, {
    body: { model: MODEL, prompt: 'Say OK', max_tokens: 8 },
    expect: [200, 400, 401, 404, 405, 500, 502, 503],
    soft: true,
  });

  // --- Claude messages ---
  await req('claude-messages', 'POST', `${V1}/messages`, {
    body: {
      model: MODEL,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
    },
    expect: [200, 400, 401, 404, 500, 502, 503],
    soft: true,
  });
  await req('count-tokens', 'POST', `${V1}/messages/count_tokens`, {
    body: {
      model: MODEL,
      messages: [{ role: 'user', content: 'hello' }],
    },
    expect: [200, 400, 401, 404, 405, 500],
    soft: true,
  });

  // --- Responses API ---
  await req('responses', 'POST', `${V1}/responses`, {
    body: { model: MODEL, input: 'Reply with exactly: OK' },
    expect: [200, 400, 401, 404, 500, 502, 503],
    soft: true,
  });

  // --- Embeddings ---
  await req('embeddings', 'POST', `${V1}/embeddings`, {
    body: { model: 'text-embedding-3-small', input: 'hello world' },
    expect: [200, 400, 401, 404, 500, 502, 503],
    soft: true,
  });

  // --- Moderations / rerank / search ---
  await req('moderations', 'POST', `${V1}/moderations`, {
    body: { input: 'hello' },
    expect: [200, 400, 401, 404, 500, 501, 502, 503],
    soft: true,
  });
  await req('rerank', 'POST', `${V1}/rerank`, {
    body: { model: 'rerank', query: 'hello', documents: ['a', 'b'] },
    expect: [200, 400, 401, 404, 500, 501, 502, 503],
    soft: true,
  });
  await req('web-search', 'POST', `${V1}/search`, {
    body: { query: 'xlab router' },
    expect: [200, 400, 401, 404, 500, 501, 502, 503],
    soft: true,
  });
  await req('web-fetch', 'POST', `${V1}/web/fetch`, {
    body: { url: 'https://example.com' },
    expect: [200, 400, 401, 404, 500, 501, 502, 503],
    soft: true,
  });

  // --- Images / audio (expect graceful fail if no provider) ---
  await req('images-generations', 'POST', `${V1}/images/generations`, {
    body: { model: 'dall-e-3', prompt: 'a cat', size: '1024x1024' },
    expect: [200, 400, 401, 404, 500, 501, 502, 503],
    soft: true,
  });
  await req('audio-speech', 'POST', `${V1}/audio/speech`, {
    body: { model: 'tts-1', input: 'hello', voice: 'alloy' },
    expect: [200, 400, 401, 404, 500, 501, 502, 503],
    soft: true,
  });

  // --- Batch / A2A / MCP / WS probe ---
  await req('batches-list', 'GET', `${V1}/batches`, { expect: [200, 401, 404, 405], soft: true });
  await req('a2a-card', 'GET', `${ROOT}/.well-known/agent.json`, { expect: [200, 404], soft: true });
  await req('a2a', 'POST', `${ROOT}/a2a`, {
    body: { jsonrpc: '2.0', id: 1, method: 'agent/authenticatedExtendedCard', params: {} },
    expect: [200, 400, 401, 404, 405, 500],
    soft: true,
  });
  await req('mcp-sse-head', 'GET', `${ROOT}/api/mcp/sse`, { expect: [200, 401, 404, 405, 406], soft: true });
  await req('amp-models', 'GET', `${ROOT}/api/provider/openai/v1/models`, {
    expect: [200, 401, 404],
    soft: true,
  });

  // --- Dashboard pages (HTML) ---
  for (const p of [
    '/dashboard',
    '/providers',
    '/combos',
    '/usage',
    '/settings',
    '/chat',
    '/playground',
    '/logs',
    '/health',
  ]) {
    await req(`page${p}`, 'GET', `${ROOT}${p}`, { expect: [200, 302, 307, 401, 404], soft: true });
  }

  // Summary
  const hardFail = results.filter((r) => r.status === 'FAIL' && !r.soft);
  const softFail = results.filter((r) => r.status === 'FAIL' && r.soft);
  const softOk = results.filter((r) => r.status === 'SOFT');
  const ok = results.filter((r) => r.status === 'OK');
  const lat = results.filter((r) => r.latency > 0).map((r) => r.latency);
  const avg = lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0;

  console.log('\n=== SUMMARY ===');
  console.log(`Total=${results.length} OK=${ok.length} HARD_FAIL=${hardFail.length} SOFT_FAIL=${softFail.length} NET_ERR=${softOk.length}`);
  console.log(`Latency avg=${avg}ms min=${Math.min(...lat)} max=${Math.max(...lat)}`);

  // Chat quality check
  if (chat?.code === 200 && chat.json?.choices?.[0]?.message?.content) {
    console.log(`Chat reply: ${String(chat.json.choices[0].message.content).slice(0, 120)}`);
  } else if (chat) {
    console.log(`Chat status: HTTP ${chat.code} — ${chat.preview}`);
  }

  // Model inventory
  const modelList = models?.json?.data || models?.json?.models || [];
  if (Array.isArray(modelList) && modelList.length) {
    const ids = modelList.map((m) => m.id || m.name).filter(Boolean);
    console.log(`Models (${ids.length}): ${ids.slice(0, 30).join(', ')}${ids.length > 30 ? '...' : ''}`);
  }

  if (hardFail.length) {
    console.log('\nHard failures:');
    hardFail.forEach((r) => console.log(`  - ${r.name}: HTTP ${r.code} ${r.preview}`));
  }
  if (softFail.length) {
    console.log('\nSoft failures (endpoint present but unexpected status):');
    softFail.forEach((r) => console.log(`  - ${r.name}: HTTP ${r.code} ${r.preview}`));
  }

  console.log(`\nFinished: ${new Date().toISOString()}\n`);
  process.exit(hardFail.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
