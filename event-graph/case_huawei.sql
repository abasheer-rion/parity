-- Case 5 (government #2, out-of-sample for policy): US adds Huawei to the Entity List, announced 2019-05-15 after
-- the close. Exposure = each supplier's Huawei share AS DISCLOSED BEFORE the ban (10-K/10-Q, dated by filing).
-- A US filer must name any customer >= 10% of revenue; a supplier that never named Huawei is marked undisclosed.
-- Several of the most exposed (NeoPhotonics, Inphi, Xilinx, Finisar, Acacia, Cypress) were acquired later and have no
-- free price history: survivorship bias, recorded below with press figures where available.

INSERT INTO source (id, name, kind, domain, is_primary, prior_confirmed, prior_retracted) VALUES
  (40, 'US Department of Commerce', 'government', 'commerce.gov', true, 0, 0),
  (41, 'Engadget',                  'outlet',     'engadget.com', false, 9, 1),
  (42, 'Motley Fool',               'outlet',     'fool.com',     false, 4, 1),
  (43, 'Federal Register',          'government', 'federalregister.gov', true, 0, 0);

INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (80, 21, 'article', 'https://techcrunch.com/2019/05/14/trump-is-reportedly-preparing-to-sign-an-executive-order-that-would-enable-a-ban-on-huawei-in-the-us/',
         'Trump expected to sign order barring telecom gear from security-risk firms (Reuters)', '2019-05-14 21:43-04'),
  (81, 40, 'press_release', 'https://asiamattersforamerica.org/project-blocks/department-of-commerce-announces-the-addition-of-huawei-technologies-co-ltd-to-the-entity-list',
         'Commerce adds Huawei and 68 affiliates to the Entity List', '2019-05-15 18:18-04'),
  (82, 41, 'article', 'https://www.engadget.com/2019/05/15/president-trump-national-emergency-for-telecom-networks/', 'Huawei added to Entity List', '2019-05-15 18:18-04'),
  (83, 43, 'filing', 'https://www.federalregister.gov/documents/2019/05/21/2019-10616/addition-of-entities-to-the-entity-list',
         'Entity List rule, public inspection 05-16 16:15, effective 05-16', '2019-05-16 16:15-04'),
  (84, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/1227025/000122702519000039/nptn-03312019x10q.htm', 'NeoPhotonics 10-Q: Huawei ~49% of Q1 revenue', '2019-05-07'),
  (85, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/1633978/000163397818000108/lumentumfy1810k.htm', 'Lumentum FY18 10-K: Huawei 11.0%', '2018-08-28'),
  (86, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/1604778/000160477818000023/qorvo2018033110-k.htm', 'Qorvo FY18 10-K: Huawei 8%', '2018-05-21'),
  (87, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/4127/000000412718000046/fy1810k92818.htm', 'Skyworks FY18 10-K: only Apple >10% (Huawei 10% in FY17)', '2018-11-15'),
  (88, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/1160958/000143774919003645/iphi20181231_10k.htm', 'Inphi 10-K: Huawei ~14%', '2019-02-28'),
  (89, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/723125/000072312519000014/a2019q2.htm', 'Micron 10-Q: Huawei 13% of 1H FY19', '2019-03-21'),
  (90, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/804328/000172894919000036/qcom03311910-q.htm', 'Qualcomm 10-Q: $150M Huawei royalties in the quarter (~3%)', '2019-05-01'),
  (91, 1, 'article', 'https://technode.com/2019/05/22/briefing-german-chipmaker-infineon-to-continue-supplying-huawei/', 'Huawei share of sales: STMicro 2.35%, Infineon 1.3% (Bloomberg data)', '2019-05-15'),
  (92, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/1604778/000160477819000035/qorvo-pressreleasehuawei.htm', 'Qorvo 8-K: FQ1 revenue cut to $730-750M from $780-800M', '2019-05-21 08:00-04'),
  (93, 1, 'article', 'https://semiconductor-today.com/news_items/2019/may/lumentum-210519.shtml', 'Lumentum cuts FQ4 to $375-390M from $405-425M, stops Huawei shipments', '2019-05-20 08:00-04'),
  (94, 1, 'filing', 'https://www.sec.gov/Archives/edgar/data/1160958/000143774919010660/ex_145624.htm', 'Inphi 8-K: Q2 revenue ~5% lower on the ban', '2019-05-22 08:00-04'),
  (95, 42, 'article', 'https://www.fool.com/investing/2019/05/17/why-neophotonics-shares-are-plunging-again-on-frid.aspx', 'NeoPhotonics fell ~20% Thursday and >20% again Friday', '2019-05-17 16:00-04'),
  (96, 1, 'article', 'https://www.cnbc.com/2019/05/19/google-suspends-some-business-with-huawei-after-trump-blacklist.html', 'Google suspends some business with Huawei (Reuters)', '2019-05-19 14:00-04'),
  (97, 43, 'filing', 'https://www.federalregister.gov/documents/2019/05/22/2019-10829/temporary-general-license', '90-day Temporary General License', '2019-05-20 16:15-04'),
  (98, 1, 'article', 'https://technode.com/2019/06/18/winners-and-losers-after-the-huawei-ban/', 'Winners and losers after the Huawei ban', '2019-06-18');

INSERT INTO entity (id, kind, name, country, attrs) VALUES
  (80, 'company', 'Huawei', 'CN', '{}'),
  (81, 'company', 'NeoPhotonics', 'US', '{"cik": "1227025"}'),
  (82, 'company', 'Lumentum', 'US', '{"cik": "1633978"}'),
  (83, 'company', 'Qorvo', 'US', '{"cik": "1604778"}'),
  (84, 'company', 'Skyworks', 'US', '{"cik": "4127"}'),
  (85, 'company', 'Inphi', 'US', '{"cik": "1160958"}'),
  (86, 'company', 'Micron', 'US', '{"cik": "723125"}'),
  (87, 'company', 'Qualcomm', 'US', '{"cik": "804328"}'),
  (88, 'company', 'Broadcom', 'US', '{"cik": "1730168"}'),
  (89, 'company', 'Intel', 'US', '{"cik": "50863"}'),
  (90, 'company', 'Alphabet', 'US', '{"cik": "1652044"}'),
  (91, 'company', 'II-VI (now Coherent)', 'US', '{"cik": "820318"}'),
  (92, 'company', 'STMicroelectronics', 'NL', '{}'),
  (93, 'company', 'TDK', 'JP', '{}'), (94, 'company', 'Taiyo Yuden', 'JP', '{}'), (95, 'company', 'Murata', 'JP', '{}'),
  (96, 'company', 'Sony', 'JP', '{}'), (97, 'company', 'Sunny Optical', 'CN', '{}'), (98, 'company', 'AAC Technologies', 'CN', '{}'),
  (99, 'company', 'ams', 'AT', '{}'), (100, 'company', 'Nokia', 'FI', '{}'), (101, 'company', 'Ericsson', 'SE', '{}'),
  (102, 'company', 'Samsung Electronics', 'KR', '{}'), (103, 'company', 'Xiaomi', 'CN', '{}'), (104, 'company', 'ZTE', 'CN', '{}'),
  (105, 'company', 'Apple', 'US', '{"cik": "320193"}'), (106, 'company', 'IQE', 'GB', '{}'), (107, 'company', 'Fabrinet', 'US', '{"cik": "1408710"}'),
  (110, 'country', 'Germany', 'DE', '{}'), (111, 'country', 'South Korea', 'KR', '{}'), (112, 'country', 'France', 'FR', '{}');

INSERT INTO security (id, entity_id, ticker, exchange) VALUES
  (40, 82, 'LITE', 'Nasdaq'), (41, 83, 'QRVO', 'Nasdaq'), (42, 84, 'SWKS', 'Nasdaq'), (43, 86, 'MU', 'Nasdaq'),
  (44, 87, 'QCOM', 'Nasdaq'), (45, 88, 'AVGO', 'Nasdaq'), (46, 89, 'INTC', 'Nasdaq'), (47, 90, 'GOOGL', 'Nasdaq'),
  (48, 91, 'COHR', 'Nasdaq'), (49, 92, 'STM', 'NYSE'), (50, 93, '6762', 'TSE'), (51, 94, '6976', 'TSE'), (52, 95, '6981', 'TSE'),
  (53, 96, '6758', 'TSE'), (54, 97, '2382', 'HKEX'), (55, 98, '2018', 'HKEX'), (56, 99, 'AMS', 'SIX'), (57, 100, 'NOKIA', 'HEL'),
  (58, 101, 'ERIC-B', 'STO'), (59, 102, '005930', 'KRX'), (60, 103, '1810', 'HKEX'), (61, 104, '0763', 'HKEX'),
  (62, 105, 'AAPL', 'Nasdaq'), (63, 106, 'IQE', 'LSE'), (64, 107, 'FN', 'NYSE');

INSERT INTO link (src_id, dst_id, rel, via_id, attrs, evidence, confidence, source_id, valid_from, valid_to, known_at) VALUES
  (81, 80, 'supplies', NULL, '{"pct_of_supplier_revenue": 49}', 'disclosed', 0.95, 84, '2019-01-01', NULL, '2019-05-07'),
  (82, 80, 'supplies', NULL, '{"pct_of_supplier_revenue": 11}', 'disclosed', 0.9, 85, '2017-07-01', NULL, '2018-08-28'),
  (83, 80, 'supplies', NULL, '{"pct_of_supplier_revenue": 8}',  'disclosed', 0.9, 86, '2017-04-01', NULL, '2018-05-21'),
  (84, 80, 'supplies', NULL, '{"pct_of_supplier_revenue": 9}',  'disclosed', 0.6, 87, '2017-10-01', NULL, '2018-11-15'),  -- below 10% in FY18, 10% in FY17
  (85, 80, 'supplies', NULL, '{"pct_of_supplier_revenue": 14}', 'disclosed', 0.95, 88, '2018-01-01', NULL, '2019-02-28'),
  (86, 80, 'supplies', NULL, '{"pct_of_supplier_revenue": 13}', 'disclosed', 0.95, 89, '2018-09-01', NULL, '2019-03-21'),
  (87, 80, 'supplies', NULL, '{"pct_of_supplier_revenue": 3}',  'disclosed', 0.7, 90, '2019-01-01', NULL, '2019-05-01'),
  (88, 80, 'supplies', NULL, '{"undisclosed": true}', 'analyst', 0.8, 1, NULL, NULL, '2019-01-01'),
  (89, 80, 'supplies', NULL, '{"undisclosed": true}', 'analyst', 0.8, 1, NULL, NULL, '2019-01-01'),
  (90, 80, 'supplies', NULL, '{"undisclosed": true}', 'analyst', 0.6, 1, NULL, NULL, '2019-01-01'),  -- Android licence
  (91, 80, 'supplies', NULL, '{"undisclosed": true}', 'analyst', 0.6, 1, NULL, NULL, '2019-01-01'),
  (92, 80, 'supplies', NULL, '{"pct_of_supplier_revenue": 2.35}', 'analyst', 0.7, 91, NULL, NULL, '2019-05-15'),
  (5,  80, 'supplies', NULL, '{"pct_of_supplier_revenue": 1.3}',  'analyst', 0.7, 91, NULL, NULL, '2019-05-15'),  -- Infineon
  (93, 80, 'supplies', NULL, '{}', 'analyst', 0.6, 1, NULL, NULL, '2019-01-01'),
  (94, 80, 'supplies', NULL, '{}', 'analyst', 0.6, 1, NULL, NULL, '2019-01-01'),
  (95, 80, 'supplies', NULL, '{}', 'analyst', 0.6, 1, NULL, NULL, '2019-01-01'),
  (96, 80, 'supplies', NULL, '{}', 'analyst', 0.6, 1, NULL, NULL, '2019-01-01'),
  (97, 80, 'supplies', NULL, '{}', 'analyst', 0.7, 1, NULL, NULL, '2019-01-01'),   -- camera modules and lenses
  (98, 80, 'supplies', NULL, '{}', 'analyst', 0.7, 1, NULL, NULL, '2019-01-01'),   -- acoustics, haptics
  (99, 80, 'supplies', NULL, '{}', 'analyst', 0.6, 1, NULL, NULL, '2019-01-01'),   -- 3D/optical sensors
  (80, 100, 'competes', NULL, '{}', 'analyst', 0.9, 1, NULL, NULL, '2019-01-01'),   -- telecom equipment
  (80, 101, 'competes', NULL, '{}', 'analyst', 0.9, 1, NULL, NULL, '2019-01-01'),
  (80, 102, 'competes', NULL, '{}', 'analyst', 0.8, 1, NULL, NULL, '2019-01-01'),   -- phones
  (80, 104, 'competes', NULL, '{}', 'analyst', 0.6, 1, NULL, NULL, '2019-01-01'),
  (107, 82, 'supplies', NULL, '{"pct_of_supplier_revenue": 16}', 'disclosed', 0.9, 98, '2017-07-01', NULL, '2018-08-22'),  -- Fabrinet FY18 10-K: Lumentum 16%
  (4,  80, 'supplies', NULL, '{"undisclosed": true}', 'disclosed', 0.7, 1, NULL, NULL, '2019-03-01'),    -- NXP 20-F names Huawei a top-10 customer, no %
  (104, 41, 'depends_on', NULL, '{"dependence": 0.8, "what": "US components; shut down by the 2018 US denial order"}', 'disclosed', 0.9, 1, '2018-04-15', NULL, '2018-05-09'),
  (103, 41, 'depends_on', NULL, '{"dependence": 0.5, "what": "Qualcomm SoCs, its largest supplier (IPO prospectus)"}', 'disclosed', 0.9, 1, '2018-06-25', NULL, '2018-06-25'),
  (41, 110, 'allied_with', NULL, '{}', 'disclosed', 0.95, 1, '1955-05-09', NULL, '2000-01-01'),
  (41, 111, 'allied_with', NULL, '{}', 'disclosed', 0.95, 1, '1953-10-01', NULL, '2000-01-01'),
  (41, 112, 'allied_with', NULL, '{}', 'disclosed', 0.95, 1, '1949-04-04', NULL, '2000-01-01');

INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (7, 'export_control', 'US adds Huawei and 68 affiliates to the Entity List', '2019-05-15 18:00-04', '2019-05-15 18:18-04');

INSERT INTO claim (id, event_id, subject_id, object_id, change, magnitude, unit, attrs, statement, first_seen_at, supersedes,
                   resolution, resolved_at) VALUES
  (30, 7, 80, NULL, 'export_restricted', NULL, NULL, '{"issuer": "US", "scope": "entity list"}',
   'Commerce adds Huawei to the Entity List: US-origin items need a licence', '2019-05-15 18:18-04', NULL, 'true', '2019-05-16'),
  -- Company guidance, as % of the period's previously guided revenue (midpoints)
  (31, 7, 82, NULL, 'revenue_loss', 7.8, 'pct_revenue', '{}', 'Lumentum: FQ4 revenue guide cut ~8% on Huawei', '2019-05-20 08:00-04', NULL, 'true', '2019-08-27'),
  (32, 7, 83, NULL, 'revenue_loss', 6.3, 'pct_revenue', '{}', 'Qorvo: FQ1 revenue guide cut ~6% on Huawei', '2019-05-21 08:00-04', NULL, 'true', '2019-07-31'),
  (33, 7, 85, NULL, 'revenue_loss', 5.0, 'pct_revenue', '{}', 'Inphi: Q2 revenue ~5% lower on the ban', '2019-05-22 08:00-04', NULL, 'true', '2019-07-30');

INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES
  (30, 81, 'supports', 'primary'), (30, 82, 'supports', 'report'), (30, 83, 'supports', 'primary'),
  (31, 93, 'supports', 'report'), (32, 92, 'supports', 'primary'), (33, 94, 'supports', 'primary');

INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint) VALUES
  (5, 7, 'Huawei added to the US Entity List (2019)',
   'A government cuts a large foreign company off from every supplier in its jurisdiction',
   'After the close on 05-15 Commerce put Huawei on the Entity List, so US suppliers needed a licence to ship it '
   'anything. Suppliers that had disclosed big Huawei shares fell hard; Google''s Android suspension on 05-19 spread '
   'the hit to non-US component makers; a 90-day licence on 05-20 and later partial resumptions softened it.',
   '{"event_kind": "export_control", "mechanisms": ["policy"], "issuer": "US", "target": "a company (Huawei)",
     "sector": "semiconductors/telecom", "leaked_days_before": 1, "precursor": "tariff escalation 05-10",
     "exposure_metric": "pct revenue from Huawei 1-49%", "survivorship_gap": "most exposed names delisted since"}');

SELECT setval('source_id_seq', greatest(43, (SELECT max(id) FROM source))),
       setval('source_doc_id_seq', greatest(98, (SELECT max(id) FROM source_doc))),
       setval('entity_id_seq', greatest(112, (SELECT max(id) FROM entity))),
       setval('security_id_seq', greatest(64, (SELECT max(id) FROM security))),
       setval('event_id_seq', greatest(7, (SELECT max(id) FROM event))),
       setval('claim_id_seq', greatest(33, (SELECT max(id) FROM claim))),
       setval('case_study_id_seq', greatest(5, (SELECT max(id) FROM case_study)));
