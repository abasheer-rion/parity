-- Case 16 (driver, odds class, training): Trump wins the 2024 US election. Polymarket had him at 58% at the 11-05
-- close; the 11-06 session priced ~100. Given that +41-point surprise, who moves, by each name's beta to the odds.
INSERT INTO source (id, name, kind, domain, is_primary, prior_confirmed, prior_retracted) VALUES
  (240, 'Associated Press (race calls)', 'news', 'apnews.com', true, 0, 0);
INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (214, 240, 'news', 'https://apnews.com/projects/election-results-2024/', 'AP calls the presidency for Trump', '2024-11-06 05:34-05'),
  (215, 239, 'dataset', 'https://polymarket.com/event/presidential-election-winner-2024', 'Polymarket: Trump 58% at the 11-05 close', '2024-11-05 20:00-05'),
  (216, 1, 'dataset', NULL, 'Yahoo daily closes 2024-06 .. 2024-11 (research use)', '2024-11-08');
INSERT INTO entity (id, kind, name) VALUES (200, 'instrument', 'Odds: Trump wins 2024');
INSERT INTO security (id, entity_id, ticker, exchange) VALUES (140, 200, 'PM-TRUMP24', 'Polymarket');
SELECT ensure_security(t, x, n) FROM (VALUES ('DJT','Nasdaq','DJT'), ('TSLA','Nasdaq','TSLA'), ('JPM','NYSE','JPM'), ('GS','NYSE','GS'), ('BAC','NYSE','BAC'), ('WFC','NYSE','WFC'), ('KRE','NYSEArca','KRE'), ('IWM','NYSEArca','IWM'), ('XLF','NYSEArca','XLF'), ('COIN','Nasdaq','COIN'), ('MSTR','Nasdaq','MSTR'), ('GEO','NYSE','GEO'), ('CXW','NYSE','CXW'), ('ENPH','Nasdaq','ENPH'), ('FSLR','Nasdaq','FSLR'), ('RUN','Nasdaq','RUN'), ('TAN','NYSEArca','TAN'), ('SEDG','Nasdaq','SEDG'), ('NEE','NYSE','NEE'), ('LMT','NYSE','LMT'), ('NOC','NYSE','NOC'), ('UNH','NYSE','UNH'), ('HUM','NYSE','HUM'), ('CVS','NYSE','CVS'), ('PFE','NYSE','PFE'), ('MRNA','Nasdaq','MRNA'), ('NUE','NYSE','NUE'), ('STLD','Nasdaq','STLD'), ('CAT','NYSE','CAT'), ('DE','NYSE','DE'), ('TLT','Nasdaq','TLT'), ('GLD','NYSEArca','GLD'), ('EWW','NYSEArca','EWW'), ('FXI','NYSEArca','FXI'), ('BABA','NYSE','BABA'), ('PDD','Nasdaq','PDD'), ('NIO','NYSE','NIO'), ('TM','NYSE','TM'), ('AAPL','Nasdaq','AAPL'), ('NVDA','Nasdaq','NVDA'), ('XOM','NYSE','XOM'), ('MXN=X','FX','MXN=X'), ('EURUSD=X','FX','EURUSD=X'), ('CNY=X','FX','CNY=X'), ('BTC-USD','FX','BTC-USD'), ('VOW3','XETRA','VOW3'), ('BMW','XETRA','BMW'), ('7203','TSE','7203'), ('005930','KRX','005930')) v(t, x, n);
INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (18, 'election', 'US presidential election: Trump wins, Republicans take the Senate', '2024-11-05 19:00-05', '2024-11-06 05:34-05');
INSERT INTO claim (id, event_id, subject_id, change, attrs, magnitude, unit, statement, first_seen_at, resolution, resolved_at) VALUES
  (82, 18, 200, 'driver_move', '{"unit": "points", "why": "AP calls the race for Trump"}', 41, 'points',
   'Trump wins: odds 58 -> ~99', '2024-11-06 05:34-05', 'true', '2024-11-06');
INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES (82, 214, 'supports', 'primary'), (82, 215, 'supports', 'report');
INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint, replay_at) VALUES
  (16, 18, 'Trump wins the 2024 US election', 'A favoured challenger wins a national election outright',
   'Odds 58% at the close before the count, ~100 by the next open. Training case for the odds-class size correction.',
   '{"event_kind": "election", "mechanisms": ["driver"], "driver": "Polymarket odds", "stage_tested": "driver -> stocks (odds move given)", "training": true}',
   '2024-11-06 09:00-05');
