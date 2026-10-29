-- Cases 9 and 10, part 2. Case 9 window: 03-08 close -> 03-10 close. Case 10: 03-10 close -> 03-13 close.
-- Live tickers from price_daily; delisted banks from archived daily closes (compounded). Abnormal = minus SPY.
CREATE TEMP TABLE archived (ticker text, d date, r numeric);
INSERT INTO archived VALUES
  ('SIVB', '2023-03-09', -60.4), ('SBNY', '2023-03-09', -12.2), ('SBNY', '2023-03-10', -22.9),
  ('FRC', '2023-03-09', -16.5), ('FRC', '2023-03-10', -14.8), ('FRC', '2023-03-13', -61.8),
  ('PACW', '2023-03-09', -25.4), ('PACW', '2023-03-10', -37.9), ('PACW', '2023-03-13', -21.1),
  ('CMA', '2023-03-09', -8.0), ('CMA', '2023-03-10', -5.0), ('CMA', '2023-03-13', -27.7);

WITH w(case_id, d0, d1) AS (VALUES (9, DATE '2023-03-08', DATE '2023-03-10'), (10, DATE '2023-03-10', DATE '2023-03-13')),
spy AS (SELECT w.case_id, abnormal_return((SELECT id FROM security WHERE ticker = 'SPY'), (SELECT id FROM security WHERE ticker = 'KRE'), w.d0, w.d1)
                  + abnormal_return((SELECT id FROM security WHERE ticker = 'KRE'), (SELECT id FROM security WHERE ticker = 'KRE'), w.d0, w.d0) AS x,
               100 * ((SELECT close_adj FROM price_daily p JOIN security s ON s.id = p.security_id WHERE s.ticker = 'SPY' AND p.d <= w.d1 ORDER BY p.d DESC LIMIT 1)
                    / (SELECT close_adj FROM price_daily p JOIN security s ON s.id = p.security_id WHERE s.ticker = 'SPY' AND p.d <= w.d0 ORDER BY p.d DESC LIMIT 1) - 1) AS spy_ret
        FROM w),
moves AS (
  SELECT w.case_id, s.id AS sid,
         CASE WHEN EXISTS (SELECT 1 FROM archived a WHERE a.ticker = s.ticker)
              THEN (SELECT 100 * (exp(sum(ln(1 + a.r / 100))) - 1) FROM archived a WHERE a.ticker = s.ticker AND a.d > w.d0 AND a.d <= w.d1)
              ELSE 100 * ((SELECT close_adj FROM price_daily WHERE security_id = s.id AND d <= w.d1 ORDER BY d DESC LIMIT 1)
                        / (SELECT close_adj FROM price_daily WHERE security_id = s.id AND d <= w.d0 ORDER BY d DESC LIMIT 1) - 1) END AS raw
  FROM w CROSS JOIN security s WHERE s.entity_id BETWEEN 160 AND 172 AND s.ticker <> 'SI'
)
INSERT INTO case_move (case_id, security_id, window_name, raw_return, abnormal_return, evidence_doc)
SELECT m.case_id, m.sid, 'd1', round(m.raw - sp.spy_ret, 2), round(m.raw - sp.spy_ret, 2), 170
FROM moves m JOIN spy sp ON sp.case_id = m.case_id WHERE m.raw IS NOT NULL;

