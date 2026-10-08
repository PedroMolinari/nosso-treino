// Fase 2: Supabase. Mantém um cache em memória para que as leituras continuem síncronas;
// só as escritas e o load() são assíncronos.
const storage = (() => {
  const DEFAULT_TYPES = CONFIG.activities;
  const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const cache = { acts: [], users: {}, weights: [] };
  let me = null;

  const ACT_MAP = { id: 'id', userId: 'user_id', type: 'type', minutes: 'minutes', intensity: 'intensity', date: 'date', time: 'time', note: 'note', weightUsed: 'weight_used', caloriesEstimated: 'calories_estimated', caloriesManual: 'calories_manual' };
  const USER_MAP = { id: 'id', name: 'name', weight: 'weight', dailyKcal: 'daily_kcal', age: 'age', height: 'height', onboarded: 'onboarded', dailyProtein: 'daily_protein', dailyCarbs: 'daily_carbs', dailyFat: 'daily_fat', eatKcal: 'eat_kcal', sex: 'sex', activity: 'activity', goal: 'goal' };
  const WEIGHT_MAP = { id: 'id', userId: 'user_id', weight: 'weight', date: 'date' };
  const fromRow = (r, m) => Object.fromEntries(Object.entries(m).map(([k, col]) => [k, r[col]]));
  const toRow = (o, m) => Object.fromEntries(Object.entries(o).filter(([k]) => k in m).map(([k, v]) => [m[k], v]));

  return {
    db,
    async signIn(email, password) { const { error } = await db.auth.signInWithPassword({ email, password }); return error ? error.message : null; },
    signOut: () => db.auth.signOut(),

    async load() {
      const { data: { session } } = await db.auth.getSession();
      if (!session) return false;
      me = session.user.id;
      // order desc: se passar do limite de linhas do Supabase (1000), ficam as mais recentes.
      const [p, a, w] = await Promise.all([db.from('profiles').select('*'), db.from('activities').select('*').order('date', { ascending: false }), db.from('weight_records').select('*')]);
      if (p.error || a.error || w.error) throw new Error('load');
      let ty = await db.from('activity_types').select('*').order('created_at').order('label');
      if (!ty.error && !ty.data.length) { // primeira vez: cria os tipos a partir de CONFIG.activities
        await db.from('activity_types').upsert(Object.entries(DEFAULT_TYPES).map(([key, v]) => ({ key, label: v.label, icon: v.icon, met_leve: v.met.leve, met_moderada: v.met.moderada, met_intensa: v.met.intensa })), { onConflict: 'key', ignoreDuplicates: true });
        ty = await db.from('activity_types').select('*').order('created_at').order('label');
      }
      if (!ty.error && ty.data.length) CONFIG.activities = Object.fromEntries(ty.data.map(r => [r.key, { label: r.label, icon: r.icon, active: r.active, met: { leve: Number(r.met_leve), moderada: Number(r.met_moderada), intensa: Number(r.met_intensa) } }]));
      cache.users = Object.fromEntries(p.data.map(r => [r.id, fromRow(r, USER_MAP)]));
      cache.acts = a.data.map(r => fromRow(r, ACT_MAP));
      cache.weights = w.data.map(r => fromRow(r, WEIGHT_MAP));
      return true;
    },

    getActivities: () => cache.acts,
    async saveActivity(a) {
      const { data, error } = await db.from('activities').insert(toRow(a, ACT_MAP)).select().single();
      if (error) return false;
      const item = fromRow(data, ACT_MAP); cache.acts.push(item); return item;
    },
    async updateActivity(id, patch) {
      const { data, error } = await db.from('activities').update(toRow(patch, ACT_MAP)).eq('id', id).select().single();
      if (error) return false;
      cache.acts = cache.acts.map(x => x.id === id ? fromRow(data, ACT_MAP) : x); return true;
    },
    async deleteActivity(id) {
      const { error } = await db.from('activities').delete().eq('id', id);
      if (error) return false;
      cache.acts = cache.acts.filter(x => x.id !== id); return true;
    },

    getUsers: () => cache.users,
    getUser: id => cache.users[id],
    async updateUser(id, patch) {
      const { data, error } = await db.from('profiles').update(toRow(patch, USER_MAP)).eq('id', id).select().single();
      if (error) return false;
      cache.users[id] = fromRow(data, USER_MAP); return true;
    },

    getWeightRecords: userId => cache.weights.filter(w => w.userId === userId).sort((a, b) => a.date.localeCompare(b.date)),
    async saveWeightRecord(r) {
      const { data, error } = await db.from('weight_records').insert(toRow(r, WEIGHT_MAP)).select().single();
      if (error) return false;
      cache.weights.push(fromRow(data, WEIGHT_MAP)); return true;
    },

    getCurrentUserId: () => me,
    getTheme() { try { return JSON.parse(localStorage.getItem('nt_theme_v2')); } catch { return null; } },
    setTheme(t) { try { localStorage.setItem('nt_theme_v2', JSON.stringify(t)); } catch { /* preferência só local */ } }
  };
})();
