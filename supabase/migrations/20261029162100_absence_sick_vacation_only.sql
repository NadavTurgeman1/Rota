-- Absences are sick leave or vacation only. Documents stay on sick leave.

update public.absence_requests set kind = 'vacation' where kind = 'other';

alter table public.absence_requests drop constraint if exists absence_requests_kind_check;
alter table public.absence_requests
  add constraint absence_requests_kind_check check (kind in ('sick', 'vacation'));
