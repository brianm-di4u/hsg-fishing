// DOM screens, HUD, spot card, fishing controls, modals and toasts.
import { G } from './state.js';
import { LAKES, LAKE_IDS, MONTHS, TIERS, CHAPTERS, SPECIES, LURES, SPOT_TYPES, UPGRADES, LURE_PRICES, STATE_RECORDS, RECORD_RULE, LIMITS_TEXT, EVENT_TEXT, CLIMATE } from './data.js';
import { getLake } from './lakes.js';
import { fmtW, fmtWShort, fmtClock, fmtMoney, esc, clamp } from './util.js';
import { airTemp, troutSeason, kickerActive, genAt } from './sim.js';
import { runHome, runMinutes, limits, standings, playerBag, generating, canFish, lureList } from './game.js';
import { drawFish, SCENES as ART_SCENES } from './art.js';

const $ = (s) => document.querySelector(s);
export const UI = { wi: null, cardFor: null, noteIdx: 0, journalTab: 'species', lastScene: null };
let NOTES = [];
export function setNotes(n) { NOTES = n; }
export function nextNote() { const n = NOTES[UI.noteIdx % NOTES.length]; UI.noteIdx++; if (n && G.S) G.S.profile.journal.notes[n.id] = 1; return n; }

const I_SUN = '<circle cx="12" cy="12" r="4.5" fill="#F2A541"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="#F2A541" stroke-width="2" stroke-linecap="round"/>';
const I_CLOUD = '<path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.2 4.4 4.4 0 0 0 7 18z" fill="#C3D3DF" stroke="#14283A" stroke-width="1.2"/>';
const icon = (inner) => `<svg class="wxi" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
const SKY = {
  clear: [icon(I_SUN), 'Clear'],
  partly: [icon('<g transform="translate(-3 -3) scale(.8)">' + I_SUN + '</g>' + I_CLOUD), 'Partly cloudy'],
  overcast: [icon(I_CLOUD), 'Overcast'],
  rain: [icon(I_CLOUD + '<path d="M9 20l-1 3M13 20l-1 3M17 20l-1 3" stroke="#4C8FA8" stroke-width="2" stroke-linecap="round"/>'), 'Rain'],
  storm: [icon(I_CLOUD + '<path d="M12 17l-2 4h3l-2 3" stroke="#F2A541" stroke-width="2" fill="none" stroke-linecap="round"/>'), 'Storms'],
  snow: [icon(I_CLOUD + '<path d="M8 21h0M12 22h0M16 21h0" stroke="#F6F3EC" stroke-width="3" stroke-linecap="round"/>'), 'Snow'],
};
const SCENES = ['title', 'campaign', 'setup', 'briefing', 'weighin', 'results', 'shop', 'journal', 'help', 'settings'];
const units = () => G.S.settings.units;
const W = (w) => fmtW(w, units());

function noteHTML(n) {
  if (!n) return '';
  return `<aside class="note"><h3><span aria-hidden="true">⚓</span> Dock Note</h3><p class="q">${esc(n.q)} <b>${esc(n.a)}.</b></p><p>${esc(n.text)}</p><p class="src">Source: ${esc(n.source)}${n.claim ? ' <span class="badge">claim</span>' : ''}</p></aside>`;
}

// ---------- scene switching ----------
export function renderScene() {
  const S = G.S; const sc = S.scene;
  document.body.className = `scene-${sc}` + (G.S.ui.reduced ? ' reduced' : '') + (document.body.classList.contains('portrait') ? ' portrait' : '');
  document.documentElement.dataset.theme = S.ui.theme;
  document.documentElement.style.setProperty('--ts', S.settings.textScale);
  for (const id of SCENES) { const el = $('#scene-' + id); if (el) el.hidden = id !== sc; }
  const play = sc === 'map' || sc === 'fish';
  $('#hud').hidden = !play;
  $('#mapbar').hidden = sc !== 'map';
  $('#fishbar').hidden = sc !== 'fish';
  if (sc !== 'map') { $('#card').hidden = true; }
  const fresh = UI.lastScene !== sc; UI.lastScene = sc;
  const fn = R[sc]; if (fn) { $('#scene-' + sc).innerHTML = fn(); if (fresh) focusFirst('#scene-' + sc); }
  if (play) renderHUD();
  if (sc === 'map') { renderMapbar(); renderCard(); }
  if (sc === 'fish') renderFishbar();
  if (sc === 'weighin') paintWeighFish();
}
function pickFocus(root) { return root && (root.querySelector('[autofocus]') || root.querySelector('.btn.primary') || root.querySelector('button')); }
export function focusScene() { focusFirst('#scene-' + G.S.scene); }
function focusFirst(sel) { const el = pickFocus($(sel)); if (el) try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }

const R = {};
R.title = () => {
  const S = G.S; const n = nextNote();
  return `<div class="title-wrap">
    <h1><span class="t1">Ouachita</span> <span class="t2">Bass Classic</span></h1>
    <p class="sub">A fishing tournament on the lakes around Hot Springs, Arkansas</p>
    <nav class="menu" aria-label="Main menu">
      ${S.resume ? `<button class="btn primary" data-act="resume">Resume: ${esc(S.resume.event.name)}</button>` : ''}
      <button class="btn ${S.resume ? '' : 'primary'}" data-act="go" data-to="campaign" ${S.resume ? '' : 'autofocus'}>Follow the River <small>campaign</small></button>
      <button class="btn" data-act="setup" data-mode="quick">Quick Tournament</button>
      <button class="btn" data-act="setup" data-mode="free">Free Fish</button>
      <div class="row"><button class="btn ghost" data-act="go" data-to="journal">Journal</button><button class="btn ghost" data-act="go" data-to="help">How to Play</button><button class="btn ghost" data-act="go" data-to="settings">Settings</button></div>
    </nav>
    ${noteHTML(n)}
    <p class="credit">Hot Springs Games · MIT · Facts from the project's research files; spots, ramps, events and anglers are fictional.</p>
  </div>`;
};

R.campaign = () => {
  const P = G.S.profile, C = P.campaign;
  const node = (ch) => {
    const L = LAKES[ch.lake]; const T = TIERS[ch.tier];
    const open = C.unlocked.includes(ch.id); const best = C.best[ch.id]; const passed = C.passed[ch.id];
    const prev = CHAPTERS[CHAPTERS.indexOf(ch) - 1];
    const lockTxt = ch.id === 'side' ? 'Finish top 5 at Lake Catherine to take the side trip.' : prev ? `Finish top ${prev.need} in ${prev.event} to open${prev.gate ? ' ' + prev.gate : ' this event'}.` : '';
    return `<li class="chain-node ${open ? 'open' : 'locked'} ${passed ? 'passed' : ''} ${ch.side ? 'side' : ''}">
      ${(() => { const art = ART_SCENES['dam-' + { catherine: 'remmel', hamilton: 'carpenter', ouachita: 'blakely', degray: 'degray' }[ch.lake]];
        return art ? `<div class="dam art" style="background-image:url('${art.src}')"><span class="cap"><b>${esc(L.dam)}</b> ${L.damYear}</span></div>` : `<div class="dam"><b>${esc(L.dam)}</b><span>${L.damYear}</span></div>`; })()}
      <div class="lake-card">
        <h3>${esc(L.name)} <small>${MONTHS[ch.month - 1]}</small></h3>
        <p class="ev">${esc(ch.event)} · ${esc(T.name)}${T.days ? ' · 2 days' : ''}${T.pairs ? ' · pairs' : ''}</p>
        <p>${esc(ch.blurb)}</p>
        ${open ? `<p class="need">${ch.id === 'ch4' ? 'Win it all.' : ch.side ? 'Top 3 pays.' : `Need: top ${ch.need}`}${best ? ` · Best: ${ord(best)}` : ''}${passed ? ' · <b>Cleared</b>' : ''}</p>
          <button class="btn primary" data-act="play" data-ch="${ch.id}">${best ? 'Fish it again' : 'Fish it'}</button>`
        : `<p class="lock"><span aria-hidden="true">🔒</span> ${esc(lockTxt)}</p>`}
      </div></li>`;
  };
  return `<div class="page">
    <header class="page-h"><button class="btn ghost back" data-act="go" data-to="title" aria-label="Back to title">← Title</button><h2>Follow the River</h2><span class="money">${fmtMoney(P.money)}</span></header>
    <p class="lede">Climb the Ouachita River's dam chain: Lake Catherine below Carpenter Dam, Lake Hamilton below Blakely Mountain Dam, then the championship on Lake Ouachita. DeGray Lake on the Caddo River is a side trip.</p>
    ${C.champion ? '<p class="banner win">🏆 Ouachita Classic champion!</p>' : ''}
    <ol class="chain">${CHAPTERS.filter((c) => !c.side).map(node).join('')}</ol>
    <h3 class="side-h">Side trip</h3>
    <ol class="chain">${node(CHAPTERS.find((c) => c.side))}</ol>
    <div class="row center"><button class="btn" data-act="go" data-to="shop">Razorstone Tackle (shop)</button></div>
  </div>`;
};

R.setup = () => {
  const o = UI.setup || (UI.setup = { mode: 'quick', lake: 'hamilton', month: 5, tier: 'regional' });
  const chip = (name, val, cur, label) => `<button class="chip ${val === cur ? 'on' : ''}" aria-pressed="${val === cur}" data-act="pick" data-k="${name}" data-v="${val}">${label}</button>`;
  return `<div class="page">
    <header class="page-h"><button class="btn ghost back" data-act="go" data-to="title">← Title</button><h2>${o.mode === 'free' ? 'Free Fish' : 'Quick Tournament'}</h2></header>
    <fieldset><legend>Lake</legend><div class="chips lakes">${LAKE_IDS.map((id) => chip('lake', id, o.lake, `<b>${LAKES[id].name}</b><small>${LAKES[id].acres}</small>`)).join('')}</div></fieldset>
    <fieldset><legend>Month</legend><div class="chips months">${MONTHS.map((m, i) => chip('month', i + 1, o.month, m.slice(0, 3))).join('')}</div>
      <p class="hint">${monthHint(o.lake, o.month)}</p></fieldset>
    ${o.mode === 'quick' ? `<fieldset><legend>Tier</legend><div class="chips">${['club', 'regional', 'championship'].map((t) => chip('tier', t, o.tier, `<b>${TIERS[t].name}</b><small>${TIERS[t].pairs ? 'pairs, evening' : `${TIERS[t].field} boats`}</small>`)).join('')}</div></fieldset>` : `<p class="hint">Statewide limits apply: ${esc(LIMITS_TEXT)}</p>`}
    <div class="row center"><button class="btn primary" data-act="startSetup">Go fishing</button></div>
  </div>`;
};
function monthHint(lake, m) {
  const c = CLIMATE[m - 1];
  const bits = [`Normals: high ${c.hi}°F, low ${c.lo}°F, ${c.p} in of rain.`];
  if (lake === 'catherine' && troutSeason(m)) bits.push('Rainbow trout are stocked in the Carpenter Dam tailrace.');
  if ((lake === 'ouachita' || lake === 'degray') && (m === 12 || m <= 2)) bits.push('Eagle season.');
  if (kickerActive(lake, m)) bits.push('Post-spawn kicker month.');
  if (c.hi >= 90) bits.push('Summer heat: fish go deep at midday.');
  return esc(bits.join(' '));
}

R.briefing = () => {
  const S = G.S, E = S.event, D = S.day, L = LAKES[E.lake], T = TIERS[E.tier];
  const w = D.weather; const sky = SKY[w.sky];
  const lines = [];
  if (T.free) lines.push(`Fish from ${fmtClock(D.start)} until ${fmtClock(D.end)}. Statewide limits: 10 black bass (no more than 4 smallmouth), 30 crappie.`);
  else {
    lines.push(`${fmtClock(D.start)} launch, check in by <b>${fmtClock(D.end)}</b> at ${esc(getLake(E.lake).ramp.name)}.`);
    lines.push(T.derby ? 'One fish wins: your single heaviest game fish.' : `${T.limit}-bass limit; cull as you go. ${T.pairs ? `Pairs: you and ${esc(E.partner.name)} of ${esc(E.partner.town)} share a livewell.` : 'Individual.'}`);
    lines.push(`${T.field} ${T.pairs ? 'teams' : 'boats'}${E.days > 1 ? `, two days: day ${E.day} of ${E.days}` : ''}. Late check-in costs 1 lb a minute; more than 15 minutes late is a DQ (fictional tournament rules).`);
  }
  const ev = [];
  if (D.snow) ev.push(['snow', EVENT_TEXT.snow]);
  if (w.clarity === 'muddy') ev.push(['mud', EVENT_TEXT.mud]);
  if (w.hi >= 90) ev.push(['heat', EVENT_TEXT.heat]);
  if (kickerActive(E.lake, E.month)) ev.push(['kicker', EVENT_TEXT.kicker]);
  if (E.lake === 'ouachita') ev.push(['slow', EVENT_TEXT.slow]);
  if (D.eagle) ev.push(['eagle', 'Eagle season: watch for a bald eagle circling over baitfish.']);
  if (E.lake === 'catherine') ev.push(['gen', `Carpenter Dam generation board (fictional times): ${D.gen.map(([a, b]) => `${fmtClock(a)}–${fmtClock(b)}`).join(', ')}. The tailrace closes while it runs.${troutSeason(E.month) ? ' Trout are in season (stocked November–April).' : ' Trout are out of season.'}`]);
  const n = nextNote();
  return `<div class="page brief">
    <header class="page-h"><button class="btn ghost back" data-act="quit">← Quit</button><h2>${esc(E.name)}</h2></header>
    ${(() => { const art = ART_SCENES['dam-' + { catherine: 'remmel', hamilton: 'carpenter', ouachita: 'blakely', degray: 'degray' }[E.lake]]; return art ? `<div class="hero-banner" style="background-image:url('${art.src}')" role="img" aria-label="${esc(L.dam)}, painted"><span class="cap">${esc(L.name)} · ${esc(L.dam)} (${L.damYear})</span></div>` : ''; })()}
    <div class="cols">
      <section class="card"><h3>${esc(L.name)} · ${MONTHS[E.month - 1]}</h3><ul class="facts">${L.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></section>
      <section class="card"><h3>Format</h3>${lines.map((l) => `<p>${l}</p>`).join('')}</section>
      <section class="card wx"><h3>Weather</h3>
        <p class="big"><span aria-hidden="true">${sky[0]}</span> ${sky[1]} · high ${w.hi}°F, low ${w.lo}°F · wind ${w.wind} mph</p>
        <p>Water <b>${Math.round(w.water)}°F</b> <span class="est">game estimate</span> · ${w.clarity} water. Sunrise ${fmtClock(D.sun.rise)}, sunset ${fmtClock(D.sun.set)}.</p>
        <p class="hint">Air temperatures follow Hot Springs' monthly normals. No lake water temperatures are published in our sources, so the game estimates them from air temperatures.</p></section>
    </div>
    ${ev.map(([k, t]) => `<p class="banner ev-${k}">${esc(t)}</p>`).join('')}
    <div class="row center">${D.snow ? '<button class="btn primary" data-act="snowDelay">Wait a day</button>' : `<button class="btn primary" data-act="launch" autofocus>Launch from ${esc(getLake(E.lake).ramp.name)}</button>`}</div>
    ${noteHTML(n)}
  </div>`;
};

// ---------- HUD ----------
export function renderHUD() {
  const S = G.S, D = S.day, E = S.event; if (!D) return;
  const T = TIERS[E.tier];
  const home = runHome(); const lm = limits(); const bag = playerBag();
  const sky = SKY[D.weather.sky];
  const left = D.end - D.clock;
  $('#hud-clock').innerHTML = `<b>${fmtClock(D.clock)}</b><small>${T.free ? `until ${fmtClock(D.end)}` : `in by ${fmtClock(D.end)}`}${home ? ` · ${home}m run` : ''}</small>`;
  $('#hud-clock').classList.toggle('warn', !T.free && left - home <= 15);
  $('#hud-well').innerHTML = T.derby ? `<b>${bag.fish.length ? W(bag.big) : '—'}</b><small>derby fish</small>`
    : T.free ? `<b>${lm.bass} bass · ${lm.crappie} crappie</b><small>limits 10 / 30</small>`
      : `<b>${lm.bass} / ${T.limit} bass</b><small>${W(bag.raw)}</small>`;
  $('#hud-wx').innerHTML = `<b><span aria-hidden="true">${sky[0]}</span> ${Math.round(airTemp(D.weather, D.clock))}°F</b><small>water ${Math.round(D.weather.water)}° est.</small>`;
}

// ---------- map bar and spot card ----------
export function renderMapbar() {
  const S = G.S, D = S.day, E = S.event, T = TIERS[E.tier];
  const atRamp = D.boat.at === 'ramp';
  $('#mapbar').innerHTML = `<span class="lakename">${esc(LAKES[D.lake].name)}${E.days > 1 ? ` · day ${E.day}/${E.days}` : ''}</span>
    <button class="btn" data-act="scan" title="Sonar scan here (10 min)">Scan <small>10 min</small></button>
    <button class="btn ${D.clock >= D.end ? 'primary' : ''}" data-act="endDay">${T.free ? 'Call it a day' : atRamp ? 'Weigh in now' : 'Head in'} <small>${atRamp ? 'at ramp' : runHome() + ' min'}</small></button>`;
}
export function renderCard() {
  const S = G.S, D = S.day; const el = $('#card');
  const id = UI.cardFor; if (!id || S.scene !== 'map') { el.hidden = true; return; }
  const L = getLake(D.lake);
  if (id.startsWith('lm:')) {
    const lm = L.def.landmarks.find((x) => 'lm:' + x.id === id); if (!lm) { el.hidden = true; return; }
    el.innerHTML = `<h3>${esc(lm.label)}</h3><p>${esc(lm.text)}</p><div class="row"><button class="btn" data-act="closeCard" autofocus>Close</button></div>`;
    el.hidden = false; return;
  }
  const sp = L.spot(id); if (!sp) { el.hidden = true; return; }
  const here = D.boat.at === sp.id; const st = D.spots[sp.id] || {};
  if (sp.hidden && !st.revealed) { el.hidden = true; return; }
  const ty = SPOT_TYPES[sp.type];
  const min = here ? 0 : runMinutes(D.boat, sp);
  const cf = canFish(sp.id);
  const extra = [];
  if (sp.id === 'ramp') extra.push(`${esc(L.ramp.name)} (fictional ramp). Weigh-in is here.`);
  else {
    extra.push(`${esc(ty.label)} · about ${sp.depth} ft · cover: ${esc(ty.cover.join(', ') || 'open water')}.`);
    if (sp.marker) extra.push(`Cedar brush pile near Island Marker ${sp.marker}.`);
    if (sp.type === 'tailrace') extra.push(`Generation board (fictional): ${D.gen.map(([a, b]) => `${fmtClock(a)}–${fmtClock(b)}`).join(', ')}.${generating() ? ' <b>Generating now: closed.</b>' : ''}`);
    if (sp.type === 'grass') extra.push('Hydrilla and milfoil: treble-hook lures foul here; weedless baits come through.');
    if (D.eagle && D.eagle.spot === sp.id) extra.push('<b>A bald eagle is circling here.</b>');
    if (st.pressure > 0.3) extra.push('Pressured: you have worked this spot hard.');
  }
  el.innerHTML = `<h3>${esc(sp.name || L.ramp.name)}</h3>${extra.map((x) => `<p>${x}</p>`).join('')}
    <div class="row">${here ? (sp.id === 'ramp' ? '' : `<button class="btn primary" data-act="fishHere" ${cf.ok ? '' : 'disabled'} autofocus>Fish here</button>`) : `<button class="btn primary" data-act="runTo" data-id="${sp.id}" autofocus>Run here <small>${min} min</small></button>`}
    <button class="btn ghost" data-act="closeCard">Close</button></div>${!cf.ok && here && sp.id !== 'ramp' ? `<p class="why">${esc(cf.why)}</p>` : ''}`;
  el.hidden = false;
}

// ---------- fishing bar ----------
export function renderFishbar() {
  const S = G.S, F = S.fish; if (!F) return;
  const lure = LURES[F.lure];
  const label = { aim: 'Hold to cast', flight: 'Casting', retrieve: F.reel ? 'Reeling' : 'Hold to reel', bite: 'SET!', fight: F.reel ? 'Reeling' : 'Hold to reel', landed: 'Landed!', lost: 'Lost it', snag: 'Snagged', back: 'Reeling in' }[F.phase] || 'Wait';
  const sp = (k, t) => `<button class="seg ${F.speed === k ? 'on' : ''}" aria-pressed="${F.speed === k}" data-act="speed" data-v="${k}" title="${t} retrieve (${k === 'slow' ? 1 : k === 'med' ? 2 : 3})">${t}</button>`;
  const bar = $('#fishbar');
  const html = `<button class="btn lure" data-act="lureMenu" aria-label="Change lure (L)"><span class="lname">${esc(lure.short)}</span><small>${esc(F.color)}</small></button>
    <div class="segs" role="group" aria-label="Retrieve speed">${sp('slow', 'Slow')}${sp('med', 'Med')}${sp('fast', 'Fast')}</div>
    <button id="action" class="btn action ph-${F.phase}" aria-label="${label} (Space)">${label}</button>
    <button class="btn ghost leave" data-act="leave" aria-label="Back to the map (Esc)" ${['aim', 'back'].includes(F.phase) ? '' : 'disabled'}>Map</button>`;
  if (bar.dataset.h !== html) { bar.innerHTML = html; bar.dataset.h = html; }
}
export function status(text) { const el = $('#status'); if (el.textContent !== text) el.textContent = text || ''; el.hidden = !text; }
export function announce(text) { const el = $('#live'); el.textContent = ''; setTimeout(() => { el.textContent = text; }, 30); }
let toastT = null;
// One message region: a scene change or a modal clears it, so stale toasts never sit over other UI.
export function clearToast() { const el = $('#toast'); clearTimeout(toastT); el.classList.remove('show'); el.hidden = true; }
export function toast(text, ms = 2600) {
  const el = $('#toast'); el.textContent = text; el.hidden = false; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => { el.classList.remove('show'); el.hidden = true; }, ms);
}

// ---------- modals ----------
export function showModal(html, cls = '') {
  const m = $('#modal'); m.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div>`; m.hidden = false;
  clearToast(); status('');
  G.S.ui.modal = cls || 'modal';
  const b = pickFocus(m); if (b) try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
}
export function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; G.S.ui.modal = null; }

