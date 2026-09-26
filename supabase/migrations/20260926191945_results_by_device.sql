-- results_by_device: the read path for the results page. One row per device, device count,
-- runtime, model and quant, so multi-GPU runs never blend into single-card medians.
--
-- security_invoker makes the view apply the caller's grants and the submissions RLS policies
-- instead of the view owner's.

create view public.results_by_device
with (security_invoker = true)
as
select
  s.device_id,
  s.device_count,
  s.runtime,
  s.model,
  s.quant,
  percentile_cont(0.5) within group (order by s.gen_tok_s::double precision) as median_gen_tok_s,
  percentile_cont(0.5) within group (order by s.prompt_tok_s::double precision) as median_prompt_tok_s,
  -- The most common context size among submissions that reported one.
  mode() within group (order by s.context_size) as typical_context_size,
  count(*)::integer as submission_count
from public.submissions s
group by s.device_id, s.device_count, s.runtime, s.model, s.quant;

comment on view public.results_by_device is
  'Median speeds per device, device count, runtime, model and quant.';

revoke all on table public.results_by_device from anon, authenticated;
grant select on table public.results_by_device to anon, authenticated;
