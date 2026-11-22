-- Usage counters for Honey, Dinner? Plus. Prefixed hd_ because this project is
-- shared with Prompt Library. Service role only (no anon policies).
create table if not exists public.hd_usage (
  app_user_id text not null,
  period text not null,
  imports integer not null default 0,
  scans integer not null default 0,
  free_cook_recipe_id text,
  updated_at timestamptz not null default now(),
  primary key (app_user_id, period)
);

alter table public.hd_usage enable row level security;

comment on table public.hd_usage is 'Honey, Dinner? weekly import/scan counters and the one free full-cook recipe, keyed by RevenueCat app user id.';
