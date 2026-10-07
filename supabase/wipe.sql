-- Rode no SQL Editor. Permite que cada pessoa apague os próprios registros de peso (necessário para "Apagar meus dados").
create policy "excluir meu peso" on weight_records for delete to authenticated using (user_id = auth.uid());
