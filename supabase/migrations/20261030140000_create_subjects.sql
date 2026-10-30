-- Disciplinas: a grade de cada curso e as disciplinas que cada aluno cursa.
--
-- Regras:
-- - Uma disciplina do Nº semestre da grade só pode ser cursada a partir do Nº semestre da matrícula
--   (no semestre dela ou depois, por exemplo ao refazer após reprovação).
-- - Ao matricular e a cada semestre novo, as disciplinas do semestre entram sozinhas como "cursando".
-- - Quando o semestre vira, o que estava "cursando" passa a "aprovado". Só o administrador marca
--   reprovado (ou aprovado) manualmente.
-- - Matrícula trancada congela as disciplinas: nada é aprovado nem incluído até reativar. Ao reativar,
--   as disciplinas em curso continuam no semestre atual.
--
-- A virada de semestre é aplicada por sync_subject_enrollments, chamada no início de cada operação da
-- Edge Function admin-users (como expire_enrollments) e por sync_my_subjects quando o aluno abre a tela.
-- Escritas só pela service role e por essas funções.

-- Grade ----------------------------------------------------------------------

create table public.subjects (
  id int generated always as identity primary key,
  course_id smallint not null references public.courses (id) on delete cascade,
  code text not null unique,
  name text not null,
  semester smallint not null check (semester > 0),
  workload_hours smallint not null default 80 check (workload_hours > 0),
  unique (course_id, name)
);

comment on table public.subjects is 'Grade curricular: disciplinas de cada curso por semestre.';

create index subjects_course_semester on public.subjects (course_id, semester);

-- Disciplinas cursadas -------------------------------------------------------

create table public.subject_enrollments (
  id bigint generated always as identity primary key,
  enrollment_id bigint not null references public.enrollments (id) on delete cascade,
  subject_id int not null references public.subjects (id) on delete cascade,
  -- Semestre da matrícula em que a disciplina foi (ou está sendo) cursada.
  taken_semester smallint not null check (taken_semester > 0),
  status text not null default 'cursando' check (status in ('cursando', 'aprovado', 'reprovado')),
  created_at timestamptz not null default now(),
  unique (enrollment_id, subject_id, taken_semester)
);

comment on table public.subject_enrollments is
  'Cada vez que um aluno cursa uma disciplina. Reprovado pode cursar de novo em outro semestre.';

-- A mesma disciplina não fica em curso duas vezes nem é cursada de novo depois de aprovada.
create unique index subject_enrollments_one_open on public.subject_enrollments (enrollment_id, subject_id)
  where status in ('cursando', 'aprovado');

-- Último semestre da matrícula cujas disciplinas já foram incluídas automaticamente.
alter table public.enrollments
  add column subjects_synced_through smallint not null default 0;

-- Virada de semestre ---------------------------------------------------------

