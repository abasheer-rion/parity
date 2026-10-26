-- Case 15 (driver, oil class, training): Israel strikes Iran (Jun 2025). Stage 2 only, as case 11: GIVEN the first Brent settle (+7.0%),
-- who moves with it, by each stock's oil beta over the 120 days before. Added to train the oil-class size correction.
INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (212, 232, 'dataset', NULL, 'Brent front-month settle 2025-06-13: +7.0% vs prior session', '2025-06-13 19:30+00'),
  (213, 1, 'dataset', NULL, 'Yahoo daily closes around 2025-06-13 (research use)', '2025-06-13');
INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (17, 'conflict', 'Israel strikes Iran''s nuclear and military sites; Iran answers with missiles', '2025-06-13 03:30+03:30', '2025-06-13 03:30+03:30');
INSERT INTO claim (id, event_id, subject_id, change, attrs, magnitude, unit, statement, first_seen_at, resolution, resolved_at) VALUES
  (81, 17, 180, 'driver_move', '{"unit": "pct", "cause": "route_risk", "why": "Israel strikes Iran"}', 7.0, 'pct',
   'Brent settles +7.0% on the first session after the strike', '2025-06-13 19:30+00', 'true', '2025-06-13');
INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES (81, 212, 'supports', 'primary');
INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint, replay_at) VALUES
  (15, 17, 'Israel strikes Iran (Jun 2025)', 'One state strikes another oil exporter''s nuclear and military sites', 'Israel strikes Iran''s nuclear and military sites; Iran answers with missiles. Brent +7.0% on the first session. Training case for the oil-class size correction.',
   '{"event_kind": "conflict", "mechanisms": ["driver"], "driver": "Brent", "stage_tested": "driver -> stocks (oil move given)", "training": true}',
   '2025-06-13 20:30+00');
