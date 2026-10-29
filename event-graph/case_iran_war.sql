-- Case 11 (driver #1): the US/Israel strike on Iran, Saturday 2026-02-28, and the first trading session after it.
-- Tests stage 2 only: GIVEN the oil move (Brent +7.3% by the 03-02 settle), who moves with it and how much, using each
-- stock's oil beta measured over the 120 days before the war. Stage 1 (event -> oil move) is not predicted here.
SELECT setval('entity_id_seq', greatest((SELECT max(id) FROM entity), 999) + 1, false),
       setval('security_id_seq', greatest((SELECT max(id) FROM security), 999) + 1, false);

INSERT INTO source (id, name, kind, domain, is_primary, prior_confirmed, prior_retracted) VALUES
  (230, 'Israel Ministry of Defense', 'government', 'mod.gov.il', true, 0, 0),
  (231, 'US Department of Defense',   'government', 'defense.gov', true, 0, 0),
  (232, 'ICE Futures Europe',         'exchange',   'ice.com',     true, 0, 0),
  (233, 'IRGC (Iranian state media)', 'government', 'tasnimnews.com', false, 0, 2),
  (234, 'Kpler',                      'data',       'kpler.com',   false, 0, 0);
INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (180, 230, 'press_release', 'https://thepublicsradio.org/npr/israel-and-the-u-s-launch-strikes-against-iran/', 'Katz: preemptive strike on Iran, national state of emergency', '2026-02-28 08:10+02'),
  (181, 231, 'press_release', 'https://theaviationist.com/2026/02/28/israel-us-attack-iran/', 'Pentagon: joint operation "Epic Fury" against Iran', '2026-02-28 09:30+02'),
  (182, 232, 'dataset', NULL, 'Brent front-month settle 2026-03-02: $77.74 (+7.3% vs 02-27 $72.48)', '2026-03-02 19:30+00'),
  (183, 233, 'news', 'https://en.wikipedia.org/wiki/2026_Strait_of_Hormuz_crisis', 'IRGC official: Strait of Hormuz "closed"', '2026-03-02 10:00+03:30'),
  (184, 1,   'dataset', 'https://www.eia.gov/todayinenergy/detail.php?id=65504', 'EIA: ~20 mb/d through Hormuz (~20% of world liquids), 84% to Asia', '2025-06-16'),
  (185, 1,   'dataset', NULL, 'Yahoo daily closes, 2025-10 .. 2026-03 (research use)', '2026-03-10');

INSERT INTO entity (id, kind, name, country) VALUES
  (180, 'commodity', 'Brent crude', NULL),
  (181, 'country',   'Iran', 'IR'),
  (182, 'route',     'Strait of Hormuz', NULL);
INSERT INTO security (id, entity_id, ticker, exchange) VALUES (120, 180, 'BZ=F', 'NYMEX');
INSERT INTO link (src_id, dst_id, rel, via_id, attrs, evidence, confidence, source_id, known_at)
VALUES (180, 182, 'depends_on', NULL, '{"pct_exposed": 20, "basis": "share of world liquids through the strait, 2024"}',
        'disclosed', 0.9, 184, '2025-06-16');

-- The universe: every ticker priced for this case is measured against Brent, known or not to the graph.
SELECT ensure_security(t, x, n, 'company', c) FROM (VALUES
  ('FRO','NYSE','Frontline','NO'), ('STNG','NYSE','Scorpio Tankers','MC'), ('DHT','NYSE','DHT Holdings','BM'),
  ('INSW','NYSE','International Seaways','US'), ('VLO','NYSE','Valero','US'), ('MPC','NYSE','Marathon Petroleum','US'),
  ('PSX','NYSE','Phillips 66','US'), ('XOM','NYSE','Exxon Mobil','US'), ('CVX','NYSE','Chevron','US'),
  ('SHEL','LSE','Shell','GB'), ('BP','LSE','BP','GB'), ('EQNR','NYSE','Equinor','NO'), ('LNG','NYSE','Cheniere','US'),
  ('VG','NYSE','Venture Global','US'), ('LMT','NYSE','Lockheed Martin','US'), ('NOC','NYSE','Northrop Grumman','US'),
  ('RTX','NYSE','RTX','US'), ('GD','NYSE','General Dynamics','US'), ('RHM','XETRA','Rheinmetall','DE'),
  ('BA','LSE','BAE Systems','GB'), ('DAL','NYSE','Delta Air Lines','US'), ('UAL','Nasdaq','United Airlines','US'),
  ('AAL','Nasdaq','American Airlines','US'), ('LHA','XETRA','Lufthansa','DE'), ('AF','EPA','Air France-KLM','FR'),
  ('CCL','NYSE','Carnival','US'), ('RCL','NYSE','Royal Caribbean','US'), ('NCLH','NYSE','Norwegian Cruise Line','US'),
  ('LYB','NYSE','LyondellBasell','US'), ('DOW','NYSE','Dow','US'), ('BAS','XETRA','BASF','DE'), ('CF','NYSE','CF Industries','US'),
  ('RELIANCE','NSE','Reliance Industries','IN'), ('BPCL','NSE','Bharat Petroleum','IN'), ('IOC','NSE','Indian Oil','IN'),
  ('5020','TSE','ENEOS','JP'), ('010950','KRX','S-Oil','KR'), ('096770','KRX','SK Innovation','KR'),
  ('9101','TSE','NYK Line','JP'), ('9104','TSE','Mitsui O.S.K. Lines','JP'), ('9107','TSE','Kawasaki Kisen','JP'),
  ('GLD','NYSEArca','SPDR Gold','US'), ('LPG','NYSE','Dorian LPG','US'), ('MATX','NYSE','Matson','US'),
  ('ITA','NYSEArca','iShares US Aerospace & Defense','US'), ('NIFTYBEES','NSE','Nifty 50 ETF','IN'), ('^VIX','INDEX','CBOE Volatility Index','US')
) v(t, x, n, c);

INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (13, 'conflict', 'US and Israel strike Iran; Iran threatens shipping in the Strait of Hormuz', '2026-02-28 08:00+02', '2026-02-28 08:10+02');

-- What the engine is told, and when. The driver claim is the oil market's own verdict at the 03-02 settle.
INSERT INTO claim (id, event_id, subject_id, change, attrs, magnitude, unit, statement, first_seen_at, resolution, resolved_at) VALUES
  (70, 13, 181, 'attacked', '{"by": ["US", "IL"]}', NULL, NULL, 'Israel and the US strike Iran', '2026-02-28 08:10+02', 'true', '2026-02-28'),
  (71, 13, 182, 'route_closed', '{}', NULL, NULL, 'IRGC: the Strait of Hormuz is closed', '2026-03-02 10:00+03:30', 'partly', '2026-03-05'),
  (72, 13, 180, 'driver_move', '{"unit": "pct", "cause": "route_risk", "why": "Strike on Iran, Hormuz threatened"}', 7.3, 'pct',
   'Brent settles +7.3% at $77.74 on the first session after the strikes', '2026-03-02 19:30+00', 'true', '2026-03-02');
INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES
  (70, 180, 'supports', 'primary'), (70, 181, 'supports', 'primary'), (71, 183, 'supports', 'report'), (72, 182, 'supports', 'primary');

INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint, replay_at) VALUES
  (11, 13, 'US/Israel strike Iran (Feb 2026)',
   'Two states strike an oil exporter that sits on a chokepoint for a fifth of world oil',
   'A weekend strike; Iran''s military says the strait is closed. Brent +7.3% on the first session, +28% in a week, '
   '+51% by October. The test: given the oil move, who moved with it? Each stock''s oil beta is measured from its own '
   'prices over the 120 days before; nothing is assumed about who is an oil name.',
   '{"event_kind": "conflict", "mechanisms": ["driver"], "driver": "Brent", "region": "Gulf", "weekend": true,
     "chokepoint_share_pct": 20, "stage_tested": "driver -> stocks (oil move given)"}',
   '2026-03-02 20:30+00');
