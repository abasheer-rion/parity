-- Replace the hand-estimated track records with ones computed from prices (stock vs SPY over the tenure,
-- up to the day before the event). Known at the event: prices are public as they print.
INSERT INTO source_doc (id, source_id, kind, title, published_at) VALUES
  (27, 1, 'dataset', 'Daily closes (Yahoo, research use): leader tenure returns vs SPY', '2024-08-12');
UPDATE link l SET attrs = l.attrs || jsonb_build_object('tenure_excess_return_pct_ann',
         tenure_excess_ann(s.id, (SELECT id FROM security WHERE ticker = 'SPY'), l.valid_from, DATE '2024-08-12')),
       source_id = 27, confidence = 0.8
FROM security s
WHERE l.rel = 'leads' AND l.attrs ? 'tenure_excess_return_pct_ann' AND s.entity_id = l.dst_id AND l.dst_id IN (30, 31);
