-- Cases 25-39 (driver, yield class): scheduled Fed decisions under Powell (2018-2026) and Warsh (2026). Unlike cases
-- 21-24 these were scheduled, so the rate change itself was priced; the news is the PATH (dots, guidance, the press
-- conference). The surprise is the 2-year Treasury yield's change on the decision day (Treasury par curve, ~3:30pm
-- read): it covers the statement AND the press conference, which the published 30-minute surprises (Bauer-Swanson
-- MPS, statement window only, to 2023) miss. MPS is kept beside each claim as the check. They disagree in sign twice:
-- 2022-11 (a dovish statement, then "very premature to pause" at the press conference) and 2018-12 (the 2-year fell as
-- stocks fell after a hawkish statement). A daily yield change also carries the day's other news (a fear day pulls
-- yields and stocks down together), so this surprise is noisier than cases 21-24's.
INSERT INTO source (id, name, kind, domain, is_primary, prior_confirmed, prior_retracted) VALUES
  (248, 'US Treasury daily par yield curve (2-year)', 'agency', 'home.treasury.gov', true, 0, 0),
  (249, 'Bauer-Swanson monetary policy surprises (FRBSF, update to Dec 2023)', 'dataset', 'frbsf.org', true, 0, 0);
INSERT INTO entity (id, kind, name) VALUES (203, 'instrument', 'US 2-year yield on a Fed decision day (pct points)');
-- Its price CHECK (never its reason): the 5-year yield, the nearest daily-priced Treasury on Yahoo.
INSERT INTO security (id, entity_id, ticker, exchange) VALUES (151, 203, '^FVX', 'INDEX');

INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (241, 246, 'press_release', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20181219a.htm', 'FOMC raises the target 25bp to 2.25-2.50%; median 2019 dots fall from three hikes to two', '2018-12-19 14:00-05'),
  (242, 248, 'dataset', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', '2-year par yield 2.65% (2018-12-18) -> 2.63% (2018-12-19): -0.02; 30-min MPS +0.030', '2018-12-19 15:30-05'),
  (243, 246, 'press_release', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20190130a.htm', 'FOMC holds at 2.25-2.50% and "will be patient"; drops "further gradual increases"', '2019-01-30 14:00-05'),
  (244, 248, 'dataset', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', '2-year par yield 2.56% (2019-01-29) -> 2.52% (2019-01-30): -0.04; 30-min MPS -0.020', '2019-01-30 15:30-05'),
  (245, 246, 'press_release', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20190731a.htm', 'FOMC cuts 25bp to 2.00-2.25%, the first cut since 2008', '2019-07-31 14:00-04'),
  (246, 248, 'dataset', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', '2-year par yield 1.85% (2019-07-30) -> 1.89% (2019-07-31): +0.04; 30-min MPS +0.006', '2019-07-31 15:30-04'),
  (247, 246, 'press_release', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20220316a.htm', 'FOMC raises 25bp to 0.25-0.50%, the first hike since 2018; median dots show six more in 2022', '2022-03-16 14:00-04'),
  (248, 248, 'dataset', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', '2-year par yield 1.85% (2022-03-15) -> 1.95% (2022-03-16): +0.10; 30-min MPS +0.138', '2022-03-16 15:30-04'),
  (249, 246, 'press_release', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20220504a.htm', 'FOMC raises 50bp to 0.75-1.00% and starts balance-sheet runoff in June', '2022-05-04 14:00-04'),
  (250, 248, 'dataset', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', '2-year par yield 2.78% (2022-05-03) -> 2.66% (2022-05-04): -0.12; 30-min MPS -0.023', '2022-05-04 15:30-04'),
  (251, 246, 'press_release', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20220921a.htm', 'FOMC raises 75bp to 3.00-3.25%; median dots put the rate at 4.4% by year-end', '2022-09-21 14:00-04'),
  (252, 248, 'dataset', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', '2-year par yield 3.96% (2022-09-20) -> 4.02% (2022-09-21): +0.06; 30-min MPS +0.135', '2022-09-21 15:30-04'),
  (253, 246, 'press_release', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20221102a.htm', 'FOMC raises 75bp to 3.75-4.00%; statement says it will weigh the lags of policy', '2022-11-02 14:00-04'),
  (254, 248, 'dataset', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', '2-year par yield 4.54% (2022-11-01) -> 4.61% (2022-11-02): +0.07; 30-min MPS -0.079', '2022-11-02 15:30-04'),
  (255, 246, 'press_release', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20231213a.htm', 'FOMC holds at 5.25-5.50%; median dots show three cuts in 2024', '2023-12-13 14:00-05'),
  (256, 248, 'dataset', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', '2-year par yield 4.73% (2023-12-12) -> 4.46% (2023-12-13): -0.27; 30-min MPS -0.082', '2023-12-13 15:30-05'),
  (257, 246, 'press_release', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20240918a.htm', 'FOMC cuts 50bp to 4.75-5.00%, the first cut since 2020', '2024-09-18 14:00-04'),
  (258, 248, 'dataset', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', '2-year par yield 3.59% (2024-09-17) -> 3.61% (2024-09-18): +0.02', '2024-09-18 15:30-04'),
  (259, 246, 'press_release', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20241218a.htm', 'FOMC cuts 25bp to 4.25-4.50%; median 2025 dots fall from four cuts to two', '2024-12-18 14:00-05'),
  (260, 248, 'dataset', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', '2-year par yield 4.25% (2024-12-17) -> 4.35% (2024-12-18): +0.10', '2024-12-18 15:30-05'),
  (261, 246, 'press_release', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20251029a.htm', 'FOMC cuts 25bp to 3.75-4.00% and ends balance-sheet runoff on Dec 1', '2025-10-29 14:00-04'),
  (262, 248, 'dataset', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', '2-year par yield 3.47% (2025-10-28) -> 3.59% (2025-10-29): +0.12', '2025-10-29 15:30-04'),
  (263, 246, 'press_release', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260429a.htm', 'FOMC holds at 3.50-3.75% with dissents against keeping an easing bias; cites Middle East conflict and inflation', '2026-04-29 14:00-04'),
  (264, 248, 'dataset', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', '2-year par yield 3.84% (2026-04-28) -> 3.92% (2026-04-29): +0.08', '2026-04-29 15:30-04'),
  (265, 246, 'press_release', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260617a.htm', 'FOMC holds at 3.50-3.75%, 12-0; drops language pointing to cuts; nine officials see a hike by year-end', '2026-06-17 14:00-04'),
  (266, 248, 'dataset', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', '2-year par yield 4.05% (2026-06-16) -> 4.20% (2026-06-17): +0.15', '2026-06-17 15:30-04'),
  (267, 246, 'press_release', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260729a.htm', 'FOMC holds at 3.50-3.75%, 9-3; Hammack, Kashkari and Logan dissent for a hike', '2026-07-29 14:00-04'),
  (268, 248, 'dataset', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', '2-year par yield 4.26% (2026-07-28) -> 4.22% (2026-07-29): -0.04', '2026-07-29 15:30-04'),
  (269, 246, 'press_release', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm', 'FOMC raises 25bp to 3.75-4.00%, 12-0, the first hike since 2023; 16 of 18 see another this year', '2026-09-16 14:00-04'),
  (270, 248, 'dataset', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', '2-year par yield 4.67% (2026-09-15) -> 4.74% (2026-09-16): +0.07', '2026-09-16 15:30-04'),
  (271, 249, 'dataset', 'https://www.frbsf.org/research-and-insights/data-and-indicators/monetary-policy-surprises/', 'Bauer-Swanson FOMC surprises, 30-minute windows (update 2023)', '2024-10-11'),
  (272, 1, 'dataset', NULL, 'Yahoo daily closes around the Powell and Warsh decisions (research use; survivors only)', '2026-10-27');

INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (27, 'rate_decision', 'Powell: Powell: balance-sheet runoff on "automatic pilot"', '2018-12-19 14:00-05', '2018-12-19 14:00-05'),
  (28, 'rate_decision', 'Powell: The pivot: no more hikes signalled', '2019-01-30 14:00-05', '2019-01-30 14:00-05'),
  (29, 'rate_decision', 'Powell: Powell: a "midcycle adjustment", not the start of a long series of cuts', '2019-07-31 14:00-04', '2019-07-31 14:00-04'),
  (30, 'rate_decision', 'Powell: First hike of the inflation cycle', '2022-03-16 14:00-04', '2022-03-16 14:00-04'),
  (31, 'rate_decision', 'Powell: Powell: a 75bp hike is "not something the committee is actively considering"', '2022-05-04 14:00-04', '2022-05-04 14:00-04'),
  (32, 'rate_decision', 'Powell: Third 75bp hike, dots a point higher than June', '2022-09-21 14:00-04', '2022-09-21 14:00-04'),
  (33, 'rate_decision', 'Powell: Powell: "very premature" to think about pausing; peak higher than thought', '2022-11-02 14:00-04', '2022-11-02 14:00-04'),
  (34, 'rate_decision', 'Powell: Powell: the question of cuts "comes into view"', '2023-12-13 14:00-05', '2023-12-13 14:00-05'),
  (35, 'rate_decision', 'Powell: A half-point start to easing', '2024-09-18 14:00-04', '2024-09-18 14:00-04'),
  (36, 'rate_decision', 'Powell: The hawkish cut', '2024-12-18 14:00-05', '2024-12-18 14:00-05'),
  (37, 'rate_decision', 'Powell: Powell: a December cut is "not a foregone conclusion, far from it"', '2025-10-29 14:00-04', '2025-10-29 14:00-04'),
  (38, 'rate_decision', 'Powell: His last meeting as chair', '2026-04-29 14:00-04', '2026-04-29 14:00-04'),
  (39, 'rate_decision', 'Warsh: First meeting as chair: easing bias removed, shorter statement, no forward guidance', '2026-06-17 14:00-04', '2026-06-17 14:00-04'),
  (40, 'rate_decision', 'Warsh: Warsh: not a "pause"; 30-year yield hits its highest since 2007', '2026-07-29 14:00-04', '2026-07-29 14:00-04'),
  (41, 'rate_decision', 'Warsh: Warsh: a "timelier return" to 2% inflation', '2026-09-16 14:00-04', '2026-09-16 14:00-04');
INSERT INTO claim (id, event_id, subject_id, change, attrs, magnitude, unit, statement, first_seen_at, resolution, resolved_at) VALUES
  (91, 27, 203, 'driver_move', '{"unit": "yield_points", "why": "Fed-day 2-year yield -0.02 pts; 30-min MPS +0.030 (sign differs from MPS: the rest of the day, press conference included, moved yields the other way)"}', -0.02, NULL,
   'Fed-day 2-year yield -0.02 points', '2018-12-19 15:30-05', 'true', '2018-12-19'),
  (92, 28, 203, 'driver_move', '{"unit": "yield_points", "why": "Fed-day 2-year yield -0.04 pts; 30-min MPS -0.020"}', -0.04, NULL,
   'Fed-day 2-year yield -0.04 points', '2019-01-30 15:30-05', 'true', '2019-01-30'),
  (93, 29, 203, 'driver_move', '{"unit": "yield_points", "why": "Fed-day 2-year yield +0.04 pts; 30-min MPS +0.006"}', 0.04, NULL,
   'Fed-day 2-year yield +0.04 points', '2019-07-31 15:30-04', 'true', '2019-07-31'),
  (94, 30, 203, 'driver_move', '{"unit": "yield_points", "why": "Fed-day 2-year yield +0.10 pts; 30-min MPS +0.138"}', 0.1, NULL,
   'Fed-day 2-year yield +0.10 points', '2022-03-16 15:30-04', 'true', '2022-03-16'),
  (95, 31, 203, 'driver_move', '{"unit": "yield_points", "why": "Fed-day 2-year yield -0.12 pts; 30-min MPS -0.023"}', -0.12, NULL,
   'Fed-day 2-year yield -0.12 points', '2022-05-04 15:30-04', 'true', '2022-05-04'),
  (96, 32, 203, 'driver_move', '{"unit": "yield_points", "why": "Fed-day 2-year yield +0.06 pts; 30-min MPS +0.135"}', 0.06, NULL,
   'Fed-day 2-year yield +0.06 points', '2022-09-21 15:30-04', 'true', '2022-09-21'),
  (97, 33, 203, 'driver_move', '{"unit": "yield_points", "why": "Fed-day 2-year yield +0.07 pts; 30-min MPS -0.079 (sign differs from MPS: the rest of the day, press conference included, moved yields the other way)"}', 0.07, NULL,
   'Fed-day 2-year yield +0.07 points', '2022-11-02 15:30-04', 'true', '2022-11-02'),
  (98, 34, 203, 'driver_move', '{"unit": "yield_points", "why": "Fed-day 2-year yield -0.27 pts; 30-min MPS -0.082"}', -0.27, NULL,
   'Fed-day 2-year yield -0.27 points', '2023-12-13 15:30-05', 'true', '2023-12-13'),
  (99, 35, 203, 'driver_move', '{"unit": "yield_points", "why": "Fed-day 2-year yield +0.02 pts"}', 0.02, NULL,
   'Fed-day 2-year yield +0.02 points', '2024-09-18 15:30-04', 'true', '2024-09-18'),
  (100, 36, 203, 'driver_move', '{"unit": "yield_points", "why": "Fed-day 2-year yield +0.10 pts"}', 0.1, NULL,
   'Fed-day 2-year yield +0.10 points', '2024-12-18 15:30-05', 'true', '2024-12-18'),
  (101, 37, 203, 'driver_move', '{"unit": "yield_points", "why": "Fed-day 2-year yield +0.12 pts"}', 0.12, NULL,
   'Fed-day 2-year yield +0.12 points', '2025-10-29 15:30-04', 'true', '2025-10-29'),
  (102, 38, 203, 'driver_move', '{"unit": "yield_points", "why": "Fed-day 2-year yield +0.08 pts"}', 0.08, NULL,
   'Fed-day 2-year yield +0.08 points', '2026-04-29 15:30-04', 'true', '2026-04-29'),
  (103, 39, 203, 'driver_move', '{"unit": "yield_points", "why": "Fed-day 2-year yield +0.15 pts"}', 0.15, NULL,
   'Fed-day 2-year yield +0.15 points', '2026-06-17 15:30-04', 'true', '2026-06-17'),
  (104, 40, 203, 'driver_move', '{"unit": "yield_points", "why": "Fed-day 2-year yield -0.04 pts"}', -0.04, NULL,
   'Fed-day 2-year yield -0.04 points', '2026-07-29 15:30-04', 'true', '2026-07-29'),
  (105, 41, 203, 'driver_move', '{"unit": "yield_points", "why": "Fed-day 2-year yield +0.07 pts"}', 0.07, NULL,
   'Fed-day 2-year yield +0.07 points', '2026-09-16 15:30-04', 'true', '2026-09-16');
INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES
  (91, 241, 'supports', 'primary'), (91, 242, 'supports', 'physical'),
  (92, 243, 'supports', 'primary'), (92, 244, 'supports', 'physical'),
  (93, 245, 'supports', 'primary'), (93, 246, 'supports', 'physical'),
  (94, 247, 'supports', 'primary'), (94, 248, 'supports', 'physical'),
  (95, 249, 'supports', 'primary'), (95, 250, 'supports', 'physical'),
  (96, 251, 'supports', 'primary'), (96, 252, 'supports', 'physical'),
  (97, 253, 'supports', 'primary'), (97, 254, 'supports', 'physical'),
  (98, 255, 'supports', 'primary'), (98, 256, 'supports', 'physical'),
  (99, 257, 'supports', 'primary'), (99, 258, 'supports', 'physical'),
  (100, 259, 'supports', 'primary'), (100, 260, 'supports', 'physical'),
  (101, 261, 'supports', 'primary'), (101, 262, 'supports', 'physical'),
  (102, 263, 'supports', 'primary'), (102, 264, 'supports', 'physical'),
  (103, 265, 'supports', 'primary'), (103, 266, 'supports', 'physical'),
  (104, 267, 'supports', 'primary'), (104, 268, 'supports', 'physical'),
  (105, 269, 'supports', 'primary'), (105, 270, 'supports', 'physical');
INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint, replay_at) VALUES
  (25, 27, 'Powell FOMC 2018-12-19', 'The central bank hikes into a falling market and says its balance-sheet runoff will stay on automatic pilot', 'FOMC raises the target 25bp to 2.25-2.50%; median 2019 dots fall from three hikes to two. Powell: balance-sheet runoff on "automatic pilot".', '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "Fed-day 2-year yield", "chair": "Powell", "era": "late-cycle tightening"}', '2018-12-19 15:30-05'),
  (26, 28, 'Powell FOMC 2019-01-30', 'The central bank holds and drops its signal of further hikes, six weeks after its last one', 'FOMC holds at 2.25-2.50% and "will be patient"; drops "further gradual increases". The pivot: no more hikes signalled.', '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "Fed-day 2-year yield", "chair": "Powell", "era": "late-cycle tightening"}', '2019-01-30 15:30-05'),
  (27, 29, 'Powell FOMC 2019-07-31', 'The central bank cuts for the first time in a decade but calls it a mid-cycle adjustment', 'FOMC cuts 25bp to 2.00-2.25%, the first cut since 2008. Powell: a "midcycle adjustment", not the start of a long series of cuts.', '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "Fed-day 2-year yield", "chair": "Powell", "era": "insurance cuts"}', '2019-07-31 15:30-04'),
  (28, 30, 'Powell FOMC 2022-03-16', 'The central bank starts hiking and signals six more this year', 'FOMC raises 25bp to 0.25-0.50%, the first hike since 2018; median dots show six more in 2022. First hike of the inflation cycle.', '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "Fed-day 2-year yield", "chair": "Powell", "era": "inflation hikes"}', '2022-03-16 15:30-04'),
  (29, 31, 'Powell FOMC 2022-05-04', 'The central bank hikes half a point and rules out a bigger step', 'FOMC raises 50bp to 0.75-1.00% and starts balance-sheet runoff in June. Powell: a 75bp hike is "not something the committee is actively considering".', '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "Fed-day 2-year yield", "chair": "Powell", "era": "inflation hikes"}', '2022-05-04 15:30-04'),
  (30, 32, 'Powell FOMC 2022-09-21', 'The central bank hikes three quarters of a point and signals a higher peak', 'FOMC raises 75bp to 3.00-3.25%; median dots put the rate at 4.4% by year-end. Third 75bp hike, dots a point higher than June.', '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "Fed-day 2-year yield", "chair": "Powell", "era": "inflation hikes"}', '2022-09-21 15:30-04'),
  (31, 33, 'Powell FOMC 2022-11-02', 'The central bank hikes and hints at slowing, then its chair says the peak will be higher', 'FOMC raises 75bp to 3.75-4.00%; statement says it will weigh the lags of policy. Powell: "very premature" to think about pausing; peak higher than thought.', '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "Fed-day 2-year yield", "chair": "Powell", "era": "inflation hikes"}', '2022-11-02 15:30-04'),
  (32, 34, 'Powell FOMC 2023-12-13', 'The central bank holds and signals three cuts next year', 'FOMC holds at 5.25-5.50%; median dots show three cuts in 2024. Powell: the question of cuts "comes into view".', '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "Fed-day 2-year yield", "chair": "Powell", "era": "peak rates"}', '2023-12-13 15:30-05'),
  (33, 35, 'Powell FOMC 2024-09-18', 'The central bank starts cutting with half a point', 'FOMC cuts 50bp to 4.75-5.00%, the first cut since 2020. A half-point start to easing.', '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "Fed-day 2-year yield", "chair": "Powell", "era": "easing"}', '2024-09-18 15:30-04'),
  (34, 36, 'Powell FOMC 2024-12-18', 'The central bank cuts but halves the cuts it signals for next year', 'FOMC cuts 25bp to 4.25-4.50%; median 2025 dots fall from four cuts to two. The hawkish cut.', '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "Fed-day 2-year yield", "chair": "Powell", "era": "easing"}', '2024-12-18 15:30-05'),
  (35, 37, 'Powell FOMC 2025-10-29', 'The central bank cuts and its chair says the next cut is far from certain', 'FOMC cuts 25bp to 3.75-4.00% and ends balance-sheet runoff on Dec 1. Powell: a December cut is "not a foregone conclusion, far from it".', '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "Fed-day 2-year yield", "chair": "Powell", "era": "easing"}', '2025-10-29 15:30-04'),
  (36, 38, 'Powell FOMC 2026-04-29', 'The central bank holds, with dissents against its easing bias, as war lifts energy prices', 'FOMC holds at 3.50-3.75% with dissents against keeping an easing bias; cites Middle East conflict and inflation. His last meeting as chair.', '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "Fed-day 2-year yield", "chair": "Powell", "era": "war inflation"}', '2026-04-29 15:30-04'),
  (37, 39, 'Warsh FOMC 2026-06-17', 'A new chair holds rates, drops the easing bias and most officials pencil in a hike', 'FOMC holds at 3.50-3.75%, 12-0; drops language pointing to cuts; nine officials see a hike by year-end. First meeting as chair: easing bias removed, shorter statement, no forward guidance.', '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "Fed-day 2-year yield", "chair": "Warsh", "era": "war inflation"}', '2026-06-17 15:30-04'),
  (38, 40, 'Warsh FOMC 2026-07-29', 'The central bank holds over three dissents for a hike; long yields jump', 'FOMC holds at 3.50-3.75%, 9-3; Hammack, Kashkari and Logan dissent for a hike. Warsh: not a "pause"; 30-year yield hits its highest since 2007.', '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "Fed-day 2-year yield", "chair": "Warsh", "era": "war inflation"}', '2026-07-29 15:30-04'),
  (39, 41, 'Warsh FOMC 2026-09-16', 'The central bank hikes for the first time in three years', 'FOMC raises 25bp to 3.75-4.00%, 12-0, the first hike since 2023; 16 of 18 see another this year. Warsh: a "timelier return" to 2% inflation.', '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "Fed-day 2-year yield", "chair": "Warsh", "era": "war inflation"}', '2026-09-16 15:30-04');
-- The universe must exist before exposures.sql reads it (expose() silently skips unknown tickers).
SELECT ensure_security(split_part(u, ':', 1), split_part(u, ':', 2), split_part(u, ':', 1)) FROM unnest(ARRAY[
  'SPY:NYSEArca','QQQ:Nasdaq','XLK:NYSEArca','XLF:NYSEArca','XLU:NYSEArca','XLP:NYSEArca','XLE:NYSEArca','XLY:NYSEArca','IWM:NYSEArca','CSCO:Nasdaq','ORCL:Nasdaq','INTC:Nasdaq',
  'MSFT:Nasdaq','AMZN:Nasdaq','EBAY:Nasdaq','NVDA:Nasdaq','AAPL:Nasdaq','LEN:NYSE','PHM:NYSE','KBH:NYSE','DHI:NYSE','TOL:NYSE','SCHW:NYSE','MS:NYSE',
  'GS:NYSE','JPM:NYSE','BAC:NYSE','C:NYSE','WFC:NYSE','DUK:NYSE','SO:NYSE','PG:NYSE','KO:NYSE','JNJ:NYSE','MO:NYSE','XOM:NYSE',
  'CVX:NYSE','IBM:NYSE','HD:NYSE','WMT:NYSE','GE:NYSE','CAT:NYSE','PFE:NYSE','MRK:NYSE','F:NYSE','DIS:NYSE','MCD:NYSE','HPQ:NYSE',
  'XLRE:NYSEArca','ARKK:NYSEArca','KRE:NYSEArca']) u;
