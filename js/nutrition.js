// Valores aproximados por 100 g: [nome, kcal, proteína, carboidrato, gordura, porção, gramas da porção]. Editáveis em Configurações → Alimentos.
const DEFAULT_FOODS = [
  ['Arroz branco cozido', 128, 2.5, 28.1, 0.2], ['Feijão cozido', 76, 4.8, 13.6, 0.5], ['Peito de frango grelhado', 159, 32, 0, 2.5],
  ['Ovo cozido', 146, 13.3, 0.6, 9.5, 'ovo', 50], ['Pão francês', 300, 8, 58.6, 3.1, 'pão', 50], ['Banana', 98, 1.3, 26, 0.1, 'banana', 80],
  ['Maçã', 56, 0.3, 15.2, 0.2, 'maçã', 130], ['Carne bovina grelhada', 219, 35.9, 0, 7.3], ['Batata cozida', 52, 1.2, 11.9, 0.1],
  ['Macarrão cozido', 102, 3.4, 19.9, 0.5], ['Leite integral', 61, 3.2, 4.7, 3.3, 'copo', 200], ['Aveia em flocos', 394, 13.9, 66.6, 8.5, 'colher de sopa', 15],
  ['Pizza de muçarela', 270, 12, 34, 11, 'fatia', 100], ['Refrigerante (cola)', 42, 0, 10.6, 0, 'lata', 350]
];
const N = { who: null, foods: [], meals: [], date: null, urls: {}, file: null };
const g1 = n => (Math.round(n * 10) / 10).toLocaleString('pt-BR');
const r1 = n => Math.round(n * 10) / 10;
const foodById = id => N.foods.find(f => f.id === id);
const firstFood = () => (N.foods.find(f => f.active) || {}).id;
const gramsOf = ({ food, qty, unit }) => unit === 'p' && food.portion_grams ? qty * food.portion_grams : qty;

async function loadFoods() {
  const db = storage.db;
  let r = await db.from('foods').select('*').order('name');
  if (r.error) throw r.error;
  if (!r.data.length) {
    await db.from('foods').upsert(DEFAULT_FOODS.map(([name, kcal, protein, carbs, fat, pn, pg]) => ({ name, kcal, protein, carbs, fat, portion_name: pn || null, portion_grams: pg || null })), { onConflict: 'name', ignoreDuplicates: true });
    r = await db.from('foods').select('*').order('name');
    if (r.error) throw r.error;
  }
  N.foods = r.data;
}

async function renderMeals() {
  $('#app').innerHTML = '<p class="muted">Carregando...</p>';
  try {
    if (!N.date) N.date = todayKey();
    if (!N.who) N.who = uid;
    await loadFoods();
    const { data, error } = await storage.db.from('nutrition_meals').select('*').eq('user_id', N.who).eq('date', N.date).order('created_at');
    if (error) throw error;
    N.meals = data; N.urls = {};
    const paths = data.map(m => m.photo_path).filter(Boolean);
    if (paths.length) { const { data: u } = await storage.db.storage.from('meal-photos').createSignedUrls(paths, 3600); (u || []).forEach(x => { if (x.signedUrl) N.urls[x.path] = x.signedUrl; }); }
  } catch (e) { console.error(e); $('#app').innerHTML = '<p>Não foi possível carregar as refeições. Confira se rodou o <code>supabase/schema.sql</code>.</p>'; return; }
  drawMeals();
}

const nutLine = (label, v, goal, unit) => `<p>${label} <b>${g1(v)}</b> / ${g1(goal)} ${unit}</p>${bar(v, goal)}`;

