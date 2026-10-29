SELECT measure_driver((SELECT entity_id FROM security WHERE ticker = 'INTC'), '2000-09-21', 226),
       measure_driver((SELECT entity_id FROM security WHERE ticker = 'AAPL'), '2000-09-28', 226);
SELECT case_auto_moves(19, '2000-09-21', '2000-09-22', ARRAY['INTC:Nasdaq','AMD:Nasdaq','AMAT:Nasdaq','KLAC:Nasdaq','LRCX:Nasdaq','HPQ:NYSE','MSFT:Nasdaq','MU:Nasdaq','TXN:NYSE','CSCO:Nasdaq','ORCL:Nasdaq','QQQ:Nasdaq','AMZN:Nasdaq','EBAY:Nasdaq','BKNG:Nasdaq','QCOM:Nasdaq','IBM:NYSE','AAPL:Nasdaq','NVDA:Nasdaq','ADI:NYSE','XLK:NYSEArca','SMH:Nasdaq','MSI:NYSE','SPY:NYSEArca'], 226),
       case_auto_moves(20, '2000-09-28', '2000-09-29', ARRAY['INTC:Nasdaq','AMD:Nasdaq','AMAT:Nasdaq','KLAC:Nasdaq','LRCX:Nasdaq','HPQ:NYSE','MSFT:Nasdaq','MU:Nasdaq','TXN:NYSE','CSCO:Nasdaq','ORCL:Nasdaq','QQQ:Nasdaq','AMZN:Nasdaq','EBAY:Nasdaq','BKNG:Nasdaq','QCOM:Nasdaq','IBM:NYSE','AAPL:Nasdaq','NVDA:Nasdaq','ADI:NYSE','XLK:NYSEArca','SMH:Nasdaq','MSI:NYSE','SPY:NYSEArca'], 226);
INSERT INTO case_step (id, case_id, parent_id, role, entity_id, mechanism, direction, description, happened_at, public_at, evidence_doc) VALUES
  (1900, 19, NULL, 'event', NULL, 'driver', NULL, 'Intel halves its Q3 growth outlook (Europe; a weak euro); chip, PC and equipment names follow.', '2000-09-22', '2000-09-21 16:30-04', 224),
  (2000, 20, NULL, 'event', NULL, 'driver', NULL, 'Apple guides EPS ~30% below consensus; worldwide slowdown, poor back-to-school, the G4 Cube.', '2000-09-29', '2000-09-28 16:15-04', 227);
SELECT case_auto_steps(19, 1900, 'driver', 2, 0.5), case_auto_steps(20, 2000, 'driver', 2, 0.5);
