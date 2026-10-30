-- Publica mudanças de perfis e matrículas no Supabase Realtime.
-- O app escuta só as linhas do próprio aluno e atualiza a carteirinha guardada no navegador
-- quando o administrador muda status, curso, polo, turno ou foto.
-- O Realtime respeita a RLS: cada aluno só recebe eventos das linhas que já pode ler.

alter publication supabase_realtime add table public.profiles, public.enrollments;
