-- Case 1: Renesas Naka N3 fire, 2021-03-19. Written with hindsight; replay() hides what wasn't public yet.
-- Status 'draft': share moves are as reported in press, not computed from price data.

INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint) VALUES
  (1, 2, 'Renesas Naka N3 fire (2021)',
   'Fire stops a major supplier''s line for a blocking auto component during an existing shortage',
   'An equipment fire stopped the 300mm line of the supplier of ~30% of the world''s automotive MCUs while the '
   'auto chip market was already short. Restart took 29 days, full shipments ~100. Automakers with thin buffers '
   'were hit; the obvious winners, rival MCU makers, could not gain because their own fabs were still down.',
   '{"event_kind": "fire", "mechanisms": ["supply_loss"], "sector": "semiconductors > autos",
     "region": "JP", "world_share_lost_pct": 7.5, "outage_days": 100,
     "regime": {"market": "existing shortage", "competitor_slack": "none"}}');

INSERT INTO case_step (id, case_id, parent_id, role, entity_id, mechanism, direction, description, why_not,
                       happened_at, public_at, evidence_doc) VALUES
  -- why it happened
  (1, 1, NULL, 'cause', 20, NULL, NULL,
   'Overcurrent ignited plating equipment on the N3 first floor; the casing and tank had low heat resistance.',
   NULL, '2021-03-19', '2021-03-21 18:00+09', 4),
  -- what shaped how big it got
  (2, 1, NULL, 'condition', NULL, NULL, NULL,
   'Auto chip supply was already short since late 2020: automakers'' buffers were thin and no one had slack.',
   NULL, '2020-12-01', '2021-01-15', 6),
  (3, 1, NULL, 'condition', NULL, NULL, NULL,
   'The two main rival MCU makers had their Austin fabs shut by winter storm Uri on 02-15 and were still recovering.',
   NULL, '2021-02-15', '2021-02-17', 10),
  -- the event
  (4, 1, 1, 'event', 20, 'supply_loss', -1,
   'N3 300mm line stopped. 600 m2 (~5%) of clean room burned, 23 tools damaged. Restarted 04-17 at <10%, '
   'targeting 100% by end of May; full shipments ~100 days after the fire. 98% of outsourceable N3 products '
   'moved to other fabs or foundries.',
   NULL, '2021-03-19', '2021-03-19 12:00+09', 12),
  -- what it caused
  (5, 1, 4, 'consequence', 1, 'supply_loss', -1,
   'Renesas shares fell 4.9% on the first trading day after the severity was known.',
   NULL, '2021-03-22', '2021-03-22 15:00+09', 6),
  (6, 1, 4, 'consequence', 3, 'supply_loss', -1,
   'Nissan shares fell 2-3% (AP) to over 3% (WSJ) on 03-22; it was already cutting output and planned more cuts.',
   NULL, '2021-03-22', '2021-03-22 15:00+09', 6),
  (7, 1, 4, 'consequence', 7, 'supply_loss', -1,
   'Honda shares fell 2-3% (AP) to over 3% (WSJ) on 03-22. Our graph had no Renesas -> Honda link, '
   'so a correct reasoner over this graph could not see it: the fix is data, not rules.',
   NULL, '2021-03-22', '2021-03-22 15:00+09', 6),
  (8, 1, 4, 'consequence', 2, 'supply_loss', -1,
   'Toyota shares fell 2-3% (AP) to over 3% (WSJ) on 03-22 but it fared better than peers: stockpile agreements with its suppliers '
   'cushioned the gap. Our graph had no buffer for Toyota, so it used the 30-day default.',
   NULL, '2021-03-22', '2021-03-22 15:00+09', 6),
  -- what looked likely but didn't happen
  (9, 1, 4, 'could_have', 4, 'supply_loss', 1,
   'NXP picks up the MCU share Renesas lost.',
   'Its own Austin fabs were shut by the 02-15 storm and only resumed mid-March, with a ~$100M Q2 revenue hit. '
   'No spare capacity to sell. This was public a month BEFORE the fire.',
   NULL, '2021-02-17', 10),
  (10, 1, 4, 'could_have', 5, 'supply_loss', 1,
   'Infineon picks up the MCU share Renesas lost.',
   'Its Austin fab was shut 02-15 and expected back to pre-storm output only in June 2021. Public before the fire.',
   NULL, '2021-02-17', 11);

INSERT INTO case_move (case_id, security_id, window_name, raw_return, abnormal_return, evidence_doc) VALUES
  (1, 1, 'd1', -4.9, NULL, 6),
  (1, 3, 'd1', -3.0, NULL, 6),
  (1, 7, 'd1', -3.0, NULL, 6),
  (1, 2, 'd1', -3.0, NULL, 6);

INSERT INTO case_opportunity (case_id, security_id, action, enter_at, exit_at, payoff_pct, rationale) VALUES
  (1, 1, 'short', '2021-03-21 18:00+09', NULL, NULL,
   'After the Sunday update the stop was confirmed by the company itself, belief was high, and Tokyo had not traded it yet. '
   'Payoff to fill from prices.'),
  (1, 4, 'avoid', '2021-03-19 12:00+09', NULL, NULL,
   'The naive "rival wins" trade on NXP/Infineon was a trap: their own outages were public since 02-17. '
   'A reasoner that checks competitors'' live capacity avoids it.'),
  (1, 2, 'hedge', '2021-03-22 09:00+09', NULL, NULL,
   'Relative: Toyota vs Nissan/Honda, if Toyota''s stockpile was public before 03-22. Needs checking before it counts.');

SELECT setval('case_study_id_seq', 1), setval('case_step_id_seq', 10);
