-- Cases 6 and 7, part 2. Moves by exchange: the 04-06 news came after Hong Kong/Sydney closed (and Shenzhen was shut
-- 04-05/06), during London/New York; 04-23 news during London's morning, after Asia closed.
INSERT INTO source_doc (id, source_id, kind, title, published_at) VALUES
  (128, 1, 'dataset', 'Daily closes (Yahoo, research use), Apr 2018; abnormal = stock minus home benchmark (none for Moscow)', '2018-05-31');

INSERT INTO case_move (case_id, security_id, window_name, raw_return, abnormal_return, evidence_doc)
SELECT w.case_id, s.id, 'd1',
       100 * ((SELECT close_adj FROM price_daily WHERE security_id = s.id AND d <= w.d1 ORDER BY d DESC LIMIT 1)
            / (SELECT close_adj FROM price_daily WHERE security_id = s.id AND d <= w.d0 ORDER BY d DESC LIMIT 1) - 1),
       abnormal_return(s.id, b.id, w.d0, w.d1), 128
FROM security s
LEFT JOIN security b ON b.ticker = bench_for(s.exchange) AND s.exchange <> 'MOEX'
CROSS JOIN LATERAL (VALUES
  (6, CASE WHEN s.exchange IN ('HKEX','ASX','SZSE','MOEX') THEN DATE '2018-04-06' ELSE DATE '2018-04-05' END,
      CASE WHEN s.exchange IN ('HKEX','ASX','SZSE','MOEX') THEN DATE '2018-04-10' ELSE DATE '2018-04-09' END),
  (7, CASE WHEN s.exchange IN ('HKEX','ASX','SZSE','MOEX') THEN DATE '2018-04-23' ELSE DATE '2018-04-20' END,
      CASE WHEN s.exchange IN ('HKEX','ASX','SZSE','MOEX') THEN DATE '2018-04-25' ELSE DATE '2018-04-24' END)
) AS w(case_id, d0, d1)
WHERE s.entity_id BETWEEN 120 AND 133;
-- Score on the market-adjusted move where there is a benchmark; Moscow keeps its raw move.
UPDATE case_move SET raw_return = round(coalesce(abnormal_return, raw_return), 2) WHERE case_id IN (6, 7);

INSERT INTO case_step (id, case_id, parent_id, role, entity_id, mechanism, direction, description, why_not, happened_at, public_at, evidence_doc) VALUES
  (600, 6, NULL, 'cause', 123, 'policy', NULL,
   'CAATSA pressure over Russia''s "malign activity": Treasury targeted oligarchs close to the Kremlin and the companies they control.',
   NULL, '2018-04-06', '2018-04-06 10:30-04', 120),
  (601, 6, NULL, 'condition', 123, 'policy', NULL,
   'Warning without a leak: the 01-29 "Kremlin list" named Deripaska, and Mnuchin said "there will be sanctions that come out of this".',
   NULL, '2018-01-29', '2018-01-30', 124),
  (602, 6, 600, 'event', 120, 'policy', NULL,
   'OFAC designated Deripaska, EN+ and Rusal (owned by EN+): US persons had to wind down dealings by 06-05 and sell the shares by 05-07.',
   NULL, '2018-04-06', '2018-04-06 10:30-04', 120),
  (603, 6, 602, 'consequence', NULL, 'policy', 1,
   'Aluminium: LME up 2.2% on 04-06, a seven-year high near $2,718 by 04-19. The LME stopped accepting new Rusal metal from 04-17.',
   NULL, '2018-04-19', '2018-04-19', 123),
  (604, 6, 602, 'consequence', 131, 'policy', NULL,
   'Rio Tinto declared force majeure on Rusal contracts (04-13): alumina and bauxite flows to and from Aughinish stopped.',
   NULL, '2018-04-13', '2018-04-13 02:00-04', 126),
  (605, 6, 602, 'could_have', NULL, 'policy', 1,
   'A long outage takes aluminium to $3,000, as mid-April forecasts said.',
   'Treasury eased on 04-23 after Europe, industry and Rio Tinto lobbied: see case 7.', '2018-04-23', '2018-04-23 09:00-04', 121),
  (700, 7, NULL, 'cause', 120, 'policy', NULL,
   'The sanction hit "the hardworking people who depend on RUSAL" (Mnuchin) and Western industry: Treasury framed the target as Deripaska himself.',
   NULL, '2018-04-23', '2018-04-23 09:00-04', 121),
  (701, 7, 700, 'event', 120, 'policy', NULL,
   'General License 14: wind-down extended to 10-23; no secondary sanctions for non-US persons doing the same; relief if Deripaska cedes control.',
   NULL, '2018-04-23', '2018-04-23 09:00-04', 121),
  (702, 7, 701, 'consequence', NULL, 'policy', -1,
   'Aluminium had its biggest one-day fall on record (~7-10%), from above $2,500 to $2,452 settle.', NULL, '2018-04-23', '2018-04-23 16:00-04', 123),
  (703, 7, 701, 'could_have', NULL, 'policy', NULL,
   'Congress blocks the eventual delisting.', 'The Senate vote failed 57-42 in January 2019; OFAC delisted the companies on 2019-01-27.',
   '2019-01-16', '2019-01-16', 127);

