-- The world graph around the Renesas Naka fire (2021-03-19), plus the claims that came in about it.
-- Graph numbers are rough, hand-entered, and marked as such. Event facts come from the cited reports.

-- ───────────── sources ─────────────
INSERT INTO source (id, name, kind, domain, is_primary, prior_confirmed, prior_retracted) VALUES
  (1, 'Parity manual entry',     'manual',         NULL,                    false, 0,  0),
  (2, 'Renesas Electronics',     'company',        'renesas.com',           true,  0,  0),
  (3, 'Wall Street Journal',     'outlet',         'wsj.com',               false, 19, 1),
  (4, 'Associated Press',        'wire',           'apnews.com',            false, 19, 1),
  (5, 'The Register',            'outlet',         'theregister.com',       false, 9,  1),
  (6, 'NXP Semiconductors',      'company',        'nxp.com',               true,  0,  0),
  (7, 'Infineon Technologies',   'company',        'infineon.com',          true,  0,  0),
  (8, '@jp_chip_insider (new)',  'social_account', 'x.com',                 false, 0,  0),
  (9, 'Taipei Times',            'outlet',         'taipeitimes.com',       false, 9,  1);

INSERT INTO source_doc (id, source_id, kind, url, title, published_at, syndicated_from) VALUES
  (1,  1, 'manual', NULL, 'Hand-entered graph seed (approximate, not research-grade)', '2021-01-01', NULL),
  (2,  2, 'press_release', 'https://www.renesas.com/en/about/press-room/update-6-notice-regarding-semiconductor-manufacturing-factory-naka-factory-fire',
         'Notice regarding Naka Factory fire', '2021-03-19 12:00+09', NULL),
  (3,  2, 'press_release', NULL, 'Update: N3 restart targeted within one month', '2021-03-21 18:00+09', NULL),
  (4,  5, 'article', 'https://www.theregister.com/2021/03/21/renesas_fire/', 'Renesas fire', '2021-03-21 20:00+09', NULL),
  (5,  2, 'press_release', NULL, 'Update: full shipment recovery ~100 days after the fire', '2021-03-30 18:00+09', NULL),
  (6,  3, 'article', NULL, 'Renesas chip-plant fire spreads concerns about global auto production', '2021-03-22 20:00+09', NULL),
  (7,  4, 'article', 'https://techxplore.com/news/2021-06-automotive-chip-maker-recovered-blaze.html',
         'Automotive chip maker says it''s nearly recovered from blaze', '2021-06-01', NULL),
  (8,  9, 'article', 'https://www.taipeitimes.com/News/biz/archives/2021/03/23/2003754302',
         'Reprint of AP: Renesas fire', '2021-03-23', NULL),
  (9,  8, 'post', NULL, 'Naka fab is DESTROYED, out for a year, sell everything', '2021-03-20 01:00+09', NULL),
  (10, 6, 'press_release', NULL, 'NXP Austin fabs closed amid Texas power outages', '2021-02-17', NULL),
  (11, 7, 'press_release', NULL, 'Infineon Austin power shut off; output back to pre-storm by June', '2021-02-17', NULL),
  (12, 2, 'press_release', 'https://www.renesas.com/en/about/press-room/update-6-notice-regarding-semiconductor-manufacturing-factory-naka-factory-fire',
         'Update 6: N3 production restarted 2021-04-17 at just under 10%', '2021-04-17 18:00+09', NULL);
UPDATE source_doc SET syndicated_from = 7 WHERE id = 8;  -- a reprint is not a second witness

-- ───────────── entities ─────────────
INSERT INTO entity (id, kind, name, country, parent_id) VALUES
  (1,  'company', 'Renesas Electronics', 'JP', NULL),
  (2,  'company', 'Toyota Motor', 'JP', NULL),
  (3,  'company', 'Nissan Motor', 'JP', NULL),
  (4,  'company', 'NXP Semiconductors', 'NL', NULL),
  (5,  'company', 'Infineon Technologies', 'DE', NULL),
  (6,  'company', 'Denso', 'JP', NULL),
  (7,  'company', 'Honda Motor', 'JP', NULL),
  (10, 'product', 'semiconductor', NULL, NULL),
  (11, 'product', 'automotive microcontroller', NULL, 10),
  (12, 'product', 'passenger vehicle', NULL, NULL),
  (13, 'product', 'automotive ECU', NULL, NULL),
  (20, 'facility', 'Renesas Naka N3 (300mm line)', 'JP', NULL),
  (21, 'facility', 'Toyota Tsutsumi Plant', 'JP', NULL),
  (22, 'facility', 'Nissan Oppama Plant', 'JP', NULL),
  (23, 'facility', 'Denso Anjo Plant', 'JP', NULL),
  (24, 'facility', 'NXP Austin fabs', 'US', NULL),
  (25, 'facility', 'Infineon Austin fab', 'US', NULL),
  (26, 'facility', 'Honda Saitama Plant', 'JP', NULL);