export function catchCard(fish) {
  const S = G.S; const sp = SPECIES[fish.sp]; const J = S.profile.journal.species[fish.sp];
  const pb = J && J.best === fish.w && J.n > 1;
  const first = J && J.n === 1;
  const info = fish.info;
  const keepLabel = info.ok ? (info.cull ? `Keep (cull ${W(info.cull.w)})` : 'Keep') : 'Keep';
  // length from the largemouth standard-weight curve (log10 W[g] = −5.528 + 3.273 log10 L[mm]), shape-adjusted: a game estimate
  const lenIn = Math.pow(10, (Math.log10(fish.w * 453.6) + 5.528) / 3.273) / 25.4 * Math.cbrt(0.36 / sp.art.h);
  const spot = getLake(S.day.lake).spot(S.fish ? S.fish.spot : 'ramp');
  showModal(`<div class="catch-hero"><canvas id="catch-cv" aria-hidden="true"></canvas></div><h2>${esc(sp.name)}</h2>
    <p class="weight">${W(fish.w)}<span class="len">about ${Math.round(lenIn)} in</span></p>
    <p class="sm where">${esc(spot ? spot.name : '')} · ${esc(LAKES[S.day.lake].name)}</p>
    ${info.ok && info.cull ? `<p class="cull">Culls your smallest fish: <b>${W(info.cull.w)}</b> (${esc(SPECIES[info.cull.sp].name.toLowerCase())})</p>` : ''}
    <p class="ribbons">${first ? '<span class="badge new">New species for your journal!</span>' : pb ? '<span class="badge new">New personal best!</span>' : ''}${sp.bass && fish.w >= 5 ? '<span class="badge kick">Kicker</span>' : ''}${S.day && S.day.livewell.length && fish.w > Math.max(...S.day.livewell.map((f) => f.w)) ? '<span class="badge big">Big fish of the day</span>' : ''}</p>
    <p class="sm">${esc(LURES[fish.lure].short)}, ${esc(fish.color)} · ${fmtClock(fish.t)}</p>
    ${info.ok ? '' : `<p class="why">${esc(info.why)}</p>`}
    <div class="row center">${info.ok ? `<button class="btn primary" data-act="keep" autofocus>${keepLabel}</button>` : ''}<button class="btn ${info.ok ? '' : 'primary'}" data-act="release" ${info.ok ? '' : 'autofocus'}>Release</button></div>`, 'catch');
  const cv = document.getElementById('catch-cv'); const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.min(520, window.innerWidth - 64), ch = Math.round(cw * 0.42);
  cv.width = cw * dpr; cv.height = ch * dpr; cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  // the fish's size on the card grows with its weight relative to the species' range
  const k = clamp(Math.cbrt(fish.w / sp.max), 0.28, 1);
  const c = cv.getContext('2d'); c.scale(dpr, dpr); drawFish(c, fish.sp, cw / 2, ch / 2, (cw * (0.42 + 0.48 * k)) / (sp.art.len * 1.08), { dpr });
}

