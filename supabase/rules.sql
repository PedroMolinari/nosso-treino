-- Rode no SQL Editor (depois do tournament.sql). Guarda atividades e hábitos editáveis, compartilhados pelo casal.
create table scoring_rules (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('exercises', 'habits')),
  name text not null,
  points int not null check (points between -50 and 50),
  active boolean not null default true,
  created_at timestamptz default now(),
  unique (kind, name)
);
alter table scoring_rules enable row level security;
create policy "ver regras" on scoring_rules for select to authenticated using (true);
create policy "criar regras" on scoring_rules for insert to authenticated with check (true);
create policy "editar regras" on scoring_rules for update to authenticated using (true) with check (true);