INSERT INTO entity_alias VALUES (1, 'ルネサス', 'ja'), (1, 'Renesas', 'en'), (20, 'Naka fab', 'en');

INSERT INTO entity_geo VALUES
  (20, ST_MakePoint(140.53, 36.39)::geography, NULL, 2000),
  (21, ST_MakePoint(137.17, 35.06)::geography, NULL, 1000),
  (22, ST_MakePoint(139.63, 35.31)::geography, NULL, 1000),
  (23, ST_MakePoint(137.07, 34.95)::geography, NULL, 1000),
  (24, ST_MakePoint(-97.86, 30.22)::geography, NULL, 3000),
  (25, ST_MakePoint(-97.70, 30.38)::geography, NULL, 3000),
  (26, ST_MakePoint(139.20, 36.10)::geography, NULL, 3000);

INSERT INTO security (id, entity_id, ticker, exchange) VALUES
  (1, 1, '6723', 'TSE'), (2, 2, '7203', 'TSE'), (3, 3, '7201', 'TSE'), (4, 4, 'NXPI', 'NASDAQ'),
  (5, 5, 'IFX', 'XETRA'), (6, 6, '6902', 'TSE'), (7, 7, '7267', 'TSE');

-- ───────────── links, as known before the fire ─────────────
INSERT INTO link (src_id, dst_id, rel, via_id, attrs, evidence, confidence, source_id, valid_from, known_at) VALUES
  (1, 20, 'owns', NULL, '{"stake_pct": 100}', 'disclosed', 0.95, 1, '2000-01-01', '2021-01-01'),
  (2, 21, 'owns', NULL, '{"stake_pct": 100}', 'disclosed', 0.95, 1, '2000-01-01', '2021-01-01'),
  (3, 22, 'owns', NULL, '{"stake_pct": 100}', 'disclosed', 0.95, 1, '2000-01-01', '2021-01-01'),
  (6, 23, 'owns', NULL, '{"stake_pct": 100}', 'disclosed', 0.95, 1, '2000-01-01', '2021-01-01'),
  (4, 24, 'owns', NULL, '{"stake_pct": 100}', 'disclosed', 0.95, 1, '2000-01-01', '2021-01-01'),
  (5, 25, 'owns', NULL, '{"stake_pct": 100}', 'disclosed', 0.95, 1, '2000-01-01', '2021-01-01'),
  (7, 26, 'owns', NULL, '{"stake_pct": 100}', 'disclosed', 0.95, 1, '2000-01-01', '2021-01-01'),
  -- Renesas is ~30% of world automotive MCUs (WSJ); N3's slice of that is our guess, hence 15% at low confidence.
  (20, 11, 'produces', 11, '{"global_share_pct": 15, "substitutable_days": 100}', 'analyst', 0.5, 1, '2020-01-01', '2021-01-01'),
  (24, 11, 'produces', 11, '{}', 'analyst', 0.8, 1, '2020-01-01', '2021-01-01'),
  (25, 11, 'produces', 11, '{}', 'analyst', 0.8, 1, '2020-01-01', '2021-01-01'),
  (21, 12, 'produces', 12, '{}', 'disclosed', 0.9, 1, '2020-01-01', '2021-01-01'),
  (22, 12, 'produces', 12, '{}', 'disclosed', 0.9, 1, '2020-01-01', '2021-01-01'),
  (26, 12, 'produces', 12, '{}', 'disclosed', 0.9, 1, '2020-01-01', '2021-01-01'),
  (23, 13, 'produces', 13, '{}', 'disclosed', 0.9, 1, '2020-01-01', '2021-01-01'),
  (11, 12, 'input_of', NULL, '{"criticality": "blocking"}', 'analyst', 0.9, 1, NULL, '2021-01-01'),
  (11, 13, 'input_of', NULL, '{"criticality": "blocking"}', 'analyst', 0.9, 1, NULL, '2021-01-01'),
  (13, 12, 'input_of', NULL, '{"criticality": "blocking"}', 'analyst', 0.9, 1, NULL, '2021-01-01'),
  (1, 2, 'supplies', 11, '{}', 'analyst', 0.7, 1, '2020-01-01', '2021-01-01'),
  (1, 3, 'supplies', 11, '{}', 'analyst', 0.6, 1, '2020-01-01', '2021-01-01'),
  (1, 6, 'supplies', 11, '{"pct_of_customer_input": 40, "buffer_days": 30}', 'analyst', 0.8, 1, '2020-01-01', '2021-01-01'),
  (6, 2, 'supplies', 13, '{"pct_of_customer_input": 50, "buffer_days": 20}', 'analyst', 0.8, 1, '2020-01-01', '2021-01-01'),
  -- Deliberately NOT here: Renesas -> Honda. The case will show it as a miss caused by a missing link.
  (1, 4, 'competes', 11, '{}', 'analyst', 0.9, 1, NULL, '2021-01-01'),
  (1, 5, 'competes', 11, '{}', 'analyst', 0.9, 1, NULL, '2021-01-01'),
  -- Learned AFTER the fire: must not appear in a replay at the fire date.
  (1, 2, 'supplies', 11, '{"single_source": true}', 'analyst', 0.99, 1, '2021-06-01', '2021-06-01');

