-- Case 12, part 2: betas to SK hynix as of the results, first-session moves, story.
SELECT measure_driver((SELECT entity_id FROM security WHERE ticker = '000660' AND exchange = 'KRX'), '2026-07-29', 193);
SELECT case_auto_moves(12, '2026-07-28', '2026-07-29', ARRAY[
  '000660:KRX','005930:KRX','005935:KRX','402340:KRX','009150:KRX','042700:KRX','240810:KOSDAQ','036930:KOSDAQ','039030:KOSDAQ',
  '005380:KRX','373220:KRX','105560:KRX','207940:KRX','MU:Nasdaq','NVDA:Nasdaq','SNDK:Nasdaq','WDC:Nasdaq','STX:Nasdaq',
  'AMD:Nasdaq','TSM:NYSE','ASML:Nasdaq','285A:TSE','8035:TSE','6857:TSE','6146:TSE','069500:KRX','1306:TSE','SPY:NYSEArca'], 193);

INSERT INTO case_step (id, case_id, parent_id, role, entity_id, mechanism, direction, description, why_not, happened_at, public_at, evidence_doc) VALUES
  (1200, 12, NULL, 'cause', NULL, NULL, NULL,
   'Memory prices had nearly doubled in 1Q26, but the RATE of increase was falling (TrendForce: +58-63% in 2Q, +13-18% '
   'forecast for 3Q). Morgan Stanley said on 07-06 that momentum was "approaching a peak". Positions were crowded and '
   'leveraged (single-stock leveraged ETFs, record retail).', NULL, '2026-07-06', '2026-07-03', 192),
  (1201, 12, 1200, 'event', NULL, 'driver', NULL,
   'Record operating profit W60.5tn (76% margin) but 5% below consensus; HBM4 shipped later than expected. SK hynix '
   '-9.6% as the Kospi fell 6% (intraday -12.6%, second circuit breaker in two sessions).', NULL, '2026-07-29',
   '2026-07-29 08:00+09', 190),
  (1202, 12, 1201, 'condition', NULL, NULL, NULL,
   'The level did not matter, the change did: record profit and still a sell-off. And the move was mostly market '
   'structure: two days later SK hynix rose 30% (limit-up) with no change in its numbers.', NULL, '2026-07-31', '2026-07-31', 193);
SELECT case_auto_steps(12, 1201, 'driver', 2, 0.5);
