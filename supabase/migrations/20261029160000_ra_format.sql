-- Novo formato do RA: número da matrícula + 6 dígitos aleatórios + "-" + 2 dígitos aleatórios.
-- Ex.: matrícula 1005 -> 1005202600-05. Como o número da matrícula é único, o RA também é.

create function public.generate_ra(p_number bigint)
returns text
language sql
volatile
set search_path = ''
as $$
  select p_number::text
    || lpad(floor(random() * 1000000)::int::text, 6, '0')
    || '-'
    || lpad(floor(random() * 100)::int::text, 2, '0')
$$;

-- O default não pode usar outra coluna; o RA é preenchido por gatilho a partir do número.
create function public.set_enrollment_ra()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.ra := public.generate_ra(new.number);
  return new;
end;
$$;

alter table public.enrollments alter column ra drop default;
drop sequence public.ra_seq;

create trigger enrollments_set_ra
  before insert on public.enrollments
  for each row execute function public.set_enrollment_ra();

-- Matrículas existentes passam para o novo formato.
update public.enrollments set ra = public.generate_ra(number);
