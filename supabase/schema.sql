-- Nosso Treino: esquema completo do banco (Supabase). Rode inteiro, uma vez, no SQL Editor de um projeto novo.
-- É o histórico de mudanças do projeto em ordem; cada parte abaixo foi uma etapa do desenvolvimento.

-- =====================================================================
-- Parte 1: Base: perfis, atividades e peso (login, RLS e perfil automático)
-- =====================================================================
-- Cole no Supabase → SQL Editor → Run.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Usuário',
  weight numeric not null default 70 check (weight > 0),
  daily_kcal int not null default 500 check (daily_kcal > 0),
  weekly_kcal int not null default 2500 check (weekly_kcal > 0),
  weekly_workouts int not null default 4 check (weekly_workouts > 0),
  weekly_minutes int not null default 240 check (weekly_minutes > 0)
);
create table activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null,
  minutes int not null check (minutes > 0 and minutes <= 600),
  intensity text not null,
  date date not null,
  time text,
  note text default '',
  weight_used numeric,
  calories_estimated int not null check (calories_estimated >= 0),
  calories_manual int check (calories_manual >= 0),
  created_at timestamptz default now()
);
create table weight_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  weight numeric not null check (weight > 0),
  date date not null
);

alter table profiles enable row level security;
alter table activities enable row level security;
alter table weight_records enable row level security;

-- O casal vê os perfis e atividades um do outro; só edita os próprios.
create policy "ver perfis" on profiles for select to authenticated using (true);
create policy "criar meu perfil" on profiles for insert to authenticated with check (id = auth.uid());
create policy "editar meu perfil" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "ver atividades" on activities for select to authenticated using (true);
create policy "criar minhas atividades" on activities for insert to authenticated with check (user_id = auth.uid());
create policy "editar minhas atividades" on activities for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "excluir minhas atividades" on activities for delete to authenticated using (user_id = auth.uid());

-- Histórico de peso é privado.
create policy "ver meu peso" on weight_records for select to authenticated using (user_id = auth.uid());
create policy "criar meu peso" on weight_records for insert to authenticated with check (user_id = auth.uid());

-- Perfil criado automaticamente para cada novo usuário (nome inicial = parte do e-mail antes do @).
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name) values (new.id, split_part(new.email, '@', 1));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Perfis dos usuários que já existiam antes desta tabela.
insert into profiles (id, name) select id, split_part(email, '@', 1) from auth.users on conflict do nothing;

-- =====================================================================
-- Parte 2: Torneio: torneios, refeições do torneio, registros diários e bucket de fotos
-- =====================================================================
-- Rode no SQL Editor DEPOIS do schema.sql. Não altera nada que já existe.
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  days int not null default 20 check (days > 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz default now()
);
create table meal_records (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  description text default '',
  foods text default '',
  photo_path text,
  points int not null default 0 check (points between -50 and 50),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table daily_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  exercises text[] not null default '{}',
  habits text[] not null default '{}',
  notes text default '',
  unique (tournament_id, user_id, date)
);

alter table tournaments enable row level security;
alter table meal_records enable row level security;
alter table daily_entries enable row level security;

create policy "ver torneios" on tournaments for select to authenticated using (true);
create policy "criar torneio" on tournaments for insert to authenticated with check (created_by = auth.uid());

create policy "ver refeicoes" on meal_records for select to authenticated using (true);
create policy "criar minhas refeicoes" on meal_records for insert to authenticated with check (user_id = auth.uid());
create policy "editar minhas refeicoes" on meal_records for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "excluir minhas refeicoes" on meal_records for delete to authenticated using (user_id = auth.uid());

create policy "ver registros diarios" on daily_entries for select to authenticated using (true);
create policy "criar meus registros" on daily_entries for insert to authenticated with check (user_id = auth.uid());
create policy "editar meus registros" on daily_entries for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "excluir meus registros" on daily_entries for delete to authenticated using (user_id = auth.uid());

