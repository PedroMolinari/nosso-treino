// Regras de pontuação: edite aqui para mudar ou adicionar itens (alimentos são buscados no texto da refeição).
const scoringRules = {
  foods: { 'batata palha': -1, 'fritura': -1, 'frito': -1, 'frita': -1, 'coca-cola': -1, 'refrigerante': -1, 'salgadinho': -1, 'salgado': -1 },
  exercises: { 'Academia': 3, 'Cheer': 3, 'Futebol': 3, 'Treino pesado': 3, 'Caminhada de 40 minutos': 2, 'Outra atividade leve': 2 },
  habits: { 'Protetor solar': 1, '2 frutas no dia': 1 }
};
const TOURNAMENT_DAYS = 20;
const MEALS = { breakfast: ['☕', 'Café da manhã'], lunch: ['🍛', 'Almoço'], dinner: ['🌙', 'Jantar'], snack: ['🍎', 'Lanche'] };
let rulesScope = '';
const T = { tab: 'placar', rules: [], t: null, meals: [], days: [], urls: {}, date: null, who: null, file: null };

const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_]/g, ' ');
const foodRules = () => T.rules.some(r => r.kind === 'foods') ? Object.fromEntries(T.rules.filter(r => r.kind === 'foods' && r.active).map(r => [r.name, r.points])) : scoringRules.foods;
const foodPoints = text => Object.entries(foodRules()).reduce((sum, [k, p]) => sum + p * (norm(text).split(norm(k)).length - 1), 0);
const pt = n => (n > 0 ? '+' : '') + n;
const fmtD = k => parseKey(k).toLocaleDateString('pt-BR');
const tDates = () => T.t ? Array.from({ length: T.t.days }, (_, i) => dateKey(addDays(parseKey(T.t.start_date), i))) : [];
const dayEntry = (u, d) => T.days.find(x => x.user_id === u && x.date === d) || { exercises: [], habits: [], notes: '' };
const mealsOf = (u, d) => T.meals.filter(m => m.user_id === u && m.date === d);
const ruleMap = k => Object.fromEntries(T.rules.filter(r => r.kind === k).map(r => [r.name, r.points]));
const activeRules = k => T.rules.filter(r => r.kind === k && r.active);
const sumRules = (list, rules) => list.reduce((s, k) => s + (rules[k] || 0), 0);
const dayPoints = (u, d) => mealsOf(u, d).reduce((s, m) => s + m.points, 0) + sumRules(dayEntry(u, d).exercises, ruleMap('exercises')) + sumRules(dayEntry(u, d).habits, ruleMap('habits'));
const hasRecord = (u, d) => mealsOf(u, d).length || dayEntry(u, d).exercises.length || dayEntry(u, d).habits.length;

function tStatus() {
  const dates = tDates(), now = todayKey();
  if (!T.t || now < dates[0]) return { label: 'Não iniciado', note: T.t ? `Começa em ${fmtD(dates[0])}` : '' };
  if (now > dates[dates.length - 1]) return { label: 'Finalizado', day: dates.length };
  return { label: 'Em andamento', day: dates.indexOf(now) + 1 };
}

async function loadRules() {
  const db = storage.db;
  let r = await db.from('scoring_rules').select('*').order('created_at');
  if (r.error) throw r.error;
  const missing = ['exercises', 'habits', 'foods'].filter(k => !r.data.some(x => x.kind === k));
  if (missing.length) { // cria os padrões de scoringRules para o que ainda não existe
    await db.from('scoring_rules').upsert(missing.flatMap(k => Object.entries(scoringRules[k]).map(([name, points]) => ({ kind: k, name, points }))), { onConflict: 'kind,name', ignoreDuplicates: true });
    r = await db.from('scoring_rules').select('*').order('created_at');
    if (r.error) throw r.error;
  }
  T.rules = r.data;
}

