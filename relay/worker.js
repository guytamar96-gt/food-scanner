// Samsung watch relay (Cloudflare Worker).
// HC Webhook on the phone posts Health Connect data here; this merges it into
// health/YYYY-MM-DD.json in the private training-data repo, which the app reads.
// Secrets (set in Cloudflare, never in this file): API_KEY, GH_TOKEN. Variable: REPO.
const TZ = 'Asia/Jerusalem';
const STAGES = { 0: 'unknown', 1: 'awake', 2: 'light', 3: 'awake', 4: 'light', 5: 'deep', 6: 'rem', 7: 'awake' };

function localDate(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
function stageName(s) {
  if (typeof s === 'number' || /^\d+$/.test(String(s))) return STAGES[Number(s)] || 'unknown';
  s = String(s).toLowerCase();
  if (s.includes('deep')) return 'deep';
  if (s.includes('rem')) return 'rem';
  if (s.includes('awake') || s.includes('out')) return 'awake';
  if (s.includes('light') || s.includes('sleep')) return 'light';
  return 'unknown';
}
function b64(s) { const b = new TextEncoder().encode(s); let bin = ''; for (const x of b) bin += String.fromCharCode(x); return btoa(bin); }
function unb64(s) { const bin = atob(s.replace(/\s/g, '')); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); }

async function gh(env, path, opts = {}) {
  return fetch(`https://api.github.com/repos/${env.REPO}/contents/${path}`, {
    ...opts,
    headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + env.GH_TOKEN, 'User-Agent': 'hc-relay', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) },
  });
}

// group the incoming records by the local day they belong to
function collect(body) {
  const days = {};
  const D = date => (days[date] ||= { steps: {}, active: {}, sleep: {}, exercise: {}, rhr: null, weight: null, bodyfat: null });
  for (const r of body.steps || []) D(localDate(r.start_time)).steps[r.start_time] = r.count;
  for (const r of body.active_calories || []) D(localDate(r.start_time)).active[r.start_time] = r.calories;
  for (const r of body.sleep || []) {
    const mins = {};
    for (const s of r.stages || []) { const k = stageName(s.stage); mins[k] = (mins[k] || 0) + (s.duration_seconds || (new Date(s.end_time) - new Date(s.start_time)) / 1000) / 60; }
    D(localDate(r.session_end_time)).sleep[r.session_end_time] = { total: (r.duration_seconds || 0) / 60, stages: mins };
  }
  for (const r of body.exercise || []) {
    D(localDate(r.start_time)).exercise[r.start_time] = { id: r.metadata && r.metadata.id, start: r.start_time, type: r.type, minutes: Math.round((r.duration_seconds || 0) / 60), distance_m: r.distance_meters ?? null };
  }
  const latest = (list, field, key) => { for (const r of list || []) { const d = D(localDate(r.time)); if (!d[key] || r.time > d[key].time) d[key] = { time: r.time, v: r[field] }; } };
  latest(body.resting_heart_rate, 'bpm', 'rhr');
  latest(body.weight, 'kilograms', 'weight');
  latest(body.body_fat, 'percentage', 'bodyfat');
  return days;
}

function merge(old, inc, date, deleted) {
  const f = Object.assign({ date, raw: { steps: {}, active: {}, sleep: {}, exercise: {} } }, old || {});
  const raw = f.raw;
  Object.assign(raw.steps, inc.steps); Object.assign(raw.active, inc.active); Object.assign(raw.sleep, inc.sleep); Object.assign(raw.exercise, inc.exercise);
  for (const k of Object.keys(raw.exercise)) if (raw.exercise[k].id && deleted.has(raw.exercise[k].id)) delete raw.exercise[k];
  const sum = o => Object.values(o).reduce((a, b) => a + (b || 0), 0);
  if (Object.keys(raw.steps).length) f.steps = Math.round(sum(raw.steps));
  if (Object.keys(raw.active).length) f.active_kcal = Math.round(sum(raw.active));
  const nights = Object.values(raw.sleep);
  if (nights.length) {
    const st = {}; let total = 0;
    for (const n of nights) { total += n.total; for (const [k, v] of Object.entries(n.stages)) st[k] = (st[k] || 0) + v; }
    const asleep = (st.deep || 0) + (st.rem || 0) + (st.light || 0);
    f.sleep = { minutes: Math.round(asleep || total - (st.awake || 0)), stages: Object.fromEntries(Object.entries(st).map(([k, v]) => [k, Math.round(v)])) };
  }
  f.exercise = Object.values(raw.exercise).sort((a, b) => a.start.localeCompare(b.start));
  if (inc.rhr && (!f.rhr_time || inc.rhr.time >= f.rhr_time)) { f.resting_hr = Math.round(inc.rhr.v); f.rhr_time = inc.rhr.time; }
  if (inc.weight && (!f.weight_time || inc.weight.time >= f.weight_time)) { f.weight_kg = Math.round(inc.weight.v * 10) / 10; f.weight_time = inc.weight.time; }
  if (inc.bodyfat) f.body_fat = Math.round(inc.bodyfat.v * 10) / 10;
  f.updatedAt = new Date().toISOString();
  return f;
}

async function saveDay(env, date, inc, deleted) {
  const path = `health/${date}.json`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await gh(env, path);
    let old = null, sha;
    if (r.ok) { const j = await r.json(); sha = j.sha; old = JSON.parse(unb64(j.content)); }
    else if (r.status !== 404) throw new Error('read ' + r.status);
    const body = JSON.stringify(merge(old, inc, date, deleted), null, 1) + '\n';
    const w = await gh(env, path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Watch data ' + date, content: b64(body), sha }) });
    if (w.ok) return;
    if (w.status !== 409 && w.status !== 422) throw new Error('write ' + w.status);
  }
  throw new Error('conflict');
}

export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return new Response('ok');
    if (req.headers.get('x-api-key') !== env.API_KEY) return new Response('unauthorised', { status: 401 });
    let body;
    try { body = await req.json(); } catch (e) { return new Response('bad json', { status: 400 }); }
    const deleted = new Set((body.deleted || []).map(d => d.id));
    const days = collect(body);
    try {
      for (const [date, inc] of Object.entries(days).sort()) await saveDay(env, date, inc, deleted);
    } catch (e) {
      return new Response('github: ' + e.message, { status: 502 }); // HC Webhook retries later
    }
    return Response.json({ ok: true, days: Object.keys(days) });
  },
};
