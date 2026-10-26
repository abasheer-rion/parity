-- Graph snapshot for the viewer: every linked entity, every link, the fire's claims with belief, and impact/replay at 3 moments.
\pset tuples_only on
-- Score every case first, so calibrate() below sees the fresh runs.
\o /dev/null
SELECT (SELECT count(*) FROM replay(cs.id, cs.replay_at)) FROM case_study cs ORDER BY cs.id;
\o
\pset format unaligned
WITH n AS (
  SELECT e.id, e.kind, e.name, e.attrs, s.ticker
  FROM entity e LEFT JOIN LATERAL (SELECT ticker FROM security WHERE entity_id = e.id ORDER BY is_primary DESC LIMIT 1) s ON true
  WHERE e.id IN (SELECT src_id FROM link UNION SELECT dst_id FROM link UNION SELECT entity_id FROM case_step WHERE entity_id IS NOT NULL)
    AND e.kind <> 'index'
),
-- Each case's picture: the entities its story names, plus their direct neighbours.
case_nodes AS (
  SELECT st.case_id, array_agg(DISTINCT x) AS ids
  FROM case_step st
  CROSS JOIN LATERAL (SELECT st.entity_id UNION SELECT l.dst_id FROM link l WHERE l.src_id = st.entity_id AND l.rel NOT IN ('holds','issued')
                      UNION SELECT l.src_id FROM link l WHERE l.dst_id = st.entity_id AND l.rel NOT IN ('holds','issued')) nb(x)
  WHERE st.entity_id IS NOT NULL AND x IS NOT NULL
  GROUP BY st.case_id
),
l AS (
  SELECT DISTINCT ON (src_id, dst_id, rel, coalesce(via_id,0)) l.src_id, l.dst_id, l.rel, v.name AS via, l.attrs, l.evidence,
         l.confidence, l.known_at::date AS known, l.valid_from AS valid_from, d.title AS source,
         (SELECT count(*) > 1 FROM link x WHERE x.src_id = l.src_id AND x.dst_id = l.dst_id AND x.rel = l.rel) AS has_later_version
  FROM link l LEFT JOIN entity v ON v.id = l.via_id JOIN source_doc d ON d.id = l.source_id
  ORDER BY src_id, dst_id, rel, coalesce(via_id,0), l.known_at DESC
),
cl AS (
  SELECT c.id, c.statement, c.first_seen_at, c.magnitude, c.duration_days, c.resolution, c.supersedes,
         belief(c.id, '2021-03-20 12:00+09') AS b0320, belief(c.id, '2021-03-22 09:00+09') AS b0322,
         belief(c.id, '2021-03-31') AS b0331, belief(c.id, '2021-04-18') AS b0418,
         (SELECT string_agg(s.name, ', ') FROM claim_evidence ce JOIN source_doc d ON d.id = ce.doc_id JOIN source s ON s.id = d.source_id WHERE ce.claim_id = c.id) AS sources
  FROM claim c WHERE c.event_id = 2
),
moments(label, t) AS (VALUES ('Mar 19 · fire reported', '2021-03-19 12:00+09'::timestamptz),
                             ('Mar 21 · "back within a month"', '2021-03-21 20:00+09'::timestamptz),
                             ('Mar 31 · "~100 days"', '2021-03-31'::timestamptz)),
imp AS (
  SELECT m.label, json_agg(json_build_object('id', i.entity_id, 'dir', i.direction, 'hops', i.hops, 'impact', i.impact,
                                             'conf', i.conf, 'path', i.path) ORDER BY i.impact * i.conf DESC) AS calls,
         (SELECT json_agg(json_build_object('verdict', r.verdict, 'name', r.name, 'lesson', r.lesson)) FROM replay(1, m.t) r) AS replay
  FROM moments m CROSS JOIN LATERAL impact(2, m.t) i GROUP BY m.label, m.t ORDER BY m.t
),
cases AS (
  SELECT cs.id, cs.title, cs.anon_title, cs.summary, cs.fingerprint, m.t AS replay_at,
    (SELECT json_agg(json_build_object('role', st.role, 'entity', e.name, 'dir', st.direction, 'text', st.description,
                                       'why_not', st.why_not, 'public_at', st.public_at) ORDER BY st.id)
       FROM case_step st LEFT JOIN entity e ON e.id = st.entity_id WHERE st.case_id = cs.id) AS steps,
    (SELECT json_agg(json_build_object('ticker', s.ticker, 'name', e.name, 'window', mv.window_name, 'raw', mv.raw_return,
                                       'abnormal', mv.abnormal_return) ORDER BY s.ticker, mv.window_name)
       FROM case_move mv JOIN security s ON s.id = mv.security_id JOIN entity e ON e.id = s.entity_id WHERE mv.case_id = cs.id) AS moves,
    (SELECT json_agg(json_build_object('ticker', s.ticker, 'action', o.action, 'enter', o.enter_at, 'exit', o.exit_at,
                                       'payoff', round(o.payoff_pct, 1), 'why', o.rationale) ORDER BY o.id)
       FROM case_opportunity o LEFT JOIN security s ON s.id = o.security_id WHERE o.case_id = cs.id) AS trades,
    (SELECT json_agg(json_build_object('firm', a.firm, 'analyst', a.analyst, 'company', a.company, 'published', a.published, 'kind', a.kind,
                                       'rating', a.rating, 'from', a.value_from, 'to', a.value_to, 'unit', a.unit, 'outcome', a.outcome,
                                       'next4w', a.next_4w_vs_market, 'why', a.reasoning, 'note', a.outcome_note) ORDER BY a.published)
       FROM analyst_scorecard a JOIN analyst_view av ON av.id = a.id
       WHERE av.event_id = cs.event_id OR (cs.id = 7 AND av.event_id = 9) OR (cs.id = 9 AND av.event_id = 11)) AS analysts,
    (SELECT json_agg(json_build_object('verdict', r.verdict, 'name', r.name, 'impact', r.impact, 'actual', r.actual_move,
                                       'path', r.path, 'lesson', r.lesson)) FROM replay(cs.id, m.t) r) AS replay
  FROM case_study cs JOIN event ev ON ev.id = cs.event_id
  CROSS JOIN LATERAL (SELECT coalesce(cs.replay_at, ev.first_seen_at) AS t) m
)
SELECT json_build_object(
  'exported', now(),
  'cases', (SELECT json_agg(cases ORDER BY cases.id) FROM cases),
  'case_nodes', (SELECT json_object_agg(case_id, ids) FROM case_nodes),
  'rule_log', (SELECT json_agg(r ORDER BY r.id) FROM rule_change r),
  'calibration', (SELECT json_agg(json_build_object('mechanism', k.m, 'cases', c.cases, 'calls', c.calls, 'scale', c.scale,
                                                    'err_now', c.mean_abs_error_now, 'err_scaled', c.mean_abs_error_scaled, 'advice', c.advice))
                  -- supply_loss predicts output-days, not % moves: not comparable, so it is left out
                  FROM (VALUES ('policy'), ('governance'), ('driver')) k(m) CROSS JOIN LATERAL calibrate(k.m) c),
  'nodes', (SELECT json_agg(n) FROM n),
  'links', (SELECT json_agg(l) FROM l),
  'claims', (SELECT json_agg(cl ORDER BY cl.id) FROM cl),
  'moments', (SELECT json_agg(json_build_object('label', label, 'calls', calls, 'replay', replay)) FROM imp));
