-- Case 2: Starbucks hires Chipotle's CEO, 2024-08-13. No government, no factory: one person moves, two stocks move.
-- Press-release times are approximate (pre-market, before 7am ET). Leaders' track records are APPROXIMATE (rough share-price math, not yet computed from price_daily). Status 'draft'.

INSERT INTO source (id, name, kind, domain, is_primary, prior_confirmed, prior_retracted) VALUES
  (10, 'Starbucks',             'company', 'starbucks.com', true,  0, 0),
  (11, 'Chipotle Mexican Grill','company', 'chipotle.com',  true,  0, 0),
  (12, 'NBC News / CNBC',       'outlet',  'nbcnews.com',   false, 19, 1),
  (13, 'Fortune',               'outlet',  'fortune.com',   false, 9, 1),
  (14, 'Quartz',                'outlet',  'qz.com',        false, 9, 1);

INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (20, 1,  'manual', NULL, 'Leader track records, approximate (tenure share return vs S&P 500); replace with computed', '2024-08-12'),
  (21, 10, 'press_release', NULL, 'Starbucks names Brian Niccol chairman and CEO; Narasimhan steps down', '2024-08-13 06:45-04'),
  (22, 11, 'press_release', 'https://ir.chipotle.com/2024-08-13-CHIPOTLE-ANNOUNCES-CEO-DEPARTURE', 'Chipotle announces CEO departure', '2024-08-13 06:50-04'),
  (23, 11, 'filing', 'https://www.sec.gov/Archives/edgar/data/1058090/000105809024000035/cmg-20240812.htm', 'Chipotle 8-K, Item 5.02', '2024-08-13 07:00-04'),
  (24, 12, 'article', 'https://www.nbcmiami.com/news/business/money-report/starbucks-replaces-ceo-laxman-narasimhan-with-chipotle-ceo-brian-niccol/3390943/',
         'Starbucks replaces CEO Laxman Narasimhan with Chipotle CEO Brian Niccol', '2024-08-13 08:00-04'),
  (25, 13, 'article', 'https://fortune.com/2024/08/13/starbucks-chipotle-elliott-investment-management-salesforce-proxy-fights-activisit-funds-twitter-jack-dorsey-elon-musk',
         'Elliott and Starboard endorse Niccol', '2024-08-13 12:00-04'),
  (26, 14, 'article', 'https://qz.com/starbucks-chipotle-stock-sbux-cmg-ceo-niccol-1851620677', 'SBUX +24.5%, CMG down on CEO swap', '2024-08-13 17:00-04');

INSERT INTO entity (id, kind, name, country, attrs) VALUES
  (30, 'company', 'Starbucks', 'US', '{"cik": "829224"}'),
  (31, 'company', 'Chipotle Mexican Grill', 'US', '{"cik": "1058090"}'),
  (32, 'person',  'Brian Niccol', 'US', '{}'),
  (33, 'person',  'Laxman Narasimhan', 'US', '{}'),
  (34, 'fund',    'Elliott Investment Management', 'US', '{}'),
  (35, 'fund',    'Starboard Value', 'US', '{}'),
  (36, 'person',  'Scott Boatwright', 'US', '{}');
INSERT INTO security (id, entity_id, ticker, exchange) VALUES (8, 30, 'SBUX', 'Nasdaq'), (9, 31, 'CMG', 'NYSE');

-- Leadership graph as known the night before.
-- Niccol at Chipotle since 2018-03: shares up ~8x vs S&P ~2x => roughly +28%/yr excess.
-- Narasimhan at Starbucks since 2023-03: shares down ~25% vs S&P up ~35% => roughly -45%/yr excess.
INSERT INTO link (src_id, dst_id, rel, attrs, evidence, confidence, source_id, valid_from, known_at) VALUES
  (32, 31, 'leads', '{"role": "CEO", "tenure_excess_return_pct_ann": 28}',  'analyst', 0.6, 20, '2018-03-05', '2024-08-12'),
  (33, 30, 'leads', '{"role": "CEO", "tenure_excess_return_pct_ann": -45}', 'analyst', 0.6, 20, '2023-03-20', '2024-08-12'),
  (36, 31, 'leads', '{"role": "COO"}', 'disclosed', 0.9, 20, '2017-01-01', '2024-08-12'),
  (34, 30, 'holds', '{"activist": true}', 'analyst', 0.8, 20, '2024-07-01', '2024-08-12'),
  (35, 30, 'holds', '{"activist": true}', 'analyst', 0.7, 20, '2024-07-01', '2024-08-12'),
  (30, 31, 'competes', '{}', 'analyst', 0.5, 20, NULL, '2024-08-12');

INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (3, 'leadership_change', 'Starbucks hires Chipotle CEO Brian Niccol; Narasimhan out', '2024-08-13 06:45-04', '2024-08-13 06:46-04');

