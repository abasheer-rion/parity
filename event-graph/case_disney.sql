-- Case 4 (governance, out-of-sample): Disney fires Chapek and brings back Iger, Sunday 2022-11-20.
-- Facts from Disney's release and 8-K, CNBC, Axios, Deadline. Release time: no official timestamp found; Deadline
-- had it by 21:48 ET, so that is when we treat it as seen. Leader records are computed from prices in the story file.

INSERT INTO source (id, name, kind, domain, is_primary, prior_confirmed, prior_retracted) VALUES
  (30, 'The Walt Disney Company', 'company', 'thewaltdisneycompany.com', true, 0, 0),
  (31, 'Deadline',                'outlet',  'deadline.com', false, 9, 1),
  (32, 'CNBC',                    'outlet',  'cnbc.com',     false, 19, 1),
  (33, 'Axios',                   'outlet',  'axios.com',    false, 9, 1);

INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (60, 30, 'press_release', 'https://thewaltdisneycompany.com/the-walt-disney-company-board-of-directors-appoints-robert-a-iger-as-chief-executive-officer/',
         'Board appoints Robert A. Iger as CEO; Chapek steps down', '2022-11-20 21:48-05'),
  (61, 31, 'article', 'https://deadline.com/2022/11/disney-bob-iger-returns-ceo-bob-chapek-out-1235178223/', 'Bob Iger returns as Disney CEO', '2022-11-20 21:48-05'),
  (62, 30, 'filing', 'https://www.sec.gov/Archives/edgar/data/1744489/000174448922000200/dis-20221120.htm', '8-K Items 5.02/9.01: Chapek terminated without cause', '2022-11-21 16:17-05'),
  (63, 33, 'article', 'https://www.axios.com/2022/11/08/disney-earnings-november-2022-misses', 'Disney misses on earnings; streaming loss $1.47B', '2022-11-08 17:00-05'),
  (64, 32, 'article', 'https://www.cnbc.com/2022/08/15/loebs-third-point-takes-new-stake-in-disney-boosting-shares.html', 'Third Point takes new stake in Disney', '2022-08-15 08:00-04'),
  (65, 30, 'filing', 'https://www.sec.gov/Archives/edgar/data/1744489/000174448922000121/dis-20220628.htm', '8-K: Chapek contract extended three years', '2022-06-28 17:00-04'),
  (66, 32, 'article', 'https://www.cnbc.com/2023/02/09/activist-investor-nelson-peltz-declares-disney-proxy-fight-is-over-after-iger-unveils-restructuring.html',
         'Peltz declares Disney proxy fight over', '2023-02-09 12:00-05');

INSERT INTO entity (id, kind, name, country, attrs) VALUES
  (60, 'company', 'Walt Disney', 'US', '{"cik": "1744489"}'),
  (61, 'person',  'Bob Iger', 'US', '{}'),
  (62, 'person',  'Bob Chapek', 'US', '{}'),
  (63, 'fund',    'Third Point', 'US', '{}'),
  (64, 'fund',    'Trian Partners', 'US', '{}'),
  (65, 'company', 'Comcast', 'US', '{"cik": "1166691"}'),
  (66, 'company', 'Netflix', 'US', '{"cik": "1065280"}'),
  (67, 'company', 'Roku', 'US', '{"cik": "1428439"}'),
  (68, 'company', 'Fox Corp', 'US', '{"cik": "1754301"}');

INSERT INTO security (id, entity_id, ticker, exchange) VALUES
  (30, 60, 'DIS', 'NYSE'), (31, 65, 'CMCSA', 'Nasdaq'), (32, 66, 'NFLX', 'Nasdaq'), (33, 67, 'ROKU', 'Nasdaq'), (34, 68, 'FOXA', 'Nasdaq');

-- Leadership as known the night before. Records get filled from prices (story file); placeholders are 0.
INSERT INTO link (src_id, dst_id, rel, attrs, evidence, confidence, source_id, valid_from, valid_to, known_at) VALUES
  (62, 60, 'leads', '{"role": "CEO", "tenure_excess_return_pct_ann": 0}', 'disclosed', 0.8, 65, '2020-02-25', NULL, '2022-11-18'),
  (61, 60, 'leads', '{"role": "CEO", "tenure_excess_return_pct_ann": 0}', 'disclosed', 0.8, 62, '2005-09-30', '2020-02-25', '2022-11-18'),
  (63, 60, 'holds', '{"activist": true, "standstill": true}', 'disclosed', 0.8, 64, '2022-08-15', NULL, '2022-09-30'),
  (60, 65, 'competes', '{}', 'analyst', 0.6, 1, NULL, NULL, '2022-01-01'),
  (60, 66, 'competes', '{}', 'analyst', 0.7, 1, NULL, NULL, '2022-01-01'),
  (60, 67, 'competes', '{}', 'analyst', 0.4, 1, NULL, NULL, '2022-01-01'),
  (60, 68, 'competes', '{}', 'analyst', 0.5, 1, NULL, NULL, '2022-01-01');

INSERT INTO event (id, kind, description, occurred_at, first_seen_at) VALUES
  (6, 'leadership_change', 'Disney fires CEO Chapek, brings back Iger for two years', '2022-11-20 21:30-05', '2022-11-20 21:48-05');

