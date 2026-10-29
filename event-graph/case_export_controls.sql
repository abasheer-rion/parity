-- Case 3 (government #1): US export controls on advanced chips and chip tools to China, 2022-10-07.
-- Part 1: the world graph and the claims as they arrived. Part 2 (case_export_controls_story.sql) is the
-- hindsight write-up, scored with moves computed from price_daily. Load prices between the two.
-- China revenue shares are from each 10-K's geography note, dated to when that 10-K was filed.
-- Release times are approximate.

INSERT INTO source (id, name, kind, domain, is_primary, prior_confirmed, prior_retracted) VALUES
  (20, 'Bureau of Industry and Security', 'government', 'bis.doc.gov', true, 0, 0),
  (21, 'Reuters',              'wire',    'reuters.com',  false, 19, 1),
  (22, 'NVIDIA',               'company', 'nvidia.com',   true, 0, 0),
  (23, 'Applied Materials',    'company', 'appliedmaterials.com', true, 0, 0),
  (24, 'Bloomberg',            'outlet',  'bloomberg.com', false, 19, 1);

INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (40, 23, 'filing', NULL, 'AMAT FY2021 10-K: China 33% of revenue', '2021-12-31'),
  (41, 1,  'filing', 'https://www.sec.gov/Archives/edgar/data/319201/000031920122000023/klac-20220630.htm', 'KLA FY2022 10-K: China 29% of revenue', '2022-08-05'),
  (42, 1,  'filing', 'https://www.sec.gov/Archives/edgar/data/707549/000070754922000107/lrcx-20220626.htm', 'Lam FY2022 10-K: China 31% of revenue', '2022-08-24'),
  (43, 22, 'filing', 'https://www.sec.gov/Archives/edgar/data/1045810/000104581022000036/nvda-20220130.htm', 'NVIDIA FY2022 10-K: China incl. HK $7.1B of $26.9B', '2022-03-18'),
  (44, 22, 'filing', 'https://www.sec.gov/Archives/edgar/data/1045810/000104581022000146/nvda-20220826.htm',
         'NVIDIA 8-K: new license requirement for A100/H100 exports to China and Russia', '2022-08-31 16:30-04'),
  (45, 1,  'article', 'https://tomshardware.com/news/us-export-rules-may-cost-nvidia-400-million-prevent-h100-development',
         'Export rules may cost Nvidia ~$400M in the quarter', '2022-08-31 18:00-04'),
  (46, 21, 'article', 'https://www.euronews.com/next/2022/09/12/usa-china-chips', 'Exclusive: US plans to broaden curbs on chip and tool exports to China in October', '2022-09-12 12:00-04'),
  (47, 20, 'press_release', 'https://info.expeditors.com/newsflash/bis-announces-updated-export-controls-on-advanced-computing-and-semiconductor-manufacturing-items-to-china',
         'BIS rule: controls on advanced computing chips and semiconductor manufacturing items to China', '2022-10-07 14:00-04'),
  (48, 24, 'article', 'https://www.bloomberg.com/news/articles/2022-10-12/applied-materials-cuts-forecast-blaming-export-curbs-to-china',
         'Applied Materials cuts forecast: export rules cut Q4 sales ~$400M', '2022-10-12 17:00-04'),
  (49, 23, 'press_release', NULL, 'Applied Materials updates Q4 guidance for new export rules', '2022-10-12 16:30-04');

INSERT INTO entity (id, kind, name, country, attrs) VALUES
  (40, 'country', 'China', 'CN', '{}'),
  (41, 'country', 'United States', 'US', '{}'),
  (42, 'product', 'semiconductor manufacturing equipment', NULL, '{}'),
  (43, 'product', 'advanced AI accelerator', NULL, '{}'),
  (44, 'company', 'Applied Materials', 'US', '{"cik": "6951"}'),
  (45, 'company', 'Lam Research', 'US', '{"cik": "707549"}'),
  (46, 'company', 'KLA', 'US', '{"cik": "319201"}'),
  (47, 'company', 'NVIDIA', 'US', '{"cik": "1045810"}'),
  (48, 'company', 'ASML', 'NL', '{}'),
  (49, 'company', 'Tokyo Electron', 'JP', '{}'),
  (50, 'agency',  'Bureau of Industry and Security', 'US', '{}'),
  (51, 'country', 'Netherlands', 'NL', '{}'),
  (52, 'country', 'Japan', 'JP', '{}');

INSERT INTO security (id, entity_id, ticker, exchange) VALUES
  (20, 44, 'AMAT', 'Nasdaq'), (21, 45, 'LRCX', 'Nasdaq'), (22, 46, 'KLAC', 'Nasdaq'), (23, 47, 'NVDA', 'Nasdaq'),
  (24, 48, 'ASML', 'Nasdaq'), (25, 49, '8035', 'TSE');

INSERT INTO link (src_id, dst_id, rel, via_id, attrs, evidence, confidence, source_id, valid_from, known_at) VALUES
  (44, 40, 'sells_in', NULL, '{"pct_of_revenue": 33}',   'disclosed', 0.95, 40, '2021-01-01', '2021-12-31'),
  (46, 40, 'sells_in', NULL, '{"pct_of_revenue": 29}',   'disclosed', 0.95, 41, '2021-07-01', '2022-08-05'),
  (45, 40, 'sells_in', NULL, '{"pct_of_revenue": 31}',   'disclosed', 0.95, 42, '2021-07-01', '2022-08-24'),
  (47, 40, 'sells_in', NULL, '{"pct_of_revenue": 26.4}', 'disclosed', 0.95, 43, '2021-02-01', '2022-03-18'),
  (48, 40, 'sells_in', NULL, '{}', 'analyst', 0.9, 1, NULL, '2022-01-01'),   -- sells there; share not loaded
  (49, 40, 'sells_in', NULL, '{}', 'analyst', 0.9, 1, NULL, '2022-01-01'),
  (44, 42, 'produces', 42, '{}', 'disclosed', 0.95, 1, NULL, '2022-01-01'),
  (45, 42, 'produces', 42, '{}', 'disclosed', 0.95, 1, NULL, '2022-01-01'),
  (46, 42, 'produces', 42, '{}', 'disclosed', 0.95, 1, NULL, '2022-01-01'),
  (48, 42, 'produces', 42, '{}', 'disclosed', 0.95, 1, NULL, '2022-01-01'),
  (49, 42, 'produces', 42, '{}', 'disclosed', 0.95, 1, NULL, '2022-01-01'),
  (47, 43, 'produces', 43, '{}', 'disclosed', 0.95, 1, NULL, '2022-01-01'),
  (44, 49, 'competes', 42, '{}', 'analyst', 0.9, 1, NULL, '2022-01-01'),    -- deposition, etch, clean
  (45, 49, 'competes', 42, '{}', 'analyst', 0.9, 1, NULL, '2022-01-01'),    -- etch, deposition
  (50, 42, 'regulates', NULL, '{}', 'disclosed', 0.95, 1, NULL, '2022-01-01'),
  -- Treaty allies, known for decades. No follow_prob given: the rule's default applies until cases teach one.
  (41, 51, 'allied_with', NULL, '{}', 'disclosed', 0.95, 1, '1949-04-04', '2000-01-01'),
  (41, 52, 'allied_with', NULL, '{}', 'disclosed', 0.95, 1, '1960-01-19', '2000-01-01');

INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (5, 'export_control', 'US license requirement on NVIDIA A100/H100 exports to China and Russia', '2022-08-26', '2022-08-31 16:30-04'),
  (4, 'export_control', 'BIS rule: advanced chips and chipmaking tools to China', '2022-10-07 14:00-04', '2022-10-07 14:00-04');

INSERT INTO claim (id, event_id, subject_id, object_id, change, magnitude, unit, attrs, statement, first_seen_at,
                   supersedes, resolution, resolved_at) VALUES
  (11, 5, 40, 43, 'export_restricted', NULL, NULL, '{"issuer": "US"}', 'License now required to export A100/H100 to China', '2022-08-31 16:30-04', NULL, 'true', '2022-10-07'),
  -- ~$400M of a ~$5.9B quarter outlook
  (12, 5, 47, NULL, 'revenue_loss', 6.8, 'pct_revenue', '{}', 'Up to ~$400M of Q3 sales at risk', '2022-08-31 18:00-04', NULL, 'true', '2022-11-16'),
  (13, 4, 40, 42, 'export_restricted', NULL, NULL, '{"issuer": "US", "status": "planned"}', 'US plans broader curbs on chip-tool exports to China in October', '2022-09-12 12:00-04', NULL, 'true', '2022-10-07'),
  (14, 4, 40, 42, 'export_restricted', NULL, NULL, '{"issuer": "US"}', 'BIS restricts tools for advanced logic, DRAM and NAND fabs in China', '2022-10-07 14:00-04', 13, 'true', '2022-10-07'),
  (15, 4, 40, 43, 'export_restricted', NULL, NULL, '{"issuer": "US"}', 'BIS restricts advanced computing chips to China', '2022-10-07 14:00-04', NULL, 'true', '2022-10-07'),
  -- ~$400M of a ~$6.65B quarter outlook
  (16, 4, 44, NULL, 'revenue_loss', 6.0, 'pct_revenue', '{}', 'Applied Materials: new rules cut Q4 sales by ~$400M', '2022-10-12 16:30-04', NULL, 'true', '2022-11-17');

INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES
  (11, 44, 'supports', 'primary'), (12, 45, 'supports', 'report'),
  (13, 46, 'supports', 'report'),
  (14, 47, 'supports', 'primary'), (15, 47, 'supports', 'primary'),
  (16, 49, 'supports', 'primary'), (16, 48, 'supports', 'report');

SELECT setval('source_id_seq', greatest(24, (SELECT max(id) FROM source))),
       setval('source_doc_id_seq', greatest(49, (SELECT max(id) FROM source_doc))),
       setval('entity_id_seq', greatest(52, (SELECT max(id) FROM entity))),
       setval('security_id_seq', greatest(25, (SELECT max(id) FROM security))),
       setval('event_id_seq', greatest(5, (SELECT max(id) FROM event))),
       setval('claim_id_seq', greatest(16, (SELECT max(id) FROM claim)));
