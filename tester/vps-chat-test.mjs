/**
 * Authenticated chat/model capability tests against remote VPS.
 * Env: ROOT_BASE, API_KEY, TIMEOUT_MS
 */
const ROOT = (process.env.ROOT_BASE || 'http://36.50.26.247:1212').replace(/\/$/, '');
const KEY = process.env.API_KEY || '';
const TIMEOUT = Math.max(5000, parseInt(process.env.TIMEOUT_MS || '120000', 10));

if (!KEY) {
  console.error('Missing API_KEY');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${KEY}`,
};

async function call(name, method, path, body, { timeout = TIMEOUT } = {}) {
  const start = Date.now();
  try {
    const res = await fetch(`${ROOT}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout),
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
    const ms = Date.now() - start;
    const preview = (text || '').replace(/\s+/g, ' ').slice(0, 220);
    console.log(`[${res.ok ? 'OK' : 'ERR'}] ${res.status} ${String(ms).padStart(5)}ms ${name}`);
    console.log(`      ${preview}`);
    return { name, ok: res.ok, status: res.status, ms, json, text };
  } catch (e) {
    const ms = Date.now() - start;
    console.log(`[FAIL] 0 ${String(ms).padStart(5)}ms ${name} :: ${e.message}`);
    return { name, ok: false, status: 0, ms, error: e.message };
  }
}

async function main() {
  console.log(`Base=${ROOT}`);
  const models = await call('models', 'GET', '/v1/models');
  const ids = (models.json?.data || []).map((m) => m.id);
  console.log('Model IDs:', ids.join(', '));

  const candidates = [...new Set([
    'gpt-5.5',
    'Digigo',
    'digigo/gpt-5.5',
    ...ids,
  ])].filter(Boolean);

  for (const model of candidates.slice(0, 8)) {
    await call(`chat:${model}`, 'POST', '/v1/chat/completions', {
      model,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 24,
      temperature: 0,
    });
  }

  // stream
  await call('chat-stream:gpt-5.5', 'POST', '/v1/chat/completions', {
    model: 'gpt-5.5',
    messages: [{ role: 'user', content: 'Say hi in 3 words' }],
    max_tokens: 32,
    stream: true,
  });

  // claude format
  await call('messages:gpt-5.5', 'POST', '/v1/messages', {
    model: 'gpt-5.5',
    max_tokens: 24,
    messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
  });

  // responses
  await call('responses:gpt-5.5', 'POST', '/v1/responses', {
    model: 'gpt-5.5',
    input: 'Reply with exactly: OK',
  });

  // count tokens
  await call('count_tokens', 'POST', '/v1/messages/count_tokens', {
    model: 'gpt-5.5',
    messages: [{ role: 'user', content: 'hello world from xlab' }],
  });

  // embeddings
  await call('embeddings', 'POST', '/v1/embeddings', {
    model: 'text-embedding-3-small',
    input: 'hello xlab router',
  });

  // invalid key
  const bad = await fetch(`${ROOT}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sk-invalid-test' },
    body: JSON.stringify({
      model: 'gpt-5.5',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 8,
    }),
    signal: AbortSignal.timeout(15000),
  });
  console.log(`[${bad.status === 401 ? 'OK' : 'ERR'}] ${bad.status} invalid-key-rejected`);
  console.log(`      ${(await bad.text()).slice(0, 160)}`);

  // dashboard bootstrap without cookie
  await call('dashboard-bootstrap', 'GET', '/api/dashboard/bootstrap');
  await call('auth-status', 'GET', '/api/auth/status');
  await call('keys-list', 'GET', '/api/keys');
  await call('providers', 'GET', '/api/providers');
  await call('combos', 'GET', '/api/combos');
  await call('settings', 'GET', '/api/settings');
  await call('usage-summary', 'GET', '/api/usage/summary');
  await call('tunnel-status', 'GET', '/api/tunnel/status');
  await call('mcp-status', 'GET', '/api/mcp/status');
  await call('health-degradation', 'GET', '/api/health/degradation');
  await call('monitoring-health', 'GET', '/api/monitoring/health');
  await call('management-status', 'GET', '/api/management/status');
  await call('models-info', 'GET', '/api/v1/models/info');
  await call('a2a-card', 'GET', '/.well-known/agent.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
