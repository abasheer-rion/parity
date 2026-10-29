-- The daily egress check (REF-0028) reports through the same health table as the
-- always-on search and sims: one row, service 'egress', with a few public numbers (bytes
-- sent in the last day, the 30-day projection, the free plan's limit, a warn flag). The
-- site's health line shows a warning when that flag is set.
--
-- Only the allowed service names change. Reads stay public (the existing policy), and
-- writes still go only through public.report_heartbeat, which only parity_writer may run.
--
-- Rollback:
--   delete from public.service_heartbeats where service = 'egress';
--   alter table public.service_heartbeats drop constraint service_heartbeats_service_check;
--   alter table public.service_heartbeats add constraint service_heartbeats_service_check
--     check (service in ('search', 'sims'));

alter table public.service_heartbeats drop constraint if exists service_heartbeats_service_check;
alter table public.service_heartbeats add constraint service_heartbeats_service_check
  check (service in ('search', 'sims', 'egress'));
