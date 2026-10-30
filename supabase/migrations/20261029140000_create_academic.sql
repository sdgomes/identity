-- Estrutura acadêmica: cursos, turmas, polos, dados do aluno, matrículas e fotos de perfil.
-- Escritas acontecem só pela Edge Function admin-users (service role) através das funções abaixo.

-- Data de referência no fuso do Brasil; o banco roda em UTC.
create function public.today_br()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- Cursos -------------------------------------------------------------------

create table public.courses (
  id smallint generated always as identity primary key,
  code text not null unique,
  name text not null unique,
  level text not null check (level in ('graduacao', 'pos_graduacao')),
  degree text not null check (degree in ('bacharelado', 'licenciatura', 'tecnologo', 'especializacao', 'mba')),
  duration_months smallint not null check (duration_months > 0)
);

comment on table public.courses is 'Catálogo de cursos com a duração que define a vigência da matrícula.';

-- Durações típicas no Brasil; ADS segue a regra combinada de 3 anos.
insert into public.courses (code, name, level, degree, duration_months) values
  ('ADS', 'Análise e Desenvolvimento de Sistemas', 'graduacao', 'tecnologo', 36),
  ('GTI', 'Gestão da Tecnologia da Informação', 'graduacao', 'tecnologo', 24),
  ('RDC', 'Redes de Computadores', 'graduacao', 'tecnologo', 30),
  ('CDD', 'Ciência de Dados', 'graduacao', 'tecnologo', 30),
  ('GRH', 'Gestão de Recursos Humanos', 'graduacao', 'tecnologo', 24),
  ('GFI', 'Gestão Financeira', 'graduacao', 'tecnologo', 24),
  ('LOG', 'Logística', 'graduacao', 'tecnologo', 24),
  ('MKT', 'Marketing', 'graduacao', 'tecnologo', 24),
  ('DGR', 'Design Gráfico', 'graduacao', 'tecnologo', 24),
  ('GAS', 'Gastronomia', 'graduacao', 'tecnologo', 24),
  ('ADM', 'Administração', 'graduacao', 'bacharelado', 48),
  ('ARQ', 'Arquitetura e Urbanismo', 'graduacao', 'bacharelado', 60),
  ('BMD', 'Biomedicina', 'graduacao', 'bacharelado', 48),
  ('CCO', 'Ciência da Computação', 'graduacao', 'bacharelado', 48),
  ('CCT', 'Ciências Contábeis', 'graduacao', 'bacharelado', 48),
  ('DIR', 'Direito', 'graduacao', 'bacharelado', 60),
  ('EFI', 'Educação Física', 'graduacao', 'bacharelado', 48),
  ('ENF', 'Enfermagem', 'graduacao', 'bacharelado', 60),
  ('ECV', 'Engenharia Civil', 'graduacao', 'bacharelado', 60),
  ('EPR', 'Engenharia de Produção', 'graduacao', 'bacharelado', 60),
  ('ESW', 'Engenharia de Software', 'graduacao', 'bacharelado', 48),
  ('FAR', 'Farmácia', 'graduacao', 'bacharelado', 60),
  ('FIS', 'Fisioterapia', 'graduacao', 'bacharelado', 60),
  ('JOR', 'Jornalismo', 'graduacao', 'bacharelado', 48),
  ('MED', 'Medicina', 'graduacao', 'bacharelado', 72),
  ('VET', 'Medicina Veterinária', 'graduacao', 'bacharelado', 60),
  ('NUT', 'Nutrição', 'graduacao', 'bacharelado', 48),
  ('ODO', 'Odontologia', 'graduacao', 'bacharelado', 60),
  ('PSI', 'Psicologia', 'graduacao', 'bacharelado', 60),
  ('PUB', 'Publicidade e Propaganda', 'graduacao', 'bacharelado', 48),
  ('REI', 'Relações Internacionais', 'graduacao', 'bacharelado', 48),
  ('SIN', 'Sistemas de Informação', 'graduacao', 'bacharelado', 48),
  ('PED', 'Pedagogia', 'graduacao', 'licenciatura', 48),
  ('LET', 'Letras', 'graduacao', 'licenciatura', 48),
  ('HIS', 'História', 'graduacao', 'licenciatura', 48),
  ('MAT', 'Matemática', 'graduacao', 'licenciatura', 48),
  ('MGP', 'MBA em Gestão de Projetos', 'pos_graduacao', 'mba', 18),
  ('MGE', 'MBA em Gestão Empresarial', 'pos_graduacao', 'mba', 18),
  ('MMD', 'MBA em Marketing Digital', 'pos_graduacao', 'mba', 18),
  ('MFC', 'MBA em Finanças e Controladoria', 'pos_graduacao', 'mba', 18),
  ('MGPS', 'MBA em Gestão de Pessoas', 'pos_graduacao', 'mba', 18),
  ('ECDI', 'Ciência de Dados e Inteligência Artificial', 'pos_graduacao', 'especializacao', 18),
  ('ESEG', 'Segurança da Informação', 'pos_graduacao', 'especializacao', 18),
  ('EESW', 'Engenharia de Software (Especialização)', 'pos_graduacao', 'especializacao', 18),
  ('EDTR', 'Direito Tributário', 'pos_graduacao', 'especializacao', 18),
  ('EDCP', 'Direito Civil e Processo Civil', 'pos_graduacao', 'especializacao', 18),
  ('EPSP', 'Psicopedagogia', 'pos_graduacao', 'especializacao', 18),
  ('EDES', 'Docência no Ensino Superior', 'pos_graduacao', 'especializacao', 12),
  ('EUTI', 'Enfermagem em Terapia Intensiva', 'pos_graduacao', 'especializacao', 24);

