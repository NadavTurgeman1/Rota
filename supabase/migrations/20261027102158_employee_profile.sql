alter table public.employees add column profile jsonb not null default '{}'::jsonb;

comment on column public.employees.profile is 'HR details kept beside the roster: identity, address, employment dates, bank, and family status.';