-- Bloqueia registros fora dos dias do torneio.
create function check_in_period() returns trigger language plpgsql as $$
declare t tournaments%rowtype;
begin
  select * into t from tournaments where id = new.tournament_id;
  if new.date < t.start_date or new.date >= t.start_date + t.days then
    raise exception 'Data fora do período do torneio';
  end if;
  return new;
end $$;
create trigger meal_period before insert or update on meal_records for each row execute function check_in_period();
create trigger entry_period before insert or update on daily_entries for each row execute function check_in_period();

-- Bucket privado; caminho: torneio/participante/data/refeicao. Todos logados veem; cada um só grava na própria pasta.
insert into storage.buckets (id, name, public) values ('meal-photos', 'meal-photos', false) on conflict do nothing;
create policy "ver fotos" on storage.objects for select to authenticated using (bucket_id = 'meal-photos');
create policy "enviar minhas fotos" on storage.objects for insert to authenticated with check (bucket_id = 'meal-photos' and (storage.foldername(name))[2] = auth.uid()::text);
create policy "trocar minhas fotos" on storage.objects for update to authenticated using (bucket_id = 'meal-photos' and (storage.foldername(name))[2] = auth.uid()::text);
create policy "apagar minhas fotos" on storage.objects for delete to authenticated using (bucket_id = 'meal-photos' and (storage.foldername(name))[2] = auth.uid()::text);

-- =====================================================================
-- Parte 3: Regras de pontuação editáveis (atividades e hábitos)
-- =====================================================================
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

-- =====================================================================
-- Parte 4: Perfil: idade, altura, cor e controle do primeiro cadastro
-- =====================================================================
-- Rode no SQL Editor. Adiciona idade, altura, cor do perfil e o controle do primeiro cadastro.
alter table profiles
  add column age int check (age between 10 and 100),
  add column height numeric check (height between 100 and 250),
  add column theme text not null default 'green' check (theme in ('green','blue','pink','purple','orange')),
  add column onboarded boolean not null default false;

-- =====================================================================
-- Parte 5: Configurações: tipos de atividade editáveis e alimentos do torneio
-- =====================================================================
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

-- =====================================================================
-- Parte 6: Permite apagar os próprios registros de peso
-- =====================================================================
-- Rode no SQL Editor. Permite que cada pessoa apague os próprios registros de peso (necessário para "Apagar meus dados").
create policy "excluir meu peso" on weight_records for delete to authenticated using (user_id = auth.uid());

-- =====================================================================
-- Parte 7: Permite excluir torneios e as fotos deles
-- =====================================================================
-- Rode no SQL Editor. Permite excluir um torneio (e, por cascata, todos os registros dele) e as fotos dele no Storage.
-- Como o casal compartilha o torneio, qualquer um dos dois pode excluir.
create policy "excluir torneio" on tournaments for delete to authenticated using (true);
create policy "apagar fotos do torneio" on storage.objects for delete to authenticated using (bucket_id = 'meal-photos');

-- =====================================================================
-- Parte 8: Refeições: alimentos e refeições com calorias e macros
-- =====================================================================
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

-- =====================================================================
-- Parte 9: GCT: gorduras, porções e dados de cálculo no perfil
-- =====================================================================
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

-- =====================================================================
-- Parte 10: Fotos compartilhadas entre Torneio e Refeições
-- =====================================================================
-- Rode no SQL Editor (depois do gct.sql). Permite que a mesma foto apareça no Torneio e nas Refeições.
alter table nutrition_meals add column description text, add column photo_path text;

-- Diz se alguma refeição (de qualquer pessoa) ainda usa a foto; evita apagar um arquivo que outra aba ainda mostra.
create function photo_in_use(p text) returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from meal_records where photo_path = p) or exists (select 1 from nutrition_meals where photo_path = p)
$$;
grant execute on function photo_in_use(text) to authenticated;

-- =====================================================================
-- Parte 11: Refeições visíveis para o casal
-- =====================================================================
-- Rode no SQL Editor. O casal passa a ver as refeições um do outro (só leitura; cada um edita apenas as próprias).
drop policy "ver minhas refeicoes n" on nutrition_meals;
create policy "ver refeicoes do casal" on nutrition_meals for select to authenticated using (true);
