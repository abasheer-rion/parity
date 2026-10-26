-- Case 3 (government #1), part 2: the hindsight write-up. Moves are computed from price_daily (market-adjusted:
-- SPY for US listings, TOPIX ETF 1306 for Tokyo), not copied from press. Needs prices loaded (build.sh does it).

INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (50, 24, 'article', 'https://www.bnnbloomberg.ca/biden-wins-deal-with-netherlands-japan-on-china-chip-export-limit-1.1875878',
   'Biden wins deal with Netherlands, Japan on China chip export limits', '2023-01-27 18:00-05'),
  (51, 1, 'dataset', NULL, 'Daily closes (Yahoo chart API, research use); abnormal = stock minus benchmark', '2022-10-31');

INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint) VALUES
  (3, 4, 'US chip export controls on China (Oct 2022)',
   'A government bars its companies from selling an advanced technology into a rival country',
   'BIS barred US firms from selling advanced AI chips and the tools for advanced logic, DRAM and NAND fabs into China, '
   'and reached some non-US suppliers too. The rule had leaked a month early. US toolmakers lost 9-14% vs the market in '
   'two days; the Dutch and Japanese rivals fell too instead of gaining, and their governments joined in January 2023.',
   '{"event_kind": "export_control", "mechanisms": ["policy"], "issuer": "US", "target": "CN",
     "sector": "semiconductors", "leaked_days_before": 25, "precursor": "company-specific license letters (Aug 2022)",
     "allies_followed": true, "exposure_metric": "pct revenue in target 26-33%"}');

INSERT INTO case_step (id, case_id, parent_id, role, entity_id, mechanism, direction, description, why_not,
                       happened_at, public_at, evidence_doc) VALUES
  (20, 3, NULL, 'cause', 50, 'policy', NULL,
   'US aim: keep advanced AI computing and advanced chipmaking out of China''s military reach.',
   NULL, '2022-10-07', '2022-10-07 14:00-04', 47),
  (21, 3, NULL, 'condition', 47, 'policy', NULL,
   'Precursors were public: toolmakers had license letters for <14nm China fabs earlier in 2022, and NVIDIA''s 8-K of '
   '08-31 disclosed its own license requirement (NVDA -8.0% vs market next day).',
   NULL, '2022-08-31', '2022-08-31 16:30-04', 44),
  (22, 3, NULL, 'condition', NULL, 'policy', NULL,
   'The rule leaked: Reuters reported it on 09-12 and again on 10-03. Toolmakers fell 2-3% vs market on the first report, '
   'so part of the hit was priced before the rule existed.',
   NULL, '2022-09-12', '2022-09-12 12:00-04', 46),
  (23, 3, 20, 'event', 50, 'policy', NULL,
   'BIS published the rule on Friday 10-07: advanced computing chips and tools for advanced logic, DRAM and NAND fabs '
   'need licenses for China; US persons barred from supporting those fabs; reach extended to some foreign-made items.',
   NULL, '2022-10-07', '2022-10-07 14:00-04', 47),
  (24, 3, 23, 'consequence', 44, 'policy', -1, 'Applied Materials fell vs the market over the next sessions.', NULL, '2022-10-11', '2022-10-11 16:00-04', 51),
  (25, 3, 23, 'consequence', 45, 'policy', -1, 'Lam Research fell the most of the US toolmakers.', NULL, '2022-10-11', '2022-10-11 16:00-04', 51),
  (26, 3, 23, 'consequence', 46, 'policy', -1, 'KLA fell vs the market.', NULL, '2022-10-11', '2022-10-11 16:00-04', 51),
  (27, 3, 23, 'consequence', 47, 'policy', -1,
   'NVIDIA fell again although its own restriction was disclosed in August: the rule widened and made it permanent.',
   NULL, '2022-10-11', '2022-10-11 16:00-04', 51),
  (28, 3, 23, 'consequence', 48, 'policy', -1,
   'ASML (Dutch, outside the US rule) fell about as much as the US toolmakers: the market priced the rule''s reach to '
   'foreign suppliers and allies following. They did: Japan and the Netherlands agreed on 2023-01-27.',
   NULL, '2022-10-11', '2022-10-11 16:00-04', 50),
  (29, 3, 23, 'consequence', 49, 'policy', -1,
   'Tokyo Electron fell too, less than the US names (-3.7% vs TOPIX to 10-11; Tokyo was closed 10-10).',
   NULL, '2022-10-11', '2022-10-11 16:00-04', 51),
  (30, 3, 29, 'could_have', 49, 'policy', 1,
   'Tokyo Electron and ASML take the China sales US toolmakers lose.',
   'Their governments were expected to follow the US, and did in January 2023; the rule also reached foreign-made items.',
   NULL, '2023-01-27 18:00-05', 50),
  (31, 3, 23, 'consequence', NULL, 'policy', NULL,
   'Applied Materials quantified the hit on 10-12 (~$400M, ~6% of the quarter) and rose 1.9% vs market next day: '
   'the number was smaller than what had been priced.',
   NULL, '2022-10-13', '2022-10-12 16:30-04', 48);

