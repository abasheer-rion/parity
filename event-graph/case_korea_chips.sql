-- Case 12 (driver #2): SK Hynix's Q2-2026 results miss consensus on 2026-07-29, in the middle of the Korean chip crash.
-- A record quarter (operating profit W60.5tn, 76% margin) that missed LSEG consensus (W64tn) because HBM4 shipped late.
-- Tests: own move from the miss (earnings elasticity, a prior), and read-through to every peer by its MEASURED beta to
-- SK Hynix's daily moves over the 120 days before.
SELECT setval('entity_id_seq', greatest((SELECT max(id) FROM entity), 999) + 1, false),
       setval('security_id_seq', greatest((SELECT max(id) FROM security), 999) + 1, false);

INSERT INTO source (id, name, kind, domain, is_primary, prior_confirmed, prior_retracted) VALUES
  (235, 'SK hynix', 'company', 'skhynix.com', true, 0, 0),
  (236, 'LSEG', 'data', 'lseg.com', false, 0, 0),
  (237, 'TrendForce', 'data', 'trendforce.com', false, 0, 0);
INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (190, 235, 'filing', 'https://www.sec.gov/Archives/edgar/data/0002120882/000119312526354777/d147827d6k.htm',
   'SK hynix 6-K: Q2 2026 revenue W79.3tn, operating profit W60.54tn; HBM4 timing pushed revenue into 2H', '2026-07-29 08:00+09'),
  (191, 236, 'dataset', NULL, 'LSEG SmartEstimate consensus Q2: operating profit W64tn, revenue W84tn', '2026-07-28'),
  (192, 237, 'report', 'https://www.trendforce.com/presscenter/news/20260703-13134.html',
   'TrendForce: 3Q26 conventional DRAM contract prices +13-18% QoQ (2Q +58-63%)', '2026-07-03'),
  (193, 1, 'dataset', NULL, 'Yahoo daily closes, 2026-03 .. 2026-08 (research use)', '2026-08-05');

SELECT ensure_security(t, x, n, 'company', c) FROM (VALUES
  ('000660','KRX','SK hynix','KR'), ('005930','KRX','Samsung Electronics','KR'), ('005935','KRX','Samsung Electronics (pref)','KR'),
  ('402340','KRX','SK Square','KR'), ('009150','KRX','Samsung Electro-Mechanics','KR'), ('042700','KRX','Hanmi Semiconductor','KR'),
  ('240810','KOSDAQ','Wonik IPS','KR'), ('036930','KOSDAQ','Jusung Engineering','KR'), ('039030','KOSDAQ','EO Technics','KR'),
  ('005380','KRX','Hyundai Motor','KR'), ('373220','KRX','LG Energy Solution','KR'), ('105560','KRX','KB Financial','KR'),
  ('207940','KRX','Samsung Biologics','KR'), ('MU','Nasdaq','Micron','US'), ('NVDA','Nasdaq','NVIDIA','US'),
  ('SNDK','Nasdaq','Sandisk','US'), ('WDC','Nasdaq','Western Digital','US'), ('STX','Nasdaq','Seagate','US'),
  ('AMD','Nasdaq','AMD','US'), ('TSM','NYSE','TSMC','TW'), ('ASML','Nasdaq','ASML','NL'), ('285A','TSE','Kioxia','JP'),
  ('8035','TSE','Tokyo Electron','JP'), ('6857','TSE','Advantest','JP'), ('6146','TSE','Disco','JP')
) v(t, x, n, c);

INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (14, 'earnings', 'SK hynix Q2 2026: record profit, below consensus; HBM4 later than expected', '2026-07-29 08:00+09', '2026-07-29 08:00+09');
INSERT INTO claim (id, event_id, subject_id, change, attrs, magnitude, unit, statement, first_seen_at, resolution, resolved_at)
SELECT 75, 14, (SELECT entity_id FROM security WHERE ticker = '000660' AND exchange = 'KRX'), 'earnings_surprise',
       '{"metric": "Q2 operating profit (W tn)", "actual": 60.54, "consensus": 64}', NULL, NULL,
       'SK hynix Q2 operating profit W60.54tn vs W64tn consensus', '2026-07-29 08:00+09', 'true', '2026-07-29';
INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES (75, 190, 'supports', 'primary');

INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint, replay_at) VALUES
  (12, 14, 'SK hynix Q2 miss in the Korean chip crash (Jul 2026)',
   'The market leader in a hot product posts a record quarter that still misses expectations, mid-sell-off',
   'A day after the Kospi''s -10.8% crash (a caveated China-lithography report, an Nvidia financing scare, crowded leveraged '
   'positions), SK hynix reported its best quarter ever and missed consensus by 5%. The Kospi fell another 6%; two days later '
   'it rose a record 17.9%. The test: read-through from one bellwether''s surprise to every peer, by measured beta.',
   '{"event_kind": "earnings", "mechanisms": ["driver"], "driver": "SK hynix", "sector": "memory",
     "regime": "crash, record leverage, circuit breakers", "second_derivative": "DRAM price growth slowing 60% -> 15% QoQ"}',
   '2026-07-29 09:00+09');
