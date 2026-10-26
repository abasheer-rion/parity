-- Reasoning functions. Load after schema.sql:  psql -f reason.sql
SET check_function_bodies = off;   -- functions may call ones defined further down
--   belief_detail(claim, as_of) / belief(claim, as_of)   how much to trust a claim at a moment
--   impact(event, as_of)                                   who is exposed, by mechanism, from claims believed at as_of
--   replay(case, as_of)                                    run impact() blind at as_of, score it against the case

-- ───────────── belief: the false-news filter ─────────────
-- Log-odds: start at the prior, then each INDEPENDENT piece of evidence adds or removes weight.
--   * Copies of one story count once (syndicated_from), and one source counts once however often it repeats.
--   * A report's weight comes from its source's track record AS OF that moment: claims it backed that were
--     later settled true vs false. New, unknown sources weigh ~0, so a swarm of fresh accounts adds nothing.
--   * The subject confirming it (primary) or a sensor seeing it (physical) weighs most.
--   * A claim about something not in our graph is penalised.

CREATE OR REPLACE FUNCTION belief_detail(p_claim bigint, p_as_of timestamptz)
RETURNS TABLE (source_name text, kind text, stance text, weight numeric)
LANGUAGE sql STABLE AS $$
  WITH prm AS (SELECT jsonb_object_agg(key, value) AS j FROM rule_param WHERE mechanism = 'belief'),
  ev AS (                            -- evidence visible at as_of, collapsed to the original doc's source
    SELECT DISTINCT ON (root.source_id) root.source_id, ce.kind, ce.stance
    FROM claim_evidence ce
    JOIN source_doc d    ON d.id = ce.doc_id
    JOIN source_doc root ON root.id = coalesce(d.syndicated_from, d.id)
    WHERE ce.claim_id = p_claim AND d.published_at <= p_as_of
      AND d.mnpi_cleared AND root.mnpi_cleared  -- uncleared material never reaches the reasoner
    ORDER BY root.source_id,
             CASE ce.stance WHEN 'retracts' THEN 0 WHEN 'denies' THEN 1 ELSE 2 END,  -- latest word wins: a retraction beats an earlier report
             CASE ce.kind WHEN 'primary' THEN 0 WHEN 'physical' THEN 1 ELSE 2 END
  ),
  record AS (                        -- each source's track record from claims settled before as_of
    SELECT s.id,
           s.prior_confirmed + count(*) FILTER (WHERE c.resolution = 'true')  AS ok,
           s.prior_retracted + count(*) FILTER (WHERE c.resolution = 'false') AS bad
    FROM source s
    LEFT JOIN source_doc d     ON d.source_id = s.id
    LEFT JOIN claim_evidence e ON e.doc_id = d.id AND e.stance = 'supports'
    LEFT JOIN claim c          ON c.id = e.claim_id AND c.resolved_at <= p_as_of AND c.id <> p_claim
    GROUP BY s.id
  )
  SELECT s.name, ev.kind, ev.stance,
         round((CASE ev.stance WHEN 'supports' THEN 1 ELSE -1 END) *
           CASE WHEN ev.stance = 'retracts'  THEN (prm.j->>'retract_weight')::numeric
                WHEN ev.kind   = 'primary'   THEN (prm.j->>'primary_weight')::numeric
                WHEN ev.kind   = 'physical'  THEN (prm.j->>'physical_weight')::numeric
                ELSE ln((r.ok + 1.0) / (r.bad + 1.0)) END, 2)   -- = log-odds of a beta(ok+1, bad+1) track record
  FROM ev JOIN source s ON s.id = ev.source_id JOIN record r ON r.id = s.id, prm
  UNION ALL
  SELECT '(not in graph)', 'graph_fit', 'denies', -(prm.j->>'unresolved_penalty')::numeric
  FROM claim c, prm WHERE c.id = p_claim AND c.subject_id IS NULL
$$;

CREATE OR REPLACE FUNCTION belief(p_claim bigint, p_as_of timestamptz)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT round(1 / (1 + exp(-(ln(pr.value / (1 - pr.value)) + coalesce(sum(b.weight), 0)))), 3)
  FROM rule_param pr LEFT JOIN belief_detail(p_claim, p_as_of) b ON true
  WHERE pr.mechanism = 'belief' AND pr.key = 'prior'
  GROUP BY pr.value
$$;

-- ───────────── impact: mechanisms over the graph ─────────────
-- Input is the event's claims as they stood at as_of (later revisions hidden), each weighted by belief().
-- Mechanism supply_loss, one rule per hop:
--   OWNER     loses (claimed loss x stake) of the facility's product for the claimed days.
--   SHORTAGE  customers are short until substitutes arrive: gap = min(days, substitutable_days).
--   CUSTOMER  short by (supplier loss x dependence on that supplier). Inventory absorbs the start:
--             felt = gap - buffer_days. It loses (shortfall x criticality) of each product made from that input
--             for felt days, which becomes the next hop's loss. Each hop is shorter and smaller by itself.
--   COMPETITOR picks up part of the world shortfall during the gap.
-- Impact unit: output-days lost (20% of output for 30 days = 6.0).

