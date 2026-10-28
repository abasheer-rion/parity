-- Price checks for the Fed-day yield driver: 5-year yield betas over the 120 days before each decision.
SELECT measure_driver(203, d, 272) FROM unnest(ARRAY[DATE '2018-12-19', DATE '2019-01-30', DATE '2019-07-31', DATE '2022-03-16', DATE '2022-05-04', DATE '2022-09-21', DATE '2022-11-02', DATE '2023-12-13', DATE '2024-09-18', DATE '2024-12-18', DATE '2025-10-29', DATE '2026-04-29', DATE '2026-06-17', DATE '2026-07-29', DATE '2026-09-16']) d;
-- Outcomes for cases 25-39: the decision day, prior close to close, vs SPY (SPY itself raw).
SELECT case_auto_moves(c, d0, d1, ARRAY[
  'SPY:NYSEArca','QQQ:Nasdaq','XLK:NYSEArca','XLF:NYSEArca','XLU:NYSEArca','XLP:NYSEArca','XLE:NYSEArca','XLY:NYSEArca','IWM:NYSEArca','CSCO:Nasdaq','ORCL:Nasdaq','INTC:Nasdaq',
  'MSFT:Nasdaq','AMZN:Nasdaq','EBAY:Nasdaq','NVDA:Nasdaq','AAPL:Nasdaq','LEN:NYSE','PHM:NYSE','KBH:NYSE','DHI:NYSE','TOL:NYSE','SCHW:NYSE','MS:NYSE',
  'GS:NYSE','JPM:NYSE','BAC:NYSE','C:NYSE','WFC:NYSE','DUK:NYSE','SO:NYSE','PG:NYSE','KO:NYSE','JNJ:NYSE','MO:NYSE','XOM:NYSE',
  'CVX:NYSE','IBM:NYSE','HD:NYSE','WMT:NYSE','GE:NYSE','CAT:NYSE','PFE:NYSE','MRK:NYSE','F:NYSE','DIS:NYSE','MCD:NYSE','HPQ:NYSE',
  'XLRE:NYSEArca','ARKK:NYSEArca','KRE:NYSEArca'], 272)
FROM (VALUES (25, DATE '2018-12-18', DATE '2018-12-19'),
             (26, DATE '2019-01-29', DATE '2019-01-30'),
             (27, DATE '2019-07-30', DATE '2019-07-31'),
             (28, DATE '2022-03-15', DATE '2022-03-16'),
             (29, DATE '2022-05-03', DATE '2022-05-04'),
             (30, DATE '2022-09-20', DATE '2022-09-21'),
             (31, DATE '2022-11-01', DATE '2022-11-02'),
             (32, DATE '2023-12-12', DATE '2023-12-13'),
             (33, DATE '2024-09-17', DATE '2024-09-18'),
             (34, DATE '2024-12-17', DATE '2024-12-18'),
             (35, DATE '2025-10-28', DATE '2025-10-29'),
             (36, DATE '2026-04-28', DATE '2026-04-29'),
             (37, DATE '2026-06-16', DATE '2026-06-17'),
             (38, DATE '2026-07-28', DATE '2026-07-29'),
             (39, DATE '2026-09-15', DATE '2026-09-16')) v(c, d0, d1);
INSERT INTO case_step (id, case_id, parent_id, role, entity_id, mechanism, direction, description, happened_at, public_at, evidence_doc) VALUES
  (2500, 25, NULL, 'event', 203, 'driver', NULL, 'Powell: FOMC raises the target 25bp to 2.25-2.50%; 2-year -0.02.', '2018-12-19', '2018-12-19 14:00-05', 241),
  (2600, 26, NULL, 'event', 203, 'driver', NULL, 'Powell: FOMC holds at 2.25-2.50% and "will be patient"; 2-year -0.04.', '2019-01-30', '2019-01-30 14:00-05', 243),
  (2700, 27, NULL, 'event', 203, 'driver', NULL, 'Powell: FOMC cuts 25bp to 2.00-2.25%, the first cut since 2008; 2-year +0.04.', '2019-07-31', '2019-07-31 14:00-04', 245),
  (2800, 28, NULL, 'event', 203, 'driver', NULL, 'Powell: FOMC raises 25bp to 0.25-0.50%, the first hike since 2018; 2-year +0.10.', '2022-03-16', '2022-03-16 14:00-04', 247),
  (2900, 29, NULL, 'event', 203, 'driver', NULL, 'Powell: FOMC raises 50bp to 0.75-1.00% and starts balance-sheet runoff in June; 2-year -0.12.', '2022-05-04', '2022-05-04 14:00-04', 249),
  (3000, 30, NULL, 'event', 203, 'driver', NULL, 'Powell: FOMC raises 75bp to 3.00-3.25%; 2-year +0.06.', '2022-09-21', '2022-09-21 14:00-04', 251),
  (3100, 31, NULL, 'event', 203, 'driver', NULL, 'Powell: FOMC raises 75bp to 3.75-4.00%; 2-year +0.07.', '2022-11-02', '2022-11-02 14:00-04', 253),
  (3200, 32, NULL, 'event', 203, 'driver', NULL, 'Powell: FOMC holds at 5.25-5.50%; 2-year -0.27.', '2023-12-13', '2023-12-13 14:00-05', 255),
  (3300, 33, NULL, 'event', 203, 'driver', NULL, 'Powell: FOMC cuts 50bp to 4.75-5.00%, the first cut since 2020; 2-year +0.02.', '2024-09-18', '2024-09-18 14:00-04', 257),
  (3400, 34, NULL, 'event', 203, 'driver', NULL, 'Powell: FOMC cuts 25bp to 4.25-4.50%; 2-year +0.10.', '2024-12-18', '2024-12-18 14:00-05', 259),
  (3500, 35, NULL, 'event', 203, 'driver', NULL, 'Powell: FOMC cuts 25bp to 3.75-4.00% and ends balance-sheet runoff on Dec 1; 2-year +0.12.', '2025-10-29', '2025-10-29 14:00-04', 261),
  (3600, 36, NULL, 'event', 203, 'driver', NULL, 'Powell: FOMC holds at 3.50-3.75% with dissents against keeping an easing bias; 2-year +0.08.', '2026-04-29', '2026-04-29 14:00-04', 263),
  (3700, 37, NULL, 'event', 203, 'driver', NULL, 'Warsh: FOMC holds at 3.50-3.75%, 12-0; 2-year +0.15.', '2026-06-17', '2026-06-17 14:00-04', 265),
  (3800, 38, NULL, 'event', 203, 'driver', NULL, 'Warsh: FOMC holds at 3.50-3.75%, 9-3; 2-year -0.04.', '2026-07-29', '2026-07-29 14:00-04', 267),
  (3900, 39, NULL, 'event', 203, 'driver', NULL, 'Warsh: FOMC raises 25bp to 3.75-4.00%, 12-0, the first hike since 2023; 2-year +0.07.', '2026-09-16', '2026-09-16 14:00-04', 269);
SELECT case_auto_steps(c, c * 100, 'driver', 2, 0.5) FROM unnest(ARRAY[25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39]) c;