-- Moves: first full session after the Friday-afternoon release, plus one more (d2) and the week (d5).
INSERT INTO case_move (case_id, security_id, window_name, raw_return, abnormal_return, evidence_doc)
SELECT 3, s.id, w.name,
       100 * ((SELECT close_adj FROM price_daily WHERE security_id = s.id AND d <= w.d1 ORDER BY d DESC LIMIT 1)
                                                      / (SELECT close_adj FROM price_daily WHERE security_id = s.id AND d <= w.d0 ORDER BY d DESC LIMIT 1) - 1),
       abnormal_return(s.id, (SELECT id FROM security WHERE ticker = CASE WHEN s.exchange = 'TSE' THEN '1306' ELSE 'SPY' END),
                       w.d0, w.d1),
       51
FROM security s
CROSS JOIN (VALUES ('d2', DATE '2022-10-06', DATE '2022-10-11'), ('d5', DATE '2022-10-06', DATE '2022-10-14')) AS w(name, d0, d1)
WHERE s.ticker IN ('AMAT', 'LRCX', 'KLAC', 'NVDA', 'ASML', '8035');
-- The replay compares against 'd1': use the two-session window (Tokyo was shut on 10-10).
INSERT INTO case_move SELECT case_id, security_id, 'd1', raw_return, abnormal_return, evidence_doc FROM case_move
WHERE case_id = 3 AND window_name = 'd2';
-- Score on the market-adjusted move: put it where replay() reads.
UPDATE case_move SET raw_return = abnormal_return WHERE case_id = 3 AND window_name = 'd1';

INSERT INTO case_opportunity (case_id, security_id, action, enter_at, exit_at, payoff_pct, rationale)
SELECT 3, s.id, o.action, o.enter_at, o.exit_at,
       -abnormal_return(s.id, (SELECT id FROM security WHERE ticker = 'SPY'), o.enter_at::date, o.exit_at::date),  -- from that day's close: conservative
       o.why
FROM security s JOIN (VALUES
  ('LRCX', 'short vs market', TIMESTAMPTZ '2022-09-12 12:00-04', TIMESTAMPTZ '2022-10-12 16:00-04',
   'On the Reuters leak: a wire with a strong record, about a policy that maps straight onto 31% of revenue. Speed + belief.'),
  ('AMAT', 'short vs market', TIMESTAMPTZ '2022-10-07 14:00-04', TIMESTAMPTZ '2022-10-12 16:00-04',
   'On the rule itself, covered before the company''s own number: guidance is when the fear gets measured.'),
  ('ASML', 'short vs market', TIMESTAMPTZ '2022-10-07 14:00-04', TIMESTAMPTZ '2022-10-14 16:00-04',
   'The trap avoided: not the "winner" of the US rule but caught by its reach and by allies following.')
) AS o(ticker, action, enter_at, exit_at, why) ON o.ticker = s.ticker;

SELECT setval('source_doc_id_seq', greatest(51, (SELECT max(id) FROM source_doc))),
       setval('case_study_id_seq', 3), setval('case_step_id_seq', 31);

