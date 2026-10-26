-- Cases 21-24 (driver, rate class): Fed policy surprises, all unscheduled (intermeeting) cuts. The driver is the SURPRISE
-- in the policy rate, read the standard way (Kuttner 2001): the front-month fed funds future's change on the day, scaled
-- by D / (D - d + 1) because the new rate counts only for the rest of the month. Percentage points; a cut is negative.
-- The surprise is the market's own reading within hours of the announcement (like a given oil settle), so the test is
-- the fan-out: which stocks a rate surprise moves, which way and by how much, from WHY they depend on rates.
-- Yahoo's front-month settles for 2001 are thin and sometimes a day late; where the event day is visibly stale the
-- two-day change is used and says so.
INSERT INTO source (id, name, kind, domain, is_primary, prior_confirmed, prior_retracted) VALUES
  (246, 'Federal Reserve (press release)', 'agency', 'federalreserve.gov', true, 0, 0),
  (247, 'CBOT 30-day fed funds futures (front month, via Yahoo ZQ=F)', 'market', NULL, true, 0, 0);
INSERT INTO entity (id, kind, name) VALUES (202, 'instrument', 'US policy-rate surprise (fed funds, pct points)');

INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (229, 246, 'press_release', 'https://www.federalreserve.gov/boarddocs/press/general/2001/20010103/', 'FOMC cuts the funds target 50bp to 6.0% between meetings; discount rate cut 25bp', '2001-01-03 13:13-05'),
  (230, 247, 'dataset', NULL, 'Jan 2001 fed funds future 93.55 (Jan 2) -> 93.99 (Jan 4): -0.44 x 31/29 (event-day settle stale)', '2001-01-04 15:00-05'),
  (231, 246, 'press_release', 'https://www.federalreserve.gov/boarddocs/press/general/2001/20010418/', 'FOMC cuts the funds target 50bp to 4.5% between meetings', '2001-04-18 10:54-04'),
  (232, 247, 'dataset', NULL, 'Apr 2001 fed funds future 95.015 -> 95.175: -0.16 x 30/13', '2001-04-18 15:00-04'),
  (233, 246, 'press_release', 'https://www.federalreserve.gov/newsevents/press/monetary/20080122b.htm', 'FOMC cuts the funds target 75bp to 3.5% between meetings, "weakening economic outlook"', '2008-01-22 08:20-05'),
  (234, 247, 'dataset', NULL, 'Jan 2008 fed funds future 95.875 -> 96.09: -0.215 x 31/10', '2008-01-22 15:00-05'),
  (235, 246, 'press_release', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20200303a.htm', 'FOMC cuts the funds target 50bp to 1.0-1.25% between meetings: "the coronavirus poses evolving risks"', '2020-03-03 10:00-05'),
  (236, 247, 'dataset', NULL, 'Mar 2020 fed funds future 98.715 -> 98.985: -0.27 x 31/29 (a cut was already half-priced on Mar 2)', '2020-03-03 15:00-05'),
  (237, 1, 'dataset', NULL, 'Yahoo daily closes around the four Fed surprises (research use; survivors only)', '2020-03-20');

INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (23, 'rate_decision', 'Fed cuts 50bp between meetings, four weeks before its scheduled meeting', '2001-01-03 13:13-05', '2001-01-03 13:13-05'),
  (24, 'rate_decision', 'Fed cuts 50bp between meetings for the second time in 2001', '2001-04-18 10:54-04', '2001-04-18 10:54-04'),
  (25, 'rate_decision', 'Fed cuts 75bp before the open, the day after a global equity rout (US closed for MLK day)', '2008-01-22 08:20-05', '2008-01-22 08:20-05'),
  (26, 'rate_decision', 'Fed cuts 50bp between meetings as the coronavirus spreads', '2020-03-03 10:00-05', '2020-03-03 10:00-05');
INSERT INTO claim (id, event_id, subject_id, change, attrs, magnitude, unit, statement, first_seen_at, resolution, resolved_at) VALUES
  (87, 23, 202, 'driver_move', '{"unit": "rate_points", "why": "Fed funds surprise -0.47 pts (Kuttner, two-day: event-day settle stale)"}', -0.47, NULL,
   'Policy-rate surprise -0.47 points', '2001-01-04 15:00-05', 'true', '2001-01-04'),
  (88, 24, 202, 'driver_move', '{"unit": "rate_points", "why": "Fed funds surprise -0.37 pts (Kuttner)"}', -0.37, NULL,
   'Policy-rate surprise -0.37 points', '2001-04-18 15:00-04', 'true', '2001-04-18'),
  (89, 25, 202, 'driver_move', '{"unit": "rate_points", "why": "Fed funds surprise -0.67 pts (Kuttner)"}', -0.67, NULL,
   'Policy-rate surprise -0.67 points', '2008-01-22 15:00-05', 'true', '2008-01-22'),
  (90, 26, 202, 'driver_move', '{"unit": "rate_points", "why": "Fed funds surprise -0.29 pts (Kuttner)"}', -0.29, NULL,
   'Policy-rate surprise -0.29 points', '2020-03-03 15:00-05', 'true', '2020-03-03');
INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES
  (87, 229, 'supports', 'primary'), (87, 230, 'supports', 'physical'), (88, 231, 'supports', 'primary'), (88, 232, 'supports', 'physical'),
  (89, 233, 'supports', 'primary'), (89, 234, 'supports', 'physical'), (90, 235, 'supports', 'primary'), (90, 236, 'supports', 'physical');
INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint, replay_at) VALUES
  (21, 23, 'Fed surprise cut (Jan 2001)', 'The central bank cuts half a point between meetings as a tech bust deepens',
   'Nasdaq +14% on the day, its best ever. Does a rate surprise fan out by duration and leverage?',
   '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "policy-rate surprise", "era": "dot-com bust"}', '2001-01-04 15:00-05'),
  (22, 24, 'Fed surprise cut (Apr 2001)', 'The central bank cuts half a point between meetings again',
   'The second intermeeting cut of 2001.', '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "policy-rate surprise", "era": "dot-com bust"}', '2001-04-18 15:00-04'),
  (23, 25, 'Fed emergency cut (Jan 2008)', 'The central bank cuts three quarters of a point before the open after a global rout',
   'A cut into a crash: the market opened -4% and closed -1%. Confounded by the rout it answered.',
   '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "policy-rate surprise", "era": "credit crisis"}', '2008-01-22 15:00-05'),
  (24, 26, 'Fed emergency cut (Mar 2020)', 'The central bank cuts half a point between meetings as a pandemic spreads',
   'The market fell 2.8% on the cut. A test of the signal a surprise sends.',
   '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "policy-rate surprise", "era": "pandemic"}', '2020-03-03 15:00-05');
