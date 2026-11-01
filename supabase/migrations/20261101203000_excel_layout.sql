-- How the by-employee sheet of an Excel export is laid out.

alter table public.sites
  add column excel_layout text not null default 'written';

alter table public.sites
  drop constraint if exists sites_excel_layout;

alter table public.sites
  add constraint sites_excel_layout check (excel_layout in ('shifts', 'written'));