export function lureMenu() {
  const F = G.S.fish; const ids = lureList();
  showModal(`<h2>Tackle box</h2><div class="lures">${ids.map((id) => {
    const L = LURES[id];
    return `<div class="lure-row ${F.lure === id ? 'on' : ''}"><div><b>${esc(L.name)}</b><p>${esc(L.tip)}</p></div><div class="chips">${L.colors.map((c) => `<button class="chip ${F.lure === id && F.color === c ? 'on' : ''}" data-act="pickLure" data-id="${id}" data-c="${c}">${esc(c)}</button>`).join('')}</div></div>`;
  }).join('')}</div><div class="row center"><button class="btn" data-act="closeModal">Done</button></div>`, 'tackle');
}

export function pauseMenu() {
  const S = G.S, T = S.event ? TIERS[S.event.tier] : null;
  showModal(`<h2>Paused</h2><div class="menu">
    <button class="btn primary" data-act="closeModal" autofocus>Resume</button>
    <button class="btn" data-act="go" data-to="help">How to Play</button>
    <button class="btn" data-act="go" data-to="settings">Settings</button>
    ${S.day && !S.day.done ? `<button class="btn" data-act="endDay">${T && T.free ? 'Call it a day' : 'Head in and weigh in'}</button>` : ''}
    <button class="btn ghost" data-act="quit">Quit to title</button></div>`, 'pause');
}

