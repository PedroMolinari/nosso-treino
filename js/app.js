const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n).toLocaleString('pt-BR');
const fmtMin = m => m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'min' : ''}`;
const num = v => Number(String(v).replace(',', '.'));
const todayKey = () => dateKey(new Date());
const typeInfo = t => CONFIG.activities[t] || CONFIG.activities.outro;
const dayLabel = k => k === todayKey() ? 'Hoje' : k === dateKey(addDays(new Date(), -1)) ? 'Ontem' : parseKey(k).toLocaleDateString('pt-BR');
const cap = (v, g) => g > 0 ? Math.min(100, Math.round(v / g * 100)) : 0; // barra e % nunca passam de 100
const bar = (v, g) => `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${cap(v, g)}"><span style="width:${cap(v, g)}%"></span></div>`;

let uid = null;
let editingProfile = false;
let actTab = 'historico';
const me = () => storage.getUser(uid);
const myActs = () => storage.getActivities().filter(a => a.userId === uid);
const filters = { person: 'all', period: 'all', type: 'all' };
const charts = {};

const accentColor = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#10b981';
function drawChart(id, type, labels, data, label) {
  charts[id]?.destroy();
  const el = document.getElementById(id);
  if (!el || !window.Chart) return;
  charts[id] = new Chart(el, { type, data: { labels, datasets: [{ label, data, backgroundColor: accentColor(), borderColor: accentColor(), borderRadius: 6, tension: .3 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: type === 'bar' } } } });
}

const emptyToday = `<p>Ainda não há atividades hoje.</p><p>Que tal registrar seu primeiro treino? 💪</p><button class="btn block" data-a="add">+ Registrar atividade</button>`;

function feedHtml() {
  const users = storage.getUsers(), all = storage.getActivities();
  const items = all.map(a => ({ k: `${a.date} ${a.time || '00:00'}`, date: a.date, time: a.time, text: `${users[a.userId]?.name} fez ${typeInfo(a.type).label}`, sub: `${a.minutes} min • 🔥 ${fmt(kcalOf(a))} kcal` }));
  // Usa a meta atual do usuário, mesmo para dias passados (simplificação).
  Object.values(users).forEach(u => {
    const byDay = {};
    all.filter(a => a.userId === u.id).forEach(a => { byDay[a.date] = (byDay[a.date] || 0) + kcalOf(a); });
    Object.entries(byDay).forEach(([d, k]) => { if (k >= u.dailyKcal) items.push({ k: d + ' 23:59', date: d, text: `${u.name} completou a meta diária 🎯` }); });
  });
  return items.sort((a, b) => b.k.localeCompare(a.k)).slice(0, 5).map(i =>
    `<li><b>${esc(i.text)}</b>${i.sub ? `<br><small>${i.sub}</small>` : ''}<br><small>${dayLabel(i.date)}${i.time ? ' às ' + i.time : ''}</small></li>`).join('');
}

