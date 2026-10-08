// Sincroniza as fotos (e a refeição) entre Torneio e Refeições. As duas abas apontam para o mesmo arquivo no Storage;
// o vínculo é feito por pessoa + dia + caminho da foto. O arquivo só é apagado quando nenhuma refeição o usa mais.
const BUCKET = 'meal-photos';

async function dropIfUnused(path) {
  if (!path) return;
  const { data } = await storage.db.rpc('photo_in_use', { p: path });
  if (data === false) await storage.db.storage.from(BUCKET).remove([path]); // se o SQL photo-sync não foi rodado, não apaga
}

async function removePhotoEverywhere(path) {
  const db = storage.db;
  await db.from('nutrition_meals').update({ photo_path: null }).eq('user_id', uid).eq('photo_path', path);
  await db.from('meal_records').update({ photo_path: null }).eq('user_id', uid).eq('photo_path', path);
  await db.storage.from(BUCKET).remove([path]);
}

async function syncFromTournament(m, oldPath) {
  if (!m.photo_path) return;
  const db = storage.db, patch = { meal_type: m.meal_type, description: m.description, photo_path: m.photo_path };
  const { data } = await db.from('nutrition_meals').select('id').eq('user_id', uid).eq('date', m.date).eq('photo_path', oldPath || m.photo_path).limit(1);
  if (data && data[0]) await db.from('nutrition_meals').update(patch).eq('id', data[0].id);
  else await db.from('nutrition_meals').insert({ ...patch, user_id: uid, date: m.date, items: [], kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

async function syncFromNutrition(m, oldPath) {
  if (!m.photo_path) return;
  const db = storage.db;
  const { data: ts } = await db.from('tournaments').select('*').order('start_date', { ascending: false }).limit(1);
  const t = ts && ts[0];
  if (!t || m.date < t.start_date || m.date > dateKey(addDays(parseKey(t.start_date), t.days - 1))) return;
  const names = m.items.map(i => i.name).join(' + '), base = { meal_type: m.meal_type, photo_path: m.photo_path, description: m.description || names, foods: names, updated_at: new Date().toISOString() };
  const { data } = await db.from('meal_records').select('id').eq('tournament_id', t.id).eq('user_id', uid).eq('date', m.date).eq('photo_path', oldPath || m.photo_path).limit(1);
  if (data && data[0]) { await db.from('meal_records').update(base).eq('id', data[0].id); return; } // pontos já registrados são mantidos
  try { await loadRules(); } catch (e) { console.error(e); }
  await db.from('meal_records').insert({ ...base, tournament_id: t.id, user_id: uid, date: m.date, points: foodPoints(names) });
}