INSERT INTO claim (id, event_id, subject_id, object_id, change, attrs, statement, first_seen_at, resolution, resolved_at) VALUES
  (7,  3, 30, 33, 'leader_departed',  '{"role": "CEO", "planned": false}', 'Narasimhan steps down as Starbucks CEO, effective immediately', '2024-08-13 06:46-04', 'true', '2024-08-13'),
  (8,  3, 30, 32, 'leader_appointed', '{"role": "CEO", "planned": false}', 'Brian Niccol to be Starbucks chairman and CEO from Sep 9',      '2024-08-13 06:46-04', 'true', '2024-09-09'),
  (9,  3, 31, 32, 'leader_departed',  '{"role": "CEO", "planned": false}', 'Niccol leaves Chipotle effective Aug 31',                        '2024-08-13 06:51-04', 'true', '2024-08-31'),
  (10, 3, 31, 36, 'leader_appointed', '{"role": "CEO", "planned": false, "interim": true}', 'COO Scott Boatwright named interim CEO', '2024-08-13 06:51-04', 'true', '2024-08-13');

INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES
  (7, 21, 'supports', 'primary'), (7, 24, 'supports', 'report'),
  (8, 21, 'supports', 'primary'), (8, 24, 'supports', 'report'),
  (9, 22, 'supports', 'primary'), (9, 23, 'supports', 'primary'),
  (10, 22, 'supports', 'primary');

INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint) VALUES
  (2, 3, 'Starbucks hires Chipotle''s CEO (2024)',
   'An underperforming CEO under activist pressure is replaced by a rival chain''s star CEO',
   'With sales down two quarters running and Elliott and Starboard pushing, Starbucks abruptly replaced its CEO of '
   '17 months with Chipotle''s CEO, whose six-year run had multiplied Chipotle''s value. One person moving re-rated both '
   'companies the same morning, in opposite directions.',
   '{"event_kind": "leadership_change", "mechanisms": ["governance"], "sector": "restaurants", "region": "US",
     "role": "CEO", "abrupt": true, "activist_present": true,
     "departing_record": "weak", "arriving_record": "strong", "poached_from_listed_peer": true}');

INSERT INTO case_step (id, case_id, parent_id, role, entity_id, mechanism, direction, description, why_not,
                       happened_at, public_at, evidence_doc) VALUES
  (11, 2, NULL, 'cause', 30, NULL, NULL,
   'Same-store sales had fallen two quarters in a row and the shares had lagged the market badly under Narasimhan.',
   NULL, '2024-07-30', '2024-07-30 16:05-04', 24),
  (12, 2, NULL, 'condition', 30, NULL, NULL,
   'Elliott took a stake and engaged the board from about June; Starboard also built a position. Pressure for change was public.',
   NULL, '2024-07-01', '2024-07-31', 25),
  (13, 2, 11, 'event', 30, 'governance', NULL,
   'Board removes Narasimhan immediately and hires Niccol, who had run Chipotle since 2018. Chipotle names COO Boatwright interim CEO.',
   NULL, '2024-08-13', '2024-08-13 06:46-04', 21),
  (14, 2, 13, 'consequence', 30, 'governance', 1,
   'Starbucks closed up 24.5%, its best day on record, erasing the year''s losses. Most of it was in the opening print: '
   'roughly 21% was already there in early trading.',
   NULL, '2024-08-13', '2024-08-13 09:30-04', 26),
  (15, 2, 13, 'consequence', 31, 'governance', -1,
   'Chipotle closed down 7.5% after falling as much as 13% intraday, on fear its turnaround leaves with him.',
   NULL, '2024-08-13', '2024-08-13 09:30-04', 26),
  (16, 2, 12, 'could_have', 34, 'governance', NULL,
   'The activists escalate to a proxy fight for board seats.',
   'The board made the change itself; Elliott and Starboard publicly endorsed Niccol the same day.',
   '2024-08-13', '2024-08-13 12:00-04', 25);

INSERT INTO case_move (case_id, security_id, window_name, raw_return, abnormal_return, evidence_doc) VALUES
  (2, 8, 'd1', 24.5, NULL, 26),
  (2, 9, 'd1', -7.5, NULL, 26);

INSERT INTO case_opportunity (case_id, security_id, action, enter_at, exit_at, payoff_pct, rationale) VALUES
  (2, 8, 'long', '2024-08-13 06:46-04', '2024-08-13 16:00-04', NULL,
   'Pre-market, on the press release. By the open ~21 of the 24.5 points were gone: this edge is pure speed.'),
  (2, 9, 'short', '2024-08-13 06:51-04', NULL, NULL,
   'Key-person risk on Chipotle; it fell up to 13% intraday and closed -7.5%, so the exit matters as much as the entry.'),
  (2, 8, 'long', '2024-07-31 00:00-04', '2024-08-13 16:00-04', NULL,
   'Pattern, not prediction: weak CEO record + two bad quarters + activists engaged = raised odds of a CEO change. '
   'This is where the case library''s look-alikes earn their keep.');

SELECT setval('source_id_seq', greatest(14, (SELECT max(id) FROM source))),
       setval('source_doc_id_seq', greatest(26, (SELECT max(id) FROM source_doc))),
       setval('entity_id_seq', greatest(36, (SELECT max(id) FROM entity))),
       setval('security_id_seq', greatest(9, (SELECT max(id) FROM security))),
       setval('event_id_seq', greatest(3, (SELECT max(id) FROM event))),
       setval('claim_id_seq', greatest(10, (SELECT max(id) FROM claim))),
       setval('case_study_id_seq', 2), setval('case_step_id_seq', 16);
