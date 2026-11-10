import { SPECIES } from './fish.js';
import { BOATS, DOCK_LV, ISLE_LV, WARDROBE, BASKET_MAX, SELL, FRUITS, GAME, GAME_MAX } from './data.js';
import { QUESTS } from './quests.js';

const $ = (id) => document.getElementById(id);
export const spById = (id) => SPECIES.find(s => s.id === id);
const f1 = (n) => n.toFixed(2).replace('.', ',');

export function drawFishArt(cv, sp, w = 260, h = 130) {
  cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.clearRect(0, 0, w, h); g.save(); g.translate(w / 2, h / 2);
  const HH = sp.h || 1, L = w * 0.36 * (sp.id === 'yilan' ? 1.15 : 1), H = h * 0.3 * HH * (sp.id === 'yilan' ? 0.9 : 1), FH = sp.fh || 1;
  g.fillStyle = sp.fin; g.beginPath(); g.moveTo(-L + 6, 0); g.lineTo(-L - 36, -H * 0.9 - 4); g.lineTo(-L - 24, 0); g.lineTo(-L - 36, H * 0.9 + 4); g.closePath(); g.fill();
  if (sp.id === 'yilan') { g.beginPath(); g.moveTo(-L * 0.8, -H); g.lineTo(L * 0.5, -H); g.lineTo(L * 0.4, -H - 9); g.lineTo(-L * 0.7, -H - 9); g.closePath(); g.fill(); }
  else { g.beginPath(); g.moveTo(-8, -H + 2); g.lineTo(26, -H - 22 * FH); g.lineTo(30, -H + 6); g.closePath(); g.fill(); }
  g.beginPath(); g.moveTo(4, H - 4); g.lineTo(-14, H + 16 * HH); g.lineTo(22, H - 2); g.closePath(); g.fill();
  if (sp.snout) { g.fillStyle = sp.top; g.beginPath(); g.moveTo(L - 2, -H * 0.3); g.lineTo(L + (sp.snout === 2 ? 36 : 22), -H * 0.05); g.lineTo(L - 2, H * 0.3); g.closePath(); g.fill(); }
  const gr = g.createLinearGradient(0, -H, 0, H); gr.addColorStop(0, sp.top); gr.addColorStop(0.55, sp.top); gr.addColorStop(0.6, sp.belly); gr.addColorStop(1, sp.belly);
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, L, H, 0, 0, 7); g.fill();
  g.save(); g.beginPath(); g.ellipse(0, 0, L, H, 0, 0, 7); g.clip();
  if (sp.stripe === 1) { g.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(i * 17, -H * 0.35, 5, H * 0.65, 0, 0, 7); g.fill(); } }
  if (sp.stripe === 2) { g.fillStyle = '#c43d2e'; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(-L * 0.6 + i * 12, -H * 0.4 + Math.sin(i * 2.1) * 8, 3, 0, 7); g.fill(); } }
  if (sp.stripe === 3) { g.fillStyle = 'rgba(232,232,160,0.85)'; for (let i = 0; i < 26; i++) { g.beginPath(); g.ellipse(-L * 0.8 + i * 9.5, -H * 0.3 + Math.sin(i * 2.7) * H * 0.4, 3.2, 2.2, 0, 0, 7); g.fill(); } }
  if (sp.stripe === 4) { g.fillStyle = 'rgba(255,244,232,0.9)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(-L * 0.6 + i * 24, -H * 0.3 + Math.sin(i * 2.3) * H * 0.3, 11 + (i % 3) * 3, 8, 0.3, 0, 7); g.fill(); } }
  if (sp.stripe === 5) { g.fillStyle = 'rgba(224,96,122,0.85)'; g.fillRect(-L, -H * 0.22, L * 2, H * 0.4); }
  if (sp.stripe === 6) { g.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(-L * 0.6 + i * 22, -H * 0.05, 9, H * 0.25, 0, 0, 7); g.fill(); } }
  if (sp.stripe === 7) { g.fillStyle = 'rgba(232,228,212,0.75)'; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(-L * 0.8 + i * 14, -H * 0.8); g.lineTo(-L * 0.8 + i * 14 + 6, -H * 0.5); g.lineTo(-L * 0.8 + i * 14 - 2, -H * 0.5); g.fill(); g.fillRect(-L * 0.8 + i * 14 - 2, H * 0.15, 7, 4); } }
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.ellipse(-4, -H * 0.45, L * 0.6, H * 0.18, 0, 0, 7); g.fill(); g.restore();
  g.fillStyle = '#111'; g.beginPath(); g.arc(L * 0.68, -H * 0.18, 5, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(L * 0.7, -H * 0.22, 1.7, 0, 7); g.fill();
  g.restore();
}