// ---------- weigh-in ----------
// Seven-segment display (SVG): lit segments glow, unlit ones stay faintly visible like a real LED board.
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' };
function sevenSeg(text) {
  const P = { a: 'M4,0 h14 l3,3 -3,3 h-14 l-3,-3z', b: 'M22,4 l3,3 v13 l-3,3 -3,-3 v-13z', c: 'M22,26 l3,3 v13 l-3,3 -3,-3 v-13z', d: 'M4,46 h14 l3,3 -3,3 h-14 l-3,-3z',
    e: 'M0,26 l3,3 v13 l-3,3 -3,-3 v-13z', f: 'M0,4 l3,3 v13 l-3,3 -3,-3 v-13z', g: 'M4,23 h14 l3,3 -3,3 h-14 l-3,-3z' };
  const chars = String(text).split(''); const W = 32;
  const body = chars.map((ch, i) => { const on = SEG[ch] || ''; return `<g transform="translate(${6 + i * W},4) skewX(-6)">${Object.keys(P).map((k) => `<path d="${P[k]}" class="${on.includes(k) ? 'on' : 'off'}"/>`).join('')}</g>`; }).join('');
  return `<svg class="seg7" viewBox="0 0 ${chars.length * W + 8} 60" aria-hidden="true">${body}</svg>`;
}
R.weighin = () => {
  const S = G.S, E = S.event, res = E.results[E.day - 1], T = TIERS[E.tier];
  const wi = UI.wi || { step: 99 };
  const bag = res.player;
  const shown = Math.min(bag.fish.length, wi.step);
  const counting = wi.step > bag.fish.length;
  const total = counting ? bag.total : 0;
  const digits = fmtWShort(wi.step > bag.fish.length ? total : bag.fish.slice(0, shown).reduce((s, f) => s + f.w, 0));
  let board = '';
  if (!T.free && wi.step > bag.fish.length + 1) {
    const st = standings(); const top = st.rows.slice(0, 10); if (!top.includes(st.me)) top.push(st.me);
    board = `<table class="board"><caption>${E.days > 1 ? `Standings after day ${E.day}` : 'Final standings'}${st.tie ? ' · <b>tie broken by big fish</b>' : ''}</caption>
      <thead><tr><th>#</th><th>${T.pairs ? 'Team' : 'Angler'}</th><th>${T.derby ? 'Fish' : 'Total'}</th><th>Big</th></tr></thead><tbody>
      ${top.map((r) => `<tr class="${r.you ? 'you' : ''}"><td>${r.rank}</td><td>${esc(r.name)}<small>${esc(r.town)}</small></td><td>${r.dq ? 'DQ' : fmtWShort(r.total)}</td><td>${fmtWShort(r.big)}</td></tr>`).join('')}</tbody></table>`;
  }
  return `<div class="page wi">
    <div class="scoreboard" role="group" aria-label="Weigh-in scoreboard">
      <div class="grille" aria-hidden="true"></div>
      <h2>${esc(E.name)}${E.days > 1 ? ` · Day ${E.day}` : ''}</h2>
      <div class="neon" aria-live="polite"><span class="sr-only">${digits}</span>${sevenSeg(digits)}</div>
      <p class="neon-sub">${T.derby ? 'heaviest fish' : `${bag.fish.length} fish`}${bag.penalty ? ` · late ${bag.late} min: −${W(bag.penalty)}` : ''}${bag.dq ? ' · DISQUALIFIED (over 15 min late)' : ''}</p>
      <ul class="bag">${bag.fish.slice(0, shown).map((f) => `<li><canvas data-fish="${f.sp}" data-w="${f.w}" width="96" height="44" aria-hidden="true"></canvas><span>${esc(SPECIES[f.sp].name)}</span><b>${fmtWShort(f.w)}</b></li>`).join('')}</ul>
    </div>
    ${board}
    <div class="row center">${wi.step >= 99 || wi.done ? (E.day < E.days && !T.free ? '<button class="btn primary" data-act="nextDay" autofocus>On to day 2</button>' : '<button class="btn primary" data-act="finish" autofocus>Results</button>') : '<button class="btn" data-act="skipWeigh">Skip</button>'}</div>
  </div>`;
};
function paintWeighFish() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  document.querySelectorAll('canvas[data-fish]').forEach((cv) => {
    cv.width = 96 * dpr; cv.height = 44 * dpr; cv.style.width = '96px'; cv.style.height = '44px';
    const k = cv.dataset.w ? clamp(0.55 + Math.cbrt(+cv.dataset.w / SPECIES[cv.dataset.fish].max) * 0.6, 0.55, 1) : 1; // bigger fish, bigger thumbnail
    const c = cv.getContext('2d'); c.scale(dpr, dpr); drawFish(c, cv.dataset.fish, 48, 22, 74 * k / SPECIES[cv.dataset.fish].art.len, { dpr });
  });
}

