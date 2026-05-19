const BASE_URL = process.env.API_BASE || 'http://157.66.100.194:1212/v1';
const API_KEY  = process.env.API_KEY;
const RPM      = 30;
const DELAY_MS = Math.ceil(60000 / RPM);

const MODELS = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.3-codex-xhigh',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad   = (s, n) => String(s).padEnd(n);

async function testModel(model) {
  const start = Date.now();
  try {
    const res = await fetch(BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        max_tokens: 16,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(30000),
    });
    const latency = Date.now() - start;
    let body;
    try { body = await res.json(); } catch { body = { raw: await res.text() }; }
    if (!res.ok) {
      const msg = body?.error?.message ?? body?.message ?? JSON.stringify(body);
      return { model, status: 'ERROR', code: res.status, latency, detail: String(msg).slice(0, 110) };
    }
    const content = body?.choices?.[0]?.message?.content ?? '(empty)';
    const u = body?.usage ?? {};
    return {
      model,
      status: 'OK',
      code: res.status,
      latency,
      reply: content.trim().slice(0, 50),
      tokens: (u.prompt_tokens ?? '?') + 'p+' + (u.completion_tokens ?? '?') + 'c',
    };
  } catch (e) {
    const cause = e.cause?.code ? `${e.cause.code} ${e.cause.address ?? ''}:${e.cause.port ?? ''}` : '';
    const detail = [e.message, cause].filter(Boolean).join(' - ');
    return { model, status: 'FAIL', code: 0, latency: Date.now() - start, detail: detail.slice(0, 110) };
  }
}

const line = (c, n = 100) => c.repeat(n);
if (!API_KEY) {
  console.error('Missing API_KEY env');
  process.exit(1);
}
console.log('\n' + line('='));
console.log(' API: ' + BASE_URL + '  |  RPM: ' + RPM + '  |  Models: ' + MODELS.length + '  |  Started: ' + new Date().toISOString());
console.log(line('='));
console.log(pad('MODEL', 40) + pad('STATUS', 8) + pad('HTTP', 6) + pad('LATENCY', 10) + 'DETAIL');
console.log(line('-'));

const results = [];
for (let i = 0; i < MODELS.length; i++) {
  if (i > 0) await sleep(DELAY_MS);
  const r = await testModel(MODELS[i]);
  results.push(r);
  const icon = r.status === 'OK' ? '[OK] ' : r.status === 'ERROR' ? '[ERR]' : '[FAIL]';
  const detail = r.status === 'OK' ? r.tokens + '  "' + r.reply + '"' : (r.detail ?? '');
  console.log(pad(r.model, 40) + pad(icon, 8) + pad(r.code, 6) + pad(r.latency + 'ms', 10) + detail);
}

const ok   = results.filter((r) => r.status === 'OK');
const err  = results.filter((r) => r.status === 'ERROR');
const fail = results.filter((r) => r.status === 'FAIL');
const avg  = ok.length ? Math.round(ok.reduce((s, r) => s + r.latency, 0) / ok.length) : 0;

console.log('\n' + line('='));
console.log(' SUMMARY: OK=' + ok.length + '  ERR=' + err.length + '  FAIL=' + fail.length + '  / total=' + MODELS.length + '  | avg-latency(OK)=' + avg + 'ms');
if (ok.length)   { console.log('\n Working models:');  ok.forEach((r) => console.log('  - ' + r.model + ' (' + r.latency + 'ms)')); }
if (err.length)  { console.log('\n Error models:');    err.forEach((r) => console.log('  - ' + r.model + '  HTTP ' + r.code + ': ' + r.detail)); }
if (fail.length) { console.log('\n Failed models:');   fail.forEach((r) => console.log('  - ' + r.model + ': ' + r.detail)); }
console.log(' Finished: ' + new Date().toISOString());
console.log(line('=') + '\n');