-- ───────────── events and claims ─────────────
INSERT INTO event (id, kind, description, geom, radius_m, occurred_at, first_seen_at) VALUES
  (1, 'storm', 'Winter storm Uri: Austin Energy orders chip fabs to shut', ST_MakePoint(-97.74, 30.27)::geography, 30000,
   '2021-02-15 00:00-06', '2021-02-16 00:00-06'),
  (2, 'fire', 'Fire at Renesas Naka N3 300mm line', ST_MakePoint(140.531, 36.391)::geography, 3000,
   '2021-03-19 02:47+09', '2021-03-19 12:00+09');

INSERT INTO claim (id, event_id, subject_id, change, magnitude, unit, duration_days, statement, first_seen_at, supersedes,
                   resolution, resolved_at) VALUES
  (1, 1, 24, 'capacity_loss', 100, 'pct_capacity', 30,  'NXP Austin fabs shut by power cuts',              '2021-02-17', NULL, 'true', '2021-03-15'),
  (2, 1, 25, 'capacity_loss', 100, 'pct_capacity', 120, 'Infineon Austin shut; pre-storm output by June',  '2021-02-17', NULL, 'true', '2021-06-30'),
  (3, 2, 20, 'capacity_loss', 100, 'pct_capacity', NULL,'N3 line production stopped after fire',           '2021-03-19 12:00+09', NULL, 'true', '2021-04-17'),
  (4, 2, 20, 'capacity_loss', 100, 'pct_capacity', 365, 'Naka fab destroyed, out for a year',              '2021-03-20 01:00+09', NULL, 'false', '2021-04-17'),
  (5, 2, 20, 'capacity_loss', 100, 'pct_capacity', 30,  'N3 restart targeted within one month',            '2021-03-21 18:00+09', 3, 'partly', '2021-04-17'),
  -- Down ~29 days, then a ramp to full by end of May; shipments back ~day 100. Averaged: ~75% for 100 days.
  (6, 2, 20, 'capacity_loss', 75,  'pct_capacity', 100, 'Full shipment recovery ~100 days after the fire', '2021-03-30 18:00+09', 5, 'true', '2021-06-30');

INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES
  (1, 10, 'supports', 'primary'),
  (2, 11, 'supports', 'primary'),
  (3, 2,  'supports', 'primary'),
  (4, 9,  'supports', 'report'),
  (5, 3,  'supports', 'primary'), (5, 4, 'supports', 'report'), (5, 6, 'supports', 'report'),
  (6, 5,  'supports', 'primary'), (6, 7, 'supports', 'report'), (6, 8, 'supports', 'report'),
  (4, 12, 'denies',   'primary');  -- Renesas restarting N3 on 04-17 kills the "out for a year" claim

SELECT setval('source_id_seq', 9), setval('source_doc_id_seq', 12), setval('entity_id_seq', 26),
       setval('security_id_seq', 7), setval('event_id_seq', 2), setval('claim_id_seq', 6);
