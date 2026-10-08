const PROFILE_DEFAULTS = { name: '', weight: 70, dailyKcal: 500, dailyProtein: 100, dailyCarbs: 250, dailyFat: 70, eatKcal: 2000, sex: null, activity: null, goal: 'maintain', age: null, height: null, onboarded: false };

async function fillSettings() {
  const el = $('#cfg'); if (!el) return;
  try { await loadRules(); } catch (e) { console.error(e); }
  try { await loadFoods(); } catch (e) { console.error(e); }
  if ($('#cfg') !== el) return;
  el.innerHTML = `<section class="card"><h2>🏆 Torneio</h2><p class="muted">Pontos das atividades, dos hábitos e dos alimentos.</p>
      <button class="ghost block" data-t="rules" data-only="exercises,habits">🏋️ Atividades e hábitos do torneio</button>
      <button class="ghost block" data-t="rules" data-only="foods">🍕 Alimentos que valem pontos</button></section>
    <section class="card"><h2>📝 Registrar atividade</h2><p class="muted">Tipos de atividade e o esforço (MET) de cada intensidade.</p>
      <ul class="list">${Object.entries(CONFIG.activities).map(([k, v]) => `<li class="row"><span${v.active === false ? ' class="muted"' : ''}>${esc(v.icon)} ${esc(v.label)}${v.active === false ? ' (oculta)' : ''}</span><button class="ghost" data-s="type" data-key="${k}">Editar</button></li>`).join('')}</ul>
      <button class="btn block" data-s="type">+ Adicionar atividade</button></section>
    <section class="card"><h2>🍽️ Alimentos</h2><p class="muted">Valores por 100 g, usados na aba Refeições.</p>
      <ul class="list">${N.foods.map(f => `<li class="row"><span${f.active ? '' : ' class="muted"'}>${esc(f.name)}<br><small>${g1(f.kcal)} kcal • P ${g1(f.protein)} • C ${g1(f.carbs)} • G ${g1(f.fat)}${f.portion_grams ? ` • 1 ${esc(f.portion_name)} = ${g1(f.portion_grams)} g` : ''}</small></span><button class="ghost" data-n="food" data-id="${f.id}">Editar</button></li>`).join('') || '<li class="muted">Nada ainda. Rode o supabase/schema.sql.</li>'}</ul>
      <button class="btn block" data-n="food">+ Adicionar alimento</button></section>
    <details class="card"><summary>Zona de perigo</summary><p class="muted">Apaga só os seus dados e reinicia o seu perfil. Os da outra pessoa não são afetados.</p><button class="ghost block danger" data-s="wipe">Apagar meus dados</button></details>`;
}

function openTypeForm(key) {
  const v = key ? CONFIG.activities[key] : { label: '', icon: '✨', met: { leve: 3, moderada: 4.5, intensa: 6 }, active: true };
  const met = (k, l) => `<label>MET ${l}<input name="${k}" type="number" step="0.1" min="0.1" max="20" value="${v.met[k]}"></label>`;
  dlg(`<form id="typeForm" novalidate data-key="${key || ''}"><h2>${key ? 'Editar' : 'Nova'} atividade</h2>
    <label>Nome<input name="label" maxlength="30" value="${esc(v.label)}" required></label>
    <label>Ícone (emoji)<input name="icon" maxlength="4" value="${esc(v.icon)}"></label>
    ${met('leve', 'leve')}${met('moderada', 'moderada')}${met('intensa', 'intensa')}
    <label class="check"><input type="checkbox" name="active"${v.active !== false ? ' checked' : ''}> Mostrar na lista de registro</label>
    <p class="err" id="err" role="alert"></p><div class="row"><button type="button" class="ghost" data-a="close">Cancelar</button><button class="btn">Salvar</button></div></form>`);
}

async function saveType(f) {
  const d = Object.fromEntries(new FormData(f)), label = d.label.trim(), m = ['leve', 'moderada', 'intensa'].map(k => Number(d[k])), fail = x => { $('#err').textContent = x; };
  if (!label) return fail('Informe um nome.');
  if (m.some(x => !Number.isFinite(x) || x <= 0 || x > 20)) return fail('Os METs devem ser números entre 0,1 e 20.');
  const row = { label, icon: d.icon.trim() || '✨', met_leve: m[0], met_moderada: m[1], met_intensa: m[2], active: !!d.active }, key = f.dataset.key, q = storage.db.from('activity_types');
  let slug = norm(label).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'atividade';
  while (!key && CONFIG.activities[slug]) slug += '-2';
  const { error } = key ? await q.update(row).eq('key', key) : await q.insert({ ...row, key: slug });
  if (error) return fail('Não foi possível salvar. Confira se rodou o schema.sql no Supabase.');
  await storage.load(); closeDlg(); fillSettings(); toast('✓ Atividade salva!');
}

function openWipe() {
  dlg(`<form id="wipeForm" novalidate><h2>🗑️ Apagar meus dados</h2>
    <p>Isso apaga <b>todas as suas</b> atividades, pesos, refeições, fotos e registros do torneio, e reinicia o seu perfil. Não dá para desfazer. Os dados da outra pessoa não são afetados.</p>
    <label>Para confirmar, digite <b>APAGAR</b><input name="word" autocomplete="off"></label>
    <p class="err" id="err" role="alert"></p>
    <div class="row"><button type="button" class="ghost" data-a="close">Cancelar</button><button class="btn" style="background:var(--warn);color:#fff">Apagar tudo</button></div></form>`);
}

async function wipeMyData(f) {
  const fail = m => { $('#err').textContent = m; btn.disabled = false; }, btn = f.querySelector('.btn'), db = storage.db, id = uid;
  if (new FormData(f).get('word').trim().toUpperCase() !== 'APAGAR') return fail('Digite APAGAR para confirmar.');
  btn.disabled = true;
  const { data: meals, error } = await db.from('meal_records').select('photo_path').eq('user_id', id);
  if (error) return fail('Não foi possível apagar. Tente novamente.');
  const { data: nm } = await db.from('nutrition_meals').select('photo_path').eq('user_id', id);
  const paths = [...new Set([...meals, ...(nm || [])].map(m => m.photo_path).filter(Boolean))];
  if (paths.length) await db.storage.from('meal-photos').remove(paths);
  for (const t of ['meal_records', 'daily_entries', 'activities', 'weight_records', 'nutrition_meals']) {
    await db.from(t).delete().eq('user_id', id);
    const { count } = await db.from(t).select('*', { count: 'exact', head: true }).eq('user_id', id);
    if (count) return fail('Não foi possível apagar tudo. Confira se rodou o schema.sql no Supabase.');
  }
  if (!(await storage.updateUser(id, PROFILE_DEFAULTS))) return fail('Não foi possível reiniciar o perfil. Tente novamente.');
  await storage.signOut(); location.reload();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-s]'); if (!b) return;
  if (b.dataset.s === 'type') openTypeForm(b.dataset.key); else if (b.dataset.s === 'wipe') openWipe();
});
document.addEventListener('submit', e => { if (e.target.id === 'typeForm') saveType(e.target); else if (e.target.id === 'wipeForm') wipeMyData(e.target); });