-- Each listed name's move becomes a consequence (|move| >= 2) or a "didn't move" (smaller), in both cases.
INSERT INTO case_step (case_id, parent_id, role, entity_id, mechanism, direction, description, why_not, happened_at, public_at, evidence_doc)
SELECT m.case_id, CASE m.case_id WHEN 6 THEN 602 ELSE 701 END,
       CASE WHEN abs(m.raw_return) >= 2 THEN 'consequence' ELSE 'could_have' END, s.entity_id, 'policy',
       CASE WHEN abs(m.raw_return) >= 2 THEN sign(m.raw_return)::smallint ELSE 1 END,
       e.name || CASE WHEN abs(m.raw_return) >= 2 THEN ' moved ' || m.raw_return || '%'
                        || CASE WHEN m.abnormal_return IS NULL THEN ' (raw; no Moscow benchmark, the market fell ~11%)' ELSE ' vs its market' END
                        || ' over the next two sessions.' ELSE ' moves.' END,
       CASE WHEN abs(m.raw_return) < 2 THEN 'Moved only ' || m.raw_return || '% over the next two sessions.' END,
       NULL, NULL, 128
FROM case_move m JOIN security s ON s.id = m.security_id JOIN entity e ON e.id = s.entity_id
WHERE m.case_id IN (6, 7) AND m.raw_return IS NOT NULL;

INSERT INTO case_opportunity (case_id, security_id, action, enter_at, exit_at, payoff_pct, rationale)
SELECT 6, s.id, 'long vs market', TIMESTAMPTZ '2018-04-06 10:30-04', TIMESTAMPTZ '2018-04-20 16:00-04',
       abnormal_return(s.id, (SELECT id FROM security WHERE ticker = 'SPY'), '2018-04-06', '2018-04-20'),
       'Producer outside the sanction, 100% aluminium: the supply channel, held until the price story peaked.'
FROM security s WHERE s.ticker = 'CENX'
UNION ALL
SELECT 7, s.id, 'exit / short vs market', TIMESTAMPTZ '2018-04-23 09:00-04', TIMESTAMPTZ '2018-04-24 16:00-04',
       -abnormal_return(s.id, (SELECT id FROM security WHERE ticker = 'SPY'), '2018-04-20', '2018-04-24'),
       'The same channel in reverse the moment Treasury signalled a way out: belief in the shortage collapsed.'
FROM security s WHERE s.ticker = 'AA'
UNION ALL
SELECT 6, s.id, 'not allowed', TIMESTAMPTZ '2018-04-06 10:30-04', NULL::timestamptz, NULL::numeric,
       'Shorting Rusal itself: US persons were barred from dealing in it. A sanction limits the trades, not just the prices.'
FROM security s WHERE s.ticker = '0486';