function renderHome() {
  const u = me(), mine = myActs(), all = storage.getActivities();
  const t = stats.summarize(mine.filter(a => a.date === todayKey())), w = stats.summarize(stats.week(mine)), st = stats.streaks(mine);
  const h = new Date().getHours(), hello = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const couple = Object.values(storage.getUsers()).map(x => ({ x, s: stats.summarize(stats.week(all.filter(a => a.userId === x.id))) }));
  const total = couple.reduce((n, c) => n + c.s.count, 0);
  $('#app').innerHTML = `
    <section class="hero"><h1>${hello}, ${esc(u.name)}!</h1><p class="cap">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <p class="msg">${t.count === 0 ? 'Que tal começar o dia com um treino?' : t.kcal >= u.dailyKcal ? 'Meta de treino do dia batida! Orgulho de você' : `Faltam ${fmt(u.dailyKcal - t.kcal)} kcal para a meta de treino de hoje. Você consegue!`}</p>
      <div class="chips"><span>🔥 ${st.current} ${st.current === 1 ? 'dia seguido' : 'dias seguidos'}</span><span>🏋️ ${w.count} ${w.count === 1 ? 'treino' : 'treinos'} na semana</span></div></section>
    <section class="card"><h2>🍽️ Alimentação de hoje</h2><div id="ft"><p>Meta: <b>${fmt(u.eatKcal)} kcal</b> • Proteínas <b>${fmt(u.dailyProtein)} g</b></p></div><a class="ghost block" href="#refeicoes">Ver refeições</a></section>
    <section class="card"><h2>🔥 Treino de hoje</h2>${t.count ? `
      <p class="big">${fmt(t.kcal)} / ${fmt(u.dailyKcal)} kcal</p>${bar(t.kcal, u.dailyKcal)}<p>${cap(t.kcal, u.dailyKcal)}% da meta de gasto</p>
      <div class="row"><span>⏱️ ${fmtMin(t.minutes)}</span><span>🏋️ ${t.count} ${t.count === 1 ? 'atividade' : 'atividades'}</span></div>` : emptyToday}</section>
    <section class="card"><h2>Nós dois ❤️</h2><div class="couple">${couple.map(c =>
      `<div><b>${esc(c.x.name).toUpperCase()}</b><br>🔥 ${fmt(c.s.kcal)} kcal<br>⏱️ ${c.s.minutes} min<br>🏋️ ${c.s.count} treinos</div>`).join('')}</div>
      <p>${total ? `Vocês já fizeram ${total} atividades esta semana! Continuem assim!` : 'Que tal começar a semana juntos?'}</p></section>
    <section class="card"><h2>Atividades recentes</h2><ul class="list">${feedHtml() || '<li class="muted">Nada por aqui ainda.</li>'}</ul></section>`;
  fillFoodToday();
}

function renderActivities() {
  $('#app').innerHTML = `<div class="seg">${[['historico', 'Histórico'], ['stats', 'Estatísticas']].map(([k, l]) => `<button class="${actTab === k ? 'on' : ''}" data-a="acttab" data-id="${k}">${l}</button>`).join('')}</div><div id="sub"></div>`;
  (actTab === 'stats' ? renderStats : renderHistory)();
}

