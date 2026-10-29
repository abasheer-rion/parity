-- Cases 6 and 7 (government #3/#4): US sanctions on Deripaska, EN+ and Rusal (2018-04-06), and Treasury's easing
-- (2018-04-23). Facts: Treasury releases sm0338/sm0365, AL Circle, Fortune, Fool, Arkansas Online/AP.
-- Announcement times are not verified: 04-06 came during US/London hours after Hong Kong had closed; 04-23 during the
-- London morning. Shares: Rusal ~6% of world aluminium (AP; Fool says 7%).

INSERT INTO source (id, name, kind, domain, is_primary, prior_confirmed, prior_retracted) VALUES
  (50, 'US Treasury (OFAC)', 'government', 'treasury.gov', true, 0, 0),
  (51, 'AL Circle',          'outlet',     'alcircle.com', false, 4, 1),
  (52, 'Fortune',            'outlet',     'fortune.com',  false, 9, 1);

INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (120, 50, 'press_release', 'https://home.treasury.gov/news/press-releases/sm0338', 'Treasury designates Russian oligarchs, officials and entities (Deripaska, EN+, Rusal)', '2018-04-06 10:30-04'),
  (121, 50, 'press_release', 'https://home.treasury.gov/news/press-releases/sm0365', 'General License 14: Rusal wind-down extended to Oct 23; path to relief if Deripaska cedes control', '2018-04-23 09:00-04'),
  (122, 52, 'article', 'https://fortune.com/2018/04/09/rusal-oleg-deripaska-sanctions-stock', 'Rusal closes down 50%; EN+, Nornickel, Glencore fall', '2018-04-09 08:00-04'),
  (123, 51, 'article', 'https://www.alcircle.com/news/lme-aluminium-falls-by-10-after-us-hints-at-easing-sanctions-on-rusal-30258', 'LME aluminium falls ~10% after US hints at easing', '2018-04-23 16:00-04'),
  (124, 1, 'article', 'https://www.steptoe.com/en/news-publications/international-compliance-blog/more-sanctions-ahead-after-treasurys-reports-to-congress-on-russian-oligarchs-defenseintel-sanctions.html',
          'CAATSA "Kremlin list" names Deripaska; Mnuchin: "there will be sanctions"', '2018-01-30'),
  (125, 1, 'article', 'https://www.alcircle.com/news/rusals-aluminium-production-rises-0-6-yoy-in-2017-29729', 'Rusal 2017 output 3,707 kt aluminium', '2018-02-01'),
  (126, 1, 'article', 'https://investegate.co.uk/announcement/rns/rio-tinto--rio/rio-tinto-reviews-arrangements-with-rusal/5325921', 'Rio Tinto declares force majeure on certain Rusal contracts', '2018-04-13 02:00-04'),
  (127, 1, 'article', 'https://www.arabnews.com/node/1436811/world', 'Senate fails to block Rusal delisting, 57-42', '2019-01-16');

INSERT INTO entity (id, kind, name, country, attrs) VALUES
  (120, 'company', 'Rusal', 'RU', '{}'),
  (121, 'commodity', 'aluminium', NULL, '{}'),
  (122, 'company', 'EN+ Group', 'RU', '{}'),
  (123, 'person', 'Oleg Deripaska', 'RU', '{}'),
  (124, 'company', 'Glencore', 'CH', '{}'),
  (125, 'company', 'Nornickel', 'RU', '{}'),
  (126, 'company', 'Alcoa', 'US', '{"cik": "1675149"}'),
  (127, 'company', 'Century Aluminum', 'US', '{"cik": "949157"}'),
  (128, 'company', 'Norsk Hydro', 'NO', '{}'),
  (129, 'company', 'South32', 'AU', '{}'),
  (130, 'company', 'Yunnan Aluminium', 'CN', '{}'),
  (131, 'company', 'Rio Tinto', 'GB', '{}'),
  (132, 'company', 'Arconic (now Howmet)', 'US', '{"cik": "4281"}'),
  (133, 'company', 'Kaiser Aluminum', 'US', '{"cik": "811596"}');

INSERT INTO security (id, entity_id, ticker, exchange) VALUES
  (70, 120, '0486', 'HKEX'), (71, 124, 'GLEN', 'LSE'), (72, 125, 'GMKN', 'MOEX'), (73, 126, 'AA', 'NYSE'),
  (74, 127, 'CENX', 'Nasdaq'), (75, 128, 'NHY', 'OSL'), (76, 129, 'S32', 'ASX'), (77, 130, '000807', 'SZSE'),
  (78, 131, 'RIO', 'LSE'), (79, 132, 'HWM', 'NYSE'), (80, 133, 'KALU', 'Nasdaq');

INSERT INTO link (src_id, dst_id, rel, via_id, attrs, evidence, confidence, source_id, valid_from, valid_to, known_at) VALUES
  (120, 121, 'produces', 121, '{"global_share_pct": 6}', 'analyst', 0.8, 125, '2017-01-01', NULL, '2018-02-01'),
  (122, 120, 'owns', NULL, '{"stake_pct": 48}', 'disclosed', 0.9, 1, '2017-11-01', NULL, '2017-11-01'),
  (123, 122, 'owns', NULL, '{"stake_pct": 76.6}', 'disclosed', 0.9, 1, '2017-11-01', NULL, '2017-11-01'),
  -- 8.75% of a ~$8.5B company is ~1% of Glencore's ~$70B value: analyst estimate
  (124, 120, 'holds', NULL, '{"stake_pct": 8.75, "pct_of_holder_value": 1}', 'disclosed', 0.8, 1, '2017-01-01', NULL, '2018-01-01'),
  (120, 125, 'owns', NULL, '{"stake_pct": 27.8}', 'disclosed', 0.9, 1, '2017-01-01', NULL, '2018-01-01'),
  (126, 121, 'produces', 121, '{"pct_revenue_from_commodity": 100}', 'disclosed', 0.9, 1, NULL, NULL, '2018-01-01'),
  (127, 121, 'produces', 121, '{"pct_revenue_from_commodity": 100}', 'disclosed', 0.9, 1, NULL, NULL, '2018-01-01'),
  (128, 121, 'produces', 121, '{}', 'disclosed', 0.9, 1, NULL, NULL, '2018-01-01'),
  (129, 121, 'produces', 121, '{}', 'disclosed', 0.8, 1, NULL, NULL, '2018-01-01'),
  (130, 121, 'produces', 121, '{"pct_revenue_from_commodity": 100}', 'disclosed', 0.8, 1, NULL, NULL, '2018-01-01'),
  (131, 121, 'produces', 121, '{"pct_revenue_from_commodity": 25}', 'analyst', 0.7, 1, NULL, NULL, '2018-01-01'),
  (132, 121, 'depends_on', NULL, '{"role": "buys and rolls aluminium"}', 'analyst', 0.8, 1, NULL, NULL, '2018-01-01'),
  (133, 121, 'depends_on', NULL, '{"role": "buys and rolls aluminium"}', 'analyst', 0.8, 1, NULL, NULL, '2018-01-01'),
  (131, 120, 'supplies', NULL, '{"what": "bauxite and alumina contracts"}', 'disclosed', 0.8, 126, NULL, NULL, '2018-01-01');

INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (8, 'sanction', 'OFAC designates Deripaska, EN+ and Rusal', '2018-04-06 10:30-04', '2018-04-06 10:30-04'),
  (9, 'sanction', 'Treasury extends Rusal wind-down, signals relief if Deripaska cedes control', '2018-04-23 09:00-04', '2018-04-23 09:00-04');

INSERT INTO claim (id, event_id, subject_id, object_id, change, attrs, statement, first_seen_at, resolution, resolved_at) VALUES
  (40, 8, 120, NULL, 'sanctioned', '{"issuer": "US", "scope": "SDN", "wind_down": "2018-06-05"}',
   'Rusal designated (owned by EN+, controlled by Deripaska); US persons must wind down by 06-05', '2018-04-06 10:30-04', 'partly', '2019-01-27'),
  (41, 8, 122, NULL, 'sanctioned', '{"issuer": "US", "scope": "SDN"}', 'EN+ designated', '2018-04-06 10:30-04', 'partly', '2019-01-27'),
  (42, 9, 120, NULL, 'sanction_eased', '{"issuer": "US", "offtake_loss": 0.15, "prev_offtake_loss": 0.5, "wind_down": "2018-10-23"}',
   'Rusal wind-down extended to 10-23; relief offered if Deripaska divests and gives up control', '2018-04-23 09:00-04', 'true', '2019-01-27');
INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES
  (40, 120, 'supports', 'primary'), (40, 122, 'supports', 'report'), (41, 120, 'supports', 'primary'),
  (42, 121, 'supports', 'primary'), (42, 123, 'supports', 'report');

INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint) VALUES
  (6, 8, 'US sanctions Rusal (Apr 2018)',
   'A government sanctions the owner of a producer of ~6% of a world commodity',
   'OFAC designated Deripaska, EN+ and Rusal. Rusal''s metal could no longer reach many Western buyers, so aluminium ran '
   'to a seven-year high, rival producers jumped, and Rusal lost half its value in a day. Its 27.8% stake in Nornickel '
   'dragged that unsanctioned company down too.',
   '{"event_kind": "sanction", "mechanisms": ["policy"], "issuer": "US", "target": "a company (commodity producer)",
     "commodity": "aluminium", "world_share_pct": 6, "warning": "Kremlin list 01-29, no leak of the action"}'),
  (7, 9, 'Treasury eases Rusal sanctions (Apr 2018)',
   'Two weeks after sanctioning a commodity producer, the government signals a way out',
   'Treasury extended the wind-down to October and offered relief if Deripaska gave up control. Aluminium had its '
   'biggest one-day fall on record; Alcoa had its worst day since 2009; Rusal rose 43% in Hong Kong.',
   '{"event_kind": "sanction_eased", "mechanisms": ["policy"], "issuer": "US", "reverses": "case 6",
     "commodity": "aluminium", "days_after_sanction": 17}');

SELECT setval('source_id_seq', greatest(52, (SELECT max(id) FROM source))),
       setval('source_doc_id_seq', greatest(127, (SELECT max(id) FROM source_doc))),
       setval('entity_id_seq', greatest(133, (SELECT max(id) FROM entity))),
       setval('security_id_seq', greatest(80, (SELECT max(id) FROM security))),
       setval('event_id_seq', greatest(9, (SELECT max(id) FROM event))),
       setval('claim_id_seq', greatest(42, (SELECT max(id) FROM claim))),
       setval('case_study_id_seq', greatest(7, (SELECT max(id) FROM case_study)));
