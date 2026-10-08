-- Rode no SQL Editor. Permite editar tipos de atividade (Registrar) e alimentos do torneio.
alter table scoring_rules drop constraint scoring_rules_kind_check;
alter table scoring_rules add constraint scoring_rules_kind_check check (kind in ('exercises', 'habits', 'foods'));

create table activity_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  icon text not null default '✨',
  met_leve numeric not null check (met_leve > 0 and met_leve <= 20),
  met_moderada numeric not null check (met_moderada > 0 and met_moderada <= 20),
  met_intensa numeric not null check (met_intensa > 0 and met_intensa <= 20),
  active boolean not null default true,
  created_at timestamptz default now()
);
alter table activity_types enable row level security;
create policy "ver tipos" on activity_types for select to authenticated using (true);
create policy "criar tipos" on activity_types for insert to authenticated with check (true);
create policy "editar tipos" on activity_types for update to authenticated using (true) with check (true);
