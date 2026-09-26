-- Submissions: one measured result. Runtime, model and quant are canonical lowercase strings
-- (the parser emits them that way and the client lowercases edits), so equivalent submissions
-- group into one row of results_by_device. Generation and prompt-processing speeds stay separate.

create table public.submissions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  device_id bigint not null references public.devices (id),
  device_count smallint not null,
  raw_command text not null,
  runtime text not null,
  model text not null,
  quant text,
  context_size integer,
  gen_tok_s numeric not null,
  prompt_tok_s numeric not null,
  created_at timestamptz not null default now(),

  constraint submissions_device_count_range check (device_count between 1 and 16),
  constraint submissions_raw_command_length check (
    btrim(raw_command) <> '' and char_length(raw_command) <= 4000
  ),
  constraint submissions_runtime_canonical check (
    runtime = lower(btrim(runtime)) and char_length(runtime) between 1 and 40
  ),
  constraint submissions_model_canonical check (
    model = lower(btrim(model)) and char_length(model) between 1 and 200
  ),
  constraint submissions_quant_canonical check (
    quant = lower(btrim(quant)) and char_length(quant) between 1 and 40
  ),
  constraint submissions_context_size_range check (context_size between 1 and 10000000),
  constraint submissions_gen_tok_s_range check (gen_tok_s > 0 and gen_tok_s <= 100000),
  constraint submissions_prompt_tok_s_range check (prompt_tok_s > 0 and prompt_tok_s <= 100000)
);

create index submissions_device_id_idx on public.submissions (device_id);
create index submissions_user_id_created_at_idx on public.submissions (user_id, created_at);

comment on table public.submissions is
  'Measured results. Public read; users insert as themselves and delete only their own rows.';

-- Rate limit: reject inserts past a fixed number of submissions per user per rolling hour.
create function public.submissions_enforce_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- THE RATE LIMIT. Change it here, in a new migration that replaces this function.
  submissions_per_user_per_hour constant integer := 20;
  recent_count integer;
begin
  -- Serialize concurrent inserts by the same user so parallel requests can't slip past the count.
  perform pg_advisory_xact_lock(hashtextextended('submissions_rate_limit:' || new.user_id::text, 0));

  select count(*) into recent_count
  from public.submissions
  where user_id = new.user_id
    and created_at > now() - interval '1 hour';

  if recent_count >= submissions_per_user_per_hour then
    -- PT429 makes PostgREST answer with HTTP 429.
    raise exception 'Rate limit reached: at most % submissions per hour. Try again later.',
      submissions_per_user_per_hour
      using errcode = 'PT429';
  end if;

  return new;
end;
$$;

create trigger submissions_enforce_rate_limit
  before insert on public.submissions
  for each row execute function public.submissions_enforce_rate_limit();

revoke all on function public.submissions_enforce_rate_limit() from public, anon, authenticated;

-- Grants: everyone reads (results and the commands behind them are public). Signed-in users
-- insert and delete. id and created_at are not insertable, so the rate limit's clock can't be
-- backdated; there is no update grant (delete and resubmit instead).
alter table public.submissions enable row level security;
revoke all on table public.submissions from anon, authenticated;
grant select on table public.submissions to anon, authenticated;
grant insert (
  user_id, device_id, device_count, raw_command, runtime, model, quant, context_size,
  gen_tok_s, prompt_tok_s
) on table public.submissions to authenticated;
grant delete on table public.submissions to authenticated;

create policy "Submissions are readable by everyone"
  on public.submissions for select
  to anon, authenticated
  using (true);

create policy "Users insert submissions as themselves"
  on public.submissions for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users delete their own submissions"
  on public.submissions for delete
  to authenticated
  using (user_id = (select auth.uid()));