R.results = () => {
  const S = G.S, E = S.event, o = E.outcome || {}, T = TIERS[E.tier], P = S.profile;
  const ch = CHAPTERS.find((c) => c.id === E.chapter);
  let head = '', body = '';
  if (T.free) {
    const bag = E.results[E.results.length - 1].player;
    const lm = limits();
    head = 'Day on the water';
    body = `<p>You kept ${lm.bass} black bass and ${lm.crappie} crappie (${W(bag.raw)}) and caught ${S.day.caught} fish in all.</p>
      <div class="card warden"><h3>Livewell check</h3><p>A wildlife officer (fictional) checks your livewell at the ramp: ${lm.bass} black bass (${lm.small} smallmouth), ${lm.crappie} crappie. <b>All legal.</b></p><p class="sm">${esc(LIMITS_TEXT)}</p></div>`;
  } else {
    head = o.champion ? 'Champion!' : `${ord(o.rank)} of ${o.of}`;
    body = `<p class="big">${E.kind === 'campaign' ? `Payout ${fmtMoney(o.payout)}${o.bigPot ? ` + big-fish pot ${fmtMoney(o.bigPot)}` : ''}` : `Payout would be ${fmtMoney(o.payout)}`} <span class="sm">(fictional purse)</span></p>`;
    if (ch && !o.champion) {
      if (o.passed) body += `<p class="banner win">${ch.gate ? `${esc(ch.gate)} is open: on to ${esc(LAKES[CHAPTERS.find((c) => c.id === o.next).lake].name)}.` : o.next ? `Qualified: ${esc(CHAPTERS.find((c) => c.id === o.next).event)} is next.` : 'Cleared!'}</p>`;
      else body += `<p class="banner">You needed top ${ch.need}. Try the event again with a new day on the water.</p>`;
    }
    if (o.champion) body += '<div class="trophy" aria-hidden="true">🏆</div><p class="banner win">You won the Ouachita Classic Championship. The whole river chain, from Remmel Dam to Blakely Mountain, is yours.</p>';
    if (ch && ch.side && o.rank <= 3) body += '<p>Side-trip money in the bank. The eagles say hello.</p>';
  }
  const n = nextNote();
  return `<div class="page res"><h2>${head}</h2>${body}
    <div class="row center">
      ${E.kind === 'campaign' ? `${!o.passed && ch && !ch.side ? `<button class="btn primary" data-act="play" data-ch="${ch.id}" autofocus>Try again</button>` : ''}
        ${o.passed && o.next ? `<button class="btn primary" data-act="play" data-ch="${o.next}" autofocus>Next: ${esc(CHAPTERS.find((c) => c.id === o.next).event)}</button>` : ''}
        <button class="btn ${o.champion || (ch && ch.side) ? 'primary' : ''}" data-act="go" data-to="campaign">River Chain</button><button class="btn" data-act="go" data-to="shop">Tackle shop</button>`
      : `<button class="btn primary" data-act="again" autofocus>Fish again</button><button class="btn" data-act="go" data-to="title">Title</button>`}
    </div>${noteHTML(n)}${P.money ? `<p class="sm center">Bank: ${fmtMoney(P.money)}</p>` : ''}</div>`;
};

