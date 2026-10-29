-- Case 40 (driver, yield class), LIVE: the FOMC decision of Wed 2026-10-28, 2:00pm ET, press conference 2:30pm.
-- Registered before the statement. The driver is the same as cases 25-39: the decision-day change in the 2-year Treasury
-- par yield, from Tuesday's 4.70%. The claim (the actual change) is added after the close-of-day read, and the case is
-- scored on the 10-28 session. Scenario fan-outs made beforehand are in calls/fed_2026-10-28*.
-- Going in (sources in calls/fed_2026-10-28.md): target 3.75-4.00% after September's hike; futures price a hold at
-- ~91% and a December hike at ~73-80%. Sept CPI 3.7% (core 2.6%, 0.3% m/m), Sept payrolls +29k, unemployment 4.2%.
-- Brent ~$111 after falling 6% Monday on Iran diplomacy (was ~$72 before the war). Midterms on 11-03.
INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (273, 248, 'dataset', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', '2-year par yield 4.70% on 2026-10-27 (10-year 4.99%, 30-year 5.30%): the base for the 10-28 surprise', '2026-10-27 17:00-04'),
  (274, 1, 'analysis', 'https://fattail.ai/warsh-data-vs-fedspeak/', 'Fed funds futures: hold 91.1%, hike 8.9% for 10-28 (Oct hike odds 72% on 09-28, 16% after Warsh in Bangkok)', '2026-10-27 21:19-04');
INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (42, 'rate_decision', 'Warsh: FOMC decision, a hold ~91% priced after September''s hike', '2026-10-28 14:00-04', '2026-10-28 14:00-04');
INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint, replay_at) VALUES
  (40, 42, 'Warsh FOMC 2026-10-28 - live call', 'A new chair''s fifth meeting, one meeting after a hike, with oil above $100 and an election in six days',
   'Hold priced ~91%, a December hike ~75%. Hawkish dissents expected (Hammack, Logan). The engine''s calls are registered '
   'per scenario before 2pm and locked from the actual 2-year move before the close.',
   '{"event_kind": "rate_decision", "mechanisms": ["driver"], "driver": "Fed-day 2-year yield", "chair": "Warsh", "era": "war inflation", "live": true}',
   '2026-10-28 15:45-04');
