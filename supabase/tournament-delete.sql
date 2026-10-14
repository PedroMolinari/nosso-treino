-- Rode no SQL Editor. Permite excluir um torneio (e, por cascata, todos os registros dele) e as fotos dele no Storage.
-- Como o casal compartilha o torneio, qualquer um dos dois pode excluir.
create policy "excluir torneio" on tournaments for delete to authenticated using (true);
create policy "apagar fotos do torneio" on storage.objects for delete to authenticated using (bucket_id = 'meal-photos');
