-- Case 8, part 2. Two moves per name: vs the market (SPY / home index) and vs the chip sector (SOXX, US names only),
-- because 04-16 was a broad sell-off. Window: 04-15 close -> 04-17 close (Asia: 04-15 -> 04-17 local).
INSERT INTO source_doc (id, source_id, kind, title, published_at) VALUES
  (150, 1, 'dataset', 'Daily closes (Yahoo, research use), Apr 2025; abnormal vs home benchmark, and vs SOXX for US chips', '2025-05-31');
UPDATE security SET entity_id = 142 WHERE ticker = '2330';   -- one TSMC, two listings
UPDATE security SET entity_id = 146 WHERE ticker = '688981'; -- one SMIC, two listings

INSERT INTO case_move (case_id, security_id, window_name, raw_return, abnormal_return, evidence_doc)
SELECT 8, s.id, w.name, abnormal_return(s.id, b.id, '2025-04-15', '2025-04-17'), abnormal_return(s.id, b.id, '2025-04-15', '2025-04-17'), 150
FROM security s JOIN security b ON b.ticker = bench_for(s.exchange)
CROSS JOIN (VALUES ('d1')) w(name)
WHERE s.ticker IN ('NVDA','AMD','AVGO','MU','MRVL','LRCX','AMAT','KLAC','INTC','QCOM','TSM','ASML','000660','005930','688256','688041','0981');
INSERT INTO case_move (case_id, security_id, window_name, raw_return, abnormal_return, evidence_doc)
SELECT 8, s.id, 'vs_sector', abnormal_return(s.id, (SELECT id FROM security WHERE ticker = 'SOXX'), '2025-04-15', '2025-04-17'),
       abnormal_return(s.id, (SELECT id FROM security WHERE ticker = 'SOXX'), '2025-04-15', '2025-04-17'), 150
FROM security s WHERE s.ticker IN ('NVDA','AMD','AVGO','MU','MRVL','LRCX','AMAT','KLAC','INTC','QCOM','TSM','ASML');

INSERT INTO case_step (id, case_id, parent_id, role, entity_id, mechanism, direction, description, why_not, happened_at, public_at, evidence_doc) VALUES
  (800, 8, NULL, 'cause', 47, 'policy', NULL,
   'H20 was NVIDIA''s cut-down design to comply with the 2022/2023 rules; the US moved the line again to cover it.',
   NULL, '2025-04-09', '2025-04-15 17:22-04', 141),
  (801, 8, NULL, 'condition', 47, 'policy', NULL,
   'Contrary signal a week earlier: NPR reported the curbs were on hold after a Mar-a-Lago dinner (two anonymous sources). '
   'A belief model should have held it at moderate weight: an outlet with a decent record, no primary confirmation.',
   NULL, '2025-04-09', '2025-04-09 12:00-04', 140),
  (802, 8, 800, 'event', 47, 'policy', NULL,
   'NVIDIA''s 8-K after the 04-15 close: licence required indefinitely; up to $5.5B of charges. AMD''s 8-K before the next open: up to $800M.',
   NULL, '2025-04-15', '2025-04-15 17:22-04', 141),
  (803, 8, 802, 'condition', NULL, 'policy', NULL,
   'Hindsight scale: the actual charge was $4.5B, $2.5B of H20 could not ship in Q1 and ~$8B was lost from Q2 (05-28). '
   'The 8-K''s charge was a floor on the damage, not the size of it.', NULL, '2025-05-28', '2025-05-28 16:21-04', 149),
  (804, 8, 802, 'could_have', NULL, 'policy', NULL,
   'The curb sticks.', 'Reversed on 07-14: licences promised, later tied to a 15% revenue share with the US government.',
   '2025-07-14', '2025-07-14', 149);

INSERT INTO case_step (case_id, parent_id, role, entity_id, mechanism, direction, description, why_not, happened_at, public_at, evidence_doc)
-- In a confounded window a move counts against the event only beyond the sector's move, where we have one.
SELECT 8, 802, CASE WHEN abs(coalesce(sx.abnormal_return, m.abnormal_return)) >= 2 THEN 'consequence' ELSE 'could_have' END, s.entity_id, 'policy',
       CASE WHEN abs(coalesce(sx.abnormal_return, m.abnormal_return)) >= 2 THEN sign(coalesce(sx.abnormal_return, m.abnormal_return))::smallint ELSE -1 END,
       e.name || CASE WHEN abs(coalesce(sx.abnormal_return, m.abnormal_return)) >= 2 THEN ' moved ' || m.abnormal_return || '% vs its market over two sessions'
                        || coalesce(' (' || sx.abnormal_return || '% vs the chip sector)', '') || '.' ELSE ' is hit beyond the sector sell-off.' END,
       CASE WHEN abs(coalesce(sx.abnormal_return, m.abnormal_return)) < 2
            THEN 'Moved ' || m.abnormal_return || '% vs its market but ' || coalesce(sx.abnormal_return::text, '?') || '% vs the chip sector: it moved with the sector.' END,
       '2025-04-17', '2025-04-17 16:00-04', 150
FROM case_move m JOIN security s ON s.id = m.security_id JOIN entity e ON e.id = s.entity_id
LEFT JOIN case_move sx ON sx.case_id = 8 AND sx.security_id = m.security_id AND sx.window_name = 'vs_sector'
WHERE m.case_id = 8 AND m.window_name = 'd1' AND m.abnormal_return IS NOT NULL;
