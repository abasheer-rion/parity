-- Disney leader records from prices (DIS vs SPY): Iger's first stint and Chapek's, up to Friday 2022-11-18.
INSERT INTO source_doc (id, source_id, kind, title, published_at) VALUES
  (67, 1, 'dataset', 'Daily closes (Yahoo, research use): Disney leader tenures vs SPY', '2022-11-18');
UPDATE link SET attrs = attrs || jsonb_build_object('tenure_excess_return_pct_ann',
         tenure_excess_ann((SELECT id FROM security WHERE ticker = 'DIS'), (SELECT id FROM security WHERE ticker = 'SPY'),
                           valid_from, coalesce(valid_to, DATE '2022-11-18'))),
       source_id = 67
WHERE rel = 'leads' AND dst_id = 60;

-- Moves: Friday close -> Monday close, vs SPY.
INSERT INTO case_move (case_id, security_id, window_name, raw_return, abnormal_return, evidence_doc)
SELECT 4, s.id, 'd1', abnormal_return(s.id, (SELECT id FROM security WHERE ticker = 'SPY'), '2022-11-18', '2022-11-21'),
       abnormal_return(s.id, (SELECT id FROM security WHERE ticker = 'SPY'), '2022-11-18', '2022-11-21'), 67
FROM security s WHERE s.ticker IN ('DIS', 'CMCSA', 'NFLX', 'ROKU', 'FOXA');