-- ───── found by the sweep (sweep() over 33 names, 10-06/07 -> 10-11, z vs Aug-Sep noise) ─────
-- These moved but the graph had no link to them: each is a consequence the engine MISSED, and a link to research.
UPDATE entity e SET name = n.name, country = n.country
FROM security s, (VALUES ('688012', 'AMEC (Advanced Micro-Fabrication Equipment)', 'CN'), ('002371', 'Naura Technology', 'CN'),
                         ('AEIS', 'Advanced Energy', 'US'), ('ONTO', 'Onto Innovation', 'US'), ('ICHR', 'Ichor', 'US'),
                         ('UCTT', 'Ultra Clean', 'US'), ('ENTG', 'Entegris', 'US'), ('MKSI', 'MKS Instruments', 'US'),
                         ('MRVL', 'Marvell', 'US'), ('AMD', 'AMD', 'US'), ('QCOM', 'Qualcomm', 'US'), ('AVGO', 'Broadcom', 'US'),
                         ('1347', 'Hua Hong Semiconductor', 'CN'), ('AXTI', 'AXT', 'US'), ('6488', 'GlobalWafers', 'TW'),
                         ('LIN', 'Linde', 'US'), ('APD', 'Air Products', 'US'), ('4063', 'Shin-Etsu Chemical', 'JP'),
                         ('3436', 'SUMCO', 'JP'), ('MP', 'MP Materials', 'US'), ('005930', 'Samsung Electronics', 'KR'),
                         ('000660', 'SK Hynix', 'KR'), ('MU', 'Micron', 'US'), ('0981', 'SMIC', 'CN'),
                         ('INTC', 'Intel', 'US'), ('TXN', 'Texas Instruments', 'US'), ('TER', 'Teradyne', 'US'))
       AS n(ticker, name, country)
WHERE s.ticker = n.ticker AND e.id = s.entity_id;

INSERT INTO case_step (case_id, parent_id, role, entity_id, mechanism, direction, description, happened_at, public_at, evidence_doc)
SELECT 3, 23, 'consequence', s.entity_id, 'policy', -1, f.why, '2022-10-11', '2022-10-11 16:00-04', 51
FROM security s JOIN (VALUES
  ('688012', 'Chinese toolmaker fell the most of anyone (-22.6% vs CSI 300, z -6.6): not a winner from the US exit but cut off from US parts and US engineers. Missing link: depends_on US components/people.'),
  ('002371', 'Chinese toolmaker fell (-16.9%, z -3.8), same reason as AMEC.'),
  ('AEIS',   'Supplies power subsystems to the US toolmakers: fell with them (-7.5%, z -3.3). Missing link: supplies -> AMAT/LRCX.'),
  ('ONTO',   'Inspection/metrology tools sold into China fabs: fell (-9.7%, z -2.1).'),
  ('MRVL',   'Chip designer with China revenue: fell (-15.3%, z -3.7). Missing link: sells_in China + advanced-computing exposure. Part is sector-wide selling.'),
  ('QCOM',   'Large China revenue: fell (-8.0%, z -3.8). Part is sector-wide selling.'),
  ('AMD',    'Data-center GPUs caught like NVIDIA''s: fell (-10.9%, z -2.7).'),
  ('AVGO',   'China revenue: fell (-6.0%, z -2.9). Part is sector-wide selling.'),
  ('1347',   'Chinese foundry: fell (-7.6%, z -2.0); SMIC moved within its noise.'),
  ('AXTI',   'Substrate maker with plants in China: fell (-9.6%, z -2.2).')
) AS f(ticker, why) ON f.ticker = s.ticker;

-- Checked and NOT affected in the window: real answers too, so the engine learns where the effect stops.
INSERT INTO case_step (case_id, parent_id, role, entity_id, mechanism, direction, description, why_not, happened_at, public_at, evidence_doc)
SELECT 3, 23, 'could_have', s.entity_id, 'policy', -1, f.what, f.why_not, '2022-10-11', '2022-10-11 16:00-04', 51
FROM security s JOIN (VALUES
  ('LIN',    'Industrial gases sold to China fabs fall.', 'Flat (+1.3%): gases go to every fab, advanced or not; a sliver of demand.'),
  ('APD',    'Industrial gases sold to China fabs fall.', 'Flat (+1.1%).'),
  ('4063',   'Wafer makers lose China demand.', 'Flat (-0.8%): wafers are not restricted and mature-node China fabs keep buying.'),
  ('3436',   'Wafer makers lose China demand.', 'Flat (-0.1%).'),
  ('MP',     'Rare-earth producers move on a China-US escalation.', 'Flat (-1.4%) in the window. The raw-materials effect came later and from China''s side (gallium/germanium curbs, July 2023): to verify and add.'),
  ('005930', 'Memory makers with China fabs are hit.', 'Flat/up: foreign-owned fabs in China were treated differently from Chinese-owned ones (to verify: licences granted).'),
  ('000660', 'Memory makers with China fabs are hit.', 'Flat/up, as Samsung.')
) AS f(ticker, what, why_not) ON f.ticker = s.ticker;