INSERT INTO case_step (id, case_id, parent_id, role, entity_id, mechanism, direction, description, why_not, happened_at, public_at, evidence_doc) VALUES
  (900, 9, NULL, 'cause', 160, 'financial', NULL,
   'SVB had parked a deposit boom in long bonds; the 2022 rate hikes left a $15B unrealised HTM loss, more than its tangible '
   'equity, while venture-funded depositors were burning cash.', NULL, '2022-12-31', '2023-02-24', 166),
  (901, 9, NULL, 'condition', NULL, 'financial', NULL,
   '94% of SVB''s deposits were uninsured and concentrated in one networked community (VC-backed companies): a run could '
   'be coordinated in hours.', NULL, '2022-12-31', '2023-02-24', 166),
  (902, 9, 900, 'event', 160, 'financial', NULL,
   'After the close on 03-08: a $1.8B loss on a $21B bond sale and a $2.25B raise; Silvergate''s wind-down the same evening.',
   NULL, '2023-03-08', '2023-03-08 17:16-05', 160),
  (903, 9, 902, 'consequence', 160, 'financial', -1,
   'SVB fell 60% on 03-09 (depositors pulled $42B) and was closed on 03-10; the stock never traded again.', NULL, '2023-03-10', '2023-03-10 12:00-05', 162),
  (904, 9, 902, 'could_have', NULL, 'financial', -1,
   'A run on the largest banks.', 'Deposits fled TO them: small banks lost ~$120B in the week to 03-15, the 25 largest gained ~$67B.',
   '2023-03-15', '2023-03-24', 170),
  (1000, 10, NULL, 'cause', 161, 'financial', NULL,
   'Signature: 90% uninsured deposits, ~20% from crypto firms; the SVB and Silvergate news triggered its own run.', NULL, '2023-03-10', '2023-03-12 18:15-04', 165),
  (1001, 10, 1000, 'event', 41, 'financial', NULL,
   'Sunday 03-12: Signature closed; a systemic risk exception protected every depositor of SVB and Signature; the Fed''s '
   'BTFP lent against bonds at par. Shareholders and some creditors were not protected.', NULL, '2023-03-12', '2023-03-12 18:15-04', 163),
  (1002, 10, 1001, 'could_have', NULL, 'financial', 1,
   'The backstop stops the sell-off.', 'It protected depositors, not shareholders: uninsured money still left the weakest '
   'banks, and their equity was what absorbed it. The rebound came a day later (FRC +27% on 03-14).', '2023-03-13', '2023-03-13 16:00-04', 170),
  (1003, 10, 1001, 'condition', NULL, 'financial', NULL,
   'Later: 11 large banks deposited $30B into First Republic (03-16); it failed anyway on 05-01 and JPMorgan bought it.',
   NULL, '2023-05-01', '2023-05-01', 170);

INSERT INTO case_step (case_id, parent_id, role, entity_id, mechanism, direction, description, why_not, happened_at, public_at, evidence_doc)
SELECT m.case_id, CASE m.case_id WHEN 9 THEN 902 ELSE 1001 END,
       CASE WHEN abs(m.raw_return) >= 2 THEN 'consequence' ELSE 'could_have' END, s.entity_id, 'financial',
       CASE WHEN abs(m.raw_return) >= 2 THEN sign(m.raw_return)::smallint ELSE -1 END,
       e.name || ' moved ' || m.raw_return || '% vs the S&P 500 over the window.',
       CASE WHEN abs(m.raw_return) < 2 THEN 'Moved only ' || m.raw_return || '% vs the S&P 500.' END, NULL, NULL, 170
FROM case_move m JOIN security s ON s.id = m.security_id JOIN entity e ON e.id = s.entity_id
WHERE m.case_id IN (9, 10) AND s.ticker <> 'KRE' AND NOT (m.case_id = 9 AND s.ticker = 'SIVB');

INSERT INTO case_opportunity (case_id, security_id, action, enter_at, exit_at, payoff_pct, rationale)
SELECT 9, s.id, 'short vs market', TIMESTAMPTZ '2023-03-08 17:16-05', TIMESTAMPTZ '2023-03-10 16:00-05', -m.raw_return,
       'Rank banks by uninsured share x same-depositor overlap x HTM loss, from their own 10-Ks; short the top of the list on the filing.'
FROM security s JOIN case_move m ON m.security_id = s.id AND m.case_id = 9 WHERE s.ticker = 'PACW'
UNION ALL
SELECT 10, s.id, 'stay short through the backstop, cover on day two', TIMESTAMPTZ '2023-03-12 18:15-04', TIMESTAMPTZ '2023-03-13 16:00-04', -m.raw_return,
       'A depositor backstop is not a shareholder backstop: the run kept pricing on Monday; the rebound came Tuesday.'
FROM security s JOIN case_move m ON m.security_id = s.id AND m.case_id = 10 WHERE s.ticker = 'WAL';
