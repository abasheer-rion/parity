-- Case 19 (driver, earnings class): Intel's revenue warning, Thursday 2000-09-21 after the close, six months after the
-- Nasdaq's peak. Q3 revenue to grow 3-5% on Q2's $8.3bn instead of the 8-12% it had guided, on weak European demand.
-- The test: the bellwether's own move from the size of the miss, and the read-through to the PC and chip chain by reason.
INSERT INTO source (id, name, kind, domain, is_primary, prior_confirmed, prior_retracted) VALUES
  (243, 'CNN Money', 'news', 'money.cnn.com', false, 0, 0),
  (244, 'Intel Corp (press release)', 'company', 'intel.com', true, 0, 0),
  (245, 'Apple Computer (press release)', 'company', 'apple.com', true, 0, 0);
INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (224, 244, 'press_release', NULL, 'Intel: Q3 revenue expected 3-5% above Q2''s $8.3bn (was 8-12%), weaker demand in Europe', '2000-09-21 16:30-04'),
  (225, 243, 'news', 'https://money.cnn.com/2000/09/21/technology/intel/', 'Intel warns; stock -21% after hours to $48.56', '2000-09-21 18:00-04'),
  (226, 1, 'dataset', NULL, 'Yahoo daily closes 2000-04 .. 2000-10 (research use; survivors only)', '2000-10-10');
SELECT ensure_security(t, x, n) FROM (VALUES ('INTC','Nasdaq','INTC'), ('AMD','Nasdaq','AMD'), ('AMAT','Nasdaq','AMAT'), ('KLAC','Nasdaq','KLAC'), ('LRCX','Nasdaq','LRCX'), ('HPQ','NYSE','HPQ'), ('MSFT','Nasdaq','MSFT'), ('MU','Nasdaq','MU'), ('TXN','NYSE','TXN'), ('CSCO','Nasdaq','CSCO'), ('ORCL','Nasdaq','ORCL'), ('QQQ','Nasdaq','QQQ'), ('AMZN','Nasdaq','AMZN'), ('EBAY','Nasdaq','EBAY'), ('BKNG','Nasdaq','BKNG'), ('QCOM','Nasdaq','QCOM'), ('IBM','NYSE','IBM'), ('AAPL','Nasdaq','AAPL'), ('NVDA','Nasdaq','NVDA'), ('ADI','NYSE','ADI'), ('XLK','NYSEArca','XLK'), ('SMH','Nasdaq','SMH'), ('MSI','NYSE','MSI')) v(t, x, n);
UPDATE entity SET name = v.n FROM (VALUES ('INTC','Intel'), ('AAPL','Apple'), ('MSI','Motorola'), ('HPQ','Hewlett-Packard'),
  ('MU','Micron'), ('TXN','Texas Instruments'), ('ADI','Analog Devices'), ('AMAT','Applied Materials'), ('KLAC','KLA'),
  ('LRCX','Lam Research'), ('SMH','Semiconductor ETF')) v(t, n)
WHERE entity.id = (SELECT entity_id FROM security WHERE ticker = v.t) AND entity.name = v.t;
INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (21, 'earnings', 'Intel warns Q3 revenue will grow 3-5%, half what it guided, on weak European demand', '2000-09-21 16:30-04', '2000-09-21 16:30-04');
INSERT INTO claim (id, event_id, subject_id, change, attrs, magnitude, unit, statement, first_seen_at, resolution, resolved_at) VALUES
  (85, 21, (SELECT entity_id FROM security WHERE ticker = 'INTC'), 'earnings_surprise',
   '{"metric": "Q3 2000 revenue ($bn), guidance midpoint", "actual": 8.63, "consensus": 9.13, "operating_leverage": 1.9, "leverage_basis": "FY1999 10-K: gross margin 62.8% / operating margin 33.2%"}', NULL, NULL,
   'Intel: Q3 revenue +3-5% q/q (~$8.6bn) vs +8-12% guided (~$9.1bn)', '2000-09-21 16:30-04', 'true', '2000-10-17');
INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES (85, 224, 'supports', 'primary'), (85, 225, 'supports', 'report');
INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint, replay_at) VALUES
  (19, 21, 'Intel warns (Sep 2000, dot-com bust)', 'The dominant chipmaker halves its quarter''s growth outlook as a tech bubble deflates',
   'Revenue guidance cut ~5.5% at the midpoint; INTC -22% next session. A bellwether miss in a bubble regime: does a 1.5x earnings elasticity hold when the stock trades at ~40x earnings?',
   '{"event_kind": "earnings", "mechanisms": ["driver"], "driver": "Intel", "era": "dot-com bust", "stage_tested": "surprise -> own move and read-through"}',
   '2000-09-22 09:00-04');

-- Case 20 (driver, earnings class): Apple's profit warning, Thursday 2000-09-28 after the close.
INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (227, 245, 'press_release', NULL, 'Apple: Q4 EPS 30-33 cents ex-gains (consensus 45), weak September sales, slow Cube', '2000-09-28 16:15-04'),
  (228, 243, 'news', 'https://money.cnn.com/2000/09/28/technology/apple/index.htm', 'Apple warns; stock -46% after hours', '2000-09-28 18:00-04');
INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (22, 'earnings', 'Apple warns Q4 EPS will be 30-33 cents vs 45 expected: slow September, back-to-school, the G4 Cube', '2000-09-28 16:15-04', '2000-09-28 16:15-04');
INSERT INTO claim (id, event_id, subject_id, change, attrs, magnitude, unit, statement, first_seen_at, resolution, resolved_at) VALUES
  (86, 22, (SELECT entity_id FROM security WHERE ticker = 'AAPL'), 'earnings_surprise',
   '{"metric": "Q4 FY2000 EPS ex-gains ($), guidance midpoint", "actual": 0.315, "consensus": 0.45}', NULL, NULL,
   'Apple: Q4 EPS 30-33 cents vs 45 cents consensus (First Call)', '2000-09-28 16:15-04', 'true', '2000-10-18');
INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES (86, 227, 'supports', 'primary'), (86, 228, 'supports', 'report');
INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint, replay_at) VALUES
  (20, 22, 'Apple warns (Sep 2000, dot-com bust)', 'A PC maker warns that quarterly profit will be a third below expectations',
   'EPS guided ~30% below consensus; AAPL -52% next session. The second bubble-era warning in a week.',
   '{"event_kind": "earnings", "mechanisms": ["driver"], "driver": "Apple", "era": "dot-com bust", "stage_tested": "surprise -> own move and read-through"}',
   '2000-09-29 09:00-04');
