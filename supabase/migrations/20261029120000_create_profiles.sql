-- Perfis de usuário.
-- Usuários, senhas, sessões e tokens ficam no schema auth, gerenciado pelo Supabase Auth.
-- Esta tabela guarda apenas dados da aplicação, ligados 1:1 a auth.users.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Dados de perfil da aplicação, um por usuário de auth.users.';

-- Acesso pela API: somente usuários autenticados, e cada um apenas ao próprio perfil.
alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy "Usuário lê o próprio perfil"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Usuário atualiza o próprio perfil"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Sem políticas de insert/delete: o perfil nasce pelo gatilho abaixo
-- e é removido em cascata quando o usuário é excluído do Auth.

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o perfil automaticamente quando um usuário é cadastrado no Auth.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuários criados antes desta migration também recebem perfil.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
