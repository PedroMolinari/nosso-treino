-- Rode no SQL Editor. Cria a tabela de alimentos, as refeições com calorias/proteínas/carboidratos e as metas no perfil.
create table foods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kcal numeric not null check (kcal >= 0),
  protein numeric not null check (protein >= 0),
  carbs numeric not null check (carbs >= 0),
  active boolean not null default true,
  created_at timestamptz default now()
);
create table nutrition_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  items jsonb not null default '[]',
  kcal numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  created_at timestamptz default now()
);
alter table profiles
  add column daily_protein int not null default 100 check (daily_protein > 0),
  add column daily_carbs int not null default 250 check (daily_carbs > 0);

alter table foods enable row level security;
alter table nutrition_meals enable row level security;
-- Lista de alimentos compartilhada pelo casal; refeições são privadas de cada um.
create policy "ver alimentos" on foods for select to authenticated using (true);
create policy "criar alimentos" on foods for insert to authenticated with check (true);
create policy "editar alimentos" on foods for update to authenticated using (true) with check (true);
create policy "ver minhas refeicoes n" on nutrition_meals for select to authenticated using (user_id = auth.uid());
create policy "criar minhas refeicoes n" on nutrition_meals for insert to authenticated with check (user_id = auth.uid());
create policy "editar minhas refeicoes n" on nutrition_meals for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "excluir minhas refeicoes n" on nutrition_meals for delete to authenticated using (user_id = auth.uid());