function renderHistory() {
  const users = storage.getUsers(), t = todayKey(), ws = dateKey(weekStart(new Date())), ms = t.slice(0, 5) + '01';
  const inPeriod = a => filters.period === 'all' || (filters.period === 'hoje' ? a.date === t : filters.period === 'semana' ? a.date >= ws : a.date >= ms);
  const list = storage.getActivities()
    .filter(a => (filters.person === 'all' || a.userId === filters.person) && (filters.type === 'all' || a.type === filters.type) && inPeriod(a))
    .sort((a, b) => `${b.date} ${b.time || ''}`.localeCompare(`${a.date} ${a.time || ''}`));
  const sel = (f, opts) => `<label>${opts.label}<select data-f="${f}">${opts.items.map(([v, l]) => `<option value="${v}"${filters[f] === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
  $('#sub').innerHTML = `
    <div class="filters">
      ${sel('person', { label: 'Pessoa', items: [['all', 'Todos'], ...Object.values(users).map(u => [u.id, esc(u.name)])] })}
      ${sel('period', { label: 'Período', items: [['all', 'Todos'], ['hoje', 'Hoje'], ['semana', 'Esta semana'], ['mes', 'Este mês']] })}
      ${sel('type', { label: 'Atividade', items: [['all', 'Todas'], ...Object.entries(CONFIG.activities).map(([k, v]) => [k, v.label])] })}
    </div>
    <section class="card"><ul class="list">${list.map(a => { const i = typeInfo(a.type); return `<li>
      <small>${dayLabel(a.date)}${filters.person === 'all' ? ' • ' + esc(users[a.userId]?.name) : ''}</small><br>
      <b>${i.icon} ${i.label}</b><br>${a.minutes} min • ${CONFIG.intensities[a.intensity]}<br>
      🔥 ${a.caloriesManual != null ? fmt(a.caloriesManual) + ' kcal (ajustado)' : '~' + fmt(a.caloriesEstimated) + ' kcal'}${a.note ? `<br><small>${esc(a.note)}</small>` : ''}
      ${a.userId === uid ? `<div class="acts"><button class="ghost" data-a="edit" data-id="${a.id}">Editar</button><button class="ghost danger" data-a="del" data-id="${a.id}">Excluir</button></div>` : ''}</li>`; }).join('') ||
      '<li class="muted">Nenhuma atividade encontrada com esses filtros.</li>'}</ul></section>`;
}

function renderStats() {
  const mine = myActs(), s = stats.summarize(mine), st = stats.streaks(mine);
  $('#sub').innerHTML = `
    <section class="card"><p class="big">🔥 ${st.current} dias seguidos</p><small>Maior sequência: ${st.best} dias</small></section>
    <section class="card"><h2>Últimos 7 dias (kcal)</h2><div class="chart"><canvas id="c7" aria-label="Calorias por dia"></canvas></div></section>
    <section class="card"><h2>Últimas 4 semanas (kcal)</h2><div class="chart"><canvas id="c4" aria-label="Calorias por semana"></canvas></div></section>
    <section class="card"><h2>Atividades</h2><div class="grid">
      <div>Total<b>${s.count}</b></div><div>Minutos<b>${fmt(s.minutes)}</b></div><div>Calorias<b>${fmt(s.kcal)}</b></div>
      <div>Média por atividade<b>${fmt(s.avgKcal)} kcal</b></div><div>Mais praticada<b>${s.topType ? typeInfo(s.topType).icon + ' ' + typeInfo(s.topType).label : '—'}</b></div><div>Dias ativos<b>${s.activeDays}</b></div></div></section>`;
  const d7 = stats.lastDays(mine, 7), w4 = stats.lastWeeks(mine, 4);
  drawChart('c7', 'bar', d7.map(d => d.label), d7.map(d => d.kcal), 'kcal');
  drawChart('c4', 'bar', w4.map(d => d.label), w4.map(d => d.kcal), 'kcal');
}

function renderProfile() {
  const u = me(), weights = storage.getWeightRecords(uid), ach = stats.achievementsFor(uid, storage.getActivities());
  const act = ACTIVITY[u.activity] || '—', goal = (GOALS[u.goal] || ['—'])[0];
  $('#app').innerHTML = `<h1>Perfil</h1>
    ${editingProfile ? `<section class="card"><h2>Editar perfil</h2><form id="profileForm" novalidate>${profileFields(u)}
      <p class="muted"><small>As metas de alimentação são recalculadas automaticamente ao salvar.</small></p>
      <p class="err" id="err" role="alert"></p><div class="row"><button type="button" class="ghost" data-a="cancelprofile">Cancelar</button><button class="btn">Salvar</button></div></form></section>`
    : `<section class="card"><div class="row"><h2>${esc(u.name)}</h2><button class="ghost" data-a="editprofile">✏️ Editar</button></div><div class="grid">
      <div>Idade<b>${u.age ?? '—'}</b></div><div>Peso<b>${u.weight} kg</b></div><div>Altura<b>${u.height ? u.height + ' cm' : '—'}</b></div>
      <div>Sexo<b>${u.sex === 'F' ? 'Feminino' : u.sex === 'M' ? 'Masculino' : '—'}</b></div><div>Atividade<b>${esc(act.split(' (')[0])}</b></div><div>Objetivo<b>${esc(goal.split(' (')[0])}</b></div></div></section>
    <section class="card"><h2>🎯 Metas diárias (calculadas)</h2><div class="grid">
      <div>Calorias para comer<b>${fmt(u.eatKcal)} kcal</b></div><div>Proteínas<b>${u.dailyProtein} g</b></div><div>Carboidratos<b>${u.dailyCarbs} g</b></div>
      <div>Gorduras<b>${u.dailyFat} g</b></div><div>Gasto em treino<b>${fmt(u.dailyKcal)} kcal</b></div></div></section>`}
    <section class="card"><div class="row"><h2>Peso</h2><button class="ghost" data-a="weight">+ Registrar peso</button></div>
      ${weights.length ? `<div class="chart"><canvas id="cw" aria-label="Evolução do peso"></canvas></div><ul class="list">${[...weights].reverse().slice(0, 5).map(w => `<li>${parseKey(w.date).toLocaleDateString('pt-BR')} — <b>${String(w.weight).replace('.', ',')} kg</b></li>`).join('')}</ul>` : '<p class="muted">O registro de peso é opcional.</p>'}</section>
    <section class="card"><h2>Conquistas</h2><div class="ach">${ach.map(a => `<div class="${a.unlocked ? '' : 'off'}"><b>${a.icon} ${a.title}</b><br><small>${a.desc}</small></div>`).join('')}</div></section>
    <div id="cfg"></div>`;
  drawChart('cw', 'line', weights.map(w => parseKey(w.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })), weights.map(w => w.weight), 'kg');
  fillSettings();
}

