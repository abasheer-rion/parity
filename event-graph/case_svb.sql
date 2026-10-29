-- Cases 9 and 10 (financial #1/#2): the SVB run (news after the close on 2023-03-08) and the Sunday 2023-03-12 package
-- (Signature closed; all depositors protected; BTFP). Bank balance-sheet facts are from FY2022 10-Ks and the 12/31/22
-- FDIC call reports (public by 01-30), dated by filing. SVB/Signature/First Republic/PacWest/Comerica have no free price
-- history now: their moves are archived Yahoo closes (Wayback), flagged as such.

INSERT INTO source (id, name, kind, domain, is_primary, prior_confirmed, prior_retracted) VALUES
  (70, 'SVB Financial Group', 'company',    'svb.com',     true, 0, 0),
  (71, 'FDIC',                'government', 'fdic.gov',    true, 0, 0),
  (72, 'Federal Reserve',     'government', 'federalreserve.gov', true, 0, 0),
  (73, 'Silvergate Capital',  'company',    'silvergate.com', true, 0, 0);

INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (160, 70, 'filing', 'https://www.sec.gov/Archives/edgar/data/719739/000119312523064680/d430920dex991.htm', 'SVB 8-K: sold ~$21B of securities at a ~$1.8B after-tax loss; raising $2.25B', '2023-03-08 17:16-05'),
  (161, 73, 'filing', 'https://www.sec.gov/Archives/edgar/data/1312109/000131210923000058/si-20230308.htm', 'Silvergate 8-K: intent to wind down and liquidate the bank', '2023-03-08 16:30-05'),
  (162, 71, 'press_release', 'https://www.fdic.gov/news/press-releases/2023/pr23016.html', 'FDIC: Silicon Valley Bank closed, FDIC receiver', '2023-03-10 12:00-05'),
  (163, 1,  'press_release', 'https://home.treasury.gov/news/press-releases/jy1337', 'Treasury/Fed/FDIC: systemic risk exception, all depositors of SVB and Signature protected', '2023-03-12 18:15-04'),
  (164, 72, 'press_release', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20230312a.htm', 'Fed: Bank Term Funding Program, collateral at par', '2023-03-12 18:15-04'),
  (165, 71, 'press_release', 'https://www.fdic.gov/news/press-releases/2023/pr23018.html', 'Signature Bank closed; Signature Bridge Bank', '2023-03-12 18:15-04'),
  (166, 1,  'filing', 'https://www.sec.gov/Archives/edgar/data/719739/000071973923000021/sivb-20221231.htm', 'SVB FY22 10-K: ~94% of deposits uninsured; HTM loss $15.2B vs ~$11.9B tangible equity', '2023-02-24'),
  (167, 71, 'dataset', 'https://api.fdic.gov/banks/financials', 'FDIC call reports 12/31/2022 (Signature, First Republic)', '2023-01-30'),
  (168, 1,  'filing', 'https://www.sec.gov/Archives/edgar/data/1102112/000162828023005257/pacw-20221231.htm', 'PacWest FY22 10-K: venture deposits 33% of deposits', '2023-02-27'),
  (169, 1,  'dataset', NULL, 'FY22 10-Ks (WAL 02-23, ZION 02-23, CMA 02-14, KEY 02-22, SCHW 02-24, JPM 02-21, BAC 02-22): uninsured share and HTM loss', '2023-02-24'),
  (170, 1,  'dataset', NULL, 'Archived Yahoo daily closes (Wayback) for delisted banks; Yahoo chart API for live tickers', '2023-03-31');

INSERT INTO entity (id, kind, name, country, attrs) VALUES
  (160, 'company', 'SVB Financial', 'US', '{"cik": "719739"}'),
  (161, 'company', 'Signature Bank', 'US', '{}'),
  (162, 'company', 'First Republic', 'US', '{}'),
  (163, 'company', 'PacWest', 'US', '{"cik": "1102112"}'),
  (164, 'company', 'Western Alliance', 'US', '{"cik": "1212545"}'),
  (165, 'company', 'Zions', 'US', '{"cik": "109380"}'),
  (166, 'company', 'Comerica', 'US', '{"cik": "28412"}'),
  (167, 'company', 'KeyCorp', 'US', '{"cik": "91576"}'),
  (168, 'company', 'Charles Schwab', 'US', '{"cik": "316709"}'),
  (169, 'company', 'JPMorgan Chase', 'US', '{"cik": "19617"}'),
  (170, 'company', 'Bank of America', 'US', '{"cik": "70858"}'),
  (171, 'company', 'Silvergate', 'US', '{"cik": "1312109"}'),
  (172, 'index',   'SPDR S&P Regional Banking ETF', 'US', '{}');
INSERT INTO security (id, entity_id, ticker, exchange) VALUES
  (100, 160, 'SIVB', 'Nasdaq'), (101, 161, 'SBNY', 'Nasdaq'), (102, 162, 'FRC', 'NYSE'), (103, 163, 'PACW', 'Nasdaq'),
  (104, 164, 'WAL', 'NYSE'), (105, 165, 'ZION', 'Nasdaq'), (106, 166, 'CMA', 'NYSE'), (107, 167, 'KEY', 'NYSE'),
  (108, 168, 'SCHW', 'NYSE'), (109, 169, 'JPM', 'NYSE'), (110, 170, 'BAC', 'NYSE'), (111, 171, 'SI', 'NYSE'), (112, 172, 'KRE', 'NYSEArca');

-- Balance-sheet facts, point-in-time (known at the filing date). htm_loss_to_tce = unrealised HTM loss / approx. TCE.
INSERT INTO entity_fact (entity_id, metric, period_end, value, unit, form, accession, known_at, source_id)
SELECT v.e, v.m, '2022-12-31', v.v, 'ratio', v.form, v.acc, v.known::timestamptz, v.doc
FROM (VALUES
  (160, 'uninsured_deposit_share', 0.94,  '10-K', 'sivb-2022', '2023-02-24', 166), (160, 'htm_loss_to_tce', 1.28, '10-K', 'sivb-2022', '2023-02-24', 166),
  (160, 'deposit_base_tech_vc', 0.9, '10-K', 'sivb-2022', '2023-02-24', 166),    -- "nearly half of US venture-backed tech and life science"
  (161, 'uninsured_deposit_share', 0.897, 'call', 'sbny-2022', '2023-01-30', 167), (161, 'htm_loss_to_tce', 0.104, 'call', 'sbny-2022', '2023-01-30', 167),
  (161, 'deposit_base_crypto', 0.20, 'call', 'sbny-2022', '2023-01-30', 167),     -- secondary source; unverified in a filing
  (162, 'uninsured_deposit_share', 0.677, 'call', 'frc-2022', '2023-01-30', 167), (162, 'htm_loss_to_tce', 0.35, 'call', 'frc-2022', '2023-01-30', 167),
  (163, 'uninsured_deposit_share', 0.525, '10-K', 'pacw-2022', '2023-02-27', 168), (163, 'htm_loss_to_tce', 0.078, '10-K', 'pacw-2022', '2023-02-27', 168),
  (163, 'deposit_base_tech_vc', 0.33, '10-K', 'pacw-2022', '2023-02-27', 168),
  (164, 'uninsured_deposit_share', 0.55,  '10-K', 'wal-2022', '2023-02-23', 169), (164, 'htm_loss_to_tce', 0.04, '10-K', 'wal-2022', '2023-02-23', 169),
  (165, 'uninsured_deposit_share', 0.53,  '10-K', 'zion-2022', '2023-02-23', 169), (165, 'htm_loss_to_tce', 0.015, '10-K', 'zion-2022', '2023-02-23', 169),
  (166, 'uninsured_deposit_share', 0.637, '10-K', 'cma-2022', '2023-02-14', 169), (166, 'htm_loss_to_tce', 0, '10-K', 'cma-2022', '2023-02-14', 169),  -- all AFS: losses already in equity
  (167, 'uninsured_deposit_share', 0.471, '10-K', 'key-2022', '2023-02-22', 169), (167, 'htm_loss_to_tce', 0.074, '10-K', 'key-2022', '2023-02-22', 169),
  (168, 'uninsured_deposit_share', 0.188, '10-K', 'schw-2022', '2023-02-24', 169), (168, 'htm_loss_to_tce', 2.53, '10-K', 'schw-2022', '2023-02-24', 169),
  (169, 'uninsured_deposit_share', 0.591, '10-K', 'jpm-2022', '2023-02-21', 169), (169, 'htm_loss_to_tce', 0.17, '10-K', 'jpm-2022', '2023-02-21', 169),
  (169, 'gsib', 1, '10-K', 'jpm-2022', '2023-02-21', 169),
  (170, 'uninsured_deposit_share', 0.373, '10-K', 'bac-2022', '2023-02-22', 169), (170, 'htm_loss_to_tce', 0.625, '10-K', 'bac-2022', '2023-02-22', 169),
  (170, 'gsib', 1, '10-K', 'bac-2022', '2023-02-22', 169)
) AS v(e, m, v, form, acc, known, doc);

INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (11, 'bank_run', 'SVB: $1.8B loss on securities sale, $2.25B raise; Silvergate winds down', '2023-03-08 16:30-05', '2023-03-08 17:16-05'),
  (12, 'bank_run', 'Signature closed; systemic risk exception protects all depositors; Fed BTFP', '2023-03-12 18:15-04', '2023-03-12 18:15-04');

INSERT INTO claim (id, event_id, subject_id, change, attrs, statement, first_seen_at, resolution, resolved_at) VALUES
  (60, 11, 160, 'bank_run', '{"base": "tech_vc", "severity": 0.6}', 'SVB takes a $1.8B loss and needs $2.25B of new capital', '2023-03-08 17:16-05', 'true', '2023-03-10'),
  (61, 11, 171, 'bank_run', '{"base": "crypto", "severity": 1}', 'Silvergate to wind down and liquidate its bank', '2023-03-08 16:30-05', 'true', '2023-03-08'),
  (62, 12, 161, 'bank_run', '{"base": "crypto", "severity": 1}', 'Signature Bank closed by NYDFS', '2023-03-12 18:15-04', 'true', '2023-03-12'),
  (63, 12, 160, 'bank_run', '{"base": "tech_vc", "severity": 1}', 'SVB failed (closed 03-10)', '2023-03-12 18:15-04', 'true', '2023-03-10'),
  (64, 12, 41,  'backstop', '{"scope": "all depositors of SVB and Signature; BTFP loans at par for all banks"}',
   'All depositors protected; Fed lends against collateral at par', '2023-03-12 18:15-04', 'true', '2023-03-13');
INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES
  (60, 160, 'supports', 'primary'), (61, 161, 'supports', 'primary'), (62, 165, 'supports', 'primary'),
  (63, 162, 'supports', 'primary'), (64, 163, 'supports', 'primary'), (64, 164, 'supports', 'primary');

INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint) VALUES
  (9, 11, 'SVB run begins (Mar 2023)',
   'A bank with mostly uninsured, concentrated deposits realises bond losses and asks for capital',
   'After the close on 03-08 SVB said it had sold its liquid bonds at a $1.8B loss and needed $2.25B; the same evening '
   'Silvergate said it would wind down. Depositors pulled $42B the next day and SVB was closed on 03-10. Banks with '
   'uninsured, concentrated deposits sold off hardest; the largest banks barely moved.',
   '{"event_kind": "bank_run", "mechanisms": ["financial"], "region": "US", "trigger": "realised HTM/AFS losses + capital raise",
     "depositor_base": "tech/VC; crypto (Silvergate)", "rates": "fast hikes 2022", "uninsured_share": 0.94}'),
  (10, 12, 'Signature closed, depositors backstopped (Mar 2023)',
   'A second bank fails as the government guarantees all depositors and offers liquidity at par',
   'On Sunday 03-12 regulators closed Signature, protected every depositor of both failed banks, and the Fed offered '
   'one-year loans against bonds at par. Depositors were safe on Monday, shareholders of the most exposed banks were not: '
   'First Republic fell 62% and Western Alliance 47%.',
   '{"event_kind": "bank_run + backstop", "mechanisms": ["financial"], "region": "US", "backstop": "depositors + BTFP",
     "lesson_target": "who a backstop protects"}');

SELECT setval('source_id_seq', greatest(73, (SELECT max(id) FROM source))),
       setval('source_doc_id_seq', greatest(170, (SELECT max(id) FROM source_doc))),
       setval('entity_id_seq', greatest(172, (SELECT max(id) FROM entity))),
       setval('security_id_seq', greatest(112, (SELECT max(id) FROM security))),
       setval('event_id_seq', greatest(12, (SELECT max(id) FROM event))),
       setval('claim_id_seq', greatest(64, (SELECT max(id) FROM claim))),
       setval('case_study_id_seq', greatest(10, (SELECT max(id) FROM case_study)));
