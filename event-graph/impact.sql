-- Given an event, reason forward through the graph to who is exposed, using ONLY facts known before
-- the event was seen. Nothing here looks at past events; the rules come from rule_param.
-- psql -v event_id=1 -f impact.sql
--
-- The rules, one per hop:
--   0. HIT      the event knocks out loss% of a facility for N days (from event_facility, else by severity).
--   1. OWNER    loses that share of its output of the product for the full N days.
--   2. SHORTAGE the world is short (loss% x facility's global share) until substitutes arrive:
--               gap = min(N, substitutable_days).
--   3. CUSTOMER is short (supplier's loss x how much it depends on that supplier) of the input.
--               Its inventory absorbs the start: felt = gap - buffer_days. Zero felt days = no hit.
--               It loses (shortfall x criticality) of every product it makes from that input, for felt days,
--               and that loss becomes the next hop's supplier loss. Each hop is shorter and smaller.
--   4. COMPETITOR picks up part of the world shortage during the gap.
-- Impact unit: output-days lost (20% of output for 30 days = 6.0). /365 gives share of a year's output.

WITH RECURSIVE
p AS (SELECT jsonb_object_agg(key, value) AS j FROM rule_param),
prm AS (SELECT (j->>'default_dependence')::numeric      AS dep0,
               (j->>'default_buffer_days')::numeric     AS buf0,
               (j->>'default_substitute_days')::numeric AS sub0,
               (j->>'unknown_penalty')::numeric         AS pen,
               (j->>'competitor_capture')::numeric      AS capture,
               (j->>'max_hops')::int                    AS max_hops,
               (j->>'min_impact')::numeric              AS min_impact,
               j
        FROM p),
ev AS (SELECT * FROM event WHERE id = :event_id),

-- Point-in-time view of each edge: the latest version known before we saw the event, and valid on its date.
own AS (
  SELECT DISTINCT ON (company_id, facility_id) o.*
  FROM owns o, ev
  WHERE o.known_at <= ev.first_seen_at
    AND (o.valid_from IS NULL OR o.valid_from <= ev.occurred_at::date)
    AND (o.valid_to   IS NULL OR o.valid_to   >  ev.occurred_at::date)
  ORDER BY company_id, facility_id, known_at DESC
),
prod AS (
  SELECT DISTINCT ON (facility_id, product_id) x.*
  FROM produces x, ev
  WHERE x.known_at <= ev.first_seen_at
    AND (x.valid_from IS NULL OR x.valid_from <= ev.occurred_at::date)
    AND (x.valid_to   IS NULL OR x.valid_to   >  ev.occurred_at::date)
  ORDER BY facility_id, product_id, known_at DESC
),
sup AS (
  SELECT DISTINCT ON (supplier_id, customer_id, product_id) s.*
  FROM supplies s, ev
  WHERE s.known_at <= ev.first_seen_at
    AND (s.valid_from IS NULL OR s.valid_from <= ev.occurred_at::date)
    AND (s.valid_to   IS NULL OR s.valid_to   >  ev.occurred_at::date)
  ORDER BY supplier_id, customer_id, product_id, known_at DESC
),
-- What each company makes: a company "makes" Q if one of its facilities produces Q.
makes AS (
  SELECT DISTINCT own.company_id, prod.product_id FROM own JOIN prod USING (facility_id)
),

-- Rule 0: which facilities did it hit, how hard, for how long.
hit AS (
  SELECT f.id AS facility_id, f.name,
         greatest(0.05, 1 - ST_Distance(f.geom, ev.geom) / (ev.radius_m + f.geo_precision_m)) AS match_conf,
         coalesce(ef.est_capacity_loss_pct / 100,
                  (prm.j->>('loss_' || coalesce(ev.severity, 'unknown')))::numeric) AS loss,
         coalesce(ef.est_outage_days,
                  (prm.j->>('days_' || coalesce(ev.severity, 'unknown')))::numeric) AS days
  FROM facility f CROSS JOIN ev CROSS JOIN prm
  LEFT JOIN event_facility ef ON ef.event_id = ev.id AND ef.facility_id = f.id
  WHERE ST_DWithin(f.geom, ev.geom, ev.radius_m + f.geo_precision_m)
),

-- Rule 1: the owner loses output. Scaled by the facility's share of the owner's capacity when we know it.
owner_loss AS (
  SELECT o.company_id, x.product_id, h.days,
         h.loss * o.stake_pct / 100
           * coalesce(x.capacity / nullif(sum(x.capacity) OVER (PARTITION BY o.company_id, x.product_id), 0), 1)
           AS loss,
         least(h.days, coalesce(x.substitutable_days, prm.sub0)) AS gap,     -- Rule 2
         h.loss * x.global_share_pct / 100 AS world_short,
         h.match_conf * o.confidence * x.confidence AS conf,
         h.name AS facility
  FROM hit h JOIN prod x USING (facility_id) JOIN own o USING (facility_id) CROSS JOIN prm
),

-- Rule 3, walked recursively. Each row: company C loses `loss` of its output of `product_id` for `days`.
chain AS (
  SELECT company_id, product_id, loss, days, conf, 0 AS hops,
         ARRAY[company_id] AS seen,
         facility || ' (' || round(loss * 100) || '% for ' || days || 'd)' AS path,
         gap AS downstream_gap
  FROM owner_loss
  UNION ALL
  SELECT s.customer_id, q.output_id,
         c.loss * dep.v * crit.v,
         felt.v,
         c.conf * s.confidence
           * CASE WHEN s.pct_of_customer_input IS NULL AND NOT coalesce(s.single_source, false) THEN prm.pen ELSE 1 END
           * CASE WHEN s.buffer_days IS NULL THEN prm.pen ELSE 1 END,
         c.hops + 1,
         c.seen || s.customer_id,
         c.path || ' -> ' || pi.name || ' -> ' || co.name
           || ' (short ' || round(c.loss * dep.v * 100) || '%, buffer ' || coalesce(s.buffer_days, prm.buf0)
           || 'd, felt ' || felt.v || 'd, ' || q.criticality || ' for ' || po.name || ')',
         felt.v
  FROM chain c
  CROSS JOIN prm
  JOIN sup s       ON s.supplier_id = c.company_id AND s.product_id = c.product_id
  JOIN input_of q  ON q.input_id = c.product_id
  JOIN makes m     ON m.company_id = s.customer_id AND m.product_id = q.output_id
  JOIN company co  ON co.id = s.customer_id
  JOIN product pi  ON pi.id = c.product_id
  JOIN product po  ON po.id = q.output_id
  CROSS JOIN LATERAL (SELECT CASE
                        WHEN s.pct_of_customer_input IS NOT NULL THEN s.pct_of_customer_input / 100
                        WHEN s.single_source THEN 1
                        ELSE prm.dep0 END AS v) dep
  CROSS JOIN LATERAL (SELECT (prm.j->>('crit_' || q.criticality))::numeric AS v) crit
  CROSS JOIN LATERAL (SELECT greatest(0, c.downstream_gap - coalesce(s.buffer_days, prm.buf0)) AS v) felt
  WHERE c.hops < prm.max_hops
    AND NOT s.customer_id = ANY (c.seen)
    AND c.loss * c.days >= prm.min_impact
),

calls AS (
  SELECT company_id, -1 AS direction, hops, loss * days AS impact, conf, path FROM chain
  UNION ALL
  -- Rule 4: competitors pick up a share of the world shortage while it lasts.
  -- Impact here is world-supply-days captured, not output-days: not yet comparable to the rows above.
  SELECT cp.company_b, 1, 1,
         ol.world_short * prm.capture * ol.gap,
         ol.conf * 0.5,
         ol.facility || ' -> world short ' || round(ol.world_short * 100, 1) || '% of '
           || pr.name || ' for ' || ol.gap || 'd -> competitor'
  FROM owner_loss ol
  CROSS JOIN prm
  JOIN competes cp ON cp.company_a = ol.company_id AND cp.product_id = ol.product_id
  JOIN product pr  ON pr.id = ol.product_id, ev
  WHERE cp.known_at <= ev.first_seen_at AND ol.world_short IS NOT NULL
)
SELECT s.ticker, s.exchange, co.name,
       CASE c.direction WHEN 1 THEN 'up' ELSE 'down' END AS direction,
       c.hops,
       round(c.impact::numeric, 1)          AS impact_days,
       round((c.impact / 365 * 100)::numeric, 2) AS pct_of_year,
       round(c.conf::numeric, 2)            AS conf,
       c.path
FROM calls c
JOIN company co ON co.id = c.company_id
JOIN security s ON s.company_id = c.company_id AND s.is_primary
ORDER BY c.impact * c.conf DESC;
