-- Case 11, part 2 (needs prices): measure oil betas as of the strike, record what every ticker did, write the story.
SELECT measure_driver(180, '2026-02-28', 185);
-- The other channels a conflict implies (channel_rule): every ticker's beta to defense, gold and fear, same window.
SELECT measure_driver(s.entity_id, '2026-02-28', 185) FROM security s
WHERE (s.ticker, s.exchange) IN (('ITA','NYSEArca'), ('GLD','NYSEArca'), ('^VIX','INDEX'));
SELECT case_auto_moves(11, '2026-02-27', '2026-03-02', ARRAY[
  'FRO:NYSE','STNG:NYSE','DHT:NYSE','INSW:NYSE','VLO:NYSE','MPC:NYSE','PSX:NYSE','XOM:NYSE','CVX:NYSE','SHEL:LSE','BP:LSE',
  'EQNR:NYSE','LNG:NYSE','VG:NYSE','LMT:NYSE','NOC:NYSE','RTX:NYSE','GD:NYSE','RHM:XETRA','BA:LSE','DAL:NYSE','UAL:Nasdaq',
  'AAL:Nasdaq','LHA:XETRA','AF:EPA','CCL:NYSE','RCL:NYSE','NCLH:NYSE','LYB:NYSE','DOW:NYSE','BAS:XETRA','CF:NYSE',
  'RELIANCE:NSE','BPCL:NSE','IOC:NSE','5020:TSE','010950:KRX','096770:KRX','9101:TSE','9104:TSE','9107:TSE','GLD:NYSEArca',
  'LPG:NYSE','MATX:NYSE','ITA:NYSEArca','NIFTYBEES:NSE','069500:KRX','1306:TSE','EXSA:XETRA','ISF:LSE','SPY:NYSEArca'], 185);

INSERT INTO case_step (id, case_id, parent_id, role, entity_id, mechanism, direction, description, why_not, happened_at, public_at, evidence_doc) VALUES
  (1100, 11, NULL, 'cause', 181, NULL, NULL,
   'Months of US-Iran escalation; Israel and the US strike Iran on a Saturday morning and Iran''s leadership is hit.',
   NULL, '2026-02-28', '2026-02-28 08:10+02', 180),
  (1101, 11, 1100, 'event', 182, 'driver', NULL,
   'Iran''s military says Hormuz is closed (~20% of world oil); tanker traffic falls ~70% then to near zero, insurers pull '
   'cover on 03-05. The first oil settle is only +7.3%: the market prices a disruption, not yet a long closure.',
   NULL, '2026-03-02', '2026-03-02 10:00+03:30', 183),
  (1102, 11, 1101, 'condition', 180, 'driver', NULL,
   'Spare capacity ~4 mb/d (Saudi, UAE) and ~2.6 mb/d of unused bypass pipelines, plus 415 mb in the US SPR: why the '
   'first move was modest. A week later Brent was +28% as the closure held.', NULL, '2026-02-27', '2026-02-27', 184),
  (1103, 11, 1101, 'condition', NULL, NULL, NULL,
   'Defense is not an oil story: it jumped on day one (NOC +6%, BAE +6%) on spending, then peaked that day and fell '
   '24-39% by October (capacity limits, rich valuations, a German frigate cancellation). No oil beta can see this channel.',
   NULL, '2026-03-02', '2026-03-02', 185),
  (1104, 11, 1101, 'condition', NULL, NULL, NULL,
   'Second-order winners beat the obvious ones over months: refiners +105-131% (record cracks) vs XOM +20%; Equinor and '
   'US LNG as non-Hormuz gas; Japanese liners and LPG carriers on longer routes. Crude tankers fell in week one: equity '
   'follows actual fixtures, and almost nothing loaded in the Gulf.', NULL, '2026-06-10', '2026-06-10', 185);

SELECT case_auto_steps(11, 1101, 'driver', 2, 0.5);