R.shop = () => {
  const P = G.S.profile;
  const up = Object.entries(UPGRADES).map(([id, u]) => `<li class="shop-row"><div><b>${esc(u.name)}</b><p>${esc(u.effect)}</p>${u.fact ? `<p class="sm">${esc(u.fact)}</p>` : ''}</div>
    ${P.upgrades[id] ? '<span class="owned">Owned</span>' : `<button class="btn" data-act="buy" data-id="${id}" ${P.money < u.price ? 'disabled' : ''}>Buy ${fmtMoney(u.price)}</button>`}</li>`).join('');
  const lures = Object.entries(LURE_PRICES).map(([id, pr]) => `<li class="shop-row"><div><b>${esc(LURES[id].name)}</b><p>${esc(LURES[id].tip)}</p></div>
    ${P.lures.includes(id) ? '<span class="owned">Owned</span>' : `<button class="btn" data-act="buy" data-id="${id}" ${P.money < pr ? 'disabled' : ''}>Buy ${fmtMoney(pr)}</button>`}</li>`).join('');
  return `<div class="page"><header class="page-h"><button class="btn ghost back" data-act="go" data-to="campaign">← River Chain</button><h2>Razorstone Tackle</h2><span class="money">${fmtMoney(P.money)}</span></header>
    <p class="lede">A fictional bait shop, named for novaculite: Latin for "razor stone." Upgrades and lures carry through the campaign; Quick and Free modes use your upgrades and every lure.</p>
    <h3>Upgrades</h3><ul class="shop">${up}</ul><h3>Lures</h3><ul class="shop">${lures}</ul></div>`;
};

