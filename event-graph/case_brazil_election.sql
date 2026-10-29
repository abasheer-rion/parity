-- Case 13 (driver #3), LIVE: Lula beats Flavio Bolsonaro in Brazil's runoff, Sunday 2026-10-25. Prediction markets had
-- Flavio at ~77%. The call below is made before B3 opens on 10-26 and scored after its close: no hindsight possible.
-- Driver: the market's odds that Lula wins (Polymarket, daily). Each stock's sensitivity to those odds is measured from
-- 120 days of prices, which include the first round (10-04), when the odds swung 28 points in one weekend.
SELECT setval('entity_id_seq', greatest((SELECT max(id) FROM entity), 999) + 1, false),
       setval('security_id_seq', greatest((SELECT max(id) FROM security), 999) + 1, false);

INSERT INTO source (id, name, kind, domain, is_primary, prior_confirmed, prior_retracted) VALUES
  (238, 'TSE (Brazil electoral court)', 'government', 'tse.jus.br', true, 0, 0),
  (239, 'Polymarket', 'exchange', 'polymarket.com', false, 0, 0);
INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (200, 238, 'dataset', 'https://resultados.tse.jus.br', 'TSE totalisation: Lula 51.79% vs Flavio 48.21%; mathematically decided', '2026-10-25 21:10-03'),
  (201, 238, 'dataset', 'https://resultados.tse.jus.br', 'TSE partial at 13% counted: Flavio ahead (counting-order artefact)', '2026-10-25 19:45-03'),
  (202, 239, 'dataset', 'https://polymarket.com/event/brazil-presidential-election', 'Polymarket daily odds, Lula to win', '2026-10-25 23:59-03'),
  (203, 1, 'dataset', NULL, 'Yahoo daily closes, 2026-06 .. 2026-10 (research use)', '2026-10-26 05:00+00');

INSERT INTO entity (id, kind, name, country) VALUES
  (190, 'instrument', 'Odds: Lula wins Brazil 2026', 'BR'),
  (191, 'person', 'Luiz Inacio Lula da Silva', 'BR'),
  (192, 'person', 'Flavio Bolsonaro', 'BR');
INSERT INTO security (id, entity_id, ticker, exchange) VALUES (130, 190, 'PM-LULA', 'Polymarket');

SELECT ensure_security(t, x, n, k, 'BR') FROM (VALUES
  ('BOVA11','B3','Ibovespa ETF','index'), ('PETR4','B3','Petrobras','company'), ('ITUB4','B3','Itau Unibanco','company'),
  ('BBDC4','B3','Bradesco','company'), ('BBAS3','B3','Banco do Brasil','company'), ('SBSP3','B3','Sabesp','company'),
  ('AXIA3','B3','Axia (ex-Eletrobras)','company'), ('MGLU3','B3','Magazine Luiza','company'), ('BPAC11','B3','BTG Pactual','company'),
  ('B3SA3','B3','B3','company'), ('CEAB3','B3','C&A Brasil','company'), ('CYRE3','B3','Cyrela','company'),
  ('MRVE3','B3','MRV','company'), ('LREN3','B3','Lojas Renner','company'), ('ASAI3','B3','Assai','company'),
  ('COGN3','B3','Cogna','company'), ('VALE3','B3','Vale','company'), ('SUZB3','B3','Suzano','company'),
  ('EMBJ3','B3','Embraer','company'), ('WEGE3','B3','WEG','company'), ('JBSS3','B3','JBS','company'),
  ('BBSE3','B3','BB Seguridade','company'), ('CSMG3','B3','Copasa','company'), ('RENT3','B3','Localiza','company'),
  ('EWZ','NYSEArca','iShares MSCI Brazil','index'), ('PBR','NYSE','Petrobras ADR','company'), ('XP','Nasdaq','XP Inc','company'),
  ('NU','NYSE','Nu Holdings','company'), ('BRL=X','FX','US dollar in reais','currency')
) v(t, x, n, k);

INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (15, 'election', 'Brazil presidential runoff: Lula re-elected over Flavio Bolsonaro', '2026-10-25 17:00-03', '2026-10-25 19:00-03');
-- Odds at the last close before the vote (Fri 10-23): 23.5. A win resolves them to 100: +76.5 points of surprise.
INSERT INTO claim (id, event_id, subject_id, object_id, change, attrs, magnitude, unit, statement, first_seen_at, resolution, resolved_at) VALUES
  (76, 15, 190, 191, 'driver_move', '{"unit": "points", "why": "Lula wins the runoff (odds 23.5 at Friday''s close)"}', 76.5, 'points',
   'TSE: Lula 51.79%, Flavio 48.21%; result mathematically decided', '2026-10-25 21:10-03', 'true', '2026-10-25'),
  (77, 15, 192, NULL, 'leads_count', '{"pct_counted": 13}', NULL, NULL,
   'Partial count: Flavio ahead with 13% counted', '2026-10-25 19:45-03', 'false', '2026-10-25 20:28-03');
INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES (76, 200, 'supports', 'primary'), (77, 201, 'supports', 'primary');

INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint, replay_at) VALUES
  (13, 15, 'Lula wins Brazil''s runoff (Oct 2026) - live call',
   'An incumbent markets feared wins an election that betting markets gave him a 1-in-4 chance of winning',
   'Flavio Bolsonaro led the first round (Ibovespa +7.7% to a record, real +4%, odds 60% -> 84%). Lula won the runoff '
   '51.8/48.2. Offshore on Sunday night: BRL futures -10%, Tokyo Brazil ETF -11 to -15%. The engine''s call is made '
   'before B3 opens on Monday 10-26 and scored after the close.',
   '{"event_kind": "election", "mechanisms": ["driver"], "driver": "odds Lula wins", "surprise_points": 76.5,
     "live": true, "contested": "Flavio seeks annulment over the voting extension"}',
   '2026-10-26 09:00-03');
