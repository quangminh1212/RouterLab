const BASE_URL = (process.env.API_BASE || 'http://157.66.100.194:1212/v1').replace(/\/$/, '');
const ROOT_BASE = (process.env.ROOT_BASE || BASE_URL.replace(/\/v1$/, '')).replace(/\/$/, '');
const API_KEY = process.env.API_KEY;
const INFERRED_MODE = process.env.npm_lifecycle_event === 'test:vps-smoke' ? 'smoke' : 'seq';
const MODE = (process.env.MODE || INFERRED_MODE).toLowerCase();
const MODEL = process.env.MODEL || '';
const MODELS = (process.env.MODELS || '').split(',').map((item) => item.trim()).filter(Boolean);
const TOTAL = parseInt(process.env.TOTAL || '12', 10);
const CONCURRENCY = Math.max(1, parseInt(process.env.CONCURRENCY || '4', 10));
const TIMEOUT_MS = Math.max(1000, parseInt(process.env.TIMEOUT_MS || '60000', 10));
const RPM = Math.max(1, parseInt(process.env.RPM || '30', 10));
const PROMPT = process.env.PROMPT || 'Reply with exactly: OK';
const MAX_TOKENS = Math.max(1, parseInt(process.env.MAX_TOKENS || '16', 10));

const DEFAULT_MODELS = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.3-codex-xhigh',
];

const SMOKE_CASES = [
  { method: 'GET', path: '/api/health', expected: [200] },
  { method: 'GET', path: '/api/version', expected: [200] },
  { method: 'GET', path: '/api/tunnel/status', expected: [200, 401] },
  { method: 'GET', path: '/api/proxy/systems/list', expected: [200] },
  { method: 'GET', path: '/api/v1/models', expected: [200] },
  { method: 'GET', path: '/api/v1/models/info', expected: [200] },
  { method: 'GET', path: '/api/v1beta/models', expected: [200] },
  { method: 'GET', path: '/api/usage/summary', expected: [200, 401] },
  { method: 'GET', path: '/api/usage/stats', expected: [200, 401] },
  { method: 'GET', path: '/api/usage/request-details', expected: [200, 401] },
  { method: 'PUT', path: '/api/v1/models', expected: [400], body: 'not-json' },
  { method: 'POST', path: '/api/v1/models/test', expected: [400], body: 'not-json' },
  { method: 'POST', path: '/api/auth/login', expected: [400, 401], body: 'not-json' },
  { method: 'GET', path: '/this-path-should-404', expected: [404] },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pad = (value, size) => String(value).padEnd(size);

function resolveModels() {
  if (MODEL) return [MODEL];
  if (MODELS.length) return MODELS;
  return DEFAULT_MODELS;
}

function pickModel(index, models) {
  return models[index % models.length];
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const offset = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[offset];
}

function summarize(results) {
  const ok = results.filter((item) => item.status === 'OK');
  const err = results.filter((item) => item.status === 'ERROR');
  const fail = results.filter((item) => item.status === 'FAIL');
  const latencies = ok.map((item) => item.latency);
  const totalLatency = latencies.reduce((sum, value) => sum + value, 0);
  return {
    ok,
    err,
    fail,
    avg: latencies.length ? Math.round(totalLatency / latencies.length) : 0,
    min: latencies.length ? Math.min(...latencies) : 0,
    p50: percentile(latencies, 0.5),
    p95: percentile(latencies, 0.95),
    max: latencies.length ? Math.max(...latencies) : 0,
  };
}

async function parseResponse(response) {
  const rawText = await response.text();
  try {
    return { rawText, body: rawText ? JSON.parse(rawText) : {} };
  } catch {
    return { rawText, body: { raw: rawText } };
  }
}

async function testOnce(model, index) {
  const start = Date.now();
  try {
    const response = await fetch(BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + API_KEY,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: PROMPT }],
        max_tokens: MAX_TOKENS,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const latency = Date.now() - start;
    const { body } = await parseResponse(response);
    if (!response.ok) {
      const message = body?.error?.message ?? body?.message ?? JSON.stringify(body);
      return { index, model, status: 'ERROR', code: response.status, latency, detail: String(message).slice(0, 180) };
    }
    const content = body?.choices?.[0]?.message?.content ?? '(empty)';
    const usage = body?.usage ?? {};
    return {
      index,
      model,
      status: 'OK',
      code: response.status,
      latency,
      reply: content.trim().replace(/\s+/g, ' ').slice(0, 60),
      tokens: `${usage.prompt_tokens ?? '?'}p+${usage.completion_tokens ?? '?'}c`,
    };
  } catch (error) {
    const cause = error?.cause?.code ? `${error.cause.code} ${error.cause.address ?? ''}:${error.cause.port ?? ''}` : '';
    const detail = [error.message, cause].filter(Boolean).join(' - ');
    return { index, model, status: 'FAIL', code: 0, latency: Date.now() - start, detail: detail.slice(0, 180) };
  }
}

async function runSequential(models) {
  const delayMs = Math.ceil(60000 / RPM);
  const results = [];
  for (let index = 0; index < TOTAL; index += 1) {
    if (index > 0) await sleep(delayMs);
    const result = await testOnce(pickModel(index, models), index + 1);
    results.push(result);
    printResult(result);
  }
  return results;
}

async function runConcurrent(models) {
  const results = new Array(TOTAL);
  let cursor = 0;
  async function worker() {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= TOTAL) return;
      const result = await testOnce(pickModel(current, models), current + 1);
      results[current] = result;
      printResult(result);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, TOTAL) }, () => worker()));
  return results;
}

