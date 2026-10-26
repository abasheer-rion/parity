SELECT case_auto_moves(18, '2022-10-28', '2022-10-31', ARRAY['BOVA11:B3','PETR4:B3','ITUB4:B3','BBDC4:B3','BBAS3:B3','SBSP3:B3','AXIA3:B3','MGLU3:B3','BPAC11:B3','B3SA3:B3','CEAB3:B3','CYRE3:B3','MRVE3:B3','LREN3:B3','ASAI3:B3','COGN3:B3','VALE3:B3','SUZB3:B3','EMBJ3:B3','WEGE3:B3','BBSE3:B3','CSMG3:B3','RENT3:B3','EWZ:NYSEArca','PBR:NYSE','XP:Nasdaq','NU:NYSE','BRL=X:FX','SPY:NYSEArca'], 223);
INSERT INTO case_step (id, case_id, parent_id, role, entity_id, mechanism, direction, description, happened_at, public_at, evidence_doc) VALUES
  (1800, 18, NULL, 'event', NULL, 'driver', NULL, 'Lula wins 50.9-49.1 after a poll-implied ~70%; a right-leaning Congress limits him.', '2022-10-30', '2022-10-30 19:57-03', 221);
SELECT case_auto_steps(18, 1800, 'driver', 2, 0.5);