-- Turmas -------------------------------------------------------------------

create table public.class_groups (
  id bigint generated always as identity primary key,
  course_id smallint not null references public.courses (id) on delete cascade,
  number smallint not null check (number between 1 and 3),
  code text not null unique,
  capacity smallint not null default 5 check (capacity > 0),
  unique (course_id, number)
);

comment on table public.class_groups is 'Até 3 turmas por curso, com 5 vagas cada.';

insert into public.class_groups (course_id, number, code)
select c.id, n, c.code || '-T' || n
from public.courses c
cross join generate_series(1, 3) as n;

-- Polos --------------------------------------------------------------------

create table public.campuses (
  id smallint generated always as identity primary key,
  name text not null unique,
  code text not null unique,
  kind text not null check (kind in ('digital', 'presencial'))
);

comment on table public.campuses is 'Polos acadêmicos.';

-- Códigos sorteados uma vez; as faixas não se sobrepõem para nunca colidirem.
insert into public.campuses (name, code, kind) values
  ('Polo Digital', (1000 + floor(random() * 4000))::int::text, 'digital'),
  ('Polo FMG Mogi das Cruzes', (5000 + floor(random() * 5000))::int::text, 'presencial');

-- Dados do aluno no perfil ---------------------------------------------------

alter table public.profiles
  add column birth_date date check (birth_date >= date '1900-01-01'),
  add column avatar_path text,
  add column campus_id smallint references public.campuses (id),
  add column shift text check (shift in ('matutino', 'vespertino', 'noturno'));

-- Matrículas ---------------------------------------------------------------

create sequence public.enrollment_number_seq start 1000;

