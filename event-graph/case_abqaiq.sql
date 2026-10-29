-- Case 14 (driver, oil class, training): Abqaiq attack (Sep 2019). Stage 2 only, as case 11: GIVEN the first Brent settle (+14.6%),
-- who moves with it, by each stock's oil beta over the 120 days before. Added to train the oil-class size correction.
INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (210, 232, 'dataset', NULL, 'Brent front-month settle 2019-09-16: +14.6% vs prior session', '2019-09-16 19:30+00'),
  (211, 1, 'dataset', NULL, 'Yahoo daily closes around 2019-09-16 (research use)', '2019-09-16');
INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (16, 'conflict', 'Drone and missile strike on Saudi Aramco''s Abqaiq and Khurais plants knocks out ~5.7 mb/d (~5% of world supply)', '2019-09-14 03:31+03', '2019-09-14 03:31+03');
INSERT INTO claim (id, event_id, subject_id, change, attrs, magnitude, unit, statement, first_seen_at, resolution, resolved_at) VALUES
  (80, 16, 180, 'driver_move', '{"unit": "pct", "cause": "crude_outage", "why": "Abqaiq attack"}', 14.6, 'pct',
   'Brent settles +14.6% on the first session after the strike', '2019-09-16 19:30+00', 'true', '2019-09-16');
INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES (80, 210, 'supports', 'primary');
INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint, replay_at) VALUES
  (14, 16, 'Abqaiq attack (Sep 2019)', 'A strike takes out half of the largest exporter''s crude processing', 'Drone and missile strike on Saudi Aramco''s Abqaiq and Khurais plants knocks out ~5.7 mb/d (~5% of world supply). Brent +14.6% on the first session. Training case for the oil-class size correction.',
   '{"event_kind": "conflict", "mechanisms": ["driver"], "driver": "Brent", "stage_tested": "driver -> stocks (oil move given)", "training": true}',
   '2019-09-16 20:30+00');
