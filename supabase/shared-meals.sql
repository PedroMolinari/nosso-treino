-- Rode no SQL Editor. O casal passa a ver as refeições um do outro (só leitura; cada um edita apenas as próprias).
drop policy "ver minhas refeicoes n" on nutrition_meals;
create policy "ver refeicoes do casal" on nutrition_meals for select to authenticated using (true);
