-- Rode no SQL Editor (depois do gct.sql). Permite que a mesma foto apareça no Torneio e nas Refeições.
alter table nutrition_meals add column description text, add column photo_path text;

-- Diz se alguma refeição (de qualquer pessoa) ainda usa a foto; evita apagar um arquivo que outra aba ainda mostra.
create function photo_in_use(p text) returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from meal_records where photo_path = p) or exists (select 1 from nutrition_meals where photo_path = p)
$$;
grant execute on function photo_in_use(text) to authenticated;