const dlg = html => { $('#dlg').innerHTML = html; if (!$('#dlg').open) $('#dlg').showModal(); };
const closeDlg = () => $('#dlg').close();
let pending = null;
function ask(msg, okLabel, fn) {
  pending = fn;
  dlg(`<h2>${msg}</h2><div class="row"><button type="button" class="ghost" data-a="close">Cancelar</button><button type="button" class="btn" data-a="confirm">${okLabel}</button></div>`);
}
function toast(html) { const t = $('#toast'); t.innerHTML = html; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }

function openActivityForm(a) {
  const owner = storage.getUser(a ? a.userId : uid);
  const opts = (obj, sel, fn) => Object.entries(obj).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${fn(v)}</option>`).join('');
  const manual = a && a.caloriesManual != null;
  dlg(`<form id="actForm" novalidate data-id="${a ? a.id : ''}" data-user="${owner.id}"><h2>${a ? 'Editar' : 'Registrar'} atividade</h2>
    <label>Atividade<select name="type">${opts(Object.fromEntries(Object.entries(CONFIG.activities).filter(([k, v]) => v.active !== false || (a && k === a.type))), a ? a.type : 'academia', v => v.icon + ' ' + v.label)}</select></label>
    <label>Duração (minutos)<input name="minutes" type="number" inputmode="numeric" min="1" max="${CONFIG.maxMinutes}" value="${a ? a.minutes : ''}" required></label>
    <label>Intensidade<select name="intensity">${opts(CONFIG.intensities, a ? a.intensity : 'moderada', v => v)}</select></label>
    <label>Data<input name="date" type="date" value="${a ? a.date : todayKey()}" required></label>
    <label>Observação (opcional)<input name="note" maxlength="80" value="${a ? esc(a.note) : ''}" placeholder="Treino de pernas"></label>
    <div class="est" id="est" aria-live="polite"></div>
    <label class="check"><input type="checkbox" name="manual"${manual ? ' checked' : ''}> Editar calorias</label>
    <input name="kcal" type="number" min="0" inputmode="numeric" aria-label="Calorias manuais" value="${manual ? a.caloriesManual : ''}">
    <p class="err" id="err" role="alert"></p>
    <div class="row"><button type="button" class="ghost" data-a="close">Cancelar</button><button class="btn">Salvar</button></div></form>`);
  updateEstimate();
}

const readForm = f => { const d = Object.fromEntries(new FormData(f)); return { ...d, minutes: Number(d.minutes), manual: !!d.manual }; };

function updateEstimate() {
  const f = $('#actForm'); if (!f) return;
  const d = readForm(f), w = storage.getUser(f.dataset.user).weight;
  $('#est').innerHTML = d.minutes > 0 && Number.isFinite(d.minutes)
    ? `🔥 Gasto estimado<br><b>~${calories.estimate(d.type, d.intensity, w, d.minutes)} kcal</b><br><small>Baseado em: ${w} kg • ${d.minutes} min • intensidade ${d.intensity}.<br>Os valores são estimativas e podem variar.</small>`
    : '<small>Informe a duração para ver a estimativa.</small>';
  f.kcal.hidden = !d.manual;
}

async function saveActivity(f) {
  const d = readForm(f), fail = m => { $('#err').textContent = m; };
  if (!Number.isFinite(d.minutes) || d.minutes <= 0) return fail('Informe uma duração maior que zero.');
  if (d.minutes > CONFIG.maxMinutes) return fail(`A duração máxima é ${CONFIG.maxMinutes} minutos.`);
  if (!d.date || isNaN(parseKey(d.date))) return fail('Informe uma data válida.');
  let manual = null;
  if (d.manual) {
    manual = Number(d.kcal);
    if (d.kcal === '' || !Number.isFinite(manual) || manual < 0 || manual > 20000) return fail('As calorias devem ser um número maior ou igual a zero.');
  }
  const weight = storage.getUser(f.dataset.user).weight, minutes = Math.round(d.minutes);
  const data = { type: d.type, minutes, intensity: d.intensity, date: d.date, note: d.note.trim(), weightUsed: weight,
                 caloriesEstimated: calories.estimate(d.type, d.intensity, weight, minutes), caloriesManual: manual };
  const ok = await (f.dataset.id ? storage.updateActivity(f.dataset.id, data)
    : storage.saveActivity({ ...data, userId: uid, time: new Date().toTimeString().slice(0, 5) }));
  if (!ok) return fail('Não foi possível salvar a atividade. Tente novamente.');
  closeDlg(); render();
  toast(`✓ Atividade registrada!<br>${typeInfo(d.type).label} • ${minutes} min<br>🔥 ${manual != null ? '' : '~'}${fmt(manual ?? data.caloriesEstimated)} kcal`);
}

function openWeightForm() {
  dlg(`<form id="weightForm" novalidate><h2>Registrar peso</h2>
    <label>Peso (kg)<input name="weight" inputmode="decimal" placeholder="79,5" required></label>
    <label>Data<input name="date" type="date" value="${todayKey()}" required></label>
    <p class="err" id="err" role="alert"></p>
    <div class="row"><button type="button" class="ghost" data-a="close">Cancelar</button><button class="btn">Salvar</button></div></form>`);
}

async function saveWeight(f) {
  const d = Object.fromEntries(new FormData(f)), w = num(d.weight);
  if (!Number.isFinite(w) || w <= 0 || w > 500) return void ($('#err').textContent = 'Informe um peso válido (maior que zero).');
  if (!d.date || isNaN(parseKey(d.date))) return void ($('#err').textContent = 'Informe uma data válida.');
  if (!(await storage.saveWeightRecord({ userId: uid, weight: w, date: d.date }))) return void ($('#err').textContent = 'Não foi possível salvar o peso. Tente novamente.');
  const latest = storage.getWeightRecords(uid).pop();
  await storage.updateUser(uid, { weight: latest.weight }); // o peso do perfil acompanha o último registro
  closeDlg(); render(); toast('✓ Peso registrado!');
}

const field = (name, label, val, extra = '') => `<label>${label}<input name="${name}" value="${esc(val ?? '')}" ${extra} required></label>`;
const select = (name, label, obj, cur, fn) => `<label>${label}<select name="${name}">${Object.entries(obj).map(([k, v]) => `<option value="${k}"${String(k) === String(cur) ? ' selected' : ''}>${fn(v)}</option>`).join('')}</select></label>`;
const profileFields = u => `${field('name', 'Nome', u.name, 'maxlength="30"')}${field('age', 'Idade', u.age, 'inputmode="numeric"')}${field('height', 'Altura (cm)', u.height, 'inputmode="numeric"')}${field('weight', 'Peso (kg)', u.weight, 'inputmode="decimal"')}
  ${select('sex', 'Sexo (usado no cálculo)', { M: 'Masculino', F: 'Feminino' }, u.sex || 'M', v => v)}${select('activity', 'Nível de atividade', ACTIVITY, u.activity || 1.55, v => v)}${select('goal', 'Objetivo', GOALS, u.goal || 'maintain', v => v[0])}
  ${field('dailyKcal', 'Meta de gasto em treino (kcal/dia)', u.dailyKcal, 'inputmode="numeric"')}`;

// Valida o perfil e já calcula as metas de alimentação pelo GCT.
function readProfile(f) {
  const d = Object.fromEntries(new FormData(f)), v = {}, activity = Number(d.activity);
  ['weight', 'height', 'age', 'dailyKcal'].forEach(k => { v[k] = num(d[k]); });
  if (!d.name.trim()) return { error: 'Informe seu nome.' };
  if (!Number.isInteger(v.age) || v.age < 10 || v.age > 100) return { error: 'Informe uma idade válida (10 a 100).' };
  if (!(v.height >= 100 && v.height <= 250)) return { error: 'Informe a altura em cm (100 a 250).' };
  if (!(v.weight > 0 && v.weight <= 500)) return { error: 'Informe um peso válido.' };
  if (!Number.isInteger(v.dailyKcal) || v.dailyKcal <= 0 || v.dailyKcal > 100000) return { error: 'A meta de gasto deve ser um número inteiro maior que zero.' };
  if (!(d.sex in { M: 1, F: 1 }) || !(activity in ACTIVITY) || !(d.goal in GOALS)) return { error: 'Escolha sexo, nível de atividade e objetivo.' };
  const g = gct(v, d.sex, activity, d.goal);
  return { patch: { ...v, name: d.name.trim(), sex: d.sex, activity, goal: d.goal, eatKcal: Math.round(g.kcal), dailyProtein: Math.round(g.protein), dailyFat: Math.round(g.fat), dailyCarbs: Math.round(g.carbs) } };
}

async function saveProfile(f) {
  const r = readProfile(f);
  if (r.error) return void ($('#err').textContent = r.error);
  if (!(await storage.updateUser(uid, r.patch))) return void ($('#err').textContent = 'Não foi possível salvar. Tente novamente.');
  editingProfile = false; fillWho(); render(); toast('✓ Perfil salvo! Metas recalculadas.');
}

async function saveOnboarding(f) {
  const r = readProfile(f);
  if (r.error) return void ($('#err').textContent = r.error);
  if (!(await storage.updateUser(uid, { ...r.patch, onboarded: true }))) return void ($('#err').textContent = 'Não foi possível salvar. Tente novamente.');
  start();
}

function renderOnboarding() {
  $('#app').innerHTML = `<section class="hero"><h1>Bem-vindo(a) ao Nosso Treino!</h1><p class="msg">Conte um pouco sobre você. As suas metas de alimentação são calculadas automaticamente.</p></section>
    <section class="card"><form id="onboardForm" novalidate>${profileFields(me())}<p class="err" id="err" role="alert"></p><button class="btn block">Começar</button></form></section>`;
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const { a, id } = b.dataset;
  if (a === 'add') openActivityForm();
  else if (a === 'edit') openActivityForm(storage.getActivities().find(x => x.id === id));
  else if (a === 'del') ask('Excluir esta atividade?', 'Excluir', async () => { if (!(await storage.deleteActivity(id))) toast('Não foi possível excluir. Tente novamente.'); render(); });
  else if (a === 'weight') openWeightForm();
  else if (a === 'close') closeDlg();
  else if (a === 'confirm') { closeDlg(); const fn = pending; pending = null; fn?.(); }
  else if (a === 'editprofile') { editingProfile = true; render(); }
  else if (a === 'cancelprofile') { editingProfile = false; render(); }
  else if (a === 'acttab') { actTab = id; renderActivities(); }
  else if (a === 'theme') { closeDlg(); setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true); }
  else if (a === 'logout') storage.signOut().then(() => location.reload());
});
document.addEventListener('input', e => { if (e.target.form?.id === 'actForm') updateEstimate(); });
document.addEventListener('change', e => { const f = e.target.dataset.f; if (f) { filters[f] = e.target.value; renderHistory(); } });
document.addEventListener('submit', e => {
  e.preventDefault();
  ({ actForm: saveActivity, weightForm: saveWeight, profileForm: saveProfile, onboardForm: saveOnboarding, loginForm: doLogin })[e.target.id]?.(e.target);
});

const routes = { inicio: renderHome, atividades: renderActivities, refeicoes: renderMeals, torneio: renderTournament, perfil: renderProfile };
function render() {
  const r = routes[location.hash.slice(1)] ? location.hash.slice(1) : 'inicio';
  if (r !== 'perfil') editingProfile = false;
  document.querySelectorAll('.nav a').forEach(a => a.dataset.r === r ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  try { routes[r](); } catch (err) { console.error(err); $('#app').innerHTML = '<p>Algo deu errado. Recarregue a página.</p>'; }
}

const fillWho = () => { $('#menuBtn').textContent = me() ? (me().name || '?').trim().charAt(0).toUpperCase() : ''; };

function openMenu() {
  dlg(`<h2>${esc(me().name)}</h2><a class="ghost block" href="#perfil" data-a="close">Perfil e configurações</a><button class="ghost block" data-a="theme">Tema ${document.documentElement.dataset.theme === 'dark' ? 'claro' : 'escuro'}</button><button class="ghost block danger" data-a="logout">Sair</button>`);
}

function renderLogin() {
  $('#app').innerHTML = `<h1>Nosso Treino 💪</h1><section class="card"><form id="loginForm" novalidate>
    <label>E-mail<input name="email" type="email" autocomplete="username" required></label>
    <label>Senha<input name="password" type="password" autocomplete="current-password" required></label>
    <p class="err" id="err" role="alert"></p><button class="btn block">Entrar</button></form></section>`;
}

async function doLogin(f) {
  const d = Object.fromEntries(new FormData(f));
  if (await storage.signIn(d.email.trim(), d.password)) return void ($('#err').textContent = 'E-mail ou senha incorretos.');
  start();
}

async function start() {
  if (SUPABASE_URL.startsWith('COLE')) { $('#app').innerHTML = '<p>Configure a URL do Supabase em js/config.js.</p>'; return; }
  let ok = false;
  try { ok = await storage.load(); } catch { $('#app').innerHTML = '<p>Não foi possível conectar. Verifique a internet e recarregue a página.</p>'; return; }
  document.body.classList.toggle('out', !ok);
  if (!ok) return renderLogin();
  uid = storage.getCurrentUserId();
  if (me() && !me().onboarded) { document.body.classList.add('out'); return renderOnboarding(); }
  fillWho(); render();
}

function setTheme(t, save) { document.documentElement.dataset.theme = t; if (save) storage.setTheme(t); }

$('#menuBtn').onclick = openMenu;
window.onhashchange = render;
// Traz os dados mais recentes do parceiro ao voltar para a aba (sem mexer em telas com formulário).
window.onfocus = async () => { if (uid && ['', '#inicio', '#atividades'].includes(location.hash) && await storage.load().catch(() => false)) render(); };
setTheme(storage.getTheme() || 'light');
start();
