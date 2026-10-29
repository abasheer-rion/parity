-- Case 8 (government #5, third export-restriction case): US license requirement on NVIDIA H20 / AMD MI308 to China,
-- disclosed in NVIDIA's 8-K after the close on 2025-04-15 (accepted 17:22 ET). Exposure = China share from each 10-K
-- filed before then. Confound: 04-16 was a broad tariff-driven sell-off (S&P ~-2%, SOX -4%).

INSERT INTO source (id, name, kind, domain, is_primary, prior_confirmed, prior_retracted) VALUES
  (60, 'AMD', 'company', 'amd.com', true, 0, 0),
  (61, 'NPR', 'outlet',  'npr.org', false, 9, 1);

INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (140, 61, 'article', 'https://www.npr.org/2025/04/09/nx-s1-5356480/nvidia-china-ai-h20-chips-trump', 'White House puts planned H20 curbs on hold after Mar-a-Lago dinner (2 sources)', '2025-04-09 12:00-04'),
  (141, 22, 'filing', 'https://www.sec.gov/Archives/edgar/data/1045810/000104581025000082/nvda-20250409.htm',
          'NVIDIA 8-K: H20 needs a licence for China, indefinitely; up to ~$5.5B of charges', '2025-04-15 17:22-04'),
  (142, 60, 'filing', 'https://www.sec.gov/Archives/edgar/data/2488/000000248825000039/amd-20250415.htm',
          'AMD 8-K: MI308 needs a licence; up to ~$800M of charges', '2025-04-16 09:03-04'),
  (143, 22, 'filing', 'https://www.sec.gov/Archives/edgar/data/1045810/000104581025000023/nvda-20250126.htm', 'NVIDIA FY25 10-K: China incl. HK $17.1B of $130.5B (13.1%)', '2025-02-26'),
  (144, 60, 'filing', 'https://www.sec.gov/Archives/edgar/data/2488/000000248825000012/amd-20241228.htm', 'AMD FY24 10-K: China incl. HK $6.2B of $25.8B (24.2%)', '2025-02-05'),
  (145, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/1835632/000183563225000057/mrvl-20250201.htm', 'Marvell FY25 10-K: China 43% (ship-to)', '2025-03-12'),
  (146, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/707549/000070754924000106/lrcx-20240630.htm', 'Lam FY24 10-K: China 42%', '2024-08-29'),
  (147, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/6951/000000695124000044/amat-20241027.htm', 'Applied FY24 10-K: China 37%', '2024-12-13'),
  (148, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/319201/000031920124000021/klac-20240630.htm', 'KLA FY24 10-K: China 43%', '2024-08-09'),
  (149, 22, 'filing', 'https://www.sec.gov/Archives/edgar/data/1045810/000104581025000115/q1fy26pr.htm', 'NVIDIA Q1 FY26: $4.5B charge, $2.5B H20 not shipped, ~$8B H20 loss in Q2 guide', '2025-05-28 16:21-04');

INSERT INTO entity (id, kind, name, country, attrs) VALUES
  (140, 'company', 'AMD', 'US', '{"cik": "2488"}'),
  (141, 'company', 'Marvell', 'US', '{"cik": "1835632"}'),
  (142, 'company', 'TSMC', 'TW', '{}'),
  (143, 'company', 'SK Hynix', 'KR', '{}'),
  (144, 'company', 'Cambricon', 'CN', '{}'),
  (145, 'company', 'Hygon', 'CN', '{}'),
  (146, 'company', 'SMIC', 'CN', '{}'),
  (147, 'index',   'iShares Semiconductor ETF', 'US', '{}');
INSERT INTO security (id, entity_id, ticker, exchange) VALUES
  (90, 140, 'AMD', 'Nasdaq'), (91, 141, 'MRVL', 'Nasdaq'), (92, 142, 'TSM', 'NYSE'), (93, 143, '000660', 'KRX'),
  (94, 144, '688256', 'SSE'), (95, 145, '688041', 'SSE'), (96, 146, '0981', 'HKEX'), (97, 147, 'SOXX', 'Nasdaq');

INSERT INTO link (src_id, dst_id, rel, via_id, attrs, evidence, confidence, source_id, valid_from, valid_to, known_at) VALUES
  (47,  40, 'sells_in', NULL, '{"pct_of_revenue": 13.1}', 'disclosed', 0.95, 143, '2024-01-29', NULL, '2025-02-26'),
  (140, 40, 'sells_in', NULL, '{"pct_of_revenue": 24.2}', 'disclosed', 0.95, 144, '2024-01-01', NULL, '2025-02-05'),
  (141, 40, 'sells_in', NULL, '{"pct_of_revenue": 43}',   'disclosed', 0.9,  145, '2024-02-04', NULL, '2025-03-12'),
  (45,  40, 'sells_in', NULL, '{"pct_of_revenue": 42}',   'disclosed', 0.95, 146, '2023-06-26', NULL, '2024-08-29'),
  (44,  40, 'sells_in', NULL, '{"pct_of_revenue": 37}',   'disclosed', 0.95, 147, '2023-10-30', NULL, '2024-12-13'),
  (46,  40, 'sells_in', NULL, '{"pct_of_revenue": 43}',   'disclosed', 0.95, 148, '2023-07-01', NULL, '2024-08-09'),
  (140, 43, 'produces', 43, '{}', 'disclosed', 0.95, 1, NULL, NULL, '2024-01-01'),
  (142, 47,  'supplies', NULL, '{}', 'analyst', 0.8, 1, NULL, NULL, '2024-01-01'),   -- makes NVIDIA's chips
  (142, 140, 'supplies', NULL, '{}', 'analyst', 0.8, 1, NULL, NULL, '2024-01-01'),
  (47, 144, 'competes', 43, '{}', 'analyst', 0.7, 1, NULL, NULL, '2024-01-01'),     -- Chinese AI-chip rivals
  (47, 145, 'competes', 43, '{}', 'analyst', 0.6, 1, NULL, NULL, '2024-01-01'),
  (144, 40, 'sells_in', NULL, '{}', 'analyst', 0.9, 1, NULL, NULL, '2024-01-01'),
  (145, 40, 'sells_in', NULL, '{}', 'analyst', 0.9, 1, NULL, NULL, '2024-01-01');

INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (10, 'export_control', 'US requires licences for NVIDIA H20 / AMD MI308 to China', '2025-04-09', '2025-04-15 17:22-04');

INSERT INTO claim (id, event_id, subject_id, object_id, change, magnitude, unit, attrs, statement, first_seen_at, resolution, resolved_at) VALUES
  (50, 10, 40, 43, 'export_restricted', NULL, NULL, '{"issuer": "US", "scope": "H20-class accelerators"}',
   'H20-class chips need a licence for China, for the indefinite future', '2025-04-15 17:22-04', 'partly', '2025-07-14'),
  -- A charge is not lost revenue: recorded so it is never mistaken for guidance.
  (51, 10, 47, NULL, 'writedown', 5500, 'usd_m', '{}', 'NVIDIA: up to ~$5.5B of H20 charges', '2025-04-15 17:22-04', 'partly', '2025-05-28'),
  (52, 10, 140, NULL, 'writedown', 800, 'usd_m', '{}', 'AMD: up to ~$800M of MI308 charges', '2025-04-16 09:03-04', 'true', '2025-05-06');
INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES
  (50, 141, 'supports', 'primary'), (50, 142, 'supports', 'primary'), (51, 141, 'supports', 'primary'), (52, 142, 'supports', 'primary');

INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint, replay_at) VALUES
  (8, 10, 'US curbs NVIDIA H20 sales to China (Apr 2025)',
   'A government extends an export restriction to the cut-down chip a company designed to comply with the last one',
   'NVIDIA disclosed after the close on 04-15 that its China-compliant H20 now needed a licence indefinitely, with up to '
   '$5.5B of charges; AMD followed for the MI308 before the next open. A week earlier a report said the curbs were on hold. '
   'The next day the whole market sold off on tariffs, so the event has to be read against the sector, not just the market.',
   '{"event_kind": "export_control", "mechanisms": ["policy"], "issuer": "US", "target": "CN", "sector": "semiconductors",
     "precursor": "Oct-2022 and Oct-2023 rules; H20 was the compliant design", "contrary_report": "NPR 04-09: curbs on hold",
     "confound": "broad tariff sell-off 04-16", "reversed": "2025-07-14"}',
   '2025-04-15 17:30-04');

SELECT setval('source_id_seq', greatest(61, (SELECT max(id) FROM source))),
       setval('source_doc_id_seq', greatest(149, (SELECT max(id) FROM source_doc))),
       setval('entity_id_seq', greatest(147, (SELECT max(id) FROM entity))),
       setval('security_id_seq', greatest(97, (SELECT max(id) FROM security))),
       setval('event_id_seq', greatest(10, (SELECT max(id) FROM event))),
       setval('claim_id_seq', greatest(52, (SELECT max(id) FROM claim))),
       setval('case_study_id_seq', greatest(8, (SELECT max(id) FROM case_study)));
