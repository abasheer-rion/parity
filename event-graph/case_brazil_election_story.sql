-- Case 13, part 2: sensitivities to the odds as of the vote. Outcomes are recorded after B3's 10-26 close:
--   SELECT case_auto_moves(13, '2026-10-23', '2026-10-26', <tickers>, 203); SELECT case_auto_steps(13, 1301, 'driver', 2, 0.5);
SELECT measure_driver(190, '2026-10-24', 203);
INSERT INTO case_step (id, case_id, parent_id, role, entity_id, mechanism, direction, description, why_not, happened_at, public_at, evidence_doc) VALUES
  (1300, 13, NULL, 'cause', NULL, NULL, NULL,
   'Markets read Flavio as fiscal tightening (a debt-ceiling rule, R$200bn of savings) and Lula as looser policy with a '
   'bigger state role. The first round put Flavio ahead: domestic, rate-sensitive names led (XP +31%, MGLU3 +24%, B3 +23%) '
   'and exporters fell as the real rose.', NULL, '2026-10-05', '2026-10-05 10:00-03', 203),
  (1301, 13, 1300, 'event', NULL, 'driver', NULL,
   'Lula wins 51.8/48.2 after trailing; odds had him at 23.5% at Friday''s close. Flavio refuses to concede. A partial '
   'count at 19:45 showed Flavio ahead: an artefact of counting order, a trap for any engine reading headlines.',
   NULL, '2026-10-25', '2026-10-25 21:10-03', 200);
-- Outcome: the 10-26 session (final: B3 closed; a build before the close takes the latest print instead).
SELECT case_auto_moves(13, '2026-10-23', '2026-10-26', ARRAY['BOVA11:B3','PETR4:B3','ITUB4:B3','BBDC4:B3','BBAS3:B3','SBSP3:B3','AXIA3:B3','MGLU3:B3','BPAC11:B3','B3SA3:B3','CEAB3:B3','CYRE3:B3','MRVE3:B3','LREN3:B3','ASAI3:B3','COGN3:B3','VALE3:B3','SUZB3:B3','EMBJ3:B3','WEGE3:B3','JBSS3:B3','BBSE3:B3','CSMG3:B3','RENT3:B3','EWZ:NYSEArca','PBR:NYSE','XP:Nasdaq','NU:NYSE','BRL=X:FX','SPY:NYSEArca'], 203);
SELECT case_auto_steps(13, 1301, 'driver', 2, 0.5);
