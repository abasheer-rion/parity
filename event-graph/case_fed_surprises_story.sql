-- Outcomes for cases 21-24: first session (the announcement came during or before it), vs SPY (SPY itself raw).
SELECT case_auto_moves(c, d0, d1, ARRAY['SPY:NYSEArca','QQQ:Nasdaq','XLK:NYSEArca','XLF:NYSEArca','XLU:NYSEArca','XLP:NYSEArca',
         'XLE:NYSEArca','XLY:NYSEArca','IWM:NYSEArca','CSCO:Nasdaq','ORCL:Nasdaq','INTC:Nasdaq','MSFT:Nasdaq','AMZN:Nasdaq','EBAY:Nasdaq',
         'NVDA:Nasdaq','AAPL:Nasdaq','LEN:NYSE','PHM:NYSE','KBH:NYSE','DHI:NYSE','TOL:NYSE','SCHW:NYSE','MS:NYSE','GS:NYSE','JPM:NYSE',
         'BAC:NYSE','C:NYSE','WFC:NYSE','DUK:NYSE','SO:NYSE','PG:NYSE','KO:NYSE','JNJ:NYSE','MO:NYSE','XOM:NYSE','CVX:NYSE','IBM:NYSE',
         'HD:NYSE','WMT:NYSE','GE:NYSE','CAT:NYSE','PFE:NYSE','MRK:NYSE','F:NYSE','DIS:NYSE','MCD:NYSE','HPQ:NYSE'], 237)
FROM (VALUES (21, DATE '2001-01-02', DATE '2001-01-03'), (22, '2001-04-17', '2001-04-18'),
             (23, '2008-01-18', '2008-01-22'), (24, '2020-03-02', '2020-03-03')) v(c, d0, d1);
INSERT INTO case_step (id, case_id, parent_id, role, entity_id, mechanism, direction, description, happened_at, public_at, evidence_doc) VALUES
  (2100, 21, NULL, 'event', 202, 'driver', NULL, 'Intermeeting 50bp cut, surprise -0.47 pts: Nasdaq +14%, its best day.', '2001-01-03', '2001-01-03 13:13-05', 229),
  (2200, 22, NULL, 'event', 202, 'driver', NULL, 'Second intermeeting 50bp cut, surprise -0.37 pts.', '2001-04-18', '2001-04-18 10:54-04', 231),
  (2300, 23, NULL, 'event', 202, 'driver', NULL, '75bp cut before the open after a global rout, surprise -0.67 pts.', '2008-01-22', '2008-01-22 08:20-05', 233),
  (2400, 24, NULL, 'event', 202, 'driver', NULL, '50bp cut between meetings over the virus, surprise -0.29 pts; the market fell.', '2020-03-03', '2020-03-03 10:00-05', 235);
SELECT case_auto_steps(c, c * 100, 'driver', 2, 0.5) FROM unnest(ARRAY[21, 22, 23, 24]) c;
