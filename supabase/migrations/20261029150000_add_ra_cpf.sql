-- RA (registro acadêmico) na matrícula e CPF no perfil.
-- O RA é gerado automaticamente junto com cada matrícula (cadastro, renovação ou troca de curso).
-- O CPF é guardado só com dígitos e validado pelos dígitos verificadores.
-- Como antes, o usuário não altera o CPF: o grant de update continua restrito a full_name.

create function public.is_valid_cpf(p_cpf text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits int[];
  v_sum int;
  v_check int;
begin
  if p_cpf is null or p_cpf !~ '^\d{11}$' or p_cpf ~ '^(\d)\1{10}$' then
    return false;
  end if;
  v_digits := string_to_array(p_cpf, null)::int[];

  -- Dígitos verificadores nas posições 10 e 11.
  for v_position in 10..11 loop
    v_sum := 0;
    for i in 1..v_position - 1 loop
      v_sum := v_sum + v_digits[i] * (v_position + 1 - i);
    end loop;
    v_check := (v_sum * 10) % 11 % 10;
    if v_check <> v_digits[v_position] then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

alter table public.profiles
  add column cpf text unique check (cpf is null or public.is_valid_cpf(cpf));

comment on column public.profiles.cpf is 'CPF somente com dígitos.';

create sequence public.ra_seq start 1;

-- Formato: ano da matrícula + sequência de 5 dígitos (ex.: 202600001).
-- Matrículas que já existem também recebem um RA.
alter table public.enrollments
  add column ra text not null unique
    default extract(year from now())::text || lpad(nextval('public.ra_seq')::text, 5, '0');

alter sequence public.ra_seq owned by public.enrollments.ra;

comment on column public.enrollments.ra is 'Registro acadêmico, gerado com a matrícula.';

-- Inclui o RA na view (nova coluna no fim, como exige create or replace view).
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
  e.ra
from public.enrollments e
join public.courses c on c.id = e.course_id
left join public.class_groups g on g.id = e.class_group_id;
