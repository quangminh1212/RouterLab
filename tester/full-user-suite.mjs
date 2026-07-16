/**
 * Full user-facing suite against remote XLab Router.
 * Env: ROOT_BASE, API_KEY (optional for free cases), TIMEOUT_MS
 */
const ROOT = (process.env.ROOT_BASE || 'http://36.50.26.247:1212').replace(/\/$/, '');
const KEY = process.env.API_KEY || '';
const TIMEOUT = Math.max(5000, parseInt(process.env.TIMEOUT_MS || '90000', 10));

const results = [];

function authHeaders(json = true) {
  const h = {};
  if (json) h['Content-Type'] = 'application/json';
  if (KEY) h.Authorization = `Bearer ${KEY}`;
  return h;
}

async function call(group, name, method, path, { body, headers, expect, soft, key } = {}) {
  const start = Date.now();
  const useKey = key === undefined ? !!KEY : key;
  try {
    const h = headers || {};
    if (body != null && !h['Content-Type']) h['Content-Type'] = 'application/json';
    if (useKey && KEY && !h.Authorization) h.Authorization = `Bearer ${KEY}`;
    const res = await fetch(`${ROOT}${path}`, {
      method,
      headers: Object.keys(h).length ? h : undefined,
      body: body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
    const expected = expect || [200];
    const ok = expected.includes(res.status);
    const row = {
      group, name, method, path, status: ok ? 'PASS' : (soft ? 'SOFT' : 'FAIL'),
      code: res.status, ms: Date.now() - start,
      preview: (text || '').replace(/\s+/g, ' ').slice(0, 140),
      json, soft: !!soft,
    };
    results.push(row);
    const icon = row.status === 'PASS' ? 'OK' : row.status;
    console.log(`[${icon}] ${String(res.status).padStart(3)} ${String(row.ms).padStart(5)}ms  ${group.padEnd(14)} ${name}`);
    return row;
  } catch (e) {
    const row = {
      group, name, method, path, status: soft ? 'SOFT' : 'FAIL',
      code: 0, ms: Date.now() - start, preview: String(e.message || e).slice(0, 160), soft: !!soft,
    };
    results.push(row);
    console.log(`[${row.status}]   0 ${String(row.ms).padStart(5)}ms  ${group.padEnd(14)} ${name} :: ${row.preview}`);
    return row;
  }
}

async function main() {
  console.log(`\n=== FULL USER SUITE ===\nBase: ${ROOT}\nAPI_KEY: ${KEY ? 'set' : 'none'}\nStarted: ${new Date().toISOString()}\n`);

  // --- A. Health / version / landing ---
  await call('ops', 'health', 'GET', '/api/health', { expect: [200], key: false });
  await call('ops', 'health-public', 'GET', '/health', { expect: [200], key: false });
  await call('ops', 'version', 'GET', '/api/version', { expect: [200], key: false });
  await call('ops', 'landing', 'GET', '/', { expect: [200, 302, 307], key: false });
  await call('ops', 'login', 'GET', '/login', { expect: [200], key: false });
  await call('ops', 'manifest', 'GET', '/manifest.webmanifest', { expect: [200, 404], key: false });
  await call('ops', 'metrics', 'GET', '/api/system/metrics', { expect: [200, 401], key: false });
  await call('ops', 'monitoring', 'GET', '/api/monitoring/health', { expect: [200], key: false });
  await call('ops', 'degradation', 'GET', '/api/health/degradation', { expect: [200], key: false });
  await call('ops', 'init', 'GET', '/api/init', { expect: [200, 401], key: false });
  await call('ops', '404', 'GET', '/this-path-should-404', { expect: [404], key: false });

  // --- B. Models discovery ---
  const models = await call('models', 'v1-models', 'GET', '/v1/models', { expect: [200], key: false });
  await call('models', 'api-models', 'GET', '/api/v1/models', { expect: [200], key: false });
  await call('models', 'models-info', 'GET', '/api/v1/models/info', { expect: [200], key: false });
  await call('models', 'v1beta', 'GET', '/api/v1beta/models', { expect: [200], key: false });
  await call('models', 'catalog', 'GET', '/api/models/catalog', { expect: [200, 401], key: false });
  await call('models', 'pricing', 'GET', '/api/pricing', { expect: [200, 401], key: false });
  await call('models', 'bad-json', 'PUT', '/api/v1/models', {
    body: 'not-json',
    headers: { 'Content-Type': 'application/json' },
    expect: [400],
    key: false,
  });

  const modelIds = (models.json?.data || []).map((m) => m.id);
  console.log(`  models listed: ${modelIds.join(', ') || '(none)'}`);

  // --- C. Auth gates ---
  await call('auth', 'status', 'GET', '/api/auth/status', { expect: [200], key: false });
  await call('auth', 'login-bad', 'POST', '/api/auth/login', {
    body: { password: '__invalid__' },
    expect: [400, 401],
    key: false,
  });
  await call('auth', 'providers-protected', 'GET', '/api/providers', { expect: [200, 401], key: false });
  await call('auth', 'combos-protected', 'GET', '/api/combos', { expect: [200, 401], key: false });
  await call('auth', 'settings-protected', 'GET', '/api/settings', { expect: [200, 401], key: false });
  await call('auth', 'keys-protected', 'GET', '/api/keys', { expect: [200, 401], key: false });
  await call('auth', 'usage-protected', 'GET', '/api/usage/summary', { expect: [200, 401], key: false });
  await call('auth', 'tunnel-protected', 'GET', '/api/tunnel/status', { expect: [200, 401], key: false });
  await call('auth', 'invalid-key', 'POST', '/v1/chat/completions', {
    body: { model: 'gpt-5.5', messages: [{ role: 'user', content: 'hi' }], max_tokens: 8 },
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sk-invalid-test' },
    expect: [401],
    key: false,
  });

  // --- D. Free public (no API key) — user path ---
  const freeModels = [
    'pol/openai',
    'oc/deepseek-v4-flash-free',
    'unc/Lorbus/Qwen3.6-27B-int4-AutoRound',
    'FREE',
    'OpenCode',
  ];
  for (const m of freeModels) {
    await call('free', `chat:${m}`, 'POST', '/v1/chat/completions', {
      body: {
        model: m,
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        max_tokens: 24,
        temperature: 0,
      },
      expect: [200],
      key: false,
    });
  }
  // stream free
  await call('free', 'stream:pol/openai', 'POST', '/v1/chat/completions', {
    body: {
      model: 'pol/openai',
      messages: [{ role: 'user', content: 'Say hi in 2 words' }],
      max_tokens: 24,
      stream: true,
    },
    expect: [200],
    key: false,
  });
  // paid without key must fail if requireApiKey
  await call('free', 'paid-no-key:gpt-5.5', 'POST', '/v1/chat/completions', {
    body: {
      model: 'gpt-5.5',
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 16,
    },
    expect: [401, 200], // 200 only if requireApiKey=false
    key: false,
    soft: true,
  });

  // --- E. Paid / combo chat (with key if available) ---
  if (KEY) {
    for (const m of ['gpt-5.5', 'Digigo', ...modelIds.filter((id) => !['FREE', 'OpenCode'].includes(id)).slice(0, 3)]) {
      await call('paid', `chat:${m}`, 'POST', '/v1/chat/completions', {
        body: {
          model: m,
          messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
          max_tokens: 24,
          temperature: 0,
        },
        expect: [200, 429, 502, 503],
        soft: true,
      });
    }
    await call('paid', 'stream:gpt-5.5', 'POST', '/v1/chat/completions', {
      body: {
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Say hi' }],
        max_tokens: 24,
        stream: true,
      },
      expect: [200, 429, 502, 503],
      soft: true,
    });
    await call('paid', 'messages:gpt-5.5', 'POST', '/v1/messages', {
      body: {
        model: 'gpt-5.5',
        max_tokens: 24,
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      },
      expect: [200, 400, 429, 502, 503],
      soft: true,
    });
    await call('paid', 'responses:gpt-5.5', 'POST', '/v1/responses', {
      body: { model: 'gpt-5.5', input: 'Reply with exactly: OK' },
      expect: [200, 400, 429, 502, 503],
      soft: true,
    });
    await call('paid', 'completions-legacy', 'POST', '/v1/completions', {
      body: { model: 'gpt-5.5', prompt: 'Say OK', max_tokens: 8 },
      expect: [200, 400, 429, 502, 503],
      soft: true,
    });
    await call('paid', 'count-tokens', 'POST', '/v1/messages/count_tokens', {
      body: { model: 'gpt-5.5', messages: [{ role: 'user', content: 'hello xlab' }] },
      expect: [200, 400, 404],
      soft: true,
    });
  } else {
    console.log('[SKIP] paid chat cases — no API_KEY');
  }

  // --- F. Other OpenAI-compatible surfaces ---
  await call('media', 'embeddings', 'POST', '/v1/embeddings', {
    body: { model: 'text-embedding-3-small', input: 'hello' },
    expect: [200, 400, 401, 404, 501, 502, 503],
    soft: true,
  });
  await call('media', 'moderations', 'POST', '/v1/moderations', {
    body: { input: 'hello' },
    expect: [200, 400, 401, 404, 501, 502, 503],
    soft: true,
  });
  await call('media', 'images', 'POST', '/v1/images/generations', {
    body: { model: 'dall-e-3', prompt: 'a cat', size: '1024x1024' },
    expect: [200, 400, 401, 404, 501, 502, 503],
    soft: true,
  });
  await call('media', 'tts', 'POST', '/v1/audio/speech', {
    body: { model: 'tts-1', input: 'hello', voice: 'alloy' },
    expect: [200, 400, 401, 404, 501, 502, 503],
    soft: true,
  });
  await call('media', 'search', 'POST', '/v1/search', {
    body: { query: 'xlab router' },
    expect: [200, 400, 401, 404, 501, 502, 503],
    soft: true,
  });
  await call('media', 'web-fetch', 'POST', '/v1/web/fetch', {
    body: { url: 'https://example.com' },
    expect: [200, 400, 401, 404, 501, 502, 503],
    soft: true,
  });
  await call('media', 'rerank', 'POST', '/v1/rerank', {
    body: { model: 'rerank', query: 'q', documents: ['a', 'b'] },
    expect: [200, 400, 401, 404, 501, 502, 503],
    soft: true,
  });
  await call('media', 'batches', 'GET', '/v1/batches', {
    expect: [200, 401],
    soft: true,
  });

  // --- G. A2A / MCP / Amp ---
  await call('agent', 'a2a-card', 'GET', '/.well-known/agent.json', { expect: [200], key: false });
  await call('agent', 'a2a-status', 'GET', '/api/a2a/status', { expect: [200], key: false });
  await call('agent', 'a2a-tasks', 'GET', '/api/a2a/tasks', { expect: [200, 401], key: false });
  await call('agent', 'a2a-rpc', 'POST', '/a2a', {
    body: { jsonrpc: '2.0', id: 1, method: 'agent/authenticatedExtendedCard', params: {} },
    expect: [200, 400, 401, 404, 405],
    soft: true,
    key: false,
  });
  await call('agent', 'mcp-status', 'GET', '/api/mcp/status', { expect: [200], key: false });
  await call('agent', 'mcp-sse', 'GET', '/api/mcp/sse', { expect: [200, 401, 404, 405, 406, 503], soft: true, key: false });
  await call('agent', 'proxy-systems', 'GET', '/api/proxy/systems/list', { expect: [200, 401], key: false });
  await call('agent', 'quota', 'GET', '/api/quota', { expect: [200, 401], key: false });
  await call('agent', 'tags', 'GET', '/api/tags', { expect: [200, 401], key: false });
  await call('agent', 'compression', 'GET', '/api/compression', { expect: [200, 401], key: false });
  await call('agent', 'mcp-registry', 'GET', '/api/mcp-registry/search?q=test', { expect: [200, 400, 401, 405], soft: true, key: false });

  // --- H. Dashboard pages (HTML) ---
  for (const p of [
    '/dashboard',
    '/dashboard/providers',
    '/dashboard/combos',
    '/dashboard/usage',
    '/dashboard/basic-chat',
    '/dashboard/endpoint',
    '/dashboard/cli-tools',
    '/dashboard/translator',
    '/dashboard/token-saver',
    '/dashboard/mcp-servers',
    '/dashboard/ai-plugins',
    '/dashboard/ai-skills',
    '/dashboard/ai-memory',
    '/dashboard/quota',
    '/dashboard/proxy-pools',
    '/dashboard/rules',
    '/dashboard/mitm',
    '/dashboard/profile',
    '/dashboard/console-log',
    '/dashboard/skills',
    '/dashboard/media-providers/web',
  ]) {
    await call('ui', `page${p}`, 'GET', p, { expect: [200, 302, 307, 401, 404], soft: true, key: false });
  }

  // Summary
  const pass = results.filter((r) => r.status === 'PASS');
  const soft = results.filter((r) => r.status === 'SOFT');
  const fail = results.filter((r) => r.status === 'FAIL');
  const byGroup = {};
  for (const r of results) {
    byGroup[r.group] = byGroup[r.group] || { pass: 0, soft: 0, fail: 0 };
    byGroup[r.group][r.status === 'PASS' ? 'pass' : r.status === 'SOFT' ? 'soft' : 'fail'] += 1;
  }

  console.log('\n=== SUMMARY BY GROUP ===');
  for (const [g, s] of Object.entries(byGroup)) {
    console.log(`  ${g.padEnd(14)} PASS=${s.pass} SOFT=${s.soft} FAIL=${s.fail}`);
  }
  console.log(`\nTOTAL=${results.length} PASS=${pass.length} SOFT=${soft.length} FAIL=${fail.length}`);
  if (fail.length) {
    console.log('\nHard failures:');
    fail.forEach((r) => console.log(`  - [${r.group}] ${r.name}: HTTP ${r.code} ${r.preview}`));
  }
  if (soft.length) {
    console.log('\nSoft (graceful/degraded):');
    soft.forEach((r) => console.log(`  - [${r.group}] ${r.name}: HTTP ${r.code} ${r.preview.slice(0, 100)}`));
  }
  console.log(`\nFinished: ${new Date().toISOString()}\n`);
  process.exit(fail.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
