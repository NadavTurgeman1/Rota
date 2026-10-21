alter table public.organizations
  add column if not exists hebrew_calendar boolean not null default true;

comment on column public.organizations.hebrew_calendar is
  'Show Hebrew dates and holidays next to Gregorian dates. Only the owner can change it (organizations_update).';