function printResult(result) {
  const icon = result.status === 'OK' ? '[OK] ' : result.status === 'ERROR' ? '[ERR]' : '[FAIL]';
  const detail = result.status === 'OK'
    ? `${result.tokens}  "${result.reply}"`
    : (result.detail ?? '');
  console.log(
    pad(`#${result.index}`, 6)
    + pad(result.model, 28)
    + pad(icon, 8)
    + pad(result.code, 6)
    + pad(`${result.latency}ms`, 10)
    + detail,
  );
}

function printHeader(models) {
  const line = '='.repeat(120);
  console.log(`\n${line}`);
  console.log(` API: ${BASE_URL}`);
  console.log(` Mode: ${MODE} | Total: ${TOTAL} | Concurrency: ${CONCURRENCY} | Timeout: ${TIMEOUT_MS}ms | RPM: ${RPM}`);
  console.log(` Models: ${models.join(', ')}`);
  console.log(` Started: ${new Date().toISOString()}`);
  console.log(line);
  console.log(pad('REQ', 6) + pad('MODEL', 28) + pad('STATUS', 8) + pad('HTTP', 6) + pad('LATENCY', 10) + 'DETAIL');
  console.log('-'.repeat(120));
}

function printSummary(results) {
  const line = '='.repeat(120);
  const summary = summarize(results);
  console.log(`\n${line}`);
  console.log(
    ` SUMMARY: OK=${summary.ok.length} ERR=${summary.err.length} FAIL=${summary.fail.length} / total=${results.length}`
    + ` | avg=${summary.avg}ms | min=${summary.min}ms | p50=${summary.p50}ms | p95=${summary.p95}ms | max=${summary.max}ms`,
  );
  if (summary.err.length) {
    console.log('\n Error requests:');
    summary.err.forEach((item) => console.log(`  - #${item.index} ${item.model} HTTP ${item.code}: ${item.detail}`));
  }
  if (summary.fail.length) {
    console.log('\n Failed requests:');
    summary.fail.forEach((item) => console.log(`  - #${item.index} ${item.model}: ${item.detail}`));
  }
  console.log(` Finished: ${new Date().toISOString()}`);
  console.log(`${line}\n`);
}

async function smokeOnce(testCase, index) {
  const start = Date.now();
  try {
    const response = await fetch(ROOT_BASE + testCase.path, {
      method: testCase.method,
      headers: testCase.body == null ? undefined : { 'Content-Type': 'application/json' },
      body: testCase.body ?? undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const latency = Date.now() - start;
    const { rawText, body } = await parseResponse(response);
    const previewSource = typeof body?.error === 'string'
      ? body.error
      : body?.error?.message ?? body?.message ?? rawText;
    const preview = String(previewSource || '').replace(/\s+/g, ' ').slice(0, 120);
    const ok = testCase.expected.includes(response.status);
    return {
      index,
      model: `${testCase.method} ${testCase.path}`,
      status: ok ? 'OK' : 'ERROR',
      code: response.status,
      latency,
      detail: ok ? preview : `expected ${testCase.expected.join('/')} | ${preview}`,
    };
  } catch (error) {
    return {
      index,
      model: `${testCase.method} ${testCase.path}`,
      status: 'FAIL',
      code: 0,
      latency: Date.now() - start,
      detail: String(error.message || error).slice(0, 180),
    };
  }
}

async function runSmoke() {
  const line = '='.repeat(120);
  console.log(`\n${line}`);
  console.log(` Smoke Base: ${ROOT_BASE}`);
  console.log(` Timeout: ${TIMEOUT_MS}ms`);
  console.log(` Started: ${new Date().toISOString()}`);
  console.log(line);
  console.log(pad('REQ', 6) + pad('ENDPOINT', 48) + pad('STATUS', 8) + pad('HTTP', 6) + pad('LATENCY', 10) + 'DETAIL');
  console.log('-'.repeat(120));

  const results = [];
  for (let index = 0; index < SMOKE_CASES.length; index += 1) {
    const result = await smokeOnce(SMOKE_CASES[index], index + 1);
    results.push(result);
    const icon = result.status === 'OK' ? '[OK] ' : result.status === 'ERROR' ? '[ERR]' : '[FAIL]';
    console.log(
      pad(`#${result.index}`, 6)
      + pad(result.model, 48)
      + pad(icon, 8)
      + pad(result.code, 6)
      + pad(`${result.latency}ms`, 10)
      + (result.detail || ''),
    );
  }

  const summary = summarize(results);
  console.log(`\n${line}`);
  console.log(
    ` SMOKE SUMMARY: OK=${summary.ok.length} ERR=${summary.err.length} FAIL=${summary.fail.length} / total=${results.length}`
    + ` | avg=${summary.avg}ms | min=${summary.min}ms | p50=${summary.p50}ms | p95=${summary.p95}ms | max=${summary.max}ms`,
  );
  console.log(` Finished: ${new Date().toISOString()}`);
  console.log(`${line}\n`);
  return results;
}

if (MODE !== 'smoke' && !API_KEY) {
  console.error('Missing API_KEY env');
  process.exit(1);
}

let results;
if (MODE === 'smoke') {
  results = await runSmoke();
} else {
  const models = resolveModels();
  printHeader(models);
  if (MODE === 'burst' || MODE === 'soak') {
    results = await runConcurrent(models);
  } else if (MODE === 'seq') {
    results = await runSequential(models);
  } else {
    console.error(`Unsupported MODE: ${MODE}. Use seq, burst, soak, or smoke.`);
    process.exit(1);
  }
  printSummary(results);
}

const hasIssue = results.some((item) => item.status !== 'OK');
process.exit(hasIssue ? 1 : 0);