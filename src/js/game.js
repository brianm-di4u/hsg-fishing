// Rules engine: events, days, time, running, livewell, check-in, weigh-in, campaign (MECHANICS §6–7).
import { G, save } from './state.js';
import { LAKES, TIERS, CHAPTERS, ANGLERS, HOMETOWNS, SPECIES, UPGRADES, LURE_PRICES, LURE_IDS } from './data.js';
import { getLake, route } from './lakes.js';
import { makeRng, hash32, clamp, dist } from './util.js';
import { makeWeather, genSchedule, genAt, fieldBag, sunTimes, DERBY_OK, kickerActive } from './sim.js';

export const bus = { fns: [], on(f) { this.fns.push(f); }, emit(type, data) { for (const f of this.fns) f(type, data); } };

const rint = (x) => Math.round(x);
export const bagTotal = (fish) => Math.round(fish.reduce((s, f) => s + f.w, 0) * 16) / 16;

// ---------- events ----------
export function startEvent(o) {
  const S = G.S;
  const ch = o.chapter ? CHAPTERS.find((c) => c.id === o.chapter) : null;
  const kind = o.mode || (ch ? 'campaign' : 'quick');
  const lake = ch ? ch.lake : o.lake || 'hamilton';
  const month = ch ? ch.month : o.month || 5;
  const tier = kind === 'free' ? 'free' : ch ? ch.tier : o.tier || 'regional';
  const T = TIERS[tier];
  const seed = (o.seed ?? G.rng.int(1e9)) >>> 0;
  const er = makeRng(seed ^ 0x9e3779b9);
  // fictional field with persistent skills
  const names = ANGLERS.slice();
  for (let i = names.length - 1; i > 0; i--) { const j = er.int(i + 1); [names[i], names[j]] = [names[j], names[i]]; }
  const field = T.free ? [] : Array.from({ length: (T.field || 1) - 1 }, (_, i) => {
    const a = names[i % names.length];
    const b = T.pairs ? names[(i + 23) % names.length] : null;
    return { name: b ? `${a.split(' ')[0]} ${a.split(' ')[1]} & ${b.split(' ')[0]} ${b.split(' ')[1]}` : a, town: HOMETOWNS[er.int(HOMETOWNS.length)], skill: er.normal(), days: [] };
  });
  const partner = T.pairs ? { name: names[47], town: HOMETOWNS[er.int(HOMETOWNS.length)] } : null;
  S.event = { kind, chapter: ch ? ch.id : null, name: ch ? ch.event : kind === 'free' ? `Free fishing on ${LAKES[lake].name}` : `${T.name} on ${LAKES[lake].name}`,
    lake, month, tier, days: T.days || 1, day: 1, seed, field, partner, results: [], over: false, weather: o.weather || null, hour: o.hour ?? null, snowDelays: 0 };
  startDay();
  return S.event;
}

export function startDay() {
  const S = G.S, E = S.event, T = TIERS[E.tier];
  const L = getLake(E.lake);
  const dr = makeRng(hash32(`${E.seed}:${E.day}:${E.snowDelays}`));
  const weather = makeWeather(dr, E.month, L.def, E.day === 1 && E.snowDelays === 0 ? (E.weather || {}) : {});
  const sun = sunTimes(E.month);
  let start = T.start, end = T.end;
  if (T.free) { start = Math.max(5 * 60, sun.rise - 15); end = 21 * 60; }
  if (E.hour != null) start = E.hour;
  S.day = {
    lake: E.lake, month: E.month, clock: start, start, end, weather, sun, snow: weather.sky === 'snow',
    boat: { x: L.ramp.x, y: L.ramp.y, at: 'ramp', ang: 0 }, run: null, spots: {}, livewell: [], culled: [], caught: 0, casts: 0,
    gen: E.lake === 'catherine' ? genSchedule(dr, start, end) : [], eagle: null, piles: {}, jelly: null, lightsSeen: false,
    partnerNext: start + 45, late: 0, dq: false, done: false, log: [], seed: dr.state, warned: false, eventsSeen: {},
  };
  for (const sp of L.spots) S.day.spots[sp.id] = { pressure: 0, revealed: !sp.hidden };
  if ((E.lake === 'ouachita' || E.lake === 'degray') && (E.month === 12 || E.month <= 2)) moveEagle(dr);
  if (E.lake === 'ouachita' && E.month >= 6 && E.month <= 9 && dr.chance(0.35)) S.day.jelly = start + 60 + dr.int(Math.max(60, end - start - 120));
  revealNear(L.ramp.x, L.ramp.y);
  S.scene = 'briefing';
  bus.emit('day', S.day);
}

export function snowDelay() {
  const E = G.S.event; E.snowDelays++; E.weather = null; startDay();
}

function moveEagle(r) {
  const S = G.S, L = getLake(S.day.lake);
  const opts = L.spots.filter((s) => !s.hidden);
  const sp = opts[(r || G.rng).int(opts.length)];
  S.day.eagle = { spot: sp.id, until: S.day.clock + 90 };
}

// ---------- time ----------
export const mph = () => (G.S.profile.upgrades.motor ? 60 : 50);
export function runMinutes(fromPt, toPt) {
  const L = getLake(G.S.day.lake);
  if (dist(fromPt.x, fromPt.y, toPt.x, toPt.y) < 2) return 0;
  const r = route(L, fromPt, toPt);
  return rint(4 + (r.miles / mph()) * 60);
}
export function runHome() { const S = G.S, L = getLake(S.day.lake); return S.day.boat.at === 'ramp' ? 0 : runMinutes(S.day.boat, L.ramp); }

export function spend(min, why) {
  const S = G.S, D = S.day, E = S.event; if (!D || min <= 0) return;
  const before = D.clock;
  D.clock = rint(D.clock + min);
  for (const id in D.spots) if (id !== D.boat.at) D.spots[id].pressure = Math.max(0, D.spots[id].pressure - 0.1 * min / 60);
  // partner (pairs) boats a bass every so often
  if (E.partner) {
    while (D.clock >= D.partnerNext && D.partnerNext <= D.end) {
      const r = makeRng(hash32(`${E.seed}:${E.day}:p${D.partnerNext}`));
      if (r.chance(0.4)) {
        const sp = r.chance(0.75) ? 'largemouth' : 'spotted';
        const w = Math.round(Math.max(0.6, 1.5 * Math.exp(r.normal() * 0.38)) * 16) / 16;
        const fish = { sp, w, by: 'partner', t: D.partnerNext };
        const res = keepFish(fish, true);
        bus.emit('partner', { fish, res });
      }
      D.partnerNext += 45;
    }
  }
  if (D.eagle && D.clock >= D.eagle.until) moveEagle(makeRng(hash32(`${E.seed}:e${D.clock}`)));
  // generation starts while in the tailrace: everyone out
  const at = D.boat.at; const L = getLake(D.lake); const spot = L.spot(at);
  if (spot && spot.type === 'tailrace' && !genAt(D.gen, before) && genAt(D.gen, D.clock)) bus.emit('generation', spot);
  if (D.jelly && before < D.jelly && D.clock >= D.jelly && D.boat.at !== 'ramp') { D.jelly = null; journalEvent('jelly'); bus.emit('jelly'); }
  if (E.lake === 'hamilton' && (E.month === 12 || E.month === 11) && D.clock > D.sun.set + 20 && !D.lightsSeen) { D.lightsSeen = true; journalEvent('lights'); bus.emit('lights'); }
  const slack = D.end - D.clock - runHome();
  if (!D.warned && slack <= 15 && !TIERS[E.tier].free && why !== 'home') { D.warned = true; bus.emit('warn', slack); }
  bus.emit('clock', { why, min });
}
export const timeUp = () => G.S.day && G.S.day.clock >= G.S.day.end;
export const generating = () => G.S.day && genAt(G.S.day.gen, G.S.day.clock);

// ---------- map actions ----------
export function revealNear(x, y, r) {
  const S = G.S, L = getLake(S.day.lake);
  const R = r ?? (S.profile.upgrades.sonar ? 120 : 60);
  const found = [];
  for (const sp of L.spots) if (sp.hidden && !S.day.spots[sp.id].revealed && dist(sp.x, sp.y, x, y) <= R) { S.day.spots[sp.id].revealed = true; found.push(sp.id); }
  if (found.length) bus.emit('reveal', found);
  return found;
}
export function scan() {
  const S = G.S; spend(10, 'scan');
  return revealNear(S.day.boat.x, S.day.boat.y, (S.profile.upgrades.sonar ? 120 : 60) * 2);
}
// begin a run (the animation is driven by main.js; finishRun applies it)
export function beginRun(id) {
  const S = G.S, D = S.day, L = getLake(D.lake);
  const to = L.spot(id); if (!to || D.run || D.done) return false;
  if (D.boat.at === id) return false;
  const min = runMinutes(D.boat, to);
  const path = route(L, D.boat, to);
  D.run = { to: id, min, path, t: 0, dur: Math.min(2.4, 0.7 + path.len / 600) };
  bus.emit('run', D.run);
  return true;
}
export function finishRun() {
  const S = G.S, D = S.day, L = getLake(D.lake); const r = D.run; if (!r) return;
  const to = L.spot(r.to);
  // sonar reveals brush along the route
  for (let i = 0; i <= 10; i++) { const k = Math.min(r.path.pts.length - 1, Math.round(i / 10 * (r.path.pts.length - 1))); const p = r.path.pts[k]; revealNear(p[0], p[1]); }
  D.boat = { x: to.x, y: to.y, at: to.id, ang: D.boat.ang };
  D.run = null;
  spend(r.min, 'run');
  revealNear(to.x, to.y);
  bus.emit('arrived', to);
  save();
}
export function canFish(id) {
  const S = G.S, D = S.day, L = getLake(D.lake); const sp = L.spot(id);
  if (!sp || sp.id === 'ramp') return { ok: false, why: 'Run to a fishing spot first.' };
  if (sp.type === 'tailrace' && generating()) return { ok: false, why: 'Carpenter Dam is generating: the tailrace is closed.' };
  if (timeUp()) return { ok: false, why: 'Time is up. Head in.' };
  return { ok: true };
}

// ---------- livewell ----------
export function limits() {
  const S = G.S, T = TIERS[S.event.tier]; const lw = S.day.livewell;
  const bass = lw.filter((f) => SPECIES[f.sp].bass), small = lw.filter((f) => SPECIES[f.sp].small), crappie = lw.filter((f) => SPECIES[f.sp].crappie);
  return { free: !!T.free, derby: !!T.derby, limit: T.limit || 0, bass: bass.length, small: small.length, crappie: crappie.length };
}
// What happens if this fish is kept: {ok, cull?, why}
export function keepInfo(fish) {
  const S = G.S, T = TIERS[S.event.tier], lw = S.day.livewell, sp = SPECIES[fish.sp], lm = limits();
  if (T.derby) {
    if (!DERBY_OK(fish.sp)) return { ok: false, why: 'Derby rules (fictional): game fish only, so no catfish, bream, trout or rough fish.' };
    if (lw.length && lw[0].w >= fish.w) return { ok: false, why: `Your derby fish (${lw[0].w.toFixed(2)} lb) is bigger.` };
    return { ok: true, cull: lw[0] || null };
  }
  if (T.free) {
    if (sp.bass) {
      if (lm.bass >= 10) return { ok: false, why: 'Daily limit reached: 10 black bass (statewide).' };
      if (sp.small && lm.small >= 4) return { ok: false, why: 'Daily limit reached: no more than 4 smallmouth (statewide).' };
      return { ok: true };
    }
    if (sp.crappie) return lm.crappie >= 30 ? { ok: false, why: 'Daily limit reached: 30 crappie (statewide).' } : { ok: true };
    return { ok: false, why: 'Free fishing: this one is logged in your journal and released.' };
  }
  if (!sp.bass) return { ok: false, why: 'Tournament rules: only black bass count. Logged and released.' };
  const bass = lw.filter((f) => SPECIES[f.sp].bass);
  if (bass.length < T.limit) return { ok: true };
  const smallest = bass.reduce((a, b) => (b.w < a.w ? b : a));
  if (smallest.w >= fish.w) return { ok: false, why: `Livewell full: your smallest bass (${smallest.w.toFixed(2)} lb) is bigger.`, full: true };
  return { ok: true, cull: smallest };
}
export function keepFish(fish, auto = false) {
  const S = G.S, D = S.day; const info = keepInfo(fish);
  if (!info.ok) return info;
  if (info.cull) { D.livewell.splice(D.livewell.indexOf(info.cull), 1); D.culled.push(info.cull); }
  D.livewell.push(fish); D.livewell.sort((a, b) => b.w - a.w);
  if (!auto) save();
  return info;
}

// ---------- journal ----------
export function logCatch(fish) {
  const S = G.S, J = S.profile.journal;
  const e = J.species[fish.sp] || (J.species[fish.sp] = { n: 0, best: 0, lakes: [] });
  e.n++; if (fish.w > e.best) e.best = fish.w; if (!e.lakes.includes(S.day.lake)) e.lakes.push(S.day.lake);
  S.day.caught++;
}
export function journalEvent(id) { const J = G.S.profile.journal; J.events[id] = (J.events[id] || 0) + 1; G.S.day && (G.S.day.eventsSeen[id] = true); }
export function noteRead(id) { G.S.profile.journal.notes[id] = 1; }

// ---------- end of day ----------
export function endDay() {
  const S = G.S, D = S.day, E = S.event; if (D.done) return;
  const home = runHome();
  if (home) { spend(home, 'home'); D.boat = { ...D.boat, ...getLake(D.lake).ramp, at: 'ramp' }; }
  D.late = TIERS[E.tier].free ? 0 : Math.max(0, D.clock - D.end);
  D.dq = D.late > 15;
  D.done = true;
  weighIn();
}

export function playerBag() {
  const S = G.S, D = S.day, T = TIERS[S.event.tier];
  const fish = T.free ? D.livewell.slice() : D.livewell.filter((f) => T.derby || SPECIES[f.sp].bass).slice(0, T.limit);
  const raw = T.derby ? (fish[0] ? fish[0].w : 0) : bagTotal(fish);
  const penalty = Math.min(raw, D.late);
  return { fish, raw, penalty, total: D.dq ? 0 : Math.round((raw - penalty) * 16) / 16, big: fish.length ? Math.max(...fish.map((f) => f.w)) : 0, dq: D.dq, late: D.late };
}

export function weighIn() {
  const S = G.S, D = S.day, E = S.event, T = TIERS[E.tier];
  const bag = playerBag();
  const res = { day: E.day, player: bag, field: [] };
  if (!T.free) {
    const fr = makeRng(hash32(`${E.seed}:field:${E.day}`));
    E.field.forEach((a) => { const b = fieldBag(fr, E.lake, E.month, E.tier, a.skill); a.days[E.day - 1] = { total: b.total, big: b.big, n: b.fish.length, sp: b.fish[0] && b.fish[0].sp }; });
  }
  E.results[E.day - 1] = res;
  S.scene = 'weighin';
  bus.emit('weighin', res);
  save();
}

