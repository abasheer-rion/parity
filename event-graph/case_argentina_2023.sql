-- Case 17 (driver, odds class, training): Milei wins Argentina's 2023 runoff (Sunday 11-19). Polymarket had him at
-- 54.5% at Friday's close; ~100 by Monday. Buenos Aires was shut Monday (holiday): the test is the US-listed names.
INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (217, 239, 'dataset', 'https://polymarket.com/event/argentina-presidential-election-who-will-win', 'Polymarket: Milei 54.5% at the 11-17 close', '2023-11-17 20:00-05'),
  (218, 1, 'dataset', NULL, 'Yahoo daily closes 2023-07 .. 2023-11 (research use)', '2023-11-22');
INSERT INTO entity (id, kind, name) VALUES (201, 'instrument', 'Odds: Milei wins 2023');
INSERT INTO security (id, entity_id, ticker, exchange) VALUES (141, 201, 'PM-MILEI23', 'Polymarket');
SELECT ensure_security(t, x, n) FROM (VALUES ('YPF','NYSE','YPF'), ('GGAL','Nasdaq','GGAL'), ('BMA','NYSE','BMA'), ('SUPV','NYSE','SUPV'), ('BBAR','NYSE','BBAR'), ('PAM','NYSE','PAM'), ('TGS','NYSE','TGS'), ('CEPU','NYSE','CEPU'), ('EDN','NYSE','EDN'), ('LOMA','NYSE','LOMA'), ('TEO','NYSE','TEO'), ('CRESY','Nasdaq','CRESY'), ('IRS','NYSE','IRS'), ('MELI','Nasdaq','MELI'), ('GLOB','NYSE','GLOB'), ('DESP','NYSE','DESP'), ('ARGT','NYSEArca','ARGT'), ('CAAP','NYSE','CAAP'), ('EWZ','NYSEArca','EWZ'), ('VIST','NYSE','VIST'), ('BIOX','Nasdaq','BIOX')) v(t, x, n);
INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (19, 'election', 'Argentina presidential runoff: Milei beats Massa 55.7-44.3', '2023-11-19 18:00-03', '2023-11-19 20:30-03');
INSERT INTO claim (id, event_id, subject_id, change, attrs, magnitude, unit, statement, first_seen_at, resolution, resolved_at) VALUES
  (83, 19, 201, 'driver_move', '{"unit": "points", "why": "Milei wins the runoff; Massa concedes"}', 45, 'points',
   'Milei wins: odds 54.5 -> ~100', '2023-11-19 20:30-03', 'true', '2023-11-19');
INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES (83, 217, 'supports', 'report');
INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint, replay_at) VALUES
  (17, 19, 'Milei wins Argentina''s runoff (Nov 2023)', 'A market-friendly outsider wins a runoff he was slightly favoured in',
   'Odds 54.5% at Friday''s close, ~100 by Monday. Training case for the odds-class size correction.',
   '{"event_kind": "election", "mechanisms": ["driver"], "driver": "Polymarket odds", "stage_tested": "driver -> stocks (odds move given)", "training": true}',
   '2023-11-20 09:00-05');
