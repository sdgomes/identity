-- Papel do usuário na aplicação.
-- O usuário não altera o próprio papel: o grant de update continua restrito a full_name.
-- Só a Edge Function admin-users (service role) ou o SQL Editor mudam este campo.

alter table public.profiles
  add column role text not null default 'user' check (role in ('user', 'admin'));

comment on column public.profiles.role is 'Papel na aplicação: user ou admin.';

-- Para promover o primeiro administrador, execute no SQL Editor:
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'EMAIL_DO_ADMIN');