// Leaderboard through the current day. Ties break by big fish (fictional rule).
export function standings() {
  const S = G.S, E = S.event, T = TIERS[E.tier];
  const n = E.results.length;
  const sumP = (k) => E.results.slice(0, n).reduce((s, r) => s + (r ? r.player[k] : 0), 0);
  const rows = E.field.map((a) => ({ name: a.name, town: a.town, total: T.derby ? Math.max(...a.days.slice(0, n).map((d) => d.total)) : a.days.slice(0, n).reduce((s, d) => s + d.total, 0), big: Math.max(...a.days.slice(0, n).map((d) => d.big)), today: a.days[n - 1] ? a.days[n - 1].total : 0, you: false }));
  const pTotal = T.derby ? Math.max(...E.results.map((r) => r.player.total)) : sumP('total');
  const pBig = Math.max(...E.results.map((r) => r.player.big));
  const youName = E.partner ? `You & ${E.partner.name}` : 'You';
  rows.push({ name: youName, town: 'Hot Springs', total: Math.round(pTotal * 16) / 16, big: pBig, today: E.results[n - 1].player.total, you: true, dq: E.results.some((r) => r.player.dq) });
  rows.forEach((r) => { r.total = Math.round(r.total * 16) / 16; r.oz = Math.round(r.total * 16); });
  rows.sort((a, b) => (b.oz - a.oz) || (b.big - a.big) || (a.you ? 1 : -1));
  rows.forEach((r, i) => { r.rank = i + 1; });
  const me = rows.find((r) => r.you);
  const tie = rows.some((r) => !r.you && r.oz === me.oz && me.oz > 0);
  return { rows, me, tie };
}

export function finishEvent() {
  const S = G.S, E = S.event, T = TIERS[E.tier], P = S.profile;
  const st = T.free ? null : standings();
  let payout = 0, bigPot = 0;
  if (st) {
    payout = T.purse[st.me.rank - 1] || 0;
    const bigAll = Math.max(...st.rows.map((r) => r.big));
    if (T.big && st.me.big >= bigAll && st.me.big > 0) bigPot = T.big;
  }
  const out = { rank: st ? st.me.rank : null, of: st ? st.rows.length : 0, payout, bigPot, passed: false, chapter: E.chapter, next: null, champion: false };
  if (E.kind === 'campaign') {
    P.money += payout + bigPot;
    const ch = CHAPTERS.find((c) => c.id === E.chapter);
    const C = P.campaign;
    C.best[ch.id] = Math.min(C.best[ch.id] || 99, out.rank);
    out.passed = out.rank <= ch.need && !st.me.dq;
    if (out.passed) {
      C.passed[ch.id] = out.rank;
      const unlock = (id) => { if (!C.unlocked.includes(id)) C.unlocked.push(id); };
      if (ch.id === 'ch1') { unlock('ch2'); unlock('side'); out.next = 'ch2'; }
      if (ch.id === 'ch2') { unlock('ch3'); out.next = 'ch3'; }
      if (ch.id === 'ch3') { unlock('ch4'); out.next = 'ch4'; out.stockChoice = P.stocking == null; }
      if (ch.id === 'ch4') { C.champion = true; out.champion = true; }
    }
  }
  P.history.unshift({ name: E.name, lake: E.lake, month: E.month, rank: out.rank, of: out.of, total: st ? st.me.total : playerBag().total });
  P.history = P.history.slice(0, 20);
  E.over = true; E.outcome = out;
  S.scene = 'results';
  save();
  bus.emit('results', out);
  return out;
}

export function nextDay() {
  const E = G.S.event; if (E.day >= E.days) return false;
  E.day++; startDay(); return true;
}

// ---------- shop ----------
export function buy(id) {
  const P = G.S.profile;
  if (UPGRADES[id]) { if (P.upgrades[id] || P.money < UPGRADES[id].price) return false; P.money -= UPGRADES[id].price; P.upgrades[id] = true; save(); return true; }
  if (LURE_PRICES[id] != null) { if (P.lures.includes(id) || P.money < LURE_PRICES[id]) return false; P.money -= LURE_PRICES[id]; P.lures.push(id); save(); return true; }
  return false;
}
export function stock(yes) {
  const P = G.S.profile; P.stocking = !!yes;
  if (yes) P.money = Math.max(0, P.money - 1500);
  save();
}
export const lureList = () => (G.S.event && G.S.event.kind === 'campaign' ? G.S.profile.lures : LURE_IDS);
export const kickerToday = () => G.S.day && kickerActive(G.S.day.lake, G.S.day.month);
