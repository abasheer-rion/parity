-- Case 5, part 2: hindsight. Moves computed vs home benchmark; window = 05-15 close -> 05-17 close (two sessions;
-- the ban came after the US close, before Asia/Europe opened 05-16). d5 = -> 05-22, through the Android news.
INSERT INTO source_doc (id, source_id, kind, title, published_at) VALUES
  (99, 1, 'dataset', 'Daily closes (Yahoo, research use), May 2019; abnormal = stock minus home benchmark', '2019-06-30');

INSERT INTO case_step (id, case_id, parent_id, role, entity_id, mechanism, direction, description, why_not, happened_at, public_at, evidence_doc) VALUES
  (500, 5, NULL, 'cause', 80, 'policy', NULL,
   'US national-security case against Huawei (5G networks, Iran-sanctions charges in January 2019) in a trade war that '
   'had just escalated: US tariffs on $200B of Chinese goods went to 25% on 05-10.', NULL, '2019-05-10', '2019-05-10', 81),
  (501, 5, NULL, 'condition', NULL, 'policy', NULL,
   'Reuters reported on the evening of 05-14 that an order on telecom gear from security-risk firms was coming that week.',
   NULL, '2019-05-14', '2019-05-14 21:43-04', 80),
  (502, 5, 500, 'event', 80, 'policy', NULL,
   'After the close on 05-15, Commerce put Huawei and 68 affiliates on the Entity List: any US-origin item needs a licence, '
   'presumption of denial. Effective 05-16.', NULL, '2019-05-15', '2019-05-15 18:18-04', 81),
  (503, 5, 502, 'consequence', 81, 'policy', -1,
   'NeoPhotonics (49% of revenue from Huawei) fell ~20% on 05-16 and >20% again on 05-17 (press; no free price history: '
   'acquired later).', NULL, '2019-05-17', '2019-05-17 16:00-04', 95),
  (504, 5, 502, 'consequence', NULL, 'policy', -1,
   'Google suspended business with Huawei needing transferred hardware, software or services (05-19, Reuters): Huawei '
   'phones abroad would lose Google''s Android. This carried the hit to component makers outside the US rule.',
   NULL, '2019-05-19', '2019-05-19 14:00-04', 96),
  (505, 5, 502, 'condition', NULL, 'policy', NULL,
   'A 90-day Temporary General License (05-20) and later partial resumptions of non-US-origin shipments (Micron, Intel, '
   'June) softened but did not lift the ban.', NULL, '2019-05-20', '2019-05-20 16:15-04', 97);

-- Every listed name's two-session move, each with the engine's view recorded in the lesson.
INSERT INTO case_move (case_id, security_id, window_name, raw_return, abnormal_return, evidence_doc)
SELECT 5, s.id, w.name, abnormal_return(s.id, b.id, '2019-05-15', w.d1), abnormal_return(s.id, b.id, '2019-05-15', w.d1), 99
FROM security s JOIN security b ON b.ticker = bench_for(s.exchange)
CROSS JOIN (VALUES ('d1', DATE '2019-05-17'), ('d5', DATE '2019-05-22')) w(name, d1)
WHERE s.entity_id IN (SELECT id FROM entity WHERE id BETWEEN 82 AND 107) OR s.ticker IN ('NXPI', 'IFX');

-- Direction of each actual move becomes a consequence (|move| >= 2 points) or a "didn't happen" (smaller).
INSERT INTO case_step (case_id, parent_id, role, entity_id, mechanism, direction, description, why_not, happened_at, public_at, evidence_doc)
SELECT 5, 502, CASE WHEN abs(m.abnormal_return) >= 2 THEN 'consequence' ELSE 'could_have' END, s.entity_id, 'policy',
       CASE WHEN abs(m.abnormal_return) >= 2 THEN sign(m.abnormal_return)::smallint ELSE -1 END,
       e.name || CASE WHEN abs(m.abnormal_return) >= 2
                      THEN ' moved ' || m.abnormal_return || '% vs its market over the two sessions after the ban.'
                      ELSE ' is hit.' END,
       CASE WHEN abs(m.abnormal_return) < 2 THEN 'Moved only ' || m.abnormal_return || '% vs its market in the first two sessions.' END,
       '2019-05-17', '2019-05-17 16:00-04', 99
FROM case_move m JOIN security s ON s.id = m.security_id JOIN entity e ON e.id = s.entity_id
WHERE m.case_id = 5 AND m.window_name = 'd1' AND m.abnormal_return IS NOT NULL;
