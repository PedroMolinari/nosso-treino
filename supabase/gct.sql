-- Rode no SQL Editor (depois do nutrition.sql). Gorduras, porções dos alimentos e dados do cálculo de GCT no perfil.
alter table foods
  add column fat numeric not null default 0 check (fat >= 0),
  add column portion_name text,
  add column portion_grams numeric check (portion_grams > 0);
alter table nutrition_meals add column fat numeric not null default 0;
alter table profiles
  add column daily_fat int not null default 70 check (daily_fat > 0),
  add column eat_kcal int not null default 2000 check (eat_kcal > 0),
  add column sex text check (sex in ('M', 'F')),
  add column activity numeric,
  add column goal text not null default 'maintain' check (goal in ('lose', 'maintain', 'gain'));

-- Gorduras e porções (aproximadas) dos alimentos padrão já cadastrados.
update foods set fat = v.fat, portion_name = v.pn, portion_grams = v.pg
from (values
  ('Arroz branco cozido', 0.2, null::text, null::numeric), ('Feijão cozido', 0.5, null, null), ('Peito de frango grelhado', 2.5, null, null),
  ('Ovo cozido', 9.5, 'ovo', 50), ('Pão francês', 3.1, 'pão', 50), ('Banana', 0.1, 'banana', 80), ('Maçã', 0.2, 'maçã', 130),
  ('Carne bovina grelhada', 7.3, null, null), ('Batata cozida', 0.1, null, null), ('Macarrão cozido', 0.5, null, null),
  ('Leite integral', 3.3, 'copo', 200), ('Aveia em flocos', 8.5, 'colher de sopa', 15), ('Pizza de muçarela', 11, 'fatia', 100), ('Refrigerante (cola)', 0, 'lata', 350)
) as v(name, fat, pn, pg)
where foods.name = v.name;