-- ───── missing links filled from filings (supplier customer concentration, dated by filing) ─────
INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (52, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/927003/000155837022011897/aeis-20220630x10q.htm', 'Advanced Energy 10-Q Q2 2022: AMAT 20%, Lam 15%', '2022-08-03'),
  (53, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/1049502/000095017022014195/mksi-20220630.htm', 'MKS 10-Q Q2 2022: Lam 15%, AMAT 13%', '2022-08-03'),
  (54, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/1275014/000095017022016091/uctt-20220701.htm', 'Ultra Clean 10-Q Q2 2022: Lam 41.0%, AMAT 22.7%', '2022-08-09'),
  (55, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/1652535/000156459022007613/ichr-10k_20211231.htm', 'Ichor FY21 10-K: Lam ~53%, AMAT ~32%', '2022-02-28'),
  (56, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/704532/000156459022028807/onto-10q_20220702.htm', 'Onto 10-Q Q2 2022: China 26.4% of revenue', '2022-08-09');
INSERT INTO link (src_id, dst_id, rel, attrs, evidence, confidence, source_id, valid_from, known_at)
SELECT s.entity_id, v.dst, v.rel, v.attrs::jsonb, v.ev, v.conf, v.doc, v.vf::date, v.known::timestamptz
FROM (VALUES
  ('AEIS', 44, 'supplies', '{"pct_of_supplier_revenue": 20}', 'disclosed', 0.95, 52, '2022-04-01', '2022-08-03'),
  ('AEIS', 45, 'supplies', '{"pct_of_supplier_revenue": 15}', 'disclosed', 0.95, 52, '2022-04-01', '2022-08-03'),
  ('MKSI', 45, 'supplies', '{"pct_of_supplier_revenue": 15}', 'disclosed', 0.95, 53, '2022-04-01', '2022-08-03'),
  ('MKSI', 44, 'supplies', '{"pct_of_supplier_revenue": 13}', 'disclosed', 0.95, 53, '2022-04-01', '2022-08-03'),
  ('UCTT', 45, 'supplies', '{"pct_of_supplier_revenue": 41}', 'disclosed', 0.95, 54, '2022-04-01', '2022-08-09'),
  ('UCTT', 44, 'supplies', '{"pct_of_supplier_revenue": 22.7}', 'disclosed', 0.95, 54, '2022-04-01', '2022-08-09'),
  ('ICHR', 45, 'supplies', '{"pct_of_supplier_revenue": 53}', 'disclosed', 0.95, 55, '2021-01-01', '2022-02-28'),
  ('ICHR', 44, 'supplies', '{"pct_of_supplier_revenue": 32}', 'disclosed', 0.95, 55, '2021-01-01', '2022-02-28'),
  ('ONTO', 40, 'sells_in', '{"pct_of_revenue": 26.4}', 'disclosed', 0.95, 56, '2022-01-01', '2022-08-09'),
  ('ONTO', 42, 'produces', '{}', 'disclosed', 0.95, 56, '2022-01-01', '2022-08-09'),
  -- Chinese chip firms that still relied on US tools, parts and engineers in 2022
  ('688012', 41, 'depends_on', '{"dependence": 0.7, "what": "US parts and US-person engineers"}', 'analyst', 0.7, 1, '2022-01-01', '2022-01-01'),
  ('002371', 41, 'depends_on', '{"dependence": 0.7, "what": "US parts and US-person engineers"}', 'analyst', 0.7, 1, '2022-01-01', '2022-01-01'),
  ('0981',   41, 'depends_on', '{"dependence": 0.6, "what": "US tools for its fabs"}', 'analyst', 0.7, 1, '2022-01-01', '2022-01-01'),
  ('1347',   41, 'depends_on', '{"dependence": 0.5, "what": "US tools for its fabs"}', 'analyst', 0.7, 1, '2022-01-01', '2022-01-01')
) AS v(ticker, dst, rel, attrs, ev, conf, doc, vf, known)
JOIN security s ON s.ticker = v.ticker;