INSERT INTO claim (id, event_id, subject_id, object_id, change, attrs, statement, first_seen_at, resolution, resolved_at) VALUES
  (20, 6, 60, 62, 'leader_departed',  '{"role": "CEO", "planned": false}', 'Chapek out as Disney CEO, effective immediately', '2022-11-20 21:48-05', 'true', '2022-11-21'),
  (21, 6, 60, 61, 'leader_appointed', '{"role": "CEO", "planned": false, "term_years": 2}', 'Iger returns as CEO for two years', '2022-11-20 21:48-05', 'true', '2022-11-21');
INSERT INTO claim_evidence (claim_id, doc_id, stance, kind) VALUES
  (20, 60, 'supports', 'primary'), (20, 61, 'supports', 'report'), (21, 60, 'supports', 'primary'), (21, 61, 'supports', 'report');

INSERT INTO case_study (id, event_id, title, anon_title, summary, fingerprint) VALUES
  (4, 6, 'Disney brings back Iger (2022)',
   'A board fires its CEO five months after extending him and brings back the long-serving predecessor',
   'Twelve days after an earnings miss sent the stock down 13% to a multi-year low, Disney''s board fired Bob Chapek, '
   'whose contract it had extended in June, and brought back Bob Iger for two years on a Sunday night. The stock opened '
   '+9% and closed +6.3% on a falling market; streaming peers did not join in.',
   '{"event_kind": "leadership_change", "mechanisms": ["governance"], "sector": "media", "region": "US", "role": "CEO",
     "abrupt": true, "returning_ceo": true, "activist_present": "settled, standstill", "prior_shock": "earnings miss -13%",
     "departing_record": "weak", "arriving_record": "strong, at the same company"}');

INSERT INTO case_step (id, case_id, parent_id, role, entity_id, mechanism, direction, description, why_not,
                       happened_at, public_at, evidence_doc) VALUES
  (400, 4, NULL, 'cause', 60, NULL, NULL,
   'Q4 FY22 missed badly (adj. EPS $0.30 vs ~$0.55 expected; streaming lost $1.47B) and the stock fell 13.2% on 11-09 '
   'to a multi-year low.', NULL, '2022-11-09', '2022-11-08 17:00-05', 63),
  (401, 4, NULL, 'condition', 63, NULL, NULL,
   'Third Point had pushed for change since August, then settled on 09-30 with a board seat and a standstill: pressure '
   'without an active fight.', NULL, '2022-09-30', '2022-08-15 08:00-04', 64),
  (402, 4, NULL, 'condition', 62, NULL, NULL,
   'The board had extended Chapek''s contract by three years in June 2022, so a firing five months later was a real surprise.',
   NULL, '2022-06-28', '2022-06-28 17:00-04', 65),
  (403, 4, 400, 'event', 60, 'governance', NULL,
   'Sunday-night release: Chapek out effective immediately (the 8-K says terminated without cause); Iger back as CEO '
   'for two years, tasked with finding a successor.', NULL, '2022-11-20', '2022-11-20 21:48-05', 60),
  (404, 4, 403, 'consequence', 60, 'governance', 1,
   'Disney opened +9.1% and closed +6.3% on Monday while the S&P 500 fell 0.4%: most of the gain was there at the '
   'open, and some faded during the day.', NULL, '2022-11-21', '2022-11-21 16:00-05', 60),
  (405, 4, 403, 'could_have', 66, 'governance', 1,
   'Streaming rivals rally in sympathy, or because Disney''s turmoil helps them.',
   'They fell slightly (Netflix -1.0%, Roku -3.6%, Comcast -0.4%, Fox -1.4%): a CEO change is company-specific.',
   '2022-11-21', '2022-11-21 16:00-05', 60),
  (406, 4, 403, 'could_have', 64, 'governance', NULL,
   'Trian''s January 2023 proxy fight wins a board seat.',
   'Iger announced a restructuring (3 divisions, ~7,000 jobs, $5.5B savings, dividend back) on 2023-02-08, and Peltz '
   'called the fight off the next day.', '2023-02-09', '2023-02-09 12:00-05', 66);

INSERT INTO case_opportunity (case_id, security_id, action, enter_at, exit_at, payoff_pct, rationale) VALUES
  (4, 30, 'long', '2022-11-20 21:48-05', '2022-11-21 09:30-05', 9.1,
   'Only reachable pre-market or on futures: from Friday''s close to Monday''s open was +9.1%. Speed is the whole edge.'),
  (4, 30, 'long', '2022-11-21 09:30-05', '2022-11-21 16:00-05', -2.5,
   'Buying at the open lost money (100.12 -> 97.58): by the open the news was priced and then some.');

SELECT setval('source_id_seq', greatest(33, (SELECT max(id) FROM source))),
       setval('source_doc_id_seq', greatest(66, (SELECT max(id) FROM source_doc))),
       setval('entity_id_seq', greatest(68, (SELECT max(id) FROM entity))),
       setval('security_id_seq', greatest(34, (SELECT max(id) FROM security))),
       setval('event_id_seq', greatest(6, (SELECT max(id) FROM event))),
       setval('claim_id_seq', greatest(21, (SELECT max(id) FROM claim))),
       setval('case_study_id_seq', greatest(4, (SELECT max(id) FROM case_study))),
       setval('case_step_id_seq', greatest(31, (SELECT max(id) FROM case_step)));