// Resumo de hoje na tela Início (carrega depois que a tela já apareceu).
async function fillFoodToday() {
  const el = $('#ft'); if (!el) return;
  const { data, error } = await storage.db.from('nutrition_meals').select('kcal,protein,carbs,fat').eq('user_id', uid).eq('date', todayKey());
  if (error || $('#ft') !== el) return;
  const u = me(), sum = k => data.reduce((s, m) => s + Number(m[k]), 0);
  el.innerHTML = `${nutLine('🔥 Calorias', sum('kcal'), u.eatKcal, 'kcal')}${nutLine('Proteínas', sum('protein'), u.dailyProtein, 'g')}<small class="muted">Carboidratos ${g1(sum('carbs'))}/${g1(u.dailyCarbs)} g • Gorduras ${g1(sum('fat'))}/${g1(u.dailyFat)} g</small>`;
}

const itemText = i => `${esc(i.name)} — ${g1(i.qty ?? i.grams)} ${i.label ? esc(i.label) : 'g'}${i.label ? ` (${g1(i.grams)} g)` : ''}`;
const mealN = (m, own) => `<div class="meal">${m.photo_path && N.urls[m.photo_path] ? `<img class="photo" src="${N.urls[m.photo_path]}" alt="Foto da refeição" loading="lazy" data-t="zoom" data-url="${N.urls[m.photo_path]}">` : ''}
  ${m.items.length ? m.items.map(itemText).join('<br>') : `${esc(m.description || '')}<br><small class="muted">Sem alimentos informados. Toque em Editar para adicionar.</small>`}
  <p><b>🔥 ${g1(m.kcal)} kcal</b> • P ${g1(m.protein)} g • C ${g1(m.carbs)} g • G ${g1(m.fat)} g</p>
  ${own ? `<div class="acts"><button class="ghost" data-n="edit" data-id="${m.id}">Editar</button>${m.photo_path ? `<button class="ghost" data-n="delphoto" data-id="${m.id}">Excluir foto</button>` : ''}<button class="ghost danger" data-n="del" data-id="${m.id}">Excluir</button></div>` : ''}</div>`;

