const pad = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Meio-dia evita erros de fuso/horário de verão ao somar dias.
const parseKey = k => new Date(k + 'T12:00:00');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const weekStart = d => { const x = new Date(d); x.setHours(12, 0, 0, 0); return addDays(x, -((x.getDay() + 6) % 7)); };
const kcalOf = a => a.caloriesManual ?? a.caloriesEstimated;

const stats = {
  inRange: (list, from, to) => list.filter(a => a.date >= from && a.date <= to),
  week(list, date = new Date()) { const s = weekStart(date); return stats.inRange(list, dateKey(s), dateKey(addDays(s, 6))); },

  summarize(list) {
    const kcal = list.reduce((s, a) => s + kcalOf(a), 0);
    const minutes = list.reduce((s, a) => s + a.minutes, 0);
    const byType = {};
    list.forEach(a => { byType[a.type] = (byType[a.type] || 0) + 1; });
    const top = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
    return { count: list.length, minutes, kcal, activeDays: new Set(list.map(a => a.date)).size,
             avgKcal: list.length ? Math.round(kcal / list.length) : 0, topType: top ? top[0] : null };
  },

  // Sequência atual: se hoje ainda não tem atividade, conta a partir de ontem.
  streaks(list) {
    const days = new Set(list.map(a => a.date));
    let best = 0, run = 0, prev = null;
    [...days].sort().forEach(k => {
      run = prev && dateKey(addDays(parseKey(prev), 1)) === k ? run + 1 : 1;
      best = Math.max(best, run); prev = k;
    });
    let d = new Date(); d.setHours(12, 0, 0, 0);
    if (!days.has(dateKey(d))) d = addDays(d, -1);
    let current = 0;
    while (days.has(dateKey(d))) { current++; d = addDays(d, -1); }
    return { current, best };
  },

  lastDays(list, n) {
    const names = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    return Array.from({ length: n }, (_, i) => {
      const d = addDays(new Date(), i - (n - 1)), key = dateKey(d);
      return { label: names[d.getDay()], kcal: stats.summarize(list.filter(a => a.date === key)).kcal };
    });
  },

  lastWeeks(list, n) {
    return Array.from({ length: n }, (_, i) => {
      const s = addDays(weekStart(new Date()), (i - (n - 1)) * 7);
      return { label: `${pad(s.getDate())}/${pad(s.getMonth() + 1)}`, kcal: stats.summarize(stats.week(list, s)).kcal };
    });
  },

  togetherDays(all) {
    const ids = Object.keys(storage.getUsers());
    if (ids.length < 2) return 0;
    const sets = ids.map(id => new Set(all.filter(a => a.userId === id).map(a => a.date)));
    return [...sets[0]].filter(d => sets.every(s => s.has(d))).length;
  },

  achievementsFor(userId, all) {
    const mine = all.filter(a => a.userId === userId);
    const s = { ...stats.summarize(mine), best: stats.streaks(mine).best, together: stats.togetherDays(all) > 0 };
    return ACHIEVEMENTS.map(a => ({ ...a, unlocked: a.test(s) }));
  }
};

// Para adicionar uma conquista, inclua um item aqui.
const ACHIEVEMENTS = [
  { icon: '🏃', title: 'Primeiro passo', desc: 'Registrar a primeira atividade', test: s => s.count >= 1 },
  { icon: '🔥', title: 'Ritmo forte', desc: 'Atividade em 5 dias diferentes', test: s => s.activeDays >= 5 },
  { icon: '🔥', title: 'Semana completa', desc: '7 dias seguidos com atividade', test: s => s.best >= 7 },
  { icon: '💪', title: 'Consistência', desc: '10 atividades registradas', test: s => s.count >= 10 },
  { icon: '🏆', title: 'Disciplina', desc: '25 atividades registradas', test: s => s.count >= 25 },
  { icon: '🔥', title: 'Mil calorias', desc: 'Acumular 1.000 kcal', test: s => s.kcal >= 1000 },
  { icon: '🔥', title: 'Grande esforço', desc: 'Acumular 5.000 kcal', test: s => s.kcal >= 5000 },
  { icon: '⏱️', title: '10 horas de treino', desc: 'Acumular 600 minutos', test: s => s.minutes >= 600 },
  { icon: '❤️', title: 'Juntos', desc: 'Os dois registraram atividade no mesmo dia', test: s => s.together }
];