-- The universe must exist before exposures.sql reads it (expose() silently skips unknown tickers).
SELECT ensure_security(split_part(u, ':', 1), split_part(u, ':', 2), split_part(u, ':', 1)) FROM unnest(ARRAY['SPY:NYSEArca','QQQ:Nasdaq',
  'XLK:NYSEArca','XLF:NYSEArca','XLU:NYSEArca','XLP:NYSEArca','XLE:NYSEArca','XLY:NYSEArca','IWM:NYSEArca','CSCO:Nasdaq','ORCL:Nasdaq',
  'INTC:Nasdaq','MSFT:Nasdaq','AMZN:Nasdaq','EBAY:Nasdaq','NVDA:Nasdaq','AAPL:Nasdaq','LEN:NYSE','PHM:NYSE','KBH:NYSE','DHI:NYSE',
  'TOL:NYSE','SCHW:NYSE','MS:NYSE','GS:NYSE','JPM:NYSE','BAC:NYSE','C:NYSE','WFC:NYSE','DUK:NYSE','SO:NYSE','PG:NYSE','KO:NYSE',
  'JNJ:NYSE','MO:NYSE','XOM:NYSE','CVX:NYSE','IBM:NYSE','HD:NYSE','WMT:NYSE','GE:NYSE','CAT:NYSE','PFE:NYSE','MRK:NYSE','F:NYSE',
  'DIS:NYSE','MCD:NYSE','HPQ:NYSE']) u;
