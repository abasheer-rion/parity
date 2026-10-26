-- Case 18 (driver, odds class, test of reasons without a price check): Lula beats Bolsonaro, Sunday 2022-10-30,
-- 50.9-49.1. No public odds history exists for 2022 (Polymarket's pre-order-book market has none), so the surprise is
-- poll-implied and no beta can check the calls: they stand on the business-model reasons alone (exposures.sql).
INSERT INTO source (id, name, kind, domain, is_primary, prior_confirmed, prior_retracted) VALUES
  (242, 'Datafolha', 'pollster', 'datafolha.folha.uol.com.br', false, 0, 0);
INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (221, 238, 'dataset', 'https://resultados.tse.jus.br/', 'TSE: Lula 50.90%, Bolsonaro 49.10% (100% counted)', '2022-10-30 19:57-03'),
  (222, 242, 'dataset', NULL, 'Datafolha final runoff poll: Lula 52%, Bolsonaro 48% of valid votes', '2022-10-29 21:00-03'),
  (223, 1, 'dataset', NULL, 'Yahoo daily closes 2022-06 .. 2022-11 (research use)', '2022-11-04');
INSERT INTO entity (id, kind, name) VALUES (196, 'instrument', 'Brazil 2022: Lula wins (poll-implied odds)');
INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (20, 'election', 'Brazil presidential runoff: Lula beats Bolsonaro 50.9-49.1; Congress leans right', '2022-10-30 17:00-03', '2022-10-30 19:57-03');
INSERT INTO claim (id, event_id, subject_id, change, attrs, magnitude, unit, statement, first_seen_at, resolution, resolved_at) VALUES
  (84, 20, 196, 'driver_move',
   '{"unit": "points", "why": "Lula wins narrowly", "basis": "~70% before the vote: Datafolha 52-48 valid votes, after polls had understated Bolsonaro by ~7 pts in round one"}',
   30, 'points', 'Lula wins: from ~70% (poll-implied) to 100', '2022-10-30 19:57-03', 'true', '2022-10-30');
INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES (84, 221, 'supports', 'primary'), (84, 222, 'supports', 'report');
INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint, replay_at) VALUES
  (18, 20, 'Lula beats Bolsonaro (Oct 2022)', 'The favoured left candidate wins a runoff narrowly, facing a right-leaning Congress',
   'Poll-implied ~70% before the vote. No odds series: the calls rest on reasons only, with no price check.',
   '{"event_kind": "election", "mechanisms": ["driver"], "driver": "poll-implied odds", "stage_tested": "reasons only, no beta check", "training": true}',
   '2022-10-31 09:00-03');
