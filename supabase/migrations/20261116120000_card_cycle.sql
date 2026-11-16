-- Ciclo da carteirinha: ela vale 6 meses e renova sozinha de 6 em 6 meses, contados a partir
-- desta data, sem passar do fim da matrícula (valid_until). O app calcula o vencimento do ciclo atual.
-- A data é a da matrícula (cadastro, renovação ou troca de curso) e recomeça quando uma matrícula
-- trancada é reativada.

alter table public.enrollments add column card_cycle_starts_on date;

update public.enrollments set card_cycle_starts_on = starts_on;

alter table public.enrollments alter column card_cycle_starts_on set not null;

comment on column public.enrollments.card_cycle_starts_on is
  'Início dos ciclos de 6 meses da carteirinha: data da matrícula ou da última reativação.';

create function public.set_card_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.card_cycle_starts_on := coalesce(new.card_cycle_starts_on, new.starts_on);
  elsif old.status = 'trancado' and new.status = 'matriculado' then
    new.card_cycle_starts_on := public.today_br();
  end if;
  return new;
end;
$$;

create trigger enrollments_set_card_cycle
  before insert or update of status on public.enrollments
  for each row execute function public.set_card_cycle();

-- Inclui o início do ciclo na view (nova coluna no fim, como exige create or replace view).
create or replace view public.enrollment_details
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
  e.created_at,
  e.ra,
  e.card_cycle_starts_on
from public.enrollments e
join public.courses c on c.id = e.course_id
left join public.class_groups g on g.id = e.class_group_id;