-- Para as matrículas ativas (de um usuário ou de todos): inclui as disciplinas dos semestres que
-- começaram desde a última vez e aprova o que estava em curso em semestres já encerrados.
create function public.sync_subject_enrollments(p_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment record;
  v_semester int;
begin
  for v_enrollment in
    select e.id, e.course_id, e.starts_on, e.subjects_synced_through
    from public.enrollments e
    where e.status = 'matriculado'
      and e.valid_until >= public.today_br()
      and (p_user_id is null or e.user_id = p_user_id)
    for update
  loop
    v_semester := public.semester_index(v_enrollment.starts_on, public.today_br());

    if v_semester > v_enrollment.subjects_synced_through then
      -- Semestres que passaram sem sincronizar também entram; como já acabaram, são aprovados abaixo.
      insert into public.subject_enrollments (enrollment_id, subject_id, taken_semester)
      select v_enrollment.id, s.id, s.semester
      from public.subjects s
      where s.course_id = v_enrollment.course_id
        and s.semester > v_enrollment.subjects_synced_through
        and s.semester <= v_semester
        and not exists (
          select 1 from public.subject_enrollments se
          where se.enrollment_id = v_enrollment.id and se.subject_id = s.id
        )
      on conflict do nothing;

      update public.enrollments set subjects_synced_through = v_semester where id = v_enrollment.id;
    end if;

    update public.subject_enrollments
    set status = 'aprovado'
    where enrollment_id = v_enrollment.id and status = 'cursando' and taken_semester < v_semester;
  end loop;
end;
$$;

-- O próprio aluno aplica a virada de semestre nas suas disciplinas ao abrir a tela.
create function public.sync_my_subjects()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sem usuário, sync_subject_enrollments(null) sincronizaria todos: nunca deixar passar.
  if (select auth.uid()) is null then
    raise exception 'Faça login para sincronizar as disciplinas.';
  end if;
  perform public.sync_subject_enrollments((select auth.uid()));
end;
$$;

-- Nova matrícula (cadastro, renovação ou troca de curso) recebe as disciplinas do 1º semestre na hora.
create function public.sync_subjects_after_enroll()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_subject_enrollments(new.user_id);
  return null;
end;
$$;

create trigger enrollments_sync_subjects
  after insert on public.enrollments
  for each row execute function public.sync_subjects_after_enroll();

-- Ao reativar uma matrícula trancada, o que estava em curso continua no semestre atual e
-- os semestres em que ela ficou trancada não recebem disciplinas automaticamente.
create function public.resume_subjects_on_reactivate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_semester int;
begin
  if old.status = 'trancado' and new.status = 'matriculado' then
    v_semester := public.semester_index(new.starts_on, public.today_br());
    update public.subject_enrollments
    set taken_semester = v_semester
    where enrollment_id = new.id and status = 'cursando';
    new.subjects_synced_through := greatest(new.subjects_synced_through, v_semester - 1);
  end if;
  return new;
end;
$$;

create trigger enrollments_resume_subjects
  before update of status on public.enrollments
  for each row execute function public.resume_subjects_on_reactivate();

-- Operações do administrador -------------------------------------------------

-- Inclui o aluno em uma disciplina do curso, respeitando o semestre mínimo dela.
create function public.add_subject_enrollment(p_enrollment_id bigint, p_subject_id int)
returns public.subject_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.enrollments;
  v_subject public.subjects;
  v_semester int;
  v_row public.subject_enrollments;
begin
  perform public.sync_subject_enrollments();

  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;
  if not found or v_enrollment.status <> 'matriculado' or v_enrollment.valid_until < public.today_br() then
    raise exception 'A matrícula precisa estar ativa (matriculado) para incluir disciplinas.';
  end if;

  select * into v_subject from public.subjects where id = p_subject_id;
  if not found or v_subject.course_id <> v_enrollment.course_id then
    raise exception 'A disciplina não pertence ao curso da matrícula.';
  end if;

  v_semester := public.semester_index(v_enrollment.starts_on, public.today_br());
  if v_subject.semester > v_semester then
    raise exception '% é do %º semestre e o aluno está no %º.', v_subject.name, v_subject.semester, v_semester;
  end if;

  if exists (
    select 1 from public.subject_enrollments
    where enrollment_id = p_enrollment_id and subject_id = p_subject_id and status in ('cursando', 'aprovado')
  ) then
    raise exception 'O aluno já está cursando ou já foi aprovado em %.', v_subject.name;
  end if;

  insert into public.subject_enrollments (enrollment_id, subject_id, taken_semester)
  values (p_enrollment_id, p_subject_id, v_semester)
  on conflict (enrollment_id, subject_id, taken_semester)
    do update set status = 'cursando'
  returning * into v_row;
  return v_row;
end;
$$;

-- Tira o aluno de uma disciplina em curso.
create function public.remove_subject_enrollment(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.subject_enrollments where id = p_id and status = 'cursando';
  if not found then
    raise exception 'Só é possível remover disciplinas em curso.';
  end if;
end;
$$;

-- Marca aprovado ou reprovado. Voltar para "cursando" só vale no semestre atual de uma matrícula ativa.
create function public.set_subject_status(p_id bigint, p_status text)
returns public.subject_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.subject_enrollments;
  v_enrollment public.enrollments;
begin
  if p_status not in ('cursando', 'aprovado', 'reprovado') then
    raise exception 'Status inválido.';
  end if;

  select * into v_row from public.subject_enrollments where id = p_id for update;
  if not found then
    raise exception 'Disciplina cursada não encontrada.';
  end if;

  if p_status = 'cursando' then
    select * into v_enrollment from public.enrollments where id = v_row.enrollment_id;
    if v_enrollment.status <> 'matriculado'
      or v_row.taken_semester <> public.semester_index(v_enrollment.starts_on, public.today_br()) then
      raise exception 'Só disciplinas do semestre atual de uma matrícula ativa podem voltar a "cursando".';
    end if;
  end if;

  if p_status in ('cursando', 'aprovado') and exists (
    select 1 from public.subject_enrollments
    where enrollment_id = v_row.enrollment_id and subject_id = v_row.subject_id
      and id <> p_id and status in ('cursando', 'aprovado')
  ) then
    raise exception 'O aluno já está cursando ou já foi aprovado nesta disciplina em outro semestre.';
  end if;

  update public.subject_enrollments set status = p_status where id = p_id returning * into v_row;
  return v_row;
end;
$$;

-- Acesso ---------------------------------------------------------------------

alter table public.subjects enable row level security;
alter table public.subject_enrollments enable row level security;

revoke all on public.subjects, public.subject_enrollments from anon, authenticated;
grant select on public.subjects, public.subject_enrollments to authenticated;

create policy "Grade visível para usuários autenticados"
  on public.subjects for select to authenticated using (true);
create policy "Usuário lê as próprias disciplinas"
  on public.subject_enrollments for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id and e.user_id = (select auth.uid())
  ));

revoke execute on function public.sync_subject_enrollments(uuid) from public, anon, authenticated;
revoke execute on function public.sync_my_subjects() from public, anon;
revoke execute on function public.add_subject_enrollment(bigint, int) from public, anon, authenticated;
revoke execute on function public.remove_subject_enrollment(bigint) from public, anon, authenticated;
revoke execute on function public.set_subject_status(bigint, text) from public, anon, authenticated;
grant execute on function public.sync_subject_enrollments(uuid) to service_role;
grant execute on function public.sync_my_subjects() to authenticated;
grant execute on function public.add_subject_enrollment(bigint, int) to service_role;
grant execute on function public.remove_subject_enrollment(bigint) to service_role;
grant execute on function public.set_subject_status(bigint, text) to service_role;

-- O app atualiza a tela de disciplinas sozinho quando o administrador muda algo (Realtime, sob RLS).
alter publication supabase_realtime add table public.subject_enrollments;
