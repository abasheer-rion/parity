SELECT measure_driver(201, '2023-11-18', 218);
SELECT case_auto_moves(17, '2023-11-17', '2023-11-20', ARRAY['YPF:NYSE','GGAL:Nasdaq','BMA:NYSE','SUPV:NYSE','BBAR:NYSE','PAM:NYSE','TGS:NYSE','CEPU:NYSE','EDN:NYSE','LOMA:NYSE','TEO:NYSE','CRESY:Nasdaq','IRS:NYSE','MELI:Nasdaq','GLOB:NYSE','DESP:NYSE','ARGT:NYSEArca','CAAP:NYSE','EWZ:NYSEArca','VIST:NYSE','BIOX:Nasdaq','SPY:NYSEArca'], 218);
INSERT INTO case_step (id, case_id, parent_id, role, entity_id, mechanism, direction, description, happened_at, public_at, evidence_doc) VALUES
  (1700, 17, NULL, 'event', NULL, 'driver', NULL, 'Milei wins 55.7-44.3 (odds 54.5 -> ~100): read as dollarisation, privatisation (YPF), an end to controls.', '2023-11-19', '2023-11-19 20:30-03', 217);
SELECT case_auto_steps(17, 1700, 'driver', 2, 0.5);