create table public.enrollments (
  id bigint generated always as identity primary key,
  number bigint not null unique default nextval('public.enrollment_number_seq'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id smallint not null references public.courses (id),
  class_group_id bigint references public.class_groups (id) on delete set null,
  status text not null default 'matriculado'
    check (status in ('matriculado', 'trancado', 'vencida', 'substituida')),
  starts_on date not null,
  valid_until date not null,
  replaced_by bigint references public.enrollments (id),
  created_at timestamptz not null default now()
);

alter sequence public.enrollment_number_seq owned by public.enrollments.number;

comment on table public.enrollments is
  'Histórico de matrículas. Vigente = matriculado ou trancado; vencida e substituida liberam a vaga na turma.';

-- No máximo uma matrícula vigente por usuário.
create unique index enrollments_one_current on public.enrollments (user_id)
  where status in ('matriculado', 'trancado');
create index enrollments_class_group on public.enrollments (class_group_id)
  where class_group_id is not null;

-- Vence no fim do semestre seguinte ao que contém início + duração.
-- Ex.: 29/10/2026 + 36 meses = 29/10/2029 (2º/2029) -> vence em 30/06/2030.
create function public.enrollment_valid_until(p_starts_on date, p_duration_months int)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when extract(month from p_starts_on + make_interval(months => p_duration_months)) <= 6
      then make_date(extract(year from p_starts_on + make_interval(months => p_duration_months))::int, 12, 31)
    else make_date(extract(year from p_starts_on + make_interval(months => p_duration_months))::int + 1, 6, 30)
  end
$$;

-- Semestres do calendário (jan–jun, jul–dez); o semestre da matrícula é o 1º.
create function public.semester_index(p_starts_on date, p_on date)
returns int
language sql
immutable
set search_path = ''
as $$
  select (extract(year from p_on)::int * 2 + (extract(month from p_on) > 6)::int)
       - (extract(year from p_starts_on)::int * 2 + (extract(month from p_starts_on) > 6)::int) + 1
$$;

-- Marca como vencidas as matrículas fora da vigência e libera a vaga na turma.
create function public.expire_enrollments()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.enrollments
  set status = 'vencida', class_group_id = null
  where status in ('matriculado', 'trancado') and valid_until < public.today_br();
$$;

-- Matricula, renova ou troca de curso. Uma matrícula vigente é substituída pela nova.
create function public.enroll_user(p_user_id uuid, p_course_id smallint)
returns public.enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course public.courses;
  v_current public.enrollments;
  v_group_id bigint;
  v_new public.enrollments;
  v_today date := public.today_br();
begin
  perform public.expire_enrollments();

  select * into v_course from public.courses where id = p_course_id;
  if not found then
    raise exception 'Curso não encontrado.';
  end if;

  -- Trava as turmas do curso para que matrículas simultâneas não ocupem a mesma vaga.
  perform 1 from public.class_groups where course_id = p_course_id for update;

  select * into v_current
  from public.enrollments
  where user_id = p_user_id and status in ('matriculado', 'trancado')
  for update;

  select g.id into v_group_id
  from public.class_groups g
  where g.course_id = p_course_id
    and (
      select count(*) from public.enrollments e
      where e.class_group_id = g.id
        and e.status in ('matriculado', 'trancado')
        and e.id is distinct from v_current.id
    ) < g.capacity
  order by g.number
  limit 1;

  if v_group_id is null then
    raise exception 'O curso % não tem vagas nas turmas.', v_course.name;
  end if;

  if v_current.id is not null then
    update public.enrollments set status = 'substituida', class_group_id = null where id = v_current.id;
  end if;

  insert into public.enrollments (user_id, course_id, class_group_id, starts_on, valid_until)
  values (p_user_id, p_course_id, v_group_id, v_today,
    public.enrollment_valid_until(v_today, v_course.duration_months))
  returning * into v_new;

  if v_current.id is not null then
    update public.enrollments set replaced_by = v_new.id where id = v_current.id;
  end if;

  return v_new;
end;
$$;

-- Alterna entre matriculado e trancado enquanto a matrícula estiver vigente.
create function public.set_enrollment_status(p_enrollment_id bigint, p_status text)
returns public.enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.enrollments;
begin
  if p_status not in ('matriculado', 'trancado') then
    raise exception 'Status inválido.';
  end if;

  perform public.expire_enrollments();

  update public.enrollments
  set status = p_status
  where id = p_enrollment_id and status in ('matriculado', 'trancado')
  returning * into v_row;

  if not found then
    raise exception 'A matrícula não está vigente; faça a renovação.';
  end if;
  return v_row;
end;
$$;

-- Matrícula com curso, turma e semestre calculados. Respeita a RLS de quem consulta.
create view public.enrollment_details
with (security_invoker = true)
as
select
  e.id,
  e.number,
  e.user_id,
  e.course_id,
  c.code as course_code,
  c.name as course_name,
  c.level as course_level,
  -- Vencida por data, mesmo antes de expire_enrollments rodar, já não ocupa turma.
  case when e.valid_until >= public.today_br() then e.class_group_id end as class_group_id,
  case when e.valid_until >= public.today_br() then g.code end as class_group_code,
  case
    when e.status in ('matriculado', 'trancado') and e.valid_until < public.today_br() then 'vencida'
    else e.status
  end as status,
  e.starts_on,
  e.valid_until,
  public.semester_index(e.starts_on, least(public.today_br(), e.valid_until)) as current_semester,
  public.semester_index(e.starts_on, e.valid_until) as total_semesters,
  e.replaced_by,
  e.created_at
from public.enrollments e
join public.courses c on c.id = e.course_id
left join public.class_groups g on g.id = e.class_group_id;

-- Acesso ---------------------------------------------------------------------

alter table public.courses enable row level security;
alter table public.class_groups enable row level security;
alter table public.campuses enable row level security;
alter table public.enrollments enable row level security;

revoke all on public.courses, public.class_groups, public.campuses, public.enrollments, public.enrollment_details
  from anon, authenticated;
grant select on public.courses, public.class_groups, public.campuses, public.enrollments, public.enrollment_details
  to authenticated;

create policy "Catálogo visível para usuários autenticados"
  on public.courses for select to authenticated using (true);
create policy "Turmas visíveis para usuários autenticados"
  on public.class_groups for select to authenticated using (true);
create policy "Polos visíveis para usuários autenticados"
  on public.campuses for select to authenticated using (true);
create policy "Usuário lê as próprias matrículas"
  on public.enrollments for select to authenticated
  using ((select auth.uid()) = user_id);

-- Funções que alteram dados ficam restritas à service role.
revoke execute on function public.expire_enrollments() from public, anon, authenticated;
revoke execute on function public.enroll_user(uuid, smallint) from public, anon, authenticated;
revoke execute on function public.set_enrollment_status(bigint, text) from public, anon, authenticated;
grant execute on function public.expire_enrollments() to service_role;
grant execute on function public.enroll_user(uuid, smallint) to service_role;
grant execute on function public.set_enrollment_status(bigint, text) to service_role;

-- Fotos de perfil ------------------------------------------------------------

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  )
$$;

-- Bucket privado: as imagens são lidas por URLs assinadas e temporárias.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Administradores gerenciam fotos de perfil"
  on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and public.is_admin())
  with check (bucket_id = 'avatars' and public.is_admin());

create policy "Usuário vê a própria foto de perfil"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
