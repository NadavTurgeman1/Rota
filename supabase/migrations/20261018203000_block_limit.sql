-- A site can cap how many open shifts one person may block in a week.

alter table public.sites
  add column constraint_block_limit boolean not null default false,
  add column constraint_max_blocks integer not null default 0;

alter table public.sites
  drop constraint if exists sites_constraint_max_blocks_check;

alter table public.sites
  add constraint sites_constraint_max_blocks_check check (constraint_max_blocks >= 0);