CREATE OR REPLACE FUNCTION impact(p_event bigint, p_as_of timestamptz DEFAULT NULL)
RETURNS TABLE (entity_id bigint, ticker text, name text, mechanism text, direction smallint,
               hops int, impact numeric, conf numeric, path text)
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE
  prm AS (SELECT jsonb_object_agg(r.key, r.value) AS j FROM rule_param r
          WHERE r.mechanism IN ('supply_loss', 'global')),
  ev AS (SELECT e.*, coalesce(p_as_of, e.first_seen_at) AS t FROM event e WHERE e.id = p_event),

  -- Every link as we knew it at t: the latest version known by then, valid on the event date.
  lk AS (
    SELECT DISTINCT ON (l.src_id, l.dst_id, l.rel, coalesce(l.via_id, 0)) l.*
    FROM link l, ev
    WHERE l.known_at <= ev.t
      AND (l.valid_from IS NULL OR l.valid_from <= ev.occurred_at::date)
      AND (l.valid_to   IS NULL OR l.valid_to   >  ev.occurred_at::date)
    ORDER BY l.src_id, l.dst_id, l.rel, coalesce(l.via_id, 0), l.known_at DESC
  ),
  makes AS (                         -- company makes Q if a facility it owns produces Q
    SELECT DISTINCT o.src_id AS company_id, p.via_id AS product_id
    FROM lk o JOIN lk p ON p.src_id = o.dst_id AND p.rel = 'produces'
    WHERE o.rel = 'owns'
  ),

  -- The event's capacity claims, latest estimate visible at t, weighted by how much we believe them.
  -- Conflicting claims about one site don't add up: the most believed one stands.
  hit AS (
    SELECT DISTINCT ON (c.subject_id)
           c.subject_id AS facility_id, f.name, c.magnitude / 100 AS loss,
           coalesce(c.duration_days, (prm.j->>'default_outage_days')::numeric) AS days,
           belief(c.id, ev.t) AS belief
    FROM claim c JOIN ev ON c.event_id = ev.id JOIN entity f ON f.id = c.subject_id CROSS JOIN prm
    WHERE c.change = 'capacity_loss' AND c.first_seen_at <= ev.t
      AND NOT EXISTS (SELECT 1 FROM claim n
                      WHERE n.supersedes = c.id AND n.first_seen_at <= ev.t)
    ORDER BY c.subject_id, belief(c.id, ev.t) DESC
  ),
  owner_loss AS (
    SELECT o.src_id AS company_id, p.via_id AS product_id, h.days,
           h.loss * coalesce((o.attrs->>'stake_pct')::numeric, 100) / 100 AS loss,
           least(h.days, coalesce((p.attrs->>'substitutable_days')::numeric,
                                  (prm.j->>'default_substitute_days')::numeric)) AS gap,
           h.loss * (p.attrs->>'global_share_pct')::numeric / 100 AS world_short,
           h.belief * o.confidence * p.confidence AS conf,
           h.name AS facility
    FROM hit h
    JOIN lk p ON p.src_id = h.facility_id AND p.rel = 'produces'
    JOIN lk o ON o.dst_id = h.facility_id AND o.rel = 'owns'
    CROSS JOIN prm
  ),

  chain AS (
    SELECT ol.company_id, ol.product_id, ol.loss, ol.days::numeric AS days, ol.conf::numeric AS conf, 0 AS hops,
           ARRAY[ol.company_id] AS seen,
           ol.facility || ' (' || round(ol.loss * 100) || '% for ' || ol.days || 'd)' AS path,
           ol.gap::numeric AS downstream_gap
    FROM owner_loss ol
    UNION ALL
    SELECT s.dst_id, q.dst_id,
           c.loss * dep.v * crit.v,
           felt.v,
           (c.conf * s.confidence
             * CASE WHEN s.attrs ? 'pct_of_customer_input' OR (s.attrs->>'single_source')::boolean
                    THEN 1 ELSE (prm.j->>'unknown_penalty')::numeric END
             * CASE WHEN s.attrs ? 'buffer_days' THEN 1 ELSE (prm.j->>'unknown_penalty')::numeric END)::numeric,
           c.hops + 1,
           c.seen || s.dst_id,
           c.path || ' -> ' || pi.name || ' -> ' || co.name
             || ' (short ' || round(c.loss * dep.v * 100) || '%, buffer ' || buf.v
             || 'd, felt ' || felt.v || 'd, ' || (q.attrs->>'criticality') || ' for ' || po.name || ')',
           felt.v
    FROM chain c
    CROSS JOIN prm
    JOIN lk s       ON s.src_id = c.company_id AND s.via_id = c.product_id AND s.rel = 'supplies'
    JOIN lk q       ON q.src_id = c.product_id AND q.rel = 'input_of'
    JOIN makes m    ON m.company_id = s.dst_id AND m.product_id = q.dst_id
    JOIN entity co  ON co.id = s.dst_id
    JOIN entity pi  ON pi.id = c.product_id
    JOIN entity po  ON po.id = q.dst_id
    CROSS JOIN LATERAL (SELECT CASE
                          WHEN s.attrs ? 'pct_of_customer_input' THEN (s.attrs->>'pct_of_customer_input')::numeric / 100
                          WHEN (s.attrs->>'single_source')::boolean THEN 1
                          ELSE (prm.j->>'default_dependence')::numeric END AS v) dep
    CROSS JOIN LATERAL (SELECT (prm.j->>('crit_' || (q.attrs->>'criticality')))::numeric AS v) crit
    CROSS JOIN LATERAL (SELECT coalesce((s.attrs->>'buffer_days')::numeric,
                                        (prm.j->>'default_buffer_days')::numeric) AS v) buf
    CROSS JOIN LATERAL (SELECT greatest(0, c.downstream_gap - buf.v) AS v) felt
    WHERE c.hops < (prm.j->>'max_hops')::int
      AND NOT s.dst_id = ANY (c.seen)
      AND c.loss * c.days >= (prm.j->>'min_impact')::numeric
  ),

  -- Disruptions already running elsewhere at t, from ANY event: a competitor that is down itself can't fill a gap.
  -- (Learned from case 1: rivals' Austin fabs were still out from a storm a month earlier.)
  down_now AS (
    SELECT o.src_id AS company_id, p.via_id AS product_id,
           max(c.magnitude / 100 * belief(c.id, ev.t)) AS loss
    FROM claim c
    JOIN event e2 ON e2.id = c.event_id
    CROSS JOIN ev CROSS JOIN prm
    JOIN lk o ON o.dst_id = c.subject_id AND o.rel = 'owns'
    JOIN lk p ON p.src_id = c.subject_id AND p.rel = 'produces'
    WHERE c.change = 'capacity_loss' AND c.first_seen_at <= ev.t AND e2.id <> ev.id
      AND e2.occurred_at + make_interval(days => coalesce(c.duration_days,
                                                          (prm.j->>'default_outage_days')::int)) > ev.t
      AND NOT EXISTS (SELECT 1 FROM claim n WHERE n.supersedes = c.id AND n.first_seen_at <= ev.t)
    GROUP BY 1, 2
  ),

  -- ───── mechanism: governance ─────
  -- Leaving: impact on the company = -(role weight x surprise x leader's record THERE x departure scale).
  --          A strong leader leaving hurts; a weak one leaving helps.
  -- Arriving: impact = +(role weight x surprise x leader's record ELSEWHERE x appointment scale). No record = no call.
  -- Implied: someone who currently leads X being appointed at Y means X is losing them, even before X says so.
  -- Record = tanh(yearly excess return during tenure / track_scale): close to +1 strong, -1 weak.
  -- Impact unit: % abnormal return.
  gp AS (SELECT jsonb_object_agg(r.key, r.value) AS j FROM rule_param r WHERE r.mechanism = 'governance'),
  record AS (                        -- every tenure known at t, past ones included: a record follows the person
    SELECT DISTINCT ON (l.src_id, l.dst_id) l.src_id AS person_id, l.dst_id AS company_id, l.confidence,
           tanh((l.attrs->>'tenure_excess_return_pct_ann')::numeric / (gp.j->>'track_scale_pct')::numeric)::numeric AS r,
           (l.valid_to IS NULL OR l.valid_to > ev.occurred_at::date) AS current
    FROM link l, ev, gp
    WHERE l.rel = 'leads' AND l.attrs ? 'tenure_excess_return_pct_ann' AND l.known_at <= ev.t
    ORDER BY l.src_id, l.dst_id, l.known_at DESC
  ),
  gov AS (
    SELECT c.*, belief(c.id, ev.t) AS belief,
           coalesce((gp.j->>('role_' || lower(c.attrs->>'role')))::numeric, (gp.j->>'role_other')::numeric)
             * CASE WHEN (c.attrs->>'planned')::boolean THEN (gp.j->>'planned_surprise')::numeric ELSE 1 END AS weight
    FROM claim c JOIN ev ON c.event_id = ev.id CROSS JOIN gp
    WHERE c.change IN ('leader_departed', 'leader_appointed') AND c.first_seen_at <= ev.t
      AND NOT EXISTS (SELECT 1 FROM claim n WHERE n.supersedes = c.id AND n.first_seen_at <= ev.t)
  ),
  gov_calls AS (
    SELECT g.subject_id AS company_id,
           -(g.weight * rc.r * (gp.j->>'departure_scale_pct')::numeric) AS signed,
           g.belief * rc.confidence AS conf,
           p.name || ' leaves ' || co.name || ' (' || (g.attrs->>'role') || ', record there '
             || round(rc.r, 2) || CASE WHEN (g.attrs->>'planned')::boolean THEN ', planned' ELSE ', abrupt' END || ')' AS path
    FROM gov g CROSS JOIN gp
    JOIN record rc ON rc.person_id = g.object_id AND rc.company_id = g.subject_id
    JOIN entity p  ON p.id = g.object_id
    JOIN entity co ON co.id = g.subject_id
    WHERE g.change = 'leader_departed'
    UNION ALL
    SELECT g.subject_id,
           g.weight * best.r * (gp.j->>'appointment_scale_pct')::numeric,
           g.belief * best.confidence,
           p.name || ' joins ' || co.name || ' (' || (g.attrs->>'role') || ', record at '
             || best.prev || ' ' || round(best.r, 2) || ')'
    FROM gov g CROSS JOIN gp
    JOIN entity p  ON p.id = g.object_id
    JOIN entity co ON co.id = g.subject_id
    CROSS JOIN LATERAL (SELECT rc.r, rc.confidence, e.name AS prev FROM record rc JOIN entity e ON e.id = rc.company_id
                        WHERE rc.person_id = g.object_id AND rc.company_id <> g.subject_id
                        ORDER BY abs(rc.r) DESC LIMIT 1) best
    WHERE g.change = 'leader_appointed'
    UNION ALL
    SELECT rc.company_id,
           -(g.weight * rc.r * (gp.j->>'departure_scale_pct')::numeric),
           g.belief * rc.confidence * 0.9,
           p.name || ' joins ' || co.name || ' => implies leaving ' || old.name || ' (record there ' || round(rc.r, 2) || ')'
    FROM gov g CROSS JOIN gp
    JOIN record rc ON rc.person_id = g.object_id AND rc.company_id <> g.subject_id AND rc.current
    JOIN entity p   ON p.id = g.object_id
    JOIN entity co  ON co.id = g.subject_id
    JOIN entity old ON old.id = rc.company_id
    WHERE g.change = 'leader_appointed'
      AND NOT EXISTS (SELECT 1 FROM gov d WHERE d.change = 'leader_departed'   -- once X confirms, use X's own claim
                      AND d.object_id = g.object_id AND d.subject_id = rc.company_id)
  ),

  -- ───── mechanism: policy (export restrictions) ─────
  -- Restriction: issuer bans selling product P into target country T (claim subject = T, object = P, attrs.issuer).
  -- Exposed: companies in the issuer's country that make P and sell into T.
  --   revenue at risk = their own guidance if published by t, else pct of revenue in T x restricted share of it.
  --   impact = -(revenue at risk x revenue_to_price).
  -- Rivals outside the issuer's reach: + (capture x the exposed rival's revenue at risk x revenue_to_price).
  -- Impact unit: % abnormal return.
  pp AS (SELECT jsonb_object_agg(r.key, r.value) AS j FROM rule_param r WHERE r.mechanism = 'policy'),
  pol AS (
    SELECT DISTINCT ON (c.subject_id, c.object_id) c.*, belief(c.id, ev.t) AS belief
    FROM claim c JOIN ev ON c.event_id = ev.id
    WHERE c.change = 'export_restricted' AND c.first_seen_at <= ev.t
      AND NOT EXISTS (SELECT 1 FROM claim n WHERE n.supersedes = c.id AND n.first_seen_at <= ev.t)
    ORDER BY c.subject_id, c.object_id, belief(c.id, ev.t) DESC
  ),
  guidance AS (                      -- the company's own number for this restriction, latest visible at t;
                                     -- else the best-believed analyst estimate of revenue at risk
    SELECT DISTINCT ON (company_id) company_id, at_risk, belief, who FROM (
      SELECT c.subject_id AS company_id, c.magnitude / 100 AS at_risk, belief(c.id, ev.t) AS belief, 'company' AS who,
             0 AS pref, c.first_seen_at AS seen
      FROM claim c JOIN ev ON c.event_id = ev.id
      WHERE c.change = 'revenue_loss' AND c.first_seen_at <= ev.t
      UNION ALL
      SELECT a.entity_id, a.value_to / 100,
             (SELECT value FROM rule_param WHERE mechanism = 'analyst' AND key = 'estimate_weight')
               * 1 / (1 + exp(-ln((sr.prior_confirmed + 1.0) / (sr.prior_retracted + 1.0)))), sr.name, 1, a.published_at
      FROM analyst_view a JOIN ev ON a.event_id = ev.id JOIN source sr ON sr.id = a.source_id
      WHERE a.kind = 'exposure' AND a.unit = 'pct_revenue' AND a.published_at <= ev.t
    ) g ORDER BY company_id, pref, seen DESC
  ),
  -- Who the rule reaches: the issuer's own companies for sure, and companies in its allies with the chance their
  -- government follows. (Learned from case 3: ASML and Tokyo Electron fell with the US names, and their governments
  -- joined three months later.)
  -- The target can be a COUNTRY (sell product P into T: exposure = sells_in pct_of_revenue) or a COMPANY cut off from
  -- everything (Entity List / SDN: object is null, exposure = supplies pct_of_supplier_revenue). Added for case 5 (Huawei).
  reach AS (
    SELECT pol.subject_id AS target_id, pol.object_id AS product_id, pol.attrs->>'issuer' AS code, 1.0 AS prob, false AS ally
    FROM pol
    UNION ALL
    SELECT pol.subject_id, pol.object_id, ally.country,
           coalesce((al.attrs->>'follow_prob')::numeric, (pp.j->>'allied_follow_prob')::numeric), true
    FROM pol CROSS JOIN pp
    JOIN entity iss  ON iss.kind = 'country' AND iss.country = pol.attrs->>'issuer'
    JOIN lk al       ON al.rel = 'allied_with' AND al.src_id = iss.id
    JOIN entity ally ON ally.id = al.dst_id
  ),
  sales AS (                         -- every company's sales into a target, country or company
    SELECT s.src_id AS company_id, s.dst_id AS target_id, s.rel, s.confidence,
           coalesce((s.attrs->>'pct_of_revenue')::numeric, (s.attrs->>'pct_of_supplier_revenue')::numeric,
                    -- A US filer must name any customer >= 10% of revenue: never named means below that.
                    CASE WHEN (s.attrs->>'undisclosed')::boolean THEN (pp.j->>'undisclosed_customer_pct')::numeric END) AS pct
    FROM lk s CROSS JOIN pp WHERE s.rel IN ('sells_in', 'supplies')
  ),
  peer_pct AS (                      -- when a company's share of sales into the target is unknown, use its peers'
    SELECT pol.subject_id AS target_id, pol.object_id AS product_id, avg(sa.pct) AS pct
    FROM pol JOIN sales sa ON sa.target_id = pol.subject_id AND sa.pct IS NOT NULL
    WHERE pol.object_id IS NULL
       OR EXISTS (SELECT 1 FROM lk pr WHERE pr.src_id = sa.company_id AND pr.rel = 'produces' AND pr.via_id = pol.object_id)
    GROUP BY 1, 2
  ),
  exposed AS (
    SELECT co.id AS company_id, co.name, pol.subject_id AS target_id, pol.object_id AS product_id,
           pol.attrs->>'issuer' AS issuer, rc.prob, rc.ally, rc.demand,
           rc.prob * coalesce(g.at_risk, coalesce(sa.pct, pk.pct) / 100
                    * coalesce((pr.attrs->>'restricted_share')::numeric, (pol.attrs->>'restricted_share')::numeric,
                               CASE WHEN pol.object_id IS NULL THEN (pp.j->>'entity_ban_restricted_share')::numeric
                                    ELSE (pp.j->>'default_restricted_share')::numeric END)) AS at_risk,
           g.at_risk IS NOT NULL AS from_guidance, g.who,
           round(coalesce(sa.pct, pk.pct), 1) AS pct_in_target,
           sa.pct IS NULL AS pct_from_peers,
           coalesce(g.belief, pol.belief) * sa.confidence
             * CASE WHEN g.at_risk IS NULL AND pol.object_id IS NOT NULL AND NOT pr.attrs ? 'restricted_share' THEN 0.7 ELSE 1 END
             * CASE WHEN sa.pct IS NOT NULL OR g.at_risk IS NOT NULL THEN 1 ELSE 0.7 END AS conf
    FROM pol CROSS JOIN pp
    JOIN sales sa   ON sa.target_id = pol.subject_id
    JOIN entity co  ON co.id = sa.company_id
    -- Who loses: anyone the rule (or an ally) reaches; and, when the target is a company, ANY of its suppliers, because
    -- a company cut off from its inputs sells less and buys less from everyone (case 5: Sunny Optical, TDK, Taiyo
    -- Yuden fell on Huawei's demand, not on any ban of their own).
    JOIN LATERAL (
      SELECT r.prob, r.ally, false AS demand FROM reach r
      WHERE r.target_id = pol.subject_id AND r.product_id IS NOT DISTINCT FROM pol.object_id AND r.code = co.country
      UNION ALL
      SELECT (pp.j->>'target_demand_drop')::numeric, false, true
      WHERE pol.object_id IS NULL
      ORDER BY 1 DESC LIMIT 1
    ) rc ON true
    LEFT JOIN lk pr ON pr.src_id = co.id AND pr.rel = 'produces' AND pr.via_id = pol.object_id
    LEFT JOIN peer_pct pk ON pk.target_id = pol.subject_id AND pk.product_id IS NOT DISTINCT FROM pol.object_id
    LEFT JOIN guidance g  ON g.company_id = co.id
    WHERE pol.object_id IS NULL OR pr.src_id IS NOT NULL
  ),
  pol_calls AS (
    SELECT x.company_id, -(x.at_risk * 100 * (pp.j->>'revenue_to_price')::numeric) AS signed, x.conf,
           x.issuer || ' restricts ' || coalesce(p.name, 'all its items') || ' to ' || t.name || ' -> ' || x.name
             || CASE WHEN x.demand THEN ' (outside the rule; ' || t.name || ' buys ~' || round(x.prob * 100) || '% less)'
                     WHEN x.ally THEN ' (ally: ' || round(x.prob * 100) || '% chance its government follows)' ELSE '' END
             || CASE WHEN x.from_guidance THEN ' (' || x.who || ') ' || round(x.at_risk * 100, 1) || '% of revenue at risk'
                     ELSE ' sells ' || x.pct_in_target || '% of revenue there'
                          || CASE WHEN x.pct_from_peers THEN ' (peers'' average)' ELSE '' END
                          || ' -> ~' || round(x.at_risk * 100, 1) || '% at risk' END
             AS path
    FROM exposed x CROSS JOIN pp LEFT JOIN entity p ON p.id = x.product_id JOIN entity t ON t.id = x.target_id
    UNION ALL
    SELECT * FROM (
      SELECT DISTINCT ON (r.id) r.id,
             x.at_risk * 100 * (pp.j->>'non_issuer_capture')::numeric * (pp.j->>'revenue_to_price')::numeric,
             x.conf * 0.5,
             x.issuer || ' restricts ' || p.name || ' to ' || t.name || ' -> ' || r.name
               || ' (outside the rule) could take ' || x.name || '''s lost sales'
      FROM exposed x CROSS JOIN pp
      JOIN lk cp     ON cp.rel = 'competes' AND cp.src_id = x.company_id
      JOIN entity r  ON r.id = cp.dst_id
      JOIN lk rs     ON rs.rel = 'sells_in' AND rs.src_id = r.id AND rs.dst_id = x.target_id
      JOIN entity p  ON p.id = x.product_id JOIN entity t ON t.id = x.target_id
      WHERE NOT x.ally                -- only the issuer's own firms lose share to outsiders...
        AND NOT EXISTS (SELECT 1 FROM next_in_line nl WHERE nl.company_id = r.id)   -- ...not to ones that are next
        AND NOT EXISTS (SELECT 1 FROM reach rc   -- ...and only to rivals the rule (or an ally) can't reach
                        WHERE rc.target_id = x.target_id AND rc.product_id IS NOT DISTINCT FROM x.product_id AND rc.code = r.country)
      ORDER BY r.id, x.at_risk DESC
    ) rivals
    UNION ALL
    -- A company cut off from its suppliers loses customers to its own rivals.
    SELECT r.id, (pp.j->>'target_rival_gain_pct')::numeric, pol.belief * cp.confidence * 0.5,
           pol.attrs->>'issuer' || ' cuts ' || t.name || ' off from its suppliers -> rival ' || r.name || ' can win its customers'
    FROM pol CROSS JOIN pp
    JOIN entity t  ON t.id = pol.subject_id AND t.kind = 'company'
    JOIN lk cp     ON cp.rel = 'competes' AND cp.src_id = t.id
    JOIN entity r  ON r.id = cp.dst_id
    WHERE pol.object_id IS NULL AND r.country IS DISTINCT FROM pol.attrs->>'issuer'
      -- Not a rival from the target's own country: the market reads it as next in line, not as a winner
      -- (case 5: ZTE fell 13% when Huawei was cut off). Whether it should be called DOWN waits for a second case.
      AND r.country IS DISTINCT FROM t.country
  ),

  -- ───── policy: one step up the chain, and who is next in line ─────
  -- UPSTREAM: a supplier S of an exposed company X loses (S's revenue share from X) x (X's revenue at risk).
  --   (Cases 3 and 5: the toolmakers' parts suppliers fell 6-10%; Fabrinet fell 17% without selling to Huawei.)
  -- NEXT IN LINE: a company in the target's country that still depends on the issuer's inputs is hit too: the market
  --   prices it being cut off next. One already cut off does not depend on them any more, and can gain as a substitute.
  --   (Cases 3, 5, 8: AMEC/Naura -17 to -23%, ZTE -13% and Xiaomi -2% fell; blacklisted Cambricon rose 9%.)
  pol_up AS (
    SELECT su.src_id AS company_id, x.company_id AS customer_id, x.name AS customer, x.issuer, x.target_id,
           (su.attrs->>'pct_of_supplier_revenue')::numeric AS pct, x.at_risk,
           (su.attrs->>'pct_of_supplier_revenue')::numeric / 100 * x.at_risk AS up_risk, x.conf * su.confidence AS conf
    FROM exposed x
    JOIN lk su ON su.rel = 'supplies' AND su.dst_id = x.company_id AND su.attrs ? 'pct_of_supplier_revenue'
    WHERE NOT EXISTS (SELECT 1 FROM exposed x2 WHERE x2.company_id = su.src_id)
  ),
  next_in_line AS (
    SELECT DISTINCT ON (c.id) c.id AS company_id, c.name, pol.attrs->>'issuer' AS issuer, t.name AS target,
           coalesce((d.attrs->>'dependence')::numeric, 0.5) AS dependence, pol.belief * d.confidence AS conf
    FROM pol
    JOIN entity t   ON t.id = pol.subject_id
    JOIN entity iss ON iss.kind = 'country' AND iss.country = pol.attrs->>'issuer'
    JOIN entity c   ON c.country = t.country AND c.kind = 'company' AND c.id <> t.id
    JOIN lk d       ON d.rel = 'depends_on' AND d.src_id = c.id AND d.dst_id = iss.id
    ORDER BY c.id
  ),

  -- ───── policy: sanctions on a company (SDN) ─────
  -- A sanction changes how much of the target's output can still reach buyers: claim attrs offtake_loss (new) and
  -- prev_offtake_loss (before; 0 for a new sanction). An easing is the same claim with a lower offtake_loss.
  -- With delta = new - prev:
  --   TARGET      moves -(sdn_target_hit_pct x delta / sdn_offtake_loss)
  --   COMMODITY   world short by (target's global share x delta) -> price moves by shortfall x commodity_price_per_shortfall
  --   PRODUCERS   of that commodity outside the sanction move with the price, by their revenue share in it
  --   ASSOCIATES  companies the target owns a big stake in are feared next: -(sdn_associate_hit_pct x stake x delta / base)
  --   HOLDERS     of the target lose their stake's share of the target's move
  sdn AS (
    SELECT DISTINCT ON (c.subject_id) c.*, belief(c.id, ev.t) AS belief,
           coalesce((c.attrs->>'offtake_loss')::numeric, (pp.j->>'sdn_offtake_loss')::numeric)
             - coalesce((c.attrs->>'prev_offtake_loss')::numeric, 0) AS delta
    FROM claim c JOIN ev ON c.event_id = ev.id CROSS JOIN pp
    WHERE c.change IN ('sanctioned', 'sanction_eased') AND c.first_seen_at <= ev.t
      AND NOT EXISTS (SELECT 1 FROM claim n WHERE n.supersedes = c.id AND n.first_seen_at <= ev.t)
    ORDER BY c.subject_id, c.first_seen_at DESC
  ),
  sdn_price AS (                     -- the commodity price move each sanction implies
    SELECT z.id AS claim_id, z.subject_id, p.via_id AS commodity_id, z.delta, z.belief,
           (p.attrs->>'global_share_pct')::numeric * z.delta * (pp.j->>'commodity_price_per_shortfall')::numeric AS price_pct
    FROM sdn z CROSS JOIN pp JOIN lk p ON p.src_id = z.subject_id AND p.rel = 'produces' AND p.attrs ? 'global_share_pct'
  ),
  sdn_calls AS (
    SELECT z.subject_id AS company_id,
           -(pp.j->>'sdn_target_hit_pct')::numeric * z.delta / (pp.j->>'sdn_offtake_loss')::numeric AS signed, z.belief AS conf,
           (z.attrs->>'issuer') || CASE WHEN z.delta >= 0 THEN ' sanctions ' ELSE ' eases sanctions on ' END || t.name
             || ' (output that can''t reach buyers ' || round(coalesce((z.attrs->>'prev_offtake_loss')::numeric, 0) * 100)
             || '% -> ' || round((z.delta + coalesce((z.attrs->>'prev_offtake_loss')::numeric, 0)) * 100) || '%)' AS path
    FROM sdn z CROSS JOIN pp JOIN entity t ON t.id = z.subject_id
    UNION ALL
    SELECT pr.src_id,
           sp.price_pct * (pp.j->>'producer_price_leverage')::numeric
             * coalesce((pr.attrs->>'pct_revenue_from_commodity')::numeric / 100, (pp.j->>'default_commodity_revenue_share')::numeric),
           sp.belief * pr.confidence
             * CASE WHEN pr.attrs ? 'pct_revenue_from_commodity' THEN 1 ELSE 0.7 END,
           t.name || ' sanction moves ' || c.name || ' ' || CASE WHEN sp.price_pct >= 0 THEN '+' ELSE '' END
             || round(sp.price_pct, 1) || '% -> producer ' || p.name
             || coalesce(' (' || (pr.attrs->>'pct_revenue_from_commodity') || '% of revenue)', ' (revenue share assumed)')
    FROM sdn_price sp CROSS JOIN pp
    JOIN lk pr      ON pr.rel = 'produces' AND pr.via_id = sp.commodity_id AND pr.src_id <> sp.subject_id
    JOIN entity p   ON p.id = pr.src_id
    JOIN entity t   ON t.id = sp.subject_id
    JOIN entity c   ON c.id = sp.commodity_id
    WHERE NOT EXISTS (SELECT 1 FROM sdn z2 WHERE z2.subject_id = pr.src_id)        -- itself sanctioned: no gain
    UNION ALL
    SELECT o.dst_id,
           -(pp.j->>'sdn_associate_hit_pct')::numeric * (o.attrs->>'stake_pct')::numeric / 100
             * z.delta / (pp.j->>'sdn_offtake_loss')::numeric,
           z.belief * o.confidence * 0.7,
           t.name || ' owns ' || (o.attrs->>'stake_pct') || '% of ' || a.name || ': feared next'
    FROM sdn z CROSS JOIN pp
    JOIN lk o      ON o.src_id = z.subject_id AND o.rel = 'owns' AND (o.attrs->>'stake_pct')::numeric >= 20
    JOIN entity a  ON a.id = o.dst_id AND a.kind = 'company'
    JOIN entity t  ON t.id = z.subject_id
    WHERE NOT EXISTS (SELECT 1 FROM sdn z2 WHERE z2.subject_id = o.dst_id)
    UNION ALL
    SELECT h.src_id,
           -(pp.j->>'sdn_target_hit_pct')::numeric * z.delta / (pp.j->>'sdn_offtake_loss')::numeric
             * (h.attrs->>'pct_of_holder_value')::numeric / 100,
           z.belief * h.confidence,
           h2.name || ' holds ' || t.name || ' (' || (h.attrs->>'pct_of_holder_value') || '% of its own value)'
    FROM sdn z CROSS JOIN pp
    JOIN lk h       ON h.dst_id = z.subject_id AND h.rel IN ('holds', 'owns') AND h.attrs ? 'pct_of_holder_value'
    JOIN entity h2  ON h2.id = h.src_id
    JOIN entity t   ON t.id = z.subject_id
    WHERE NOT EXISTS (SELECT 1 FROM sdn z2 WHERE z2.subject_id = h.src_id)
  ),

  -- ───── mechanism: financial (bank runs) ─────
  -- A run (claim change 'bank_run' on the failing bank, attrs.base = its depositor base, attrs.severity 0..1) reprices
  -- every bank b whose balance sheet we hold as of t (entity_fact, dated by filing):
  --   run chance  P = uninsured share x (1 + overlap x share of b's deposits in the same base) x severity x run_prob_scale
  --                   (x gsib_damp for a too-big-to-fail bank; the failing bank itself: P = uninsured share x severity)
  --   damage      L = min(1, unrealised HTM losses / tangible equity + franchise_loss)
  --   move        -100 x P x L, the worst trigger per bank.
  -- A backstop (claim 'backstop') removes backstop_relief of every bank's run chance: shareholders still bear the rest.
  -- Impact unit: % abnormal return.
  fp AS (SELECT jsonb_object_agg(r.key, r.value) AS j FROM rule_param r WHERE r.mechanism = 'financial'),
  bank AS (
    SELECT f.entity_id,
           max(f.value) FILTER (WHERE f.metric = 'uninsured_deposit_share') AS unins,
           max(f.value) FILTER (WHERE f.metric = 'htm_loss_to_tce') AS htm,
           max(f.value) FILTER (WHERE f.metric = 'deposit_base_tech_vc') AS tech_vc,
           max(f.value) FILTER (WHERE f.metric = 'deposit_base_crypto') AS crypto,
           coalesce(bool_or(f.metric = 'gsib' AND f.value = 1), false) AS gsib
    FROM (SELECT DISTINCT ON (entity_id, metric) * FROM entity_fact, ev WHERE known_at <= ev.t
          ORDER BY entity_id, metric, known_at DESC) f
    GROUP BY f.entity_id HAVING max(f.value) FILTER (WHERE f.metric = 'uninsured_deposit_share') IS NOT NULL
  ),
  run_trig AS (
    SELECT c.*, belief(c.id, ev.t) AS belief, coalesce((c.attrs->>'severity')::numeric, 1) AS severity
    FROM claim c JOIN ev ON c.event_id = ev.id
    WHERE c.change = 'bank_run' AND c.first_seen_at <= ev.t
  ),
  backstop AS (
    SELECT max(belief(c.id, ev.t)) AS belief FROM claim c JOIN ev ON c.event_id = ev.id
    WHERE c.change = 'backstop' AND c.first_seen_at <= ev.t
  ),
  fin_calls AS (
    SELECT DISTINCT ON (b.entity_id) b.entity_id AS company_id,
           -100 * p.prob * least(1, coalesce(b.htm, 0) + (fp.j->>'franchise_loss')::numeric) AS signed,
           r.belief * 0.8 AS conf,
           CASE WHEN b.entity_id = r.subject_id THEN e.name || ': run under way'
                ELSE t.name || ' run (' || (r.attrs->>'base') || ' depositors) -> ' || e.name END
             || ' (uninsured ' || round(b.unins * 100) || '%'
             || CASE WHEN p.overlap > 0 THEN ', ' || round(p.overlap * 100) || '% same depositor base' ELSE '' END
             || ', HTM loss ' || round(coalesce(b.htm, 0) * 100) || '% of tangible equity'
             || CASE WHEN b.gsib THEN ', too big to fail' ELSE '' END || ')' AS path,
           p.prob AS prob, least(1, coalesce(b.htm, 0) + (fp.j->>'franchise_loss')::numeric) AS dmg
    FROM bank b CROSS JOIN fp
    CROSS JOIN run_trig r
    JOIN entity e ON e.id = b.entity_id
    JOIN entity t ON t.id = r.subject_id
    CROSS JOIN LATERAL (SELECT CASE r.attrs->>'base' WHEN 'tech_vc' THEN coalesce(b.tech_vc, 0)
                                                     WHEN 'crypto' THEN coalesce(b.crypto, 0) ELSE 0 END AS overlap) o
    CROSS JOIN LATERAL (SELECT o.overlap,
      CASE WHEN b.entity_id = r.subject_id THEN b.unins * r.severity
           ELSE b.unins * (1 + (fp.j->>'base_overlap_mult')::numeric * o.overlap) * r.severity
                * (fp.j->>'run_prob_scale')::numeric * CASE WHEN b.gsib THEN (fp.j->>'gsib_damp')::numeric ELSE 1 END
      END AS prob) p
    ORDER BY b.entity_id, p.prob * least(1, coalesce(b.htm, 0) + 0.3) DESC
  ),
  fin_backstop AS (                  -- a backstop with no new run: banks recover part of what the run chance priced
    SELECT b.entity_id AS company_id,
           100 * (fp.j->>'backstop_relief')::numeric * b.unins * (fp.j->>'run_prob_scale')::numeric
             * CASE WHEN b.gsib THEN (fp.j->>'gsib_damp')::numeric ELSE 1 END
             * least(1, coalesce(b.htm, 0) + (fp.j->>'franchise_loss')::numeric) AS signed,
           bs.belief * 0.8 AS conf,
           'Depositor backstop -> ' || e.name || ' run chance cut by ' || round((fp.j->>'backstop_relief')::numeric * 100) || '%' AS path
    FROM bank b CROSS JOIN fp CROSS JOIN backstop bs JOIN entity e ON e.id = b.entity_id
    WHERE bs.belief IS NOT NULL
  ),

  -- ───── mechanism: driver (markets price the surprise) ─────
  -- A claim moves a driver by its SURPRISE, the part the market did not already expect:
  --   'driver_move'        the driver moves by magnitude (odds points for an outcome, % for a price, points for a policy-rate surprise): e.g. an election
  --                        resolves an outcome priced at 23.5% -> +76.5 points
  --   'earnings_surprise'  a company reports vs consensus: its own move = earnings_elasticity x (actual/consensus - 1)
  -- Every stock with a measured priced_on link to the driver (|t| >= min_t, known by t) moves beta x driver move.
  dp AS (SELECT jsonb_object_agg(r.key, r.value) AS j FROM rule_param r WHERE r.mechanism = 'driver'),
  drv AS (
    SELECT DISTINCT ON (c.subject_id) c.id, c.subject_id, c.change, c.attrs, belief(c.id, ev.t) AS belief,
           CASE WHEN c.change = 'earnings_surprise' THEN 'earnings' WHEN c.attrs->>'unit' = 'points' THEN 'odds'
                WHEN c.attrs->>'unit' = 'rate_points' THEN 'rate' ELSE 'price' END AS cls,
           coalesce(c.attrs->>'cause', 'any') AS cause,
           CASE c.change WHEN 'driver_move' THEN c.magnitude
                -- a revenue miss is priced as the profit miss it causes: x operating leverage (gross / operating margin)
                ELSE (dp.j->>'earnings_elasticity')::numeric * 100 * coalesce((c.attrs->>'operating_leverage')::numeric, 1)
                     * ((c.attrs->>'actual')::numeric / (c.attrs->>'consensus')::numeric - 1) END AS move,
           CASE c.change WHEN 'driver_move' THEN coalesce(c.attrs->>'why', 'driver moves')
                ELSE (c.attrs->>'metric') || ' ' || (c.attrs->>'actual') || ' vs consensus ' || (c.attrs->>'consensus')
                     || coalesce(' x operating leverage ' || (c.attrs->>'operating_leverage'), '') END AS why
    FROM claim c JOIN ev ON c.event_id = ev.id CROSS JOIN dp
    WHERE c.change IN ('driver_move', 'earnings_surprise') AND c.first_seen_at <= ev.t
      AND NOT EXISTS (SELECT 1 FROM claim n WHERE n.supersedes = c.id AND n.first_seen_at <= ev.t)
    ORDER BY c.subject_id, c.first_seen_at DESC
  ),
  chan AS (                          -- channels the event's kind implies that no claim has measured: priors, half confidence.
    SELECT NULL::bigint AS id, s.entity_id AS subject_id, 'driver_move'::text AS change, '{"unit": "pct"}'::jsonb AS attrs,
           (dp.j->>'channel_conf')::numeric AS belief, 'channel'::text AS cls, cr.cause, pr.move,
           ev.kind || ' usually moves ' || cr.ticker || ' ' || CASE WHEN pr.move >= 0 THEN '+' ELSE '' END
             || pr.move || '% (' || cr.rationale || '; median of ' || pr.n || ' past cases)' AS why
    FROM channel_rule cr JOIN ev ON cr.event_kind = ev.kind CROSS JOIN dp
    JOIN security s ON s.ticker = cr.ticker AND s.exchange = cr.exchange
    CROSS JOIN LATERAL (             -- the event being predicted never tunes its own prior
      SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY o.m)::numeric, 1) AS move, count(*) AS n
      FROM unnest(cr.obs_on, cr.obs_move) o(d, m) WHERE abs(o.d - ev.occurred_at::date) > 7) pr
    WHERE NOT EXISTS (SELECT 1 FROM drv d WHERE d.subject_id = s.entity_id) AND pr.n > 0
  ),
  -- Each driver class carries a size correction learned across cases by tune_driver() (1 until >= 3 cases agree); the
  -- path shows it, so the tuner can undo it when it refits.
  drv_all AS (SELECT d.*, coalesce((dp.j->>('scale_' || d.cls))::numeric, 1) AS sc
              FROM (SELECT * FROM drv UNION ALL SELECT * FROM chan) d CROSS JOIN dp),
  -- WHY each company depends on each driver, for the cause at hand (a supply cut and a demand boom both lift oil, and
  -- move airlines' demand, refiners' margins and cruise bookings differently). No reason, no call.
  why_exposed AS (
    SELECT d.subject_id AS driver_id, x.src_id AS company_id, sum((x.attrs->>'elasticity')::numeric) AS el,
           string_agg((x.attrs->>'channel') || ': ' || (x.attrs->>'why'), '; ') AS why
    FROM drv_all d CROSS JOIN ev        -- every reason counts: lk keeps one link per pair, a company can have several
    JOIN link x ON x.dst_id = d.subject_id AND x.rel = 'exposed_to' AND x.known_at <= ev.t
    WHERE x.attrs->'when' ? 'any' OR x.attrs->'when' ? d.cause
       OR (x.attrs->'when' ? 'supply' AND d.cause IN ('route_risk', 'crude_outage'))   -- both are supply shocks
    GROUP BY 1, 2
  ),
  drv_each AS (
    SELECT d.subject_id AS company_id, d.move * d.sc AS signed, d.belief AS conf,
           d.why || ' -> own move ' || round(d.move, 1) || '% (earnings elasticity ' || (dp.j->>'earnings_elasticity') || ')'
             || ' [scale ' || d.cls || ' ' || d.sc || ']' AS path
    FROM drv_all d CROSS JOIN dp WHERE d.change = 'earnings_surprise'
    UNION ALL
    SELECT c.subject_id, c.move * c.sc, c.belief, c.why || ' [scale ' || c.cls || ' ' || c.sc || ']'
    FROM drv_all c WHERE c.cls = 'channel'                           -- the channel's own instrument (ITA, gold) moves too
    UNION ALL
    -- The reason sets the direction. The measured beta is the safety check: agreeing, its (measured) size is used;
    -- silent (too little history, t below the bar), the reason's prior size at lower confidence; disagreeing, the call
    -- stands on its reason but is flagged and down-weighted: prices learned something else in that window.
    SELECT w.company_id,
           CASE WHEN chk.agree THEN (dp.j->>'check_weight')::numeric * chk.beta + (1 - (dp.j->>'check_weight')::numeric) * w.el
                ELSE w.el END * d.move * d.sc,
           d.belief * CASE WHEN chk.agree THEN least(1, abs(chk.t) / (dp.j->>'t_full')::numeric)
                           WHEN chk.agree IS NULL THEN (dp.j->>'conf_no_check')::numeric
                           ELSE (dp.j->>'conf_check_fails')::numeric END,
           d.why || ' -> ' || x.name || ' ' || CASE WHEN d.move >= 0 THEN '+' ELSE '' END || round(d.move, 1)
             || CASE WHEN d.attrs->>'unit' IN ('points', 'rate_points') THEN ' pts' ELSE '%' END
             || ' -> ' || e.name || ' (' || w.why || ')'
             || CASE WHEN chk.agree THEN ' | check OK: has moved ' || chk.beta
                       || CASE WHEN d.attrs->>'unit' = 'points' THEN '% per point' ELSE '% per 1%' END || ' with it (t ' || chk.t || ')'
                     WHEN chk.agree IS NULL THEN ' | no price check: prior ' || round(w.el, 4)
                       || CASE WHEN d.attrs->>'unit' IN ('points', 'rate_points') THEN '% per point' ELSE '% per 1%' END
                     ELSE ' | CHECK FAILS: prices moved the other way (beta ' || chk.beta || ', t ' || chk.t || ')' END
             || ' [scale ' || d.cls || ' ' || d.sc || ']'
    FROM why_exposed w CROSS JOIN dp
    JOIN drv_all d ON d.subject_id = w.driver_id
    JOIN entity e  ON e.id = w.company_id
    JOIN entity x  ON x.id = d.subject_id
    LEFT JOIN LATERAL (
      SELECT (pl.attrs->>'beta')::numeric AS beta, (pl.attrs->>'tstat')::numeric AS t,
             sign((pl.attrs->>'beta')::numeric) = sign(w.el) AS agree
      FROM lk pl WHERE pl.src_id = w.company_id AND pl.dst_id = d.subject_id AND pl.rel = 'priced_on'
        AND abs((pl.attrs->>'tstat')::numeric) >= (dp.j->>'min_t')::numeric) chk ON true
    WHERE w.el <> 0 AND NOT EXISTS (SELECT 1 FROM drv_all o WHERE o.subject_id = w.company_id)
  ),
  drv_calls AS (                     -- one channel per stock, its strongest: oil, defense and fear land on the same day,
    SELECT DISTINCT ON (company_id) * -- so adding them would count one reaction two or three times
    FROM drv_each ORDER BY company_id, abs(signed) * conf DESC
  ),
  calls AS (
    SELECT dc.company_id, sign(dc.signed)::int AS direction, 0 AS hops, abs(dc.signed) AS impact, dc.conf, dc.path,
           'driver' AS mech
    FROM drv_calls dc
    UNION ALL
    SELECT pc.company_id, sign(pc.signed)::int, 0, abs(pc.signed), pc.conf, pc.path, 'policy'
    FROM pol_calls pc
    UNION ALL
    SELECT fc.company_id, sign(fc.signed)::int, 0, abs(fc.signed), fc.conf, fc.path, 'financial' FROM fin_calls fc
    UNION ALL
    SELECT fb.company_id, sign(fb.signed)::int, 0, abs(fb.signed), fb.conf, fb.path, 'financial' FROM fin_backstop fb
    UNION ALL
    SELECT u.company_id, -1, 1, sum(u.up_risk) * 100 * max((pp.j->>'revenue_to_price')::numeric), max(u.conf),
           string_agg(u.issuer || ' restricts -> ' || u.customer || ' has ~' || round(u.at_risk * 100, 1) || '% at risk -> supplier '
                      || e.name || ' gets ' || u.pct || '% of its revenue from it', '; '), 'policy'
    FROM pol_up u CROSS JOIN pp JOIN entity e ON e.id = u.company_id GROUP BY u.company_id
    UNION ALL
    SELECT n.company_id, -1, 0, n.dependence * (pp.j->>'next_in_line_hit_pct')::numeric, n.conf * 0.7,
           n.issuer || ' restricts ' || n.target || ' -> ' || n.name || ' (same country) still depends on ' || n.issuer
             || ' inputs: priced as next in line', 'policy'
    FROM next_in_line n CROSS JOIN pp
    UNION ALL
    SELECT sc.company_id, sign(sc.signed)::int, 0, abs(sc.signed), sc.conf, sc.path, 'policy' FROM sdn_calls sc
    UNION ALL
    SELECT gc.company_id, sign(gc.signed)::int AS direction, 0 AS hops, abs(gc.signed) AS impact, gc.conf, gc.path,
           'governance' AS mech
    FROM gov_calls gc
    UNION ALL
    SELECT c.company_id, -1 AS direction, c.hops, c.loss * c.days AS impact, c.conf, c.path, 'supply_loss' FROM chain c
    UNION ALL
    -- Competitors: impact here is world-supply-days captured, not yet comparable to output-days lost.
    SELECT cp.dst_id, 1, 1,
           ol.world_short * (prm.j->>'competitor_capture')::numeric * ol.gap * (1 - coalesce(dn.loss, 0)),
           ol.conf * 0.5,
           ol.facility || ' -> world short ' || round(ol.world_short * 100, 1) || '% of '
             || pr.name || ' for ' || ol.gap || 'd -> competitor'
             || CASE WHEN dn.loss IS NOT NULL
                     THEN ' (itself ' || round(dn.loss * 100) || '% down, can''t fill)' ELSE '' END,
           'supply_loss'
    FROM owner_loss ol
    CROSS JOIN prm
    JOIN lk cp      ON cp.src_id = ol.company_id AND cp.via_id = ol.product_id AND cp.rel = 'competes'
    JOIN entity pr  ON pr.id = ol.product_id
    LEFT JOIN down_now dn ON dn.company_id = cp.dst_id AND dn.product_id = ol.product_id
    WHERE ol.world_short IS NOT NULL
  )
  SELECT c.company_id, s.ticker, e.name, c.mech, c.direction::smallint, c.hops,
         round(c.impact::numeric, 1), round(c.conf::numeric, 2), c.path
  FROM calls c
  JOIN entity e ON e.id = c.company_id
  LEFT JOIN security s ON s.entity_id = c.company_id AND s.is_primary
  ORDER BY c.impact * c.conf DESC
$$;

-- ───────────── driver betas: how a stock has moved with a driver, from prices only ─────────────
-- Daily regression of the stock's move (vs its home benchmark; raw for a benchmark itself) on the driver's daily change
-- (% return for a price, points for odds). Asian/European closes come before a US-hours driver's close, so they are
-- matched to that driver's PREVIOUS session (not when the driver is itself an Asian/European stock). Only prices strictly before p_to count: the event day never measures itself.
CREATE OR REPLACE FUNCTION driver_beta(p_sec bigint, p_drv bigint, p_from date, p_to date)
RETURNS TABLE (beta numeric, tstat numeric, r2 numeric, n int) LANGUAGE sql STABLE AS $$
  WITH s AS (SELECT s.id, s.exchange, b.id AS bench,
                    s.exchange IN ('TSE','HKEX','SZSE','SSE','KRX','TWSE','TPEX','LSE','XETRA','SIX','HEL','STO','EPA','OSL',
                                   'ASX','MOEX','KOSDAQ','NSE') AS early
             FROM security s LEFT JOIN security b ON b.ticker = bench_for(s.exchange) AND b.id <> s.id WHERE s.id = p_sec),
  px AS (SELECT p.d, 100 * (p.close_adj / lag(p.close_adj) OVER (ORDER BY p.d) - 1) AS r
         FROM price_daily p WHERE p.security_id = p_sec AND p.d >= p_from AND p.d < p_to
           AND extract(isodow FROM p.d) < 6),                -- FX feeds stamp Monday's open as Sunday: weekdays only
  bx AS (SELECT p.d, 100 * (p.close_adj / lag(p.close_adj) OVER (ORDER BY p.d) - 1) AS r
         FROM price_daily p JOIN s ON p.security_id = s.bench WHERE p.d >= p_from AND p.d < p_to),
  y AS (SELECT px.d, px.r - coalesce(bx.r, 0) AS y FROM px LEFT JOIN bx ON bx.d = px.d
        WHERE px.r IS NOT NULL AND (bx.r IS NOT NULL OR (SELECT bench FROM s) IS NULL)),
  lagged AS (SELECT s.early AND NOT (SELECT ds.exchange IN ('TSE','HKEX','SZSE','SSE','KRX','TWSE','TPEX','LSE','XETRA','SIX',
                                    'HEL','STO','EPA','OSL','ASX','MOEX','KOSDAQ','NSE') FROM security ds WHERE ds.id = p_drv) AS lag
             FROM s),
  -- Same-clock markets: the driver's change between the STOCK's consecutive sessions (odds trade on weekends, and the
  -- weekend is often when the news lands)
  dx0 AS (SELECT p.d, lead(p.d) OVER (ORDER BY p.d) AS next_d,
                CASE WHEN ds.exchange = 'Polymarket' THEN p.close_adj - lag(p.close_adj) OVER (ORDER BY p.d)
                     ELSE 100 * (p.close_adj / lag(p.close_adj) OVER (ORDER BY p.d) - 1) END AS x
         FROM price_daily p JOIN security ds ON ds.id = p.security_id CROSS JOIN lagged
         WHERE p.security_id = p_drv AND p.d >= p_from AND p.d < p_to
           AND (lagged.lag OR p.d IN (SELECT px.d FROM px))),
  -- A price driver moves for many reasons, and a beta learns them all: in a window where oil fell on recession fears,
  -- cruise lines "rose with oil". An event moves the driver for ONE reason (a war: supply), so measure against the
  -- part of the driver's move the US market does not explain. Odds are left whole: they move markets, not the reverse.
  mk AS (SELECT p.d, 100 * (p.close_adj / lag(p.close_adj) OVER (ORDER BY p.d) - 1) AS m
         FROM price_daily p JOIN security sp ON sp.id = p.security_id AND sp.ticker = 'SPY' AND sp.exchange = 'NYSEArca'
         WHERE p.d >= p_from AND p.d < p_to),
  dxm AS (SELECT dx0.*, mk.m FROM dx0 LEFT JOIN mk ON mk.d = dx0.d),
  km AS (SELECT CASE WHEN (SELECT exchange FROM security WHERE id = p_drv) = 'Polymarket'
                       OR (SELECT lag FROM lagged) IS NOT NULL AND (SELECT ds.exchange FROM security ds WHERE ds.id = p_drv)
                          NOT IN ('NYSE','Nasdaq','NYSEArca','NYMEX','FX','INDEX')   -- an Asian/European driver: SPY is not its market
                       OR (SELECT value FROM rule_param WHERE mechanism = 'driver' AND key = 'orthogonalize') = 0 THEN 0
                     ELSE coalesce(regr_slope(x, m), 0) END AS k FROM dxm),
  dx AS (SELECT dxm.d, dxm.next_d, dxm.x - km.k * coalesce(dxm.m, 0) AS x FROM dxm CROSS JOIN km),
  xy AS (SELECT y.y, dx.x FROM y CROSS JOIN lagged
         JOIN dx ON CASE WHEN lagged.lag THEN dx.d < y.d AND y.d <= coalesce(dx.next_d, p_to) ELSE dx.d = y.d END
         WHERE dx.x IS NOT NULL),
  f AS (SELECT regr_slope(y, x) AS b, regr_r2(y, x) AS r2, regr_count(y, x)::int AS n,
               regr_sxx(y, x) AS sxx, regr_syy(y, x) AS syy, regr_sxy(y, x) AS sxy FROM xy)
  SELECT round(b::numeric, 4),
         round((b / nullif(sqrt(greatest(syy - b * sxy, 0) / nullif(n - 2, 0) / nullif(sxx, 0)), 0))::numeric, 2),
         round(r2::numeric, 3), n
  FROM f WHERE n >= 20
$$;

-- Measure every priced security against one driver and store the result as point-in-time 'priced_on' links
-- (known when the window closed). Every security we hold prices for is tried, not just names the graph knows:
-- the graph learns who is exposed from how they traded.
CREATE OR REPLACE FUNCTION measure_driver(p_driver_entity bigint, p_to date, p_doc bigint)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE v_drv bigint; v_from date; v_n int;
BEGIN
  SELECT id INTO v_drv FROM security WHERE entity_id = p_driver_entity ORDER BY is_primary DESC LIMIT 1;
  v_from := p_to - (SELECT value FROM rule_param WHERE mechanism = 'driver' AND key = 'window_days')::int;
  INSERT INTO link (src_id, dst_id, rel, attrs, evidence, confidence, source_id, valid_from, known_at)
  SELECT s.entity_id, p_driver_entity, 'priced_on',
         jsonb_build_object('beta', b.beta, 'tstat', b.tstat, 'r2', b.r2, 'n', b.n, 'window', v_from || '..' || p_to,
                            'unit', CASE WHEN d.exchange = 'Polymarket' THEN '% per odds point' ELSE '% per 1% driver move' END),
         'inferred_stats', least(1, abs(b.tstat) / 4)::real, p_doc, v_from,
         ((p_to - 1)::timestamp + interval '22 hours') AT TIME ZONE 'UTC'   -- last session's US close is in by then
  FROM security s CROSS JOIN security d CROSS JOIN LATERAL driver_beta(s.id, v_drv, v_from, p_to) b
  WHERE d.id = v_drv AND s.id <> v_drv AND s.is_primary
    AND s.exchange NOT IN ('Polymarket') AND b.beta IS NOT NULL
    AND b.n >= (SELECT value FROM rule_param WHERE mechanism = 'driver' AND key = 'min_n')
    AND NOT EXISTS (SELECT 1 FROM link l WHERE l.src_id = s.entity_id AND l.dst_id = p_driver_entity AND l.rel = 'priced_on'
                    AND l.known_at = ((p_to - 1)::timestamp + interval '22 hours') AT TIME ZONE 'UTC');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

-- ───────────── replay: blind run, then score with hindsight ─────────────
-- Runs impact() as of p_as_of (default: the moment we first saw the event), saves the run with the rules
-- that produced it, and compares every call to the case's recorded consequences:
--   hit             we called the right entity and direction
--   wrong_direction right entity, wrong way
--   missed          the case says it was affected; we said nothing
--   false_alarm     we called it; the case says it did not happen (could_have)
--   unconfirmed     we called it; the case records nothing either way
--   avoided         the case records a path that did NOT happen, and we correctly said nothing
-- Each verdict carries the case's own explanation, so a miss arrives with its reason.

DROP FUNCTION IF EXISTS replay(bigint, timestamptz);
CREATE FUNCTION replay(p_case bigint, p_as_of timestamptz DEFAULT NULL)
RETURNS TABLE (verdict text, name text, predicted smallint, actual smallint, impact numeric, actual_move numeric,
               lesson text, path text)
LANGUAGE plpgsql AS $$
DECLARE
  v_event bigint;
  v_as_of timestamptz;
  v_run   bigint;
BEGIN
  SELECT cs.event_id, coalesce(p_as_of, e.first_seen_at) INTO v_event, v_as_of
  FROM case_study cs JOIN event e ON e.id = cs.event_id WHERE cs.id = p_case;

  INSERT INTO replay_run (case_id, as_of, params)
  SELECT p_case, v_as_of, jsonb_object_agg(r.mechanism || '.' || r.key, r.value) FROM rule_param r
  RETURNING id INTO v_run;

  WITH net AS (                      -- paths of one mechanism into one entity add up (signed); units differ across mechanisms
    SELECT i.entity_id, i.mechanism, sum(i.direction * i.impact) AS signed, max(i.conf) AS conf,
           string_agg(i.path, '  +  ' ORDER BY i.impact DESC) AS path
    FROM impact(v_event, v_as_of) i GROUP BY 1, 2
  ),
  pred AS (                          -- one call per entity: its strongest mechanism. Netting to ~nothing is not a call.
    SELECT DISTINCT ON (n.entity_id) n.entity_id, n.mechanism, sign(n.signed)::smallint AS direction, n.signed AS impact, n.path
    FROM net n
    WHERE abs(n.signed) >= (SELECT value FROM rule_param WHERE mechanism = 'global' AND key = 'min_impact')
    ORDER BY n.entity_id, abs(n.signed) * n.conf DESC
  ),
  moved AS (
    SELECT s.entity_id, coalesce(m.abnormal_return, m.raw_return) AS raw_return FROM case_move m JOIN security s ON s.id = m.security_id
    WHERE m.case_id = p_case AND m.window_name = 'd1'
  ),
  actual AS (                        -- what the case says happened to each entity (could_have = it didn't)
    SELECT DISTINCT ON (st.entity_id) st.entity_id, st.role,
           CASE WHEN st.role = 'could_have' THEN NULL ELSE st.direction END AS direction,
           st.description || coalesce(' Why not: ' || st.why_not, '') AS lesson
    FROM case_step st
    WHERE st.case_id = p_case AND st.entity_id IS NOT NULL AND st.role IN ('consequence', 'could_have')
    ORDER BY st.entity_id, CASE st.role WHEN 'consequence' THEN 0 ELSE 1 END
  )
  INSERT INTO replay_result (run_id, entity_id, mechanism, predicted, actual, verdict, impact, actual_move, path, lesson)
  SELECT v_run, coalesce(p.entity_id, a.entity_id), p.mechanism, p.direction, a.direction,
         CASE WHEN p.entity_id IS NULL AND a.direction IS NULL THEN 'avoided'  -- didn't happen, and we didn't call it
              WHEN p.entity_id IS NULL THEN 'missed'
              WHEN a.entity_id IS NULL THEN 'unconfirmed'   -- the case is silent: research gap, not a verdict
              WHEN a.direction IS NULL THEN 'false_alarm'
              WHEN p.direction = a.direction THEN 'hit'
              ELSE 'wrong_direction' END,
         round(p.impact, 1), mv.raw_return, p.path, a.lesson
  FROM pred p FULL JOIN actual a ON a.entity_id = p.entity_id
  LEFT JOIN moved mv ON mv.entity_id = coalesce(p.entity_id, a.entity_id);

  RETURN QUERY
  SELECT rr.verdict, e.name, rr.predicted, rr.actual, rr.impact, rr.actual_move, rr.lesson, rr.path
  FROM replay_result rr JOIN entity e ON e.id = rr.entity_id
  WHERE rr.run_id = v_run
  ORDER BY CASE rr.verdict WHEN 'hit' THEN 0 WHEN 'avoided' THEN 0 WHEN 'wrong_direction' THEN 1
                           WHEN 'false_alarm' THEN 2 ELSE 3 END,
           abs(rr.impact) DESC NULLS LAST;
END $$;

-- ───────────── scoring prices ─────────────
-- Market-adjusted return, %: the stock's move minus its benchmark's, from the last close ON OR BEFORE d_from
-- to the last close ON OR BEFORE d_to. Market-adjusted (beta 1) on purpose: simple, and hard to overfit.
CREATE OR REPLACE FUNCTION abnormal_return(p_sec bigint, p_bench bigint, p_from date, p_to date)
RETURNS numeric LANGUAGE sql STABLE AS $$
  WITH px AS (
    SELECT s, (SELECT close_adj FROM price_daily WHERE security_id = s AND d <= p_from ORDER BY d DESC LIMIT 1) AS a,
              (SELECT close_adj FROM price_daily WHERE security_id = s AND d <= p_to   ORDER BY d DESC LIMIT 1) AS b
    FROM unnest(ARRAY[p_sec, p_bench]) AS s
  )
  SELECT round(100 * ((max(b / a) FILTER (WHERE s = p_sec)) - (max(b / a) FILTER (WHERE s = p_bench))), 2) FROM px
$$;

-- ───────────── calibration: history tunes the numbers, it never answers ─────────────
-- For one mechanism, across the LATEST replay of every case: the scale factor that best maps predicted size onto
-- the actual move (least squares through zero). Proposes, never applies: with few cases it would just memorise them.
CREATE OR REPLACE FUNCTION calibrate(p_mechanism text)
RETURNS TABLE (cases bigint, calls bigint, scale numeric, mean_abs_error_now numeric, mean_abs_error_scaled numeric, advice text)
LANGUAGE sql STABLE AS $$
  WITH latest AS (SELECT DISTINCT ON (case_id) id FROM replay_run ORDER BY case_id, run_at DESC, id DESC),
  pts AS (
    SELECT rr.run_id, rr.impact AS p, rr.actual_move AS a FROM replay_result rr JOIN latest l ON l.id = rr.run_id
    WHERE rr.mechanism = p_mechanism AND rr.verdict = 'hit' AND rr.actual_move IS NOT NULL AND rr.impact <> 0
  ),
  fit AS (SELECT count(DISTINCT run_id) AS n_cases, count(*) AS n, sum(p * a) / nullif(sum(p * p), 0) AS k FROM pts)
  SELECT f.n_cases, f.n, round(f.k, 2),
         round(avg(abs(pts.a - pts.p)), 2), round(avg(abs(pts.a - f.k * pts.p)), 2),
         CASE WHEN f.n_cases < 3 THEN 'only ' || f.n_cases || ' case(s): note it, do not apply yet'
              ELSE 'consider multiplying this mechanism''s scale parameter by ' || round(f.k, 2) END
  FROM pts, fit f GROUP BY f.n_cases, f.n, f.k
$$;

-- ───────────── tune_driver: learn each driver class's size correction from every scored case ─────────────
-- Why sizes miss: a beta measured in calm months, extrapolated to a big surprise, is off by a factor that differs by kind
-- of driver (election odds overshot ~0.85x, oil in a war undershot ~2x). So the correction is per class, fitted on ALL
-- calls with an outcome (not only hits: fitting on hits alone flatters the sizes), on raw sizes (the applied scale
-- undone), and judged leave-one-case-out: each case is predicted with a scale fitted on the OTHER cases. It is applied
-- only when the class has >= 3 cases and the held-out error falls; it is shrunk toward 1 while cases are few.
CREATE OR REPLACE FUNCTION tune_driver()
RETURNS TABLE (cls text, cases bigint, calls bigint, scale_now numeric, scale_fit numeric, mae_now numeric,
               mae_held_out numeric, advice text)
LANGUAGE plpgsql AS $f$
BEGIN
  RETURN QUERY
  WITH latest AS (SELECT DISTINCT ON (case_id) id, case_id FROM replay_run ORDER BY case_id, run_at DESC, id DESC),
  pts AS (
    SELECT l.case_id, m[1] AS cls, rr.impact / m[2]::numeric AS p, rr.actual_move AS a
    FROM replay_result rr JOIN latest l ON l.id = rr.run_id
    CROSS JOIN LATERAL regexp_match(rr.path, '\[scale (\w+) ([0-9.]+)\]') m
    WHERE rr.mechanism = 'driver' AND rr.verdict IN ('hit', 'wrong_direction') AND rr.actual_move IS NOT NULL
      AND rr.impact <> 0 AND m[2]::numeric > 0
  ),
  n AS (SELECT pts.cls, count(DISTINCT case_id) AS n_cases FROM pts GROUP BY 1),
  loo AS (                           -- each case scored with the class scale fitted on the other cases only
    SELECT p.cls, p.case_id, p.p, p.a,
           (SELECT 1 + (sum(o.p * o.a) / nullif(sum(o.p * o.p), 0) - 1) * (n.n_cases - 1) / (n.n_cases + 1.0)
            FROM pts o WHERE o.cls = p.cls AND o.case_id <> p.case_id) AS k_other
    FROM pts p JOIN n ON n.cls = p.cls
  ),
  fit AS (SELECT pts.cls, 1 + (sum(p * a) / nullif(sum(p * p), 0) - 1) * n.n_cases / (n.n_cases + 2.0) AS k
          FROM pts JOIN n ON n.cls = pts.cls GROUP BY pts.cls, n.n_cases),
  now AS (SELECT r.key, r.value FROM rule_param r WHERE r.mechanism = 'driver' AND r.key LIKE 'scale_%'),
  e AS (SELECT l.cls, l.case_id, abs(l.a - coalesce(now.value, 1) * l.p) AS err_now, abs(l.a - coalesce(l.k_other, 1) * l.p) AS err_loo,
               coalesce(now.value, 1) AS s_now
        FROM loo l LEFT JOIN now ON now.key = 'scale_' || l.cls)
  SELECT n.cls, n.n_cases, count(*), max(e.s_now), round(max(f.k), 2), round(avg(e.err_now), 2), round(avg(e.err_loo), 2),
         CASE WHEN n.n_cases < 3 THEN 'only ' || n.n_cases || ' case(s): keep collecting'
              WHEN abs(max(f.k) - max(e.s_now)) < 0.05 THEN 'applied: ' || max(e.s_now) || ' still fits'
              WHEN avg(e.err_loo) >= avg(e.err_now) THEN 'held-out error does not fall: keep ' || max(e.s_now)
              ELSE 'apply ' || round(max(f.k), 2) END
  FROM e JOIN n ON n.cls = e.cls JOIN fit f ON f.cls = e.cls
  GROUP BY n.cls, n.n_cases ORDER BY n.cls;
END $f$;

-- ───────────── driver_checks: the safety-check report ─────────────
-- Correlations are checks, not reasons. For an event's drivers as of t: every reasoned exposure with what prices say about
-- it (agrees / disagrees / no check), and every significant beta with NO reason behind it (co-movement to research, never
-- a call: in H1 2025 cruise lines "rose with oil" because both fell on recession fears, which no war repeats).
CREATE OR REPLACE FUNCTION driver_checks(p_event bigint, p_as_of timestamptz)
RETURNS TABLE (driver text, company text, reason text, elasticity numeric, beta numeric, t numeric, verdict text)
LANGUAGE sql STABLE AS $$
  WITH drivers AS (
    SELECT DISTINCT c.subject_id AS id FROM claim c WHERE c.event_id = p_event AND c.first_seen_at <= p_as_of
      AND c.change IN ('driver_move', 'earnings_surprise')
    UNION SELECT s.entity_id FROM channel_rule cr JOIN event e ON e.id = p_event AND e.kind = cr.event_kind
          JOIN security s ON s.ticker = cr.ticker AND s.exchange = cr.exchange),
  lk AS (SELECT DISTINCT ON (l.src_id, l.dst_id, l.rel) l.* FROM link l JOIN drivers d ON d.id = l.dst_id
         WHERE l.rel IN ('exposed_to', 'priced_on') AND l.known_at <= p_as_of
         ORDER BY l.src_id, l.dst_id, l.rel, l.known_at DESC),
  ex AS (SELECT dst_id, src_id, sum((attrs->>'elasticity')::numeric) AS el, string_agg(attrs->>'why', '; ') AS why
         FROM link l WHERE l.rel = 'exposed_to' AND l.known_at <= p_as_of AND dst_id IN (SELECT id FROM drivers) GROUP BY 1, 2),
  b AS (SELECT dst_id, src_id, (attrs->>'beta')::numeric AS beta, (attrs->>'tstat')::numeric AS t FROM lk WHERE rel = 'priced_on'),
  mt AS (SELECT value FROM rule_param WHERE mechanism = 'driver' AND key = 'min_t')
  SELECT dx.name, e.name, ex.why, round(ex.el, 4), b.beta, b.t,
         CASE WHEN ex.src_id IS NULL THEN 'co-movement with no reason: research, do not call'
              WHEN b.t IS NULL OR abs(b.t) < mt.value THEN 'no check (beta not significant)'
              WHEN sign(b.beta) = sign(ex.el) THEN 'check OK'
              ELSE 'CHECK FAILS: prices moved the other way' END
  FROM ex FULL JOIN b ON b.dst_id = ex.dst_id AND b.src_id = ex.src_id CROSS JOIN mt
  JOIN entity e ON e.id = coalesce(ex.src_id, b.src_id) JOIN entity dx ON dx.id = coalesce(ex.dst_id, b.dst_id)
  WHERE ex.src_id IS NOT NULL OR abs(b.t) >= mt.value
  ORDER BY 1, 7, 2
$$;

-- ───────────── sweep: who actually moved, whether or not the graph knew them ─────────────
-- The graph can only reason about what it holds. This looks past it: every security with prices, its move vs its
-- home-market benchmark over the event window, scaled by its own normal noise (z). A big |z| on a company the graph
-- has no link to is a MISSING LINK to research, not a result.
CREATE OR REPLACE FUNCTION bench_for(p_exchange text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_exchange WHEN 'TSE' THEN '1306' WHEN 'HKEX' THEN '2800' WHEN 'SZSE' THEN '510300' WHEN 'SSE' THEN '510300'
                         WHEN 'KRX' THEN '069500' WHEN 'TWSE' THEN '0050' WHEN 'TPEX' THEN '0050'
                         WHEN 'LSE' THEN 'ISF' WHEN 'XETRA' THEN 'EXSA' WHEN 'SIX' THEN 'EXSA' WHEN 'HEL' THEN 'EXSA'
                         WHEN 'STO' THEN 'EXSA' WHEN 'EPA' THEN 'EXSA' WHEN 'OSL' THEN 'EXSA'
                         WHEN 'ASX' THEN 'STW' WHEN 'MOEX' THEN 'IMOEX'
                         WHEN 'B3' THEN 'BOVA11' WHEN 'KOSDAQ' THEN '069500' WHEN 'NSE' THEN 'NIFTYBEES'
                         WHEN 'FX' THEN NULL WHEN 'NYMEX' THEN NULL WHEN 'Polymarket' THEN NULL WHEN 'INDEX' THEN NULL ELSE 'SPY' END
$$;

CREATE OR REPLACE FUNCTION sweep(p_west_from date, p_east_from date, p_to date, p_noise_from date, p_noise_to date)
RETURNS TABLE (ticker text, exchange text, abnormal numeric, z numeric, in_graph boolean, links int)
LANGUAGE sql STABLE AS $$
  WITH sec AS (
    SELECT s.id, s.ticker, s.exchange, s.entity_id, b.id AS bench,
           CASE WHEN s.exchange IN ('TSE','HKEX','SZSE','SSE','KRX','TWSE','TPEX','LSE','XETRA','SIX','HEL','STO','EPA','OSL','ASX','MOEX','KOSDAQ','NSE') THEN p_east_from ELSE p_west_from END AS d0
    FROM security s JOIN security b ON b.ticker = bench_for(s.exchange)
    WHERE s.id <> b.id AND s.ticker NOT IN ('SPY','1306','2800','510300','069500','0050','ISF','EXSA','STW','IMOEX','BOVA11','NIFTYBEES')
      AND s.exchange NOT IN ('Polymarket', 'NYMEX', 'INDEX')
      AND EXISTS (SELECT 1 FROM price_daily WHERE security_id = s.id AND d BETWEEN p_noise_from AND p_to)
  ),
  daily AS (                         -- normal noise: daily abnormal returns in a quiet window...
    SELECT sec.id, 100 * (p.close_adj / lag(p.close_adj) OVER w - 1) - 100 * (q.close_adj / lag(q.close_adj) OVER w - 1) AS ar
    FROM sec JOIN price_daily p ON p.security_id = sec.id AND p.d BETWEEN p_noise_from AND p_noise_to
    JOIN price_daily q ON q.security_id = sec.bench AND q.d = p.d
    WINDOW w AS (PARTITION BY sec.id ORDER BY p.d)
  ),
  noise AS (SELECT id, stddev(ar) AS sd FROM daily GROUP BY id),   -- ...and their spread
  sessions AS (
    SELECT sec.id, greatest(1, (SELECT count(*) FROM price_daily WHERE security_id = sec.id AND d > sec.d0 AND d <= p_to)) AS n
    FROM sec
  )
  SELECT sec.ticker, sec.exchange, abnormal_return(sec.id, sec.bench, sec.d0, p_to),
         round(abnormal_return(sec.id, sec.bench, sec.d0, p_to) / nullif(n.sd * sqrt(ss.n::numeric), 0), 1),
         EXISTS (SELECT 1 FROM link l WHERE l.src_id = sec.entity_id OR l.dst_id = sec.entity_id),
         (SELECT count(*)::int FROM link l WHERE l.src_id = sec.entity_id OR l.dst_id = sec.entity_id)
  FROM sec JOIN noise n ON n.id = sec.id JOIN sessions ss ON ss.id = sec.id
  ORDER BY 4 NULLS LAST
$$;

-- ───────────── leader track record, from prices ─────────────
-- Yearly excess return over a tenure: the stock's annualised return minus its benchmark's, in %.
CREATE OR REPLACE FUNCTION tenure_excess_ann(p_sec bigint, p_bench bigint, p_from date, p_to date)
RETURNS numeric LANGUAGE sql STABLE AS $$
  WITH px AS (
    SELECT s, (SELECT close_adj FROM price_daily WHERE security_id = s AND d <= p_from ORDER BY d DESC LIMIT 1) AS a,
              (SELECT close_adj FROM price_daily WHERE security_id = s AND d <= p_to   ORDER BY d DESC LIMIT 1) AS b
    FROM unnest(ARRAY[p_sec, p_bench]) AS s
  ), yrs AS (SELECT greatest((p_to - p_from) / 365.25, 0.25) AS y)
  SELECT round(100 * (power(max(b / a) FILTER (WHERE s = p_sec), 1 / y) - power(max(b / a) FILTER (WHERE s = p_bench), 1 / y)), 1)
  FROM px, yrs GROUP BY y
$$;

-- ───────────── analyst scorecard ─────────────
-- Exposure/estimate views: how far their number was from what it turned out to be.
-- Rating/target views: did the stock move their way over the next ~20 trading days vs its market (where we hold prices)?
CREATE OR REPLACE VIEW analyst_scorecard AS
SELECT a.id, s.name AS firm, a.analyst, e.name AS company, a.published_at::date AS published, a.kind,
       coalesce(a.rating_from || ' -> ', '') || coalesce(a.rating_to, '') AS rating,
       a.value_from, a.value_to, a.unit, a.outcome,
       CASE WHEN a.outcome IS NOT NULL AND a.value_to IS NOT NULL THEN round(a.value_to - a.outcome, 1) END AS error,
       CASE WHEN a.kind IN ('rating', 'price_target') THEN
         CASE WHEN a.rating_to IN ('Buy','Outperform','Overweight','Top pick') AND coalesce(a.rating_from, '') NOT IN ('Buy','Outperform','Overweight') THEN 1
              WHEN a.rating_to IN ('Neutral','Market Perform','Hold','Underperform','Equal-weight') AND a.rating_from IN ('Buy','Outperform','Overweight','Strong Buy') THEN -1
              WHEN a.value_to > a.value_from THEN 1 WHEN a.value_to < a.value_from THEN -1 END END AS call_direction,
       (SELECT abnormal_return(sec.id, b.id, a.published_at::date, a.published_at::date + 28)
        FROM security sec JOIN security b ON b.ticker = bench_for(sec.exchange)
        WHERE sec.entity_id = a.entity_id AND sec.ticker NOT IN ('SPY') ORDER BY sec.is_primary DESC LIMIT 1) AS next_4w_vs_market,
       a.reasoning, a.outcome_note
FROM analyst_view a JOIN source s ON s.id = a.source_id JOIN entity e ON e.id = a.entity_id;

-- ───────────── case helpers: outcomes from prices, for a whole universe ─────────────
-- First-session move of every listed ticker after an event: last close on or before p_d0 -> its first close on or
-- after p_first (each market's own first session). Abnormal = vs its home benchmark; raw for benchmarks/FX/futures.
CREATE OR REPLACE FUNCTION case_auto_moves(p_case bigint, p_d0 date, p_first date, p_tickers text[], p_doc bigint)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE v_n int;
BEGIN
  INSERT INTO case_move (case_id, security_id, window_name, raw_return, abnormal_return, evidence_doc)
  SELECT p_case, s.id, 'd1', x.raw, coalesce(x.raw - x.braw, x.raw), p_doc
  FROM security s
  LEFT JOIN security b ON b.ticker = bench_for(s.exchange) AND b.id <> s.id
  CROSS JOIN LATERAL (SELECT min(d) AS d1 FROM price_daily WHERE security_id = s.id AND d >= p_first) f
  CROSS JOIN LATERAL (
    SELECT round(100 * ((SELECT close_adj FROM price_daily WHERE security_id = s.id AND d <= f.d1 ORDER BY d DESC LIMIT 1)
                      / (SELECT close_adj FROM price_daily WHERE security_id = s.id AND d <= p_d0 ORDER BY d DESC LIMIT 1) - 1), 2) AS raw,
           round(100 * ((SELECT close_adj FROM price_daily WHERE security_id = b.id AND d <= f.d1 ORDER BY d DESC LIMIT 1)
                      / (SELECT close_adj FROM price_daily WHERE security_id = b.id AND d <= p_d0 ORDER BY d DESC LIMIT 1) - 1), 2) AS braw) x
  WHERE (s.ticker || ':' || s.exchange) = ANY (p_tickers) AND f.d1 IS NOT NULL AND x.raw IS NOT NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

-- What the case records from those moves, for every name no hand-written step covers: |abnormal| >= p_big is a
-- consequence in its direction; |abnormal| < p_quiet is a could_have (it did not move). In between: silent.
CREATE OR REPLACE FUNCTION case_auto_steps(p_case bigint, p_parent bigint, p_mech text, p_big numeric, p_quiet numeric)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE v_n int;
BEGIN
  INSERT INTO case_step (id, case_id, parent_id, role, entity_id, mechanism, direction, description, why_not)
  SELECT 100000 + p_case * 1000 + row_number() OVER (ORDER BY abs(m.abnormal_return) DESC), p_case, p_parent,
         CASE WHEN abs(m.abnormal_return) >= p_big THEN 'consequence' ELSE 'could_have' END, s.entity_id, p_mech,
         CASE WHEN abs(m.abnormal_return) >= p_big THEN sign(m.abnormal_return)::smallint END,
         s.ticker || ' first session ' || CASE WHEN m.abnormal_return >= 0 THEN '+' ELSE '' END || m.abnormal_return
           || '% vs its market (' || CASE WHEN m.raw_return >= 0 THEN '+' ELSE '' END || m.raw_return || '% raw)',
         CASE WHEN abs(m.abnormal_return) < p_quiet THEN 'moved less than ' || p_quiet || '% against its market' END
  FROM case_move m JOIN security s ON s.id = m.security_id
  WHERE m.case_id = p_case AND m.window_name = 'd1'
    AND (abs(m.abnormal_return) >= p_big OR abs(m.abnormal_return) < p_quiet)
    AND NOT EXISTS (SELECT 1 FROM case_step st WHERE st.case_id = p_case AND st.entity_id = s.entity_id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

-- A listed thing by ticker: the existing entity if we hold the security, else a new entity + security.
CREATE OR REPLACE FUNCTION ensure_security(p_ticker text, p_exchange text, p_name text, p_kind text DEFAULT 'company',
                                           p_country text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v bigint;
BEGIN
  SELECT entity_id INTO v FROM security WHERE ticker = p_ticker AND exchange = p_exchange;
  IF v IS NULL THEN
    INSERT INTO entity (kind, name, country) VALUES (p_kind, p_name, p_country) RETURNING id INTO v;
    INSERT INTO security (entity_id, ticker, exchange) VALUES (v, p_ticker, p_exchange);
  END IF;
  RETURN v;
END $$;