async function tLoad() {
  const db = storage.db;
  await loadRules();
  const { data: ts, error } = await db.from('tournaments').select('*').order('start_date', { ascending: false }).limit(1);
  if (error) throw error;
  Object.assign(T, { t: ts[0] || null, meals: [], days: [], urls: {} });
  if (!T.t) return;
  const [m, d] = await Promise.all([db.from('meal_records').select('*').eq('tournament_id', T.t.id).order('created_at'), db.from('daily_entries').select('*').eq('tournament_id', T.t.id)]);
  if (m.error || d.error) throw new Error('load');
  T.meals = m.data; T.days = d.data;
  const paths = T.meals.map(x => x.photo_path).filter(Boolean);
  if (paths.length) { const { data } = await db.storage.from('meal-photos').createSignedUrls(paths, 3600); (data || []).forEach(x => { if (x.signedUrl) T.urls[x.path] = x.signedUrl; }); }
}

async function renderTournament() {
  $('#app').innerHTML = '<p class="muted">Carregando torneio...</p>';
  try { await tLoad(); } catch (e) { console.error(e); $('#app').innerHTML = '<p>Não foi possível carregar o torneio. Confira se rodou o <code>supabase/schema.sql</code>.</p>'; return; }
  drawTournament();
}

function mealCard(m, own) {
  const [icon, label] = MEALS[m.meal_type], url = T.urls[m.photo_path];
  return `<div class="meal"><b>${icon} ${label}</b>${url ? `<img class="photo" src="${url}" alt="Foto: ${label}" loading="lazy" data-t="zoom" data-url="${url}">` : ''}
    <p>${esc(m.description || '')}${m.foods ? `<br><small>${esc(m.foods)}</small>` : ''}</p><b>${pt(m.points)} ${Math.abs(m.points) === 1 ? 'ponto' : 'pontos'}</b>
    ${own ? `<div class="acts"><button class="ghost" data-t="meal" data-id="${m.id}">Editar</button>${m.photo_path ? `<button class="ghost" data-t="delphoto" data-id="${m.id}">Excluir foto</button>` : ''}<button class="ghost danger" data-t="delmeal" data-id="${m.id}">Excluir</button></div>` : ''}</div>`;
}

