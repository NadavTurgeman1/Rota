-- A new site starts at 72 weekly hours and 8 hours of rest. Existing rows keep their values.
alter table public.sites alter column min_rest_hours set default 8;
alter table public.sites alter column max_weekly_hours set default 72;