function drawMeals() {
  const u = storage.getUser(N.who) || me(), own = N.who === uid, today = todayKey(), sum = k => N.meals.reduce((s, m) => s + Number(m[k]), 0);
  const groups = Object.entries(MEALS).map(([k, [i, l]]) => { const ms = N.meals.filter(m => m.meal_type === k); return ms.length ? `<h2>${i} ${l}</h2>${ms.map(m => mealN(m, own)).join('')}` : ''; }).join('');
  const people = Object.values(storage.getUsers());
  const personSelect = people.length > 1 ? `<label style="margin:.8rem 0 0">Pessoa<select data-nwho>${people.map(p => `<option value="${p.id}"${p.id === N.who ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>` : '';
  $('#app').innerHTML = `<h1>🍽️ Refeições</h1>
    <section class="card"><div class="row"><button class="ghost" data-n="prev" aria-label="Dia anterior">◀</button><b>${dayLabel(N.date)} — ${fmtD(N.date).slice(0, 5)}</b><button class="ghost" data-n="next" aria-label="Próximo dia" ${N.date >= today ? 'disabled' : ''}>▶</button></div>${personSelect}</section>
    <section class="card"><h2>Resumo do dia</h2>${nutLine('🔥 Calorias', sum('kcal'), u.eatKcal, 'kcal')}${nutLine('🥩 Proteínas', sum('protein'), u.dailyProtein, 'g')}${nutLine('🍞 Carboidratos', sum('carbs'), u.dailyCarbs, 'g')}${nutLine('🥑 Gorduras', sum('fat'), u.dailyFat, 'g')}
      <small class="muted">Metas calculadas automaticamente no Perfil.</small></section>
    <section class="card">${groups || '<p class="muted">Nenhuma refeição neste dia.</p>'}${own ? '<button class="btn block" data-n="add">+ Adicionar refeição</button>' : ''}</section>`;
}

const unitOpts = (f, unit) => `<option value="g"${unit !== 'p' ? ' selected' : ''}>g</option>${f && f.portion_grams ? `<option value="p"${unit === 'p' ? ' selected' : ''}>${esc(f.portion_name)}</option>` : ''}`;
function foodRow(sel, qty, unit) {
  const opts = N.foods.filter(x => x.active || x.id === sel).map(x => `<option value="${x.id}"${x.id === sel ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
  return `<div class="frow" data-row><select class="fs" aria-label="Alimento">${opts}</select><input type="number" min="0.1" max="3000" step="any" value="${qty}" aria-label="Quantidade"><select class="fu" aria-label="Unidade">${unitOpts(foodById(sel), unit)}</select><button type="button" class="ghost" data-n="rmrow" aria-label="Remover">✕</button></div>`;
}

function openNMeal(m) {
  if (!N.foods.length) return toast('Cadastre alimentos em Configurações primeiro.');
  N.file = null;
  const rows = m ? m.items.filter(i => foodById(i.id)).map(i => foodRow(i.id, i.qty ?? i.grams, i.unit || 'g')).join('') : foodRow(firstFood(), 100, 'g');
  dlg(`<form id="nMealForm" novalidate data-id="${m ? m.id : ''}"><h2>${m ? 'Editar' : 'Adicionar'} refeição</h2>
    <label>Tipo<select name="meal_type">${Object.entries(MEALS).map(([k, [i, l]]) => `<option value="${k}"${m && m.meal_type === k ? ' selected' : ''}>${i} ${l}</option>`).join('')}</select></label>
    <div class="cam"><label class="btn ghost">📷 Tirar foto<input type="file" accept="image/*" capture="environment" data-nf="photo"></label><label class="btn ghost">🖼️ Galeria<input type="file" accept="image/*" data-nf="photo"></label></div>
    <p id="npp" class="muted">${m && m.photo_path ? 'Já tem foto (escolha outra para substituir).' : 'A foto também aparece no Torneio.'}</p>
    <p><b>Alimentos</b> <small class="muted">(em gramas ou na porção do alimento)</small></p><div id="nrows">${rows}</div>
    <button type="button" class="ghost block" data-n="addrow" style="margin-top:.6rem">+ Adicionar alimento</button>
    <div class="est" id="npv" aria-live="polite"></div><p class="err" id="err" role="alert"></p>
    <div class="row"><button type="button" class="ghost" data-a="close">Cancelar</button><button class="btn">Salvar</button></div></form>`);
  nPreview();
}

const readItems = f => [...f.querySelectorAll('[data-row]')].map(r => ({ food: foodById(r.querySelector('.fs').value), qty: Number(r.querySelector('input').value), unit: r.querySelector('.fu').value }));
const calc = items => items.reduce((s, i) => { if (!i.food || !(i.qty > 0)) return s; const k = gramsOf(i) / 100; return { kcal: s.kcal + i.food.kcal * k, protein: s.protein + i.food.protein * k, carbs: s.carbs + i.food.carbs * k, fat: s.fat + i.food.fat * k }; }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

function nPreview() {
  const f = $('#nMealForm'); if (!f) return;
  const t = calc(readItems(f));
  $('#npv').innerHTML = `Total: <b>🔥 ${g1(t.kcal)} kcal</b> • P ${g1(t.protein)} g • C ${g1(t.carbs)} g • G ${g1(t.fat)} g<br><small>Valores aproximados, calculados pela tabela de alimentos.</small>`;
}

async function saveNMeal(f) {
  const items = readItems(f), btn = f.querySelector('.btn:not(.ghost)'), fail = m => { $('#err').textContent = m; btn.disabled = false; };
  if (!items.length) return fail('Adicione pelo menos um alimento.');
  if (items.some(i => !i.food || !Number.isFinite(i.qty) || i.qty <= 0 || gramsOf(i) < 1 || gramsOf(i) > 5000)) return fail('Informe a quantidade de cada alimento (até 5000 g no total por item).');
  btn.disabled = true;
  const t = calc(items), id = f.dataset.id, old = N.meals.find(m => m.id === id), type = new FormData(f).get('meal_type');
  const row = { meal_type: type, kcal: r1(t.kcal), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat),
    items: items.map(i => ({ id: i.food.id, name: i.food.name, qty: i.qty, unit: i.unit, label: i.unit === 'p' ? i.food.portion_name : null, grams: r1(gramsOf(i)) })) };
  if (N.file) {
    $('#err').textContent = 'Enviando foto...';
    try {
      const path = `nutrition/${uid}/${N.date}/${type}-${Date.now()}.jpg`;
      const { error } = await storage.db.storage.from('meal-photos').upload(path, await compress(N.file), { contentType: 'image/jpeg' });
      if (error) throw error;
      row.photo_path = path; $('#err').textContent = '✓ Foto enviada';
    } catch (e) { console.error(e); return fail('Não foi possível enviar a foto. Tente novamente.'); }
  }
  const q = storage.db.from('nutrition_meals');
  const { error } = id ? await q.update(row).eq('id', id) : await q.insert({ ...row, user_id: uid, date: N.date });
  if (error) return fail('Não foi possível salvar. Confira se rodou o schema.sql e tente novamente.');
  const oldPath = N.file && old ? old.photo_path : null;
  await syncFromNutrition({ date: N.date, meal_type: type, items: row.items, description: old && old.description, photo_path: row.photo_path || (old && old.photo_path) }, oldPath);
  if (oldPath) await dropIfUnused(oldPath);
  closeDlg(); renderMeals(); toast('✓ Refeição salva!');
}

function openFoodForm(id) {
  const v = id ? foodById(id) : { name: '', kcal: 100, protein: 5, carbs: 15, fat: 2, portion_name: '', portion_grams: '', active: true };
  const num = (k, l) => `<label>${l}<input name="${k}" type="number" step="0.1" min="0" max="1000" value="${v[k]}"></label>`;
  dlg(`<form id="foodForm" novalidate data-id="${id || ''}"><h2>${id ? 'Editar' : 'Novo'} alimento</h2><p><small>Valores para cada 100 g.</small></p>
    <label>Nome<input name="name" maxlength="40" value="${esc(v.name)}" required></label>
    ${num('kcal', 'Calorias (kcal)')}${num('protein', 'Proteínas (g)')}${num('carbs', 'Carboidratos (g)')}${num('fat', 'Gorduras (g)')}
    <p><small>Porção padrão (opcional), por exemplo "ovo" = 50 g:</small></p>
    <label>Nome da porção<input name="portion_name" maxlength="20" value="${esc(v.portion_name || '')}" placeholder="ovo, fatia, copo..."></label>
    <label>Gramas da porção<input name="portion_grams" type="number" step="0.1" min="0" max="3000" value="${v.portion_grams || ''}"></label>
    <label class="check"><input type="checkbox" name="active"${v.active !== false ? ' checked' : ''}> Mostrar na lista de refeições</label>
    <p class="err" id="err" role="alert"></p><div class="row"><button type="button" class="ghost" data-a="close">Cancelar</button><button class="btn">Salvar</button></div></form>`);
}

async function saveFood(f) {
  const d = Object.fromEntries(new FormData(f)), name = d.name.trim(), fail = m => { $('#err').textContent = m; };
  const n = ['kcal', 'protein', 'carbs', 'fat'].map(k => Number(d[k])), pn = d.portion_name.trim(), pg = Number(d.portion_grams);
  if (!name) return fail('Informe um nome.');
  if (n.some(x => !Number.isFinite(x) || x < 0 || x > 1000)) return fail('Os valores devem ser números entre 0 e 1000.');
  if ((pn && !(pg > 0)) || (!pn && pg > 0)) return fail('Informe o nome e as gramas da porção, ou deixe os dois vazios.');
  const row = { name, kcal: n[0], protein: n[1], carbs: n[2], fat: n[3], portion_name: pn || null, portion_grams: pn ? pg : null, active: !!d.active }, q = storage.db.from('foods'), id = f.dataset.id;
  const { error } = id ? await q.update(row).eq('id', id) : await q.insert(row);
  if (error) return fail('Não foi possível salvar. Já existe um alimento com esse nome?');
  await loadFoods(); closeDlg(); fillSettings(); toast('✓ Alimento salvo!');
}

// ---------- GCT: gasto calórico total e divisão em macronutrientes ----------
const ACTIVITY = { 1.2: 'Sedentário (pouco ou nenhum exercício)', 1.375: 'Leve (1 a 3 treinos/semana)', 1.55: 'Moderado (3 a 5 treinos/semana)', 1.725: 'Intenso (6 a 7 treinos/semana)', 1.9: 'Muito intenso (treino pesado todo dia)' };
const GOALS = { lose: ['Emagrecer (−15%)', 0.85], maintain: ['Manter o peso', 1], gain: ['Ganhar massa (+10%)', 1.1] };
const PROTEIN_G_KG = 1.8, FAT_G_KG = 0.9;
function gct(u, sex, factor, goal) {
  const tmb = 10 * u.weight + 6.25 * u.height - 5 * u.age + (sex === 'M' ? 5 : -161); // Mifflin-St Jeor
  const total = tmb * factor, kcal = total * GOALS[goal][1];
  const protein = PROTEIN_G_KG * u.weight, fat = FAT_G_KG * u.weight;
  const carbs = Math.max(1, (kcal - protein * 4 - fat * 9) / 4); // carboidrato = calorias que sobram (4 kcal/g)
  return { tmb, total, kcal, protein, fat, carbs };
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-n]'); if (!b) return;
  const { n, id } = b.dataset;
  if (n === 'prev' || n === 'next') { N.date = dateKey(addDays(parseKey(N.date), n === 'next' ? 1 : -1)); renderMeals(); }
  else if (n === 'add') openNMeal();
  else if (n === 'edit') openNMeal(N.meals.find(m => m.id === id));
  else if (n === 'del') ask('Excluir esta refeição?', 'Excluir', async () => {
    const m = N.meals.find(x => x.id === id), { error } = await storage.db.from('nutrition_meals').delete().eq('id', id);
    if (error) toast('Não foi possível excluir. Tente novamente.'); else await dropIfUnused(m && m.photo_path);
    renderMeals(); });
  else if (n === 'delphoto') ask('Excluir a foto desta refeição (também some do Torneio)?', 'Excluir foto', async () => {
    await removePhotoEverywhere(N.meals.find(x => x.id === id).photo_path); renderMeals(); });
  else if (n === 'addrow') { $('#nrows').insertAdjacentHTML('beforeend', foodRow(firstFood(), 100, 'g')); nPreview(); }
  else if (n === 'rmrow') { b.closest('[data-row]').remove(); nPreview(); }
  else if (n === 'food') openFoodForm(id);
});
['input', 'change'].forEach(t => document.addEventListener(t, e => {
  if (e.target.dataset.nwho !== undefined) { if (t === 'change') { N.who = e.target.value; renderMeals(); } return; }
  if (e.target.dataset.nf === 'photo') { if (e.target.files[0]) { N.file = e.target.files[0]; $('#npp').textContent = `📎 ${N.file.name}`; } return; }
  if (e.target.classList.contains('fs')) { const f = foodById(e.target.value); e.target.closest('[data-row]').querySelector('.fu').innerHTML = unitOpts(f, 'g'); }
  if (e.target.closest('#nMealForm')) nPreview();
}));
document.addEventListener('submit', e => {
  if (e.target.id === 'nMealForm') saveNMeal(e.target);
  else if (e.target.id === 'foodForm') saveFood(e.target);
});