R.journal = () => {
  const J = G.S.profile.journal; const tab = UI.journalTab;
  const tabs = [['species', 'Species'], ['records', 'Records & rules'], ['events', 'Sightings'], ['notes', 'Dock Notes'], ['history', 'History']];
  let body = '';
  if (tab === 'species') body = `<ul class="species">${Object.entries(SPECIES).map(([id, sp]) => { const e = J.species[id]; return `<li class="${e ? 'got' : ''}"><canvas data-fish="${id}" width="96" height="44" aria-hidden="true"></canvas><div><b>${e ? esc(sp.name) : '???'}</b><small>${e ? `${e.n} caught · best ${W(e.best)} · ${e.lakes.map((l) => LAKES[l].short).join(', ')}` : 'not caught yet'}</small></div></li>`; }).join('')}</ul><p class="sm">Weights are game estimates; only species our sources list for each lake appear there.</p>`;
  if (tab === 'records') body = `<table class="board"><caption>Arkansas state records (AGFC)</caption><thead><tr><th>Species</th><th>Weight</th><th>Water</th><th>Date</th></tr></thead><tbody>${STATE_RECORDS.map((r) => `<tr><td>${esc(r.sp)}</td><td>${esc(r.w)}</td><td>${esc(r.water)}</td><td>${esc(r.date)}</td></tr>`).join('')}</tbody></table>
    <p>${esc(RECORD_RULE)}</p><p>No state records come from the Hot Springs lakes in our sources, and AGFC does not appear to publish per-lake records.</p><h3>Limits</h3><p>${esc(LIMITS_TEXT)}</p>`;
  if (tab === 'events') { const evs = [['eagle', 'Bald eagle circling', EVENT_TEXT.eagle], ['jelly', 'Freshwater jellyfish', EVENT_TEXT.jelly], ['lights', 'Garvan Holiday Lights', EVENT_TEXT.lights], ['generation', 'Generation at Carpenter Dam', EVENT_TEXT.generation], ['snow', 'Snow day', EVENT_TEXT.snow]]; body = `<ul class="events">${evs.map(([id, n, t]) => `<li class="${J.events[id] ? 'got' : ''}"><b>${J.events[id] ? esc(n) : '???'}</b><p>${J.events[id] ? esc(t) : 'Not seen yet.'}</p></li>`).join('')}</ul>`; }
  if (tab === 'notes') body = `<ul class="notes">${NOTES.map((n) => J.notes[n.id] ? `<li>${noteHTML(n)}</li>` : '<li class="locked">A Dock Note you have not read yet.</li>').join('')}</ul>`;
  if (tab === 'history') body = G.S.profile.history.length ? `<table class="board"><thead><tr><th>Event</th><th>Place</th><th>Bag</th></tr></thead><tbody>${G.S.profile.history.map((h) => `<tr><td>${esc(h.name)}<small>${MONTHS[h.month - 1]}</small></td><td>${h.rank ? `${ord(h.rank)} / ${h.of}` : '—'}</td><td>${fmtWShort(h.total)}</td></tr>`).join('')}</tbody></table>` : '<p>No events yet.</p>';
  return `<div class="page"><header class="page-h"><button class="btn ghost back" data-act="back">← Back</button><h2>Journal</h2></header>
    <div class="tabs" role="tablist">${tabs.map(([k, n]) => `<button role="tab" class="chip ${tab === k ? 'on' : ''}" aria-selected="${tab === k}" data-act="jtab" data-v="${k}">${n}</button>`).join('')}</div>${body}</div>`;
};
export function paintJournal() { paintWeighFish(); }