function drawTournament() {
  if (!T.t) { $('#app').innerHTML = `<h1>🏆 Torneio</h1><section class="card"><p>Status: <b>Não iniciado</b></p><button class="btn block" data-t="start">🏆 Iniciar torneio</button></section>`; return; }
  const st = tStatus(), dates = tDates(), today = todayKey(), last = dates[dates.length - 1];
  const users = Object.values(storage.getUsers()).sort((a, b) => (b.id === uid) - (a.id === uid));
  if (!dates.includes(T.date)) T.date = dates.includes(today) ? today : today > last ? last : dates[0];
  if (!storage.getUser(T.who)) T.who = uid;
  const own = T.who === uid && T.date <= today && T.date >= dates[0], e = dayEntry(T.who, T.date), dis = own ? '' : 'disabled';
  const chk = key => { const map = ruleMap(key), names = [...new Set([...activeRules(key).map(r => r.name), ...e[key]])];
    return names.map(k => `<label class="check"><input type="checkbox" data-tk="${key}" value="${esc(k)}" ${e[key].includes(k) ? 'checked' : ''} ${dis}> ${esc(k)} <b>${pt(map[k] ?? 0)}</b></label>`).join(''); };
  const meals = mealsOf(T.who, T.date);
  const tabBar = `<div class="seg">${[['placar', 'Placar'], ['dia', 'Dia'], ['historico', 'Histórico']].map(([k, l]) => `<button class="${T.tab === k ? 'on' : ''}" data-t="tab" data-id="${k}">${l}</button>`).join('')}</div>`;
  $('#app').innerHTML = `<h1>🏆 Torneio</h1>
    <section class="card"><p class="big">${st.day ? `Dia ${st.day} de ${dates.length}` : st.label}</p>${bar(st.day || 0, dates.length)}
      <p>Status: <b>${st.label}</b> ${st.note || ''}<br>Início: ${fmtD(dates[0])} • Término: ${fmtD(last)} • Restam ${st.label === 'Finalizado' ? 0 : dates.filter(d => d > today).length} dias</p>
      ${st.label === 'Finalizado' ? '<div class="acts"><button class="ghost" data-t="start">Iniciar novo torneio</button></div>' : ''}</section>
    ${tabBar}
    ${T.tab === 'placar' ? `<section class="card"><h2>🏆 Placar</h2><div class="couple">${users.map(u => { const tot = dates.reduce((s, d) => s + dayPoints(u.id, d), 0), reg = dates.filter(d => hasRecord(u.id, d)).length;
      return `<div><b>${esc(u.name)}</b><br>Hoje: ${pt(dayPoints(u.id, today))}<br>Total: <b>${pt(tot)}</b><br>Média/dia: ${reg ? (tot / reg).toFixed(1).replace('.', ',') : '0'}<br>Dias registrados: ${reg}/${dates.length}${bar(reg, dates.length)}</div>`; }).join('')}</div>
      <small>Os nomes vêm do Perfil de cada um.</small></section>` : ''}
    ${T.tab === 'dia' ? `<section class="card" id="tday"><h2>📅 Dia</h2><div class="filters" style="grid-template-columns:1fr 1fr">
      <label>Data<select data-ts="date">${dates.map((d, i) => `<option value="${d}"${d === T.date ? ' selected' : ''}>Dia ${i + 1} — ${fmtD(d).slice(0, 5)}</option>`).join('')}</select></label>
      <label>Pessoa<select data-ts="who">${users.map(u => `<option value="${u.id}"${u.id === T.who ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label></div>
      <h2>🍽️ Refeições</h2>${meals.map(m => mealCard(m, own)).join('') || `<p class="muted">${T.date > today ? 'Esse dia ainda não chegou: os registros abrem em ' + fmtD(T.date) + '.' : 'Nenhuma refeição registrada.'}</p>`}
      ${own ? '<button class="btn block" data-t="meal">+ Adicionar refeição</button>' : ''}
      <h2>🏋️ Atividades</h2>${chk('exercises')}<h2>☀️ Hábitos</h2>${chk('habits')}
      <label>Observações<input data-tk="notes" maxlength="500" value="${esc(e.notes || '')}" ${dis}></label>
      <p class="big">📊 Total do dia: ${pt(dayPoints(T.who, T.date))}</p></section>` : ''}
    ${T.tab === 'historico' ? `<section class="card"><h2>📊 Histórico</h2><ul class="list">${dates.map((d, i) => `<li><button class="ghost" style="width:100%;text-align:left" data-t="day" data-d="${d}"><b>Dia ${i + 1} — ${fmtD(d).slice(0, 5)}</b><br>${users.map(u => `${esc(u.name)}: ${pt(dayPoints(u.id, d))}`).join(' • ')}</button></li>`).join('')}</ul><button class="ghost danger block" data-t="deltournament">🗑️ Excluir torneio</button></section>` : ''}`;
}

const afterRules = () => { if (location.hash === '#torneio') drawTournament(); };

function openRules(only) {
  if (only !== undefined) rulesScope = only;
  const all = { exercises: '🏋️ Atividades', habits: '☀️ Hábitos', foods: '🍕 Alimentos (palavras que valem pontos)' };
  const kinds = Object.fromEntries(Object.entries(all).filter(([k]) => !rulesScope || rulesScope.split(',').includes(k)));
  const rows = k => T.rules.filter(r => r.kind === k).map(r => `<div class="rule"><span${r.active ? '' : ' class="muted"'}>${esc(r.name)}</span><input type="number" step="1" min="-50" max="50" value="${r.points}" aria-label="Pontos de ${esc(r.name)}" data-rp="${r.id}"><button type="button" class="ghost" data-t="ruletoggle" data-id="${r.id}">${r.active ? 'Ocultar' : 'Mostrar'}</button></div>`).join('');
  dlg(`<h2>⚙️ Atividades e hábitos</h2><p><small>${rulesScope === 'foods' ? 'Vale para novas refeições (as já salvas mantêm os pontos). Escreva a palavra como aparece na comida. "Ocultar" desativa a palavra.' : 'Alterar os pontos recalcula todos os dias. "Ocultar" tira da lista, mas os dias já marcados continuam contando.'}</small></p>
    ${Object.entries(kinds).map(([k, l]) => `<h3>${l}</h3>${rows(k)}`).join('')}
    <form id="ruleForm" novalidate><h3>➕ Adicionar novo</h3>
      <label>Tipo<select name="kind">${Object.entries(kinds).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      <label>Nome<input name="name" maxlength="40" placeholder="Ex.: Corrida" required></label>
      <label>Pontos<input name="points" type="number" step="1" min="-50" max="50" value="1"></label>
      <p class="err" id="err" role="alert"></p><div class="row"><button type="button" class="ghost" data-a="close">Fechar</button><button class="btn">Adicionar</button></div></form>`);
}

async function saveRulePoints(x) {
  const p = Number(x.value);
  if (!Number.isInteger(p) || p < -50 || p > 50) { toast('Use um número inteiro entre -50 e 50.'); return openRules(); }
  const { error } = await storage.db.from('scoring_rules').update({ points: p }).eq('id', x.dataset.rp);
  if (error) { toast('Não foi possível salvar. Tente novamente.'); return openRules(); }
  T.rules = T.rules.map(r => r.id === x.dataset.rp ? { ...r, points: p } : r); afterRules();
}

async function toggleRule(id) {
  const r = T.rules.find(x => x.id === id);
  const { error } = await storage.db.from('scoring_rules').update({ active: !r.active }).eq('id', id);
  if (error) return toast('Não foi possível salvar. Tente novamente.');
  r.active = !r.active; openRules(); afterRules();
}

async function addRule(f) {
  const d = Object.fromEntries(new FormData(f)), name = d.name.trim(), points = Number(d.points), fail = m => { $('#err').textContent = m; };
  if (!name) return fail('Informe um nome.');
  if (!Number.isInteger(points) || points < -50 || points > 50) return fail('Os pontos devem ser um número inteiro entre -50 e 50.');
  if (T.rules.some(r => r.kind === d.kind && norm(r.name) === norm(name))) return fail('Esse item já existe (talvez esteja oculto).');
  const { data, error } = await storage.db.from('scoring_rules').insert({ kind: d.kind, name, points }).select().single();
  if (error) return fail('Não foi possível adicionar. Tente novamente.');
  T.rules.push(data); openRules(); afterRules();
}

async function saveEntry(patch) {
  const e = { ...dayEntry(uid, T.date), ...patch };
  const row = { tournament_id: T.t.id, user_id: uid, date: T.date, exercises: e.exercises, habits: e.habits, notes: e.notes || '' };
  const { data, error } = await storage.db.from('daily_entries').upsert(row, { onConflict: 'tournament_id,user_id,date' }).select().single();
  if (error) return toast('Não foi possível salvar. Tente novamente.');
  T.days = [...T.days.filter(x => !(x.user_id === uid && x.date === T.date)), data]; drawTournament();
}

async function compress(file, max = 1280) {
  const img = await createImageBitmap(file), s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error('blob')), 'image/jpeg', 0.8));
}

function openMealForm(m) {
  T.file = null;
  const opts = Object.entries(MEALS).map(([k, [i, l]]) => `<option value="${k}"${m && m.meal_type === k ? ' selected' : ''}>${i} ${l}</option>`).join('');
  const manual = m && m.points !== foodPoints(m.foods || m.description || '');
  dlg(`<form id="mealForm" novalidate data-id="${m ? m.id : ''}"><h2>${m ? 'Editar' : 'Adicionar'} refeição</h2>
    <label>Tipo de refeição<select name="meal_type">${opts}</select></label>
    <div class="cam"><label class="btn ghost">📷 Tirar foto<input type="file" accept="image/*" capture="environment" data-tf="photo"></label><label class="btn ghost">🖼️ Galeria<input type="file" accept="image/*" data-tf="photo"></label></div>
    <p id="pv" class="muted">${m && m.photo_path ? 'Já tem foto (escolha outra para substituir).' : ''}</p>
    <label>Descrição<input name="description" maxlength="200" value="${m ? esc(m.description || '') : ''}" placeholder="Arroz, feijão, frango e salada"></label>
    <label>Alimentos (separe por + ou vírgula)<input name="foods" maxlength="200" value="${m ? esc(m.foods || '') : ''}" placeholder="Pizza + Coca-Cola"></label>
    <label>Pontos (automático; edite para ajustar)<input name="points" type="number" step="1" min="-50" max="50" value="${m ? m.points : 0}" ${manual ? 'data-manual="1"' : ''}></label>
    <p class="err" id="err" role="alert"></p>
    <div class="row"><button type="button" class="ghost" data-a="close">Cancelar</button><button class="btn">Salvar</button></div></form>`);
}

async function saveMeal(f) {
  const d = Object.fromEntries(new FormData(f)), points = Number(d.points), btn = f.querySelector('.btn:not(.ghost)'), fail = m => { $('#err').textContent = m; btn.disabled = false; };
  if (!Number.isInteger(points) || points < -50 || points > 50) return fail('Os pontos devem ser um número inteiro entre -50 e 50.');
  btn.disabled = true;
  const old = T.meals.find(x => x.id === f.dataset.id);
  const row = { meal_type: d.meal_type, description: d.description.trim(), foods: d.foods.trim(), points, updated_at: new Date().toISOString() };
  if (T.file) {
    $('#err').textContent = 'Enviando foto...';
    try {
      const blob = await compress(T.file), path = `${T.t.id}/${uid}/${T.date}/${d.meal_type}-${Date.now()}.jpg`;
      const { error } = await storage.db.storage.from('meal-photos').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      row.photo_path = path; $('#err').textContent = '✓ Foto enviada';
    } catch (e) { console.error(e); return fail('Não foi possível enviar a foto. Tente novamente.'); }
  }
  const q = storage.db.from('meal_records');
  const { error } = old ? await q.update(row).eq('id', old.id) : await q.insert({ ...row, tournament_id: T.t.id, user_id: uid, date: T.date });
  if (error) return fail('Não foi possível salvar a refeição. Tente novamente.');
  const oldPath = T.file && old ? old.photo_path : null;
  await syncFromTournament({ date: old ? old.date : T.date, meal_type: row.meal_type, description: row.description, photo_path: row.photo_path || (old && old.photo_path) }, oldPath);
  if (oldPath) await dropIfUnused(oldPath);
  closeDlg(); await renderTournament(); toast('✓ Refeição salva!');
}

function openDelTournament() {
  dlg(`<form id="delTournamentForm" novalidate><h2>🗑️ Excluir torneio</h2>
    <p>Isso apaga o torneio iniciado em ${fmtD(T.t.start_date)} com <b>todos os registros e fotos dos dois participantes</b>. Não dá para desfazer.</p>
    <label>Para confirmar, digite <b>APAGAR</b><input name="word" autocomplete="off"></label>
    <p class="err" id="err" role="alert"></p>
    <div class="row"><button type="button" class="ghost" data-a="close">Cancelar</button><button class="btn" style="background:var(--warn);color:#fff">Excluir torneio</button></div></form>`);
}

async function deleteTournament(f) {
  const btn = f.querySelector('.btn'), db = storage.db, id = T.t.id, fail = m => { $('#err').textContent = m; btn.disabled = false; };
  if (new FormData(f).get('word').trim().toUpperCase() !== 'APAGAR') return fail('Digite APAGAR para confirmar.');
  btn.disabled = true;
  const { data, error } = await db.from('meal_records').select('photo_path').eq('tournament_id', id);
  if (error) return fail('Não foi possível excluir. Tente novamente.');
  await db.from('tournaments').delete().eq('id', id); // os registros do torneio saem em cascata
  const { count } = await db.from('tournaments').select('*', { count: 'exact', head: true }).eq('id', id);
  if (count) return fail('Não foi possível excluir. Confira se rodou o schema.sql no Supabase.');
  const paths = data.map(m => m.photo_path).filter(Boolean);
  for (const p of paths) await dropIfUnused(p);
  closeDlg(); T.date = null; renderTournament(); toast('✓ Torneio excluído');
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-t]'); if (!b) return;
  const { t, id, d } = b.dataset, m = T.meals.find(x => x.id === id);
  if (t === 'start') dlg(`<form id="startForm"><h2>🏆 Iniciar torneio</h2><label>Data de início (Dia 1)<input type="date" name="start" value="${todayKey()}" required></label><p class="err" id="err" role="alert"></p><div class="row"><button type="button" class="ghost" data-a="close">Cancelar</button><button class="btn">Continuar</button></div></form>`);
  else if (t === 'zoom') dlg(`<img src="${b.dataset.url}" alt="Foto da refeição" style="width:100%;border-radius:12px"><button type="button" class="ghost" data-a="close" style="margin-top:.6rem">Fechar</button>`);
  else if (t === 'day') { T.date = d; T.tab = 'dia'; drawTournament(); }
  else if (t === 'tab') { T.tab = id; drawTournament(); }
  else if (t === 'meal') openMealForm(m);
  else if (t === 'rules') openRules(b.dataset.only || '');
  else if (t === 'deltournament') openDelTournament();
  else if (t === 'ruletoggle') toggleRule(id);
  else if (t === 'delmeal') ask('Excluir esta refeição e a foto?', 'Excluir', async () => {
    const { error } = await storage.db.from('meal_records').delete().eq('id', id);
    if (error) return toast('Não foi possível excluir. Tente novamente.');
    await dropIfUnused(m.photo_path); renderTournament(); });
  else if (t === 'delphoto') ask('Excluir só a foto desta refeição?', 'Excluir foto', async () => {
    const { error } = await storage.db.from('meal_records').update({ photo_path: null }).eq('id', id);
    if (error) return toast('Não foi possível excluir a foto. Tente novamente.');
    await removePhotoEverywhere(m.photo_path); renderTournament(); });
});

document.addEventListener('change', e => {
  const x = e.target;
  if (x.dataset.rp) saveRulePoints(x);
  else if (x.dataset.ts === 'date') { T.date = x.value; drawTournament(); }
  else if (x.dataset.ts === 'who') { T.who = x.value; drawTournament(); }
  else if (x.dataset.tk === 'notes') saveEntry({ notes: x.value.slice(0, 500) });
  else if (x.dataset.tk) saveEntry({ [x.dataset.tk]: [...document.querySelectorAll(`[data-tk="${x.dataset.tk}"]:checked`)].map(i => i.value) });
  else if (x.dataset.tf === 'photo' && x.files[0]) { T.file = x.files[0]; $('#pv').textContent = `📎 ${x.files[0].name}`; }
});

document.addEventListener('input', e => { // pontos automáticos até o usuário ajustar manualmente
  const f = e.target.form; if (!f || f.id !== 'mealForm') return;
  if (e.target.name === 'points') e.target.dataset.manual = '1';
  else if (e.target.name !== 'meal_type' && !f.points.dataset.manual) f.points.value = foodPoints(f.foods.value || f.description.value);
});

document.addEventListener('submit', e => {
  if (e.target.id === 'mealForm') saveMeal(e.target);
  else if (e.target.id === 'ruleForm') addRule(e.target);
  else if (e.target.id === 'delTournamentForm') deleteTournament(e.target);
  else if (e.target.id === 'startForm') {
    const start = new FormData(e.target).get('start');
    if (!start || isNaN(parseKey(start))) return void ($('#err').textContent = 'Informe uma data válida.');
    const end = dateKey(addDays(parseKey(start), TOURNAMENT_DAYS - 1));
    ask(`Iniciar o torneio em ${fmtD(start)}? Será o Dia 1, com término em ${fmtD(end)} (${TOURNAMENT_DAYS} dias).`, 'Confirmar', async () => {
      const { error } = await storage.db.from('tournaments').insert({ start_date: start, days: TOURNAMENT_DAYS });
      if (error) return toast('Não foi possível iniciar o torneio. Tente novamente.');
      renderTournament(); toast('🏆 Torneio iniciado!'); });
  }
});