export function createUI(G) {
  const S = G.save; let mode = null; let shopTab = 'tekne';
  const val = (it, k) => Math.round(it.v * (it.cooked ? SELL.cookedMul : 1) * k);
  const matches = (it, o) => o.type === 'sp' ? (it.id === o.sp && !!it.cooked === !!o.cooked) : o.type === 'cooked' ? !!it.cooked : o.type === 'big' ? it.w >= o.minW : !it.cooked;
  const orderText = (o) => o.type === 'sp' ? `${spById(o.sp).name}${o.cooked ? ' (pişmiş)' : ''}` : o.type === 'cooked' ? 'Pişmiş balık (herhangi)' : o.type === 'big' ? `${o.minW} kg üstü büyük balık` : 'Taze balık (herhangi)';
  const custPay = (it, o) => Math.round(it.v * (it.cooked ? SELL.cookedMul : 1) * SELL.customer * (o.type === 'sp' ? 1.1 : 1));
  const name = (it) => spById(it.id).name + (it.cooked ? ' · pişmiş' : '');
  function artRow(it) { return `<canvas data-art="${it.id}"></canvas>`; }
  function paintArts(root) { root.querySelectorAll('canvas[data-art]').forEach(cv => drawFishArt(cv, spById(cv.dataset.art), 144, 72)); }
  const total = (k) => S.inv.reduce((a, it) => a + val(it, k), 0);
  function show(id, on) { $(id).classList.toggle('on', on); }
  const fruitKinds = () => Object.keys(FRUITS).filter(k => (S.fruit && S.fruit[k]) > 0);
  const fruitTotal = (k) => fruitKinds().reduce((a, f) => a + Math.round(FRUITS[f].price * S.fruit[f] * k), 0);
  function fruitRows(k) {
    const ks = fruitKinds(); if (!ks.length) return '';
    let h = `<div class="sec">Meyveler</div>`;
    ks.forEach(f => { const n = S.fruit[f]; h += `<div class="row"><div class="t"><b>${FRUITS[f].name} × ${n}</b><small>tanesi ${Math.round(FRUITS[f].price * k)} altın</small></div><button class="btn" data-a="sellf" data-k="${k === SELL.chest ? 'chest' : 'stall'}" data-f="${f}">Sat +${Math.round(FRUITS[f].price * n * k)}</button></div>`; });
    if (ks.length > 1) h += `<div class="row"><div class="t"><b>Tüm meyveler</b></div><button class="btn gold" data-a="sellf" data-k="${k === SELL.chest ? 'chest' : 'stall'}" data-f="*">+${fruitTotal(k)}</button></div>`;
    return h;
  }
  const gameKinds = () => Object.keys(GAME).filter(k => (S.game && S.game[k]) > 0);
  const gameTotal = (k) => gameKinds().reduce((a, g) => a + Math.round(GAME[g].price * S.game[g] * k), 0);
  const gameCount = () => Object.values(S.game || {}).reduce((a, b) => a + b, 0);
  function gameRows(k) {
    const ks = gameKinds(); if (!ks.length) return '';
    const kk = k === SELL.chest ? 'chest' : 'stall';
    let h = `<div class="sec">Av hayvanları</div>`;
    ks.forEach(g => { const n = S.game[g]; h += `<div class="row"><div class="t"><b>${GAME[g].name} × ${n}</b><small>tanesi ${Math.round(GAME[g].price * k)} altın</small></div><button class="btn" data-a="sellg" data-k="${kk}" data-f="${g}">Sat +${Math.round(GAME[g].price * n * k)}</button></div>`; });
    if (ks.length > 1) h += `<div class="row"><div class="t"><b>Tüm av</b></div><button class="btn gold" data-a="sellg" data-k="${kk}" data-f="*">+${gameTotal(k)}</button></div>`;
    return h;
  }
  function renderQuests() {
    const b = $('pbody'); const Q = G.quests; const dn = Q.doneCount();
    let h = `<h2>Görevler</h2><small class="sub">${dn}/${QUESTS.length} tamamlandı · Altın ${S.coins}. Görevler sırayla seni yönlendirir; hedef dolunca ödül otomatik verilir.</small>`;
    const act = Q.active();
    QUESTS.forEach(q => { const d = Q.done(q), v = Q.val(q), p = Math.round(v / q.goal * 100); const isA = act && act.id === q.id;
      h += `<div class="row" style="${isA ? 'background:rgba(255,220,120,.16);border-radius:12px;padding-left:8px;padding-right:8px' : ''}${d ? ';opacity:.55' : ''}"><div class="t"><b>${d ? '✓ ' : ''}${q.title}</b><small>${q.desc}</small><div style="height:6px;border-radius:9px;background:rgba(80,110,95,.22);margin-top:5px;overflow:hidden"><div style="height:100%;width:${p}%;background:${d ? '#6f9c6b' : '#e0a73a'}"></div></div><small>${q.stat === 'run' ? v + ' / ' + q.goal + ' m' : v + ' / ' + q.goal}</small></div><span class="btn ${d ? 'ghost' : 'gold'}" style="pointer-events:none">${d ? 'Alındı' : '+' + q.reward}</span></div>`; });
    b.innerHTML = h;
  }
  function head() { return `<small class="sub">Sepet ${S.inv.length}/${BASKET_MAX} · Altın ${S.coins}</small>`; }

  /* ---- Sepet ---- */
  function renderBasket() {
    const b = $('pbody'); const rows = S.inv.map((it, i) => `<div class="row">${artRow(it)}<div class="t"><b>${name(it)}</b><small>${f1(it.w)} kg · değer ≈ ${val(it, 1)}</small></div><button class="btn ghost" data-a="rel" data-i="${i}">Bırak</button></div>`).join('');
    const fk = fruitKinds(); const fr = fk.length ? `<div class="sec">Meyveler</div>` + fk.map(f => `<div class="row"><div class="t"><b>${FRUITS[f].name} × ${S.fruit[f]}</b><small>değer ≈ ${FRUITS[f].price * S.fruit[f]} · tezgahta sat</small></div></div>`).join('') : '';
    const gk = gameKinds(); const gr = gk.length ? `<div class="sec">Av hayvanları (${gameCount()}/${GAME_MAX})</div>` + gk.map(g => `<div class="row"><div class="t"><b>${GAME[g].name} × ${S.game[g]}</b><small>değer ≈ ${GAME[g].price * S.game[g]} · tezgahta sat</small></div></div>`).join('') : '';
    b.innerHTML = `<h2>Sepet</h2>${head()}${rows || (fk.length || gk.length ? '' : '<small class="sub">Sepetin boş. Balık tut, meyve topla, yayla av yap; tezgahta ya da toptancı sandığında sat.</small>')}${fr}${gr}`; paintArts(b);
  }
  /* ---- Tezgah ---- */
  function renderStall() {
    const b = $('pbody'); let h = `<h2>Balık Tezgahı</h2>${head()}<small class="sub">Tezgaha %${Math.round(SELL.stall * 100)}, müşteriye %${Math.round(SELL.customer * 100)} fiyatla satarsın. Pişmiş balık ×${SELL.cookedMul}.</small>`;
    const cs = G.customers.filter(c => c.state === 'wait');
    h += `<div class="sec">Müşteriler</div>`;
    if (!cs.length) h += `<small class="sub">Şu an bekleyen müşteri yok. Göle bak; bir kayık gelebilir.</small>`;
    cs.forEach(c => {
      const ms = S.inv.map((it, i) => ({ it, i })).filter(({ it }) => matches(it, c.order)).sort((a, b2) => custPay(b2.it, c.order) - custPay(a.it, c.order)).slice(0, 3);
      h += `<div class="row" style="flex-wrap:wrap"><div class="t"><b>${c.name}</b><small>İstiyor: ${orderText(c.order)} · kalan ${Math.max(0, Math.ceil(c.wait))} sn</small></div></div>`;
      if (!ms.length) h += `<small class="sub" style="margin-left:6px">Sepetinde uygun balık yok.</small>`;
      ms.forEach(({ it, i }) => { h += `<div class="row">${artRow(it)}<div class="t"><b>${name(it)}</b><small>${f1(it.w)} kg</small></div><button class="btn gold" data-a="serve" data-c="${c.id}" data-i="${i}">Ver +${custPay(it, c.order)}</button></div>`; });
    });
    h += `<div class="sec">Tezgaha sat</div>`;
    h += S.inv.map((it, i) => `<div class="row">${artRow(it)}<div class="t"><b>${name(it)}</b><small>${f1(it.w)} kg</small></div><button class="btn" data-a="sell" data-k="stall" data-i="${i}">Sat +${val(it, SELL.stall)}</button></div>`).join('') || '<small class="sub">Sepetin boş.</small>';
    if (S.inv.length) h += `<div class="row"><div class="t"><b>Hepsini sat</b></div><button class="btn gold" data-a="sellall" data-k="stall">+${total(SELL.stall)}</button></div>`;
    h += fruitRows(SELL.stall); h += gameRows(SELL.stall);
    b.innerHTML = h; paintArts(b);
  }
  function renderChest() {
    const b = $('pbody'); let h = `<h2>Toptancı Sandığı</h2>${head()}<small class="sub">Balıkları hemen ama yarı fiyatına (%${Math.round(SELL.chest * 100)}) satar. Tezgah ya da müşteri daha kazançlı.</small>`;
    h += S.inv.map((it, i) => `<div class="row">${artRow(it)}<div class="t"><b>${name(it)}</b><small>${f1(it.w)} kg</small></div><button class="btn" data-a="sell" data-k="chest" data-i="${i}">Sat +${val(it, SELL.chest)}</button></div>`).join('') || '<small class="sub">Sepetin boş.</small>';
    if (S.inv.length) h += `<div class="row"><div class="t"><b>Hepsini sat</b></div><button class="btn gold" data-a="sellall" data-k="chest">+${total(SELL.chest)}</button></div>`;
    h += fruitRows(SELL.chest); h += gameRows(SELL.chest);
    b.innerHTML = h; paintArts(b);
  }
  function renderFire() {
    const b = $('pbody'); const F = G.fire; let h = `<h2>Kamp Ateşi</h2>${head()}`;
    if (!F.lit) { h += `<small class="sub">Ateş sönük. Yak, sonra balıklarını şişe takıp pişir (değeri ×${SELL.cookedMul} olur).</small><button class="btn gold" data-a="light">Ateşi Yak</button>`; }
    else {
      h += `<small class="sub">Ateş yanıyor${F.burn < 40 ? ' (azalıyor)' : ''}. Aynı anda 3 balık pişirebilirsin.</small>`;
      h += `<div class="sec">Şişler</div>` + F.slots.map((s, i) => `<div class="row"><div class="t"><b>${s.it ? name(s.it).replace(' · pişmiş', '') : 'Boş şiş'}</b><small>${s.it ? (s.done ? 'Hazır! Yanındayken sepete alınır' : 'Pişiyor… %' + Math.round(s.t / s.dur * 100)) : '—'}</small></div></div>`).join('');
      h += `<div class="sec">Çiğ balıklar</div>` + (S.inv.map((it, i) => ({ it, i })).filter(({ it }) => !it.cooked).map(({ it, i }) => `<div class="row">${artRow(it)}<div class="t"><b>${name(it)}</b><small>${f1(it.w)} kg · pişince ≈ ${val({ ...it, cooked: true }, 1)}</small></div><button class="btn" data-a="cook" data-i="${i}" ${F.slots.some(s => !s.it) ? '' : 'disabled'}>Pişir</button></div>`).join('') || '<small class="sub">Pişirilecek çiğ balık yok.</small>');
    }
    b.innerHTML = h; paintArts(b);
  }
  const RENDER = { basket: renderBasket, stall: renderStall, chest: renderChest, fire: renderFire, quests: renderQuests };
  function open(m) { mode = m; RENDER[m](); show('panel', true); G.sound.sfx('ui'); G.onPanel && G.onPanel(true); }
  function closePanel() { if (!mode) return; mode = null; show('panel', false); G.onPanel && G.onPanel(false); }
  function refresh() { if (mode) { const sc = $('panel').querySelector('.sheet').scrollTop; RENDER[mode](); $('panel').querySelector('.sheet').scrollTop = sc; } if ($('shop').classList.contains('on')) renderShop(); }

  $('panel').addEventListener('click', (e) => {
    const t = e.target.closest('[data-a]'); if (!t) { if (e.target === $('panel')) closePanel(); return; }
    const a = t.dataset.a, i = +t.dataset.i;
    if (a === 'rel') { S.inv.splice(i, 1); G.sound.sfx('splash'); G.persist(); G.hud(); }
    else if (a === 'sell') { const it = S.inv[i]; if (!it) return; S.coins += val(it, SELL[t.dataset.k]); S.inv.splice(i, 1); G.sound.sfx('coin'); G.persist(); G.hud(); }
    else if (a === 'sellall') { const k = SELL[t.dataset.k]; const sum = total(k); S.coins += sum; S.inv.length = 0; G.sound.sfx('coin'); G.toast('+' + sum + ' altın'); G.persist(); G.hud(); }
    else if (a === 'sellf') { const k = SELL[t.dataset.k]; const f = t.dataset.f; let sum = 0; for (const x of Object.keys(FRUITS)) { if (f !== '*' && f !== x) continue; const n = S.fruit[x] || 0; sum += Math.round(FRUITS[x].price * n * k); S.fruit[x] = 0; } if (sum) { S.coins += sum; G.sound.sfx('coin'); G.toast('+' + sum + ' altın'); G.persist(); G.hud(); } }
    else if (a === 'sellg') { const k = SELL[t.dataset.k]; const f = t.dataset.f; let sum = 0; for (const x of Object.keys(GAME)) { if (f !== '*' && f !== x) continue; const n = S.game[x] || 0; sum += Math.round(GAME[x].price * n * k); S.game[x] = 0; } if (sum) { S.coins += sum; G.sound.sfx('coin'); G.toast('+' + sum + ' altın'); G.persist(); G.hud(); } }
    else if (a === 'serve') { const c = G.customers.find(x => x.id === +t.dataset.c); const it = S.inv[i]; if (!c || !it || !matches(it, c.order)) return; const pay = custPay(it, c.order); S.coins += pay; S.sold = (S.sold || 0) + 1; S.inv.splice(i, 1); G.serve(c, pay); G.sound.sfx('coin'); G.persist(); G.hud(); }
    else if (a === 'light') { G.lightFire(); }
    else if (a === 'cook') { const it = S.inv[i]; if (it && !it.cooked && G.cookStart(it)) { S.inv.splice(i, 1); G.sound.sfx('sizzle'); G.persist(); G.hud(); } }
    refresh();
  });
  $('pclose').addEventListener('click', () => { G.sound.sfx('ui'); closePanel(); });

  /* ---- Mağaza ---- */
  const fmt = (n) => n.toLocaleString('tr-TR');
  function btnFor(owned, equipped, price, act, args) {
    if (equipped) return `<button class="btn ghost" disabled>Kullanımda</button>`;
    if (owned) return `<button class="btn" data-a="${act}" ${args}>Kullan</button>`;
    return `<button class="btn gold" data-a="${act}" ${args} ${S.coins >= price ? '' : 'disabled'}>${fmt(price)} al</button>`;
  }
  function renderShop() {
    const b = $('sbody'); const tabs = [['tekne', 'Tekneler'], ['ev', 'Evler'], ['giyim', 'Giyim']];
    let h = `<h2>Mağaza</h2>${head()}<div class="tabs">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${shopTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (shopTab === 'tekne') {
      h += BOATS.map((bt) => `<div class="row"><div class="t"><b>${bt.name}</b><small>${bt.desc} Hız ${bt.speed.toFixed(1)} m/sn</small></div>${btnFor(S.boats[bt.id], S.boat === bt.id, bt.price, 'boat', `data-i="${bt.id}"`)}</div>`).join('');
    } else if (shopTab === 'ev') {
      h += `<div class="sec">İskele Evi</div>` + DOCK_LV.map((d) => `<div class="row"><div class="t"><b>${d.name}</b><small>${d.desc || 'Başlangıç evin.'}</small></div>${d.lv <= S.dockLv ? `<button class="btn ghost" disabled>${d.lv === S.dockLv ? 'Mevcut' : 'Tamam'}</button>` : `<button class="btn gold" data-a="dock" data-i="${d.lv}" ${S.coins >= d.price && d.lv === S.dockLv + 1 ? '' : 'disabled'}>${fmt(d.price)} yükselt</button>`}</div>`).join('');
      h += `<div class="sec">Ada Evi</div>` + ISLE_LV.map((d) => `<div class="row"><div class="t"><b>${d.name}</b><small>${d.desc || 'Adadaki eski kulübe.'}</small></div>${d.lv <= S.isleLv ? `<button class="btn ghost" disabled>${d.lv === S.isleLv ? 'Mevcut' : 'Tamam'}</button>` : `<button class="btn gold" data-a="isle" data-i="${d.lv}" ${S.coins >= d.price && d.lv === S.isleLv + 1 ? '' : 'disabled'}>${fmt(d.price)} yükselt</button>`}</div>`).join('');
      h += `<small class="sub">Seviyeler sırayla alınır.</small>`;
    } else {
      for (const [grp, def] of Object.entries(WARDROBE)) {
        h += `<div class="sec">${def.title}</div>` + def.items.map((it) => { const owned = it.price === 0 || (S.own[grp] || []).includes(it.id); const eq = S.outfit[grp] === it.id; return `<div class="row"><div class="t"><b>${it.c ? `<span class="chip" style="background:${it.c}"></span>` : ''}${it.name}</b></div>${btnFor(owned, eq, it.price, 'wear', `data-g="${grp}" data-i="${it.id}"`)}</div>`; }).join('');
      }
    }
    const sc = $('shop').querySelector('.sheet').scrollTop; b.innerHTML = h; $('shop').querySelector('.sheet').scrollTop = sc;
    $('shop').classList.toggle('side', shopTab === 'giyim');
  }
  function openShop() { shopTab = shopTab || 'tekne'; renderShop(); show('shop', true); G.sound.sfx('ui'); G.onShop && G.onShop(true, shopTab); }
  function closeShop() { show('shop', false); G.onShop && G.onShop(false, shopTab); }
  $('shop').addEventListener('click', (e) => {
    const tb = e.target.closest('[data-tab]'); if (tb) { shopTab = tb.dataset.tab; renderShop(); G.sound.sfx('ui'); G.onShop && G.onShop(true, shopTab); return; }
    const t = e.target.closest('[data-a]'); if (!t) return; const a = t.dataset.a;
    if (a === 'boat') { const id = +t.dataset.i, bt = BOATS[id]; if (!S.boats[id]) { if (S.coins < bt.price) return; S.coins -= bt.price; S.boats[id] = true; G.sound.sfx('buy'); G.toast(bt.name + ' satın alındı!'); } S.boat = id; G.swapBoat(id); }
    else if (a === 'dock') { const lv = +t.dataset.i, d = DOCK_LV[lv - 1]; if (S.coins < d.price) return; S.coins -= d.price; S.dockLv = lv; G.upgradeDock(lv); G.sound.sfx('buy'); G.toast(d.name + ' hazır!'); }
    else if (a === 'isle') { const lv = +t.dataset.i, d = ISLE_LV[lv - 1]; if (S.coins < d.price) return; S.coins -= d.price; S.isleLv = lv; G.upgradeIsle(lv); G.sound.sfx('buy'); G.toast(d.name + ' hazır!'); }
    else if (a === 'wear') { const grp = t.dataset.g, id = t.dataset.i, it = WARDROBE[grp].items.find(x => x.id === id); const owned = it.price === 0 || (S.own[grp] || []).includes(id); if (!owned) { if (S.coins < it.price) return; S.coins -= it.price; (S.own[grp] = S.own[grp] || []).push(id); G.sound.sfx('buy'); } else G.sound.sfx('ui'); S.outfit[grp] = id; G.applyOutfit(); }
    G.persist(); G.hud(); renderShop();
  });
  $('shop').addEventListener('pointerdown', (e) => { if (e.target === $('shop') && !$('shop').classList.contains('side')) closeShop(); });
  $('sclose').addEventListener('click', () => { G.sound.sfx('ui'); closeShop(); });

  return { open, closePanel, refresh, openShop, closeShop, isOpen: () => !!mode || $('shop').classList.contains('on'), orderText, matches, custPay };
}