R.help = () => `<div class="page help"><header class="page-h"><button class="btn ghost back" data-act="back">← Back</button><h2>How to Play</h2></header>
  <section class="card"><h3>The day</h3><p>Pick a spot on the lake map and run there (running costs time). Fish it: choose a lure, color and retrieve speed, cast, work the bait and fight what bites. Keep your best five bass and get back to the ramp before check-in. The weigh-in ranks you against a field of fictional anglers.</p></section>
  <section class="card"><h3>Controls</h3><table class="keys"><thead><tr><th></th><th>Mouse / touch</th><th>Keyboard</th></tr></thead><tbody>
    <tr><td>Pick a spot</td><td>Tap a marker</td><td>Tab or arrow keys, Enter</td></tr>
    <tr><td>Aim</td><td>Press on the water and drag</td><td>Arrow keys move the target</td></tr>
    <tr><td>Cast</td><td>Hold, release when the ring is tightest</td><td>Hold Space, release</td></tr>
    <tr><td>Reel</td><td>Hold anywhere (or the big button)</td><td>Hold Space</td></tr>
    <tr><td>Twitch the lure</td><td>Quick tap while reeling</td><td>Enter</td></tr>
    <tr><td>Set the hook</td><td>Tap when you see “!”</td><td>Space or Enter</td></tr>
    <tr><td>Fight</td><td>Hold to reel; drag left/right to steer the rod</td><td>Hold Space; Left/Right arrows</td></tr>
    <tr><td>Lure / speed</td><td>Buttons</td><td>L · 1 2 3</td></tr>
    <tr><td>Map / pause</td><td>Map button / menu</td><td>Esc · M mutes</td></tr></tbody></table></section>
  <section class="card"><h3>The fight</h3><p>Keep the tension marker in the <b>GOOD</b> zone. Too long in <b>DANGER</b> snaps the line; too long in <b>SLACK</b> and the fish throws the hook. When a bass <b>jumps</b>, ease off but stay tight. Pull the rod <b>against</b> the way the fish swims (the arrow beside it) to tire it faster.</p></section>
  <section class="card"><h3>Reading the water</h3><p>Fish follow water temperature: crappie move shallow from about 56°F, bass and bream a few degrees warmer, catfish warmest. Outside their spawn, fish hold deep or on brush. Summer heat pushes fish deep at midday; dawn and dusk bring them up. Clear water favors natural colors; muddy water favors chartreuse, black/blue and lures that thump. Treble hooks snag brush and foul in grass; weedless baits don't. Keep the lure at the fish's depth: the sonar strip shows the bottom and your lure.</p>
    <p class="sm"><b>Game estimates:</b> water temperatures, fish weights, spawn windows beyond the sourced crappie values, bite odds and the generation schedule are game logic. Spots, ramps, events, payouts, tournament rules and anglers are fictional. Lake facts, climate normals, species lists and statewide limits come from the project's research files.</p></section>
  <section class="card"><h3>Rules</h3><p>Tournaments: five black bass, culling allowed; late check-in costs 1 lb a minute and more than 15 minutes is a DQ; ties break by big fish. Free Fish uses Arkansas statewide limits. ${esc(LIMITS_TEXT)}</p></section>
</div>`;

R.settings = () => {
  const s = G.S.settings;
  const tog = (k, on, label) => `<button class="chip ${on ? 'on' : ''}" aria-pressed="${on}" data-act="set" data-k="${k}">${label}</button>`;
  const opt = (k, v, label) => `<button class="chip ${s[k] === v ? 'on' : ''}" aria-pressed="${s[k] === v}" data-act="set" data-k="${k}" data-v="${v}">${label}</button>`;
  return `<div class="page"><header class="page-h"><button class="btn ghost back" data-act="back">← Back</button><h2>Settings</h2></header>
  <div class="set"><span>Sound</span><div class="chips">${tog('sound', s.sound, s.sound ? 'On' : 'Off')}</div></div>
  <div class="set"><label for="vol">Volume</label><input id="vol" type="range" min="0" max="1" step="0.1" value="${s.volume}" data-set="volume"></div>
  <div class="set"><span>Motion</span><div class="chips">${opt('motion', 'auto', 'System')}${opt('motion', 'reduced', 'Reduced')}${opt('motion', 'full', 'Full')}</div></div>
  <div class="set"><span>Text size</span><div class="chips">${opt('textScale', 1, '100%')}${opt('textScale', 1.15, '115%')}${opt('textScale', 1.3, '130%')}</div></div>
  <div class="set"><span>Assist mode <small>auto hook-set, wider tension band</small></span><div class="chips">${tog('assist', s.assist, s.assist ? 'On' : 'Off')}</div></div>
  <div class="set"><span>Theme</span><div class="chips">${opt('theme', 'auto', 'System')}${opt('theme', 'light', 'Light')}${opt('theme', 'dark', 'Dark')}</div></div>
  <div class="set"><span>Weights</span><div class="chips">${opt('units', 'lb-oz', 'lb and oz')}${opt('units', 'lb', 'decimal lb')}</div></div>
  <p class="sm">${G.storage ? 'Settings and progress save in this browser.' : 'Storage is unavailable: progress lasts for this session only.'}</p></div>`;
};

export function ord(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
