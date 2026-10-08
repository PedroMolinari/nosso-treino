// Valores iniciais de atividades e METs. Depois do primeiro acesso, eles passam a ser editados em Configurações (Supabase).
const CONFIG = {
  maxMinutes: 600,
  intensities: { leve: 'Leve', moderada: 'Moderada', intensa: 'Intensa' },
  // Valores aproximados do Compendium of Physical Activities. Edite à vontade.
  activities: {
    academia:   { label: 'Academia',   icon: '🏋️', met: { leve: 3.5, moderada: 5,   intensa: 7 } },
    caminhada:  { label: 'Caminhada',  icon: '🚶', met: { leve: 2.8, moderada: 3.5, intensa: 4.5 } },
    corrida:    { label: 'Corrida',    icon: '🏃', met: { leve: 6,   moderada: 8,   intensa: 10 } },
    bicicleta:  { label: 'Bicicleta',  icon: '🚴', met: { leve: 4,   moderada: 6,   intensa: 8 } },
    natacao:    { label: 'Natação',    icon: '🏊', met: { leve: 5,   moderada: 7,   intensa: 9.5 } },
    cheers:     { label: 'Cheers',     icon: '📣', met: { leve: 3,   moderada: 4.5, intensa: 6 } },
    danca:      { label: 'Dança',      icon: '💃', met: { leve: 3,   moderada: 4.5, intensa: 6.5 } },
    futebol:    { label: 'Futebol',    icon: '⚽', met: { leve: 5,   moderada: 7,   intensa: 9 } },
    esporte:    { label: 'Esporte',    icon: '🎾', met: { leve: 4,   moderada: 6,   intensa: 8 } },
    alongamento:{ label: 'Alongamento',icon: '🧘', met: { leve: 2,   moderada: 2.5, intensa: 3 } },
    outro:      { label: 'Outro',      icon: '✨', met: { leve: 3,   moderada: 4.5, intensa: 6.5 } }
  },
};

const calories = {
  // calorias = MET × peso (kg) × horas
  estimate(type, intensity, weight, minutes) {
    const met = (CONFIG.activities[type] || CONFIG.activities.outro).met[intensity];
    const kcal = met * weight * (minutes / 60);
    return Number.isFinite(kcal) && kcal >= 0 ? Math.round(kcal) : 0;
  }
};
