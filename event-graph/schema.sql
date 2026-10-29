-- Parity event graph, v2: anything that happens -> claims -> belief -> mechanisms over a world graph -> calls.
-- Postgres 17 + PostGIS.
--
-- Rules every fact follows:
--   1. PROVENANCE: every fact points to a source_doc. No source, no fact.
--   2. POINT-IN-TIME: valid_from/valid_to = when it was true in the world; known_at = when WE could have known it.
--      Every read filters known_at <= the moment being reasoned about, or replays leak the future.
--   3. GENERAL: nodes are entities of any kind; edges are links of any kind. Nothing is factory-specific.
--      Numbers a mechanism needs (buffer days, share of sales, stake) live in the link's attrs.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ───────────── sources and provenance ─────────────

CREATE TABLE source (                -- who is talking: an outlet, an account, an agency, a company, a sensor
  id         bigserial PRIMARY KEY,
  name       text NOT NULL,
  kind       text NOT NULL,          -- outlet, wire, social_account, government, company, exchange, sensor
  domain     text,
  is_primary boolean NOT NULL DEFAULT false,  -- speaks for itself: a company about its own plant, a regulator about its own rule
  prior_confirmed int NOT NULL DEFAULT 0,     -- seeded track record, before we have our own; see belief()
  prior_retracted int NOT NULL DEFAULT 0
);

CREATE TABLE source_doc (
  id              bigserial PRIMARY KEY,
  source_id       bigint NOT NULL REFERENCES source(id),
  kind            text NOT NULL,     -- article, filing, press_release, post, dataset, satellite, manual
  url             text,
  title           text,
  published_at    timestamptz,       -- when the world could first see it
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  syndicated_from bigint REFERENCES source_doc(id),  -- a copy of another doc is not independent confirmation
  sha256          text UNIQUE,
  -- Compliance: we may only trade on what we were allowed to have. Every doc says how we got it.
  acquired_via    text NOT NULL DEFAULT 'public'
                  CHECK (acquired_via IN ('public', 'licensed', 'foia', 'expert_call', 'own_research', 'manual')),
  license_ref     text,              -- vendor contract / terms that permit this use
  mnpi_cleared    boolean NOT NULL DEFAULT true  -- false = held for compliance review; the reasoner must not read it
);

-- ───────────── the world graph ─────────────

CREATE TABLE entity_kind (
  kind text PRIMARY KEY,
  note text NOT NULL
);
INSERT INTO entity_kind VALUES
  ('company',   'legal entity; parent_id rolls subsidiaries up to the listed one'),
  ('facility',  'any physical site: fab, plant, mine, port, refinery, data center, warehouse'),
  ('product',   'anything made or sold, as a taxonomy via parent_id'),
  ('commodity', 'traded raw material: oil, copper, wheat, neon'),
  ('country',   'sovereign state; also the subject of policy, sanctions, elections'),
  ('region',    'province, state, city, trade bloc'),
  ('person',    'executive, official, politician'),
  ('agency',    'regulator, central bank, ministry, court'),
  ('route',     'shipping lane, strait, pipeline, rail corridor'),
  ('currency',  'currency'),
  ('index',     'market index or benchmark'),
  ('policy',    'law, tariff, sanction, rule: a thing that can be enacted, changed or struck down'),
  ('instrument','a security or contract that is not equity we trade: MBS tranche, CDO, CDS, commercial paper, a loan pool'),
  ('fund',      'money market fund, hedge fund, pension, SIV/conduit: holds things and is funded by someone');

CREATE TABLE entity (
  id        bigserial PRIMARY KEY,
  kind      text NOT NULL REFERENCES entity_kind(kind),
  name      text NOT NULL,
  country   char(2),
  parent_id bigint REFERENCES entity(id),
  lei       text UNIQUE,             -- best cross-source join key for companies
  attrs     jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE entity_alias (          -- "TSMC", "Taiwan Semiconductor", "台積電" all resolve here
  entity_id bigint NOT NULL REFERENCES entity(id),
  alias     text NOT NULL,
  lang      text,
  PRIMARY KEY (entity_id, alias)
);
CREATE TABLE entity_geo (
  entity_id   bigint PRIMARY KEY REFERENCES entity(id),
  geom        geography(Point, 4326) NOT NULL,
  footprint   geography(Polygon, 4326),
  precision_m integer NOT NULL       -- 50 = surveyed, 5000 = "somewhere in that city"; drives match confidence
);
CREATE INDEX entity_geo_idx ON entity_geo USING gist (geom);

CREATE UNIQUE INDEX entity_cik_idx ON entity ((attrs->>'cik')) WHERE attrs ? 'cik';
CREATE UNIQUE INDEX entity_cusip_idx ON entity ((attrs->>'cusip')) WHERE attrs ? 'cusip';

-- Numbers about an entity (assets, equity, repo funding...), point-in-time: known_at = when it was filed.
-- Leverage on 2008-03-01 = whatever had been FILED by then, not the restated figure from later.
CREATE TABLE entity_fact (
  entity_id  bigint NOT NULL REFERENCES entity(id),
  metric     text   NOT NULL,         -- XBRL tag or our own name
  period_end date   NOT NULL,
  value      numeric NOT NULL,
  unit       text   NOT NULL,
  form       text,                    -- 10-K, 10-Q
  accession  text   NOT NULL,
  known_at   timestamptz NOT NULL,
  source_id  bigint NOT NULL REFERENCES source_doc(id),
  PRIMARY KEY (entity_id, metric, period_end, accession)
);

CREATE TABLE security (              -- what we actually trade
  id         bigserial PRIMARY KEY,
  entity_id  bigint NOT NULL REFERENCES entity(id),
  ticker     text NOT NULL,
  exchange   text NOT NULL,
  figi       text UNIQUE,
  is_primary boolean NOT NULL DEFAULT true,
  UNIQUE (ticker, exchange)
);

CREATE TABLE relation_kind (
  rel  text PRIMARY KEY,
  note text NOT NULL                 -- includes which attrs the mechanisms read
);
INSERT INTO relation_kind VALUES
  ('owns',      'company -> anything. attrs: stake_pct'),
  ('produces',  'facility|company -> product (via). attrs: capacity, global_share_pct, substitutable_days'),
  ('supplies',  'company -> company, of product (via). attrs: pct_of_customer_input, buffer_days, single_source, pct_of_supplier_revenue'),
  ('input_of',  'product -> product. attrs: criticality = blocking|major|minor'),
  ('competes',  'company -> company, in product (via)'),
  ('sells_in',  'company -> country|region. attrs: pct_of_revenue'),
  ('located_in','anything -> country|region'),
  ('regulates', 'agency -> company|product|country'),
  ('leads',     'person -> company|agency|country. attrs: role'),
  ('depends_on','anything -> route|commodity|policy. attrs: pct_exposed'),
  ('member_of', 'company -> index; country -> bloc'),
  ('allied_with','country -> country: an ally that tends to follow its policy. attrs: follow_prob'),
  -- money links: how 2008 travelled. A loss moves along holds; a run moves along lends_to; a promise along insures.
  ('holds',     'company|fund -> instrument|company. attrs: notional_usd, pct_of_equity, mark_level (1/2/3)'),
  ('issued',    'company|fund -> instrument: who owes on it'),
  ('backed_by', 'instrument -> instrument|commodity|region: an MBS is backed by loans in a region. attrs: pct'),
  ('lends_to',  'company|fund -> company|fund. attrs: notional_usd, tenor_days, secured, collateral_id'),
  ('insures',   'company -> instrument|company: CDS seller, bond insurer, guarantor. attrs: notional_usd, collateral_posted_usd'),
  ('backstops', 'agency|country -> company|instrument: explicit or implicit government support. attrs: explicit'),
  ('exposed_to', 'company -> driver (a commodity, a basket, an outcome''s odds, a bellwether): WHY its value depends on the '
                 'driver, from its business model, before any price is looked at. attrs: elasticity (% per 1% driver move, or '
                 'per odds point), channel (cost|revenue|margin|policy|demand|peer|index|fear), why, when (causes it holds for: '
                 'any|supply|demand). A call needs one of these; a measured beta (priced_on) only checks it'),
  ('priced_on', 'company -> driver (a commodity, a company, an outcome''s odds): how its stock has moved with the driver, '
                'measured from prices before known_at. attrs: beta (% per driver unit), tstat, r2, n, window, unit');

CREATE TABLE link (
  id         bigserial PRIMARY KEY,
  src_id     bigint NOT NULL REFERENCES entity(id),
  dst_id     bigint NOT NULL REFERENCES entity(id),
  rel        text   NOT NULL REFERENCES relation_kind(rel),
  via_id     bigint REFERENCES entity(id),     -- the product/commodity the link is about, when there is one
  attrs      jsonb  NOT NULL DEFAULT '{}',
  evidence   text   NOT NULL DEFAULT 'manual', -- disclosed, customs, analyst, inferred_llm, inferred_stats, manual
  confidence real   NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  source_id  bigint NOT NULL REFERENCES source_doc(id),
  valid_from date, valid_to date,
  known_at   timestamptz NOT NULL
);
CREATE INDEX link_src_idx ON link (src_id, rel);
CREATE INDEX link_dst_idx ON link (dst_id, rel);

-- ───────────── what comes in: events and claims ─────────────
-- An event is one thing that happened in the world. Many documents talk about it; each makes claims.
-- A claim is one checkable statement: "N3 line stopped", "restart in ~1 month", "tariff of 25% on X".

CREATE TABLE event (
  id            bigserial PRIMARY KEY,
  kind          text NOT NULL,       -- fire, explosion, storm, strike, sanction, tariff, election, arrest, ruling, outage, earnings...
  description   text NOT NULL,
  geom          geography(Point, 4326),
  radius_m      integer,
  occurred_at   timestamptz,
  first_seen_at timestamptz NOT NULL -- when OUR pipeline saw it
);

CREATE TABLE claim (
  id            bigserial PRIMARY KEY,
  event_id      bigint NOT NULL REFERENCES event(id),
  subject_id    bigint REFERENCES entity(id),  -- null = we could not resolve who it is about (itself a warning sign)
  object_id     bigint REFERENCES entity(id),  -- the other party, when there is one: the CEO who left, the acquirer, the plaintiff
  change        text NOT NULL,       -- capacity_loss, leader_departed, leader_appointed, demand_loss, policy_enacted, ...
  attrs         jsonb NOT NULL DEFAULT '{}',   -- details the mechanism reads: role, planned, interim, price...
  magnitude     numeric,             -- in `unit`
  unit          text,                -- pct_capacity, pct, usd, ...
  duration_days integer,
  statement     text NOT NULL,
  first_seen_at timestamptz NOT NULL,
  supersedes    bigint REFERENCES claim(id),   -- a later estimate of the same thing ("1 month" -> "100 days")
  resolution    text CHECK (resolution IN ('true', 'false', 'partly')),  -- set once the world settles it
  resolved_at   timestamptz
);

CREATE TABLE claim_evidence (
  claim_id  bigint NOT NULL REFERENCES claim(id),
  doc_id    bigint NOT NULL REFERENCES source_doc(id),
  stance    text NOT NULL CHECK (stance IN ('supports', 'denies', 'retracts')),
  kind      text NOT NULL CHECK (kind IN ('report', 'primary', 'physical')),  -- physical = satellite, AIS, seismic, grid data
  PRIMARY KEY (claim_id, doc_id)
);

-- ───────────── reasoning: mechanisms and their rules ─────────────
-- A mechanism is one way a change travels through the graph. The reasoner never looks up an answer;
-- it applies mechanisms to the graph as it stood. History tunes rule_param and proposes new rules.

CREATE TABLE mechanism (
  key    text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('built', 'planned')),
  reads  text[] NOT NULL,            -- relation kinds it walks
  note   text NOT NULL
);
INSERT INTO mechanism VALUES
  ('supply_loss',  'built',   '{owns,produces,supplies,input_of,competes}',
   'lost output flows to customers, shrunk by dependence, absorbed by buffers, amplified by criticality; competitors fill the gap'),
  ('demand_shock', 'planned', '{sells_in,supplies}',   'a buyer, market or country stops buying: suppliers lose sales by exposure'),
  ('policy',       'built',   '{sells_in,produces,competes}',
   'a rule, tariff or sanction changes who can sell what, where. Built so far: export restrictions. A company under the '
   'issuing government loses (its sales into the target x the restricted part of them); its own guidance replaces the '
   'estimate once published; rivals outside the issuer''s reach are the candidate winners'),
  ('financial',    'built',   '{holds,issued,backed_by,lends_to,insures,backstops,depends_on}',
   'losses flow to holders (by pct_of_equity), runs flow to whoever is funded short-term by the lender pulling back, '
   'insurers owe when what they insure fails, backstops cap the damage to debt but not to equity'),
  ('governance',   'built',   '{leads,owns}',
   'a leader leaving or arriving moves a company by the role''s weight x how surprising it was x the leader''s track record; '
   'a strong leader leaving hurts, a weak one leaving helps, and their record follows them to the next company'),
  ('contagion',    'planned', '{competes,member_of}',   'peers repriced on read-through: "if it happened to them..."'),
  ('driver',       'built',   '{exposed_to,priced_on}',
   'markets move on the surprise in a driver (oil, a bellwether''s results, an election''s odds), and each stock''s response '
   'to that driver is MEASURED from its own past prices: a call needs a REASON (exposed_to: cost, revenue, policy...) that holds '
   'for why the driver moved; the measured beta is a safety check on it (agree: its size is used; disagree: flagged, down-weighted)');

CREATE TABLE rule_param (
  mechanism text NOT NULL,           -- 'belief' for the false-news filter, 'global' for walk limits
  key       text NOT NULL,
  value     numeric NOT NULL,
  note      text NOT NULL DEFAULT '',
  PRIMARY KEY (mechanism, key)
);
INSERT INTO rule_param VALUES
  ('global',      'max_hops',                4,    'stop walking downstream after this many hops'),
  ('global',      'min_impact',              0.1,  'stop walking a path once it loses less than this many output-days'),
  ('supply_loss', 'crit_blocking',           1.0,  'output lost per unit of input lost, when nothing works without it'),
  ('supply_loss', 'crit_major',              0.5,  ''),
  ('supply_loss', 'crit_minor',              0.1,  ''),
  ('supply_loss', 'default_dependence',      0.25, 'share of a customer''s need one supplier covers, when unknown'),
  ('supply_loss', 'default_buffer_days',     30,   'customer inventory of an input, when unknown'),
  ('supply_loss', 'default_substitute_days', 180,  'days until other suppliers cover a lost product, when unknown'),
  ('supply_loss', 'default_outage_days',     30,   'outage length when a claim gives none'),
  ('supply_loss', 'unknown_penalty',        0.7,  'confidence multiplier per defaulted number on an edge'),
  ('supply_loss', 'competitor_capture',      0.5,  'share of the world shortfall competitors can make up during the gap'),
  ('policy',      'default_restricted_share', 0.3, 'share of a company''s sales into the target that a restriction catches, when unknown'),
  ('policy',      'revenue_to_price',        1.2,  'abnormal return per unit of revenue put at risk. Was 0.6; x2.0 after 3 independent cases agreed (1.94, 1.98, 2.01): markets price persistence and spread, not one year of lost sales'),
  ('policy',      'entity_ban_restricted_share', 0.9, 'share of sales to a company cut off from everything (Entity List/SDN) that stops'),
  ('policy',      'undisclosed_customer_pct', 5, 'a customer a US filer never named is under the 10% disclosure line: assume this'),
  ('policy',      'target_demand_drop',      0.3,  'how much less a company cut off from its inputs buys from suppliers the rule does not reach'),
  ('policy',      'next_in_line_hit_pct',    8,    'hit on a company in the target''s country that still depends on the issuer''s inputs (x dependence)'),
  ('policy',      'target_rival_gain_pct',   2.0,  'abnormal return for a rival of a company that has been cut off'),
  ('policy',      'sdn_target_hit_pct',      30,   'move of a company placed on the sanctions list (at the base offtake loss)'),
  ('policy',      'sdn_offtake_loss',        0.5,  'share of a sanctioned company''s output that can no longer reach buyers, when the claim gives none'),
  ('policy',      'commodity_price_per_shortfall', 4, '% price move per 1% of world supply lost'),
  ('policy',      'producer_price_leverage', 1.0,  'equity move per 1% commodity price move, for revenue fully in that commodity'),
  ('policy',      'default_commodity_revenue_share', 0.4, 'revenue share in the commodity, when unknown'),
  ('policy',      'sdn_associate_hit_pct',   40,   'fear-of-association hit on a company the sanctioned one owns, per 100% stake'),
  ('policy',      'allied_follow_prob',      0.5,  'chance an ally''s government follows a restriction, when the link gives none'),
  ('policy',      'non_issuer_capture',      0.3,  'share of a restricted rival''s lost sales a rival outside the issuer''s reach can win'),
  ('governance',  'role_ceo',                1.0,  'weight of the role: how much of the company one person moves'),
  ('governance',  'role_cfo',                0.4,  ''),
  ('governance',  'role_other',              0.2,  ''),
  ('governance',  'planned_surprise',        0.3,  'a pre-announced succession is mostly priced; an abrupt change is not (1.0)'),
  ('governance',  'track_scale_pct',         25,   'yearly excess return that counts as a strong record: tanh(excess / this)'),
  ('governance',  'departure_scale_pct',     10,   'abnormal return when a top-record CEO leaves abruptly'),
  ('governance',  'appointment_scale_pct',   10,   'abnormal return when a top-record CEO arrives abruptly'),
  ('financial',   'run_prob_scale',          0.5,  'chance of a run per unit of uninsured-deposit share, for a bank that shares nothing with the failed one'),
  ('financial',   'base_overlap_mult',       1.0,  'extra run chance per unit of deposits in the same base as the failed bank (tech/VC, crypto)'),
  ('financial',   'franchise_loss',          0.3,  'equity lost in a run beyond realised bond losses (franchise, fire sales)'),
  ('financial',   'gsib_damp',               0.2,  'run chance multiplier for a too-big-to-fail bank: deposits flee to it'),
  ('financial',   'backstop_relief',         0.1,  'share of a bank''s run-driven equity loss a DEPOSITOR backstop removes on day one. Was 0.7: case 10 showed it protects depositors, not shareholders'),
  ('belief',      'prior',                  0.3,  'chance a claim is true before any evidence'),
  ('belief',      'primary_weight',          3.0,  'log-odds added when the subject itself confirms'),
  ('belief',      'physical_weight',         2.5,  'log-odds added by sensor evidence: satellite, AIS, grid'),
  ('belief',      'retract_weight',          5.0,  'log-odds removed by a retraction'),
  ('belief',      'unresolved_penalty',      1.0,  'log-odds removed when the subject is not in our graph');

-- What the reasoner said, frozen at the time it said it.
CREATE TABLE impact_call (
  id          bigserial PRIMARY KEY,
  event_id    bigint NOT NULL REFERENCES event(id),
  as_of       timestamptz NOT NULL,
  entity_id   bigint NOT NULL REFERENCES entity(id),
  mechanism   text NOT NULL REFERENCES mechanism(key),
  direction   smallint NOT NULL CHECK (direction IN (-1, 1)),
  hops        smallint NOT NULL,
  impact      numeric NOT NULL,
  conf        numeric NOT NULL,
  path        text NOT NULL,
  made_at     timestamptz NOT NULL DEFAULT now()
);

-- ───────────── the case library: how the reasoner learns ─────────────
-- One case = one past event, written up with hindsight: why it happened, what it caused, what it could have
-- caused but didn't, what the market did, and what we could have done with what was knowable at the time.
-- Replays hide everything not public by the replay time; scoring then uses all of it.

CREATE TABLE case_study (
  id          bigserial PRIMARY KEY,
  event_id    bigint NOT NULL REFERENCES event(id),
  title       text NOT NULL,
  anon_title  text NOT NULL,         -- name-free version, so a model can't answer from memory of the real event
  summary     text NOT NULL,
  fingerprint jsonb NOT NULL,        -- what makes it comparable: event kind, mechanisms, sector, size, market regime
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verified'))
);

CREATE TABLE case_step (             -- the causal story as a tree: parent_id is "because of"
  id         bigserial PRIMARY KEY,
  case_id    bigint NOT NULL REFERENCES case_study(id),
  parent_id  bigint REFERENCES case_step(id),
  role       text NOT NULL CHECK (role IN ('cause', 'condition', 'event', 'consequence', 'could_have')),
  -- cause: why it happened. condition: what made it worse or milder (tight market, stockpile).
  -- consequence: what it actually caused. could_have: a path that looked likely but didn't happen, and why not.
  entity_id  bigint REFERENCES entity(id),
  mechanism  text REFERENCES mechanism(key),
  direction  smallint CHECK (direction IN (-1, 1)),   -- for the entity: hurt or helped
  description text NOT NULL,
  why_not    text,                   -- for could_have: what stopped it
  happened_at date,
  public_at   timestamptz,           -- when the market could have known: the replay cutoff for this step
  evidence_doc bigint REFERENCES source_doc(id)
);

CREATE TABLE case_move (             -- what prices did
  case_id     bigint NOT NULL REFERENCES case_study(id),
  security_id bigint NOT NULL REFERENCES security(id),
  window_name text NOT NULL,         -- d1, d5, d20
  raw_return  numeric,
  abnormal_return numeric,           -- vs market/sector; null until computed from price data
  evidence_doc bigint REFERENCES source_doc(id),
  PRIMARY KEY (case_id, security_id, window_name)
);

CREATE TABLE case_opportunity (      -- what we could have done, using only what was public at enter_at
  id          bigserial PRIMARY KEY,
  case_id     bigint NOT NULL REFERENCES case_study(id),
  security_id bigint REFERENCES security(id),
  action      text NOT NULL,         -- short, long, avoid, hedge
  enter_at    timestamptz NOT NULL,
  exit_at     timestamptz,
  payoff_pct  numeric,
  rationale   text NOT NULL
);

CREATE TABLE replay_run (
  id       bigserial PRIMARY KEY,
  case_id  bigint NOT NULL REFERENCES case_study(id),
  as_of    timestamptz NOT NULL,
  params   jsonb NOT NULL,           -- rule_param snapshot, so a score is tied to the rules that earned it
  run_at   timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE replay_result (
  run_id    bigint NOT NULL REFERENCES replay_run(id),
  entity_id bigint NOT NULL REFERENCES entity(id),
  predicted smallint,                -- direction we called, null = we said nothing
  actual    smallint,                -- direction the case records, null = nothing recorded
  mechanism text,
  verdict   text NOT NULL,           -- hit, wrong_direction, missed, false_alarm, unconfirmed, avoided
  impact    numeric,                 -- signed, in the mechanism's unit (output-days, or % abnormal return)
  actual_move numeric,               -- the case's first-day move, % (case_move d1), for magnitude error
  path      text,
  lesson    text                     -- the case's explanation, so a miss carries its own reason
);

-- ───────────── prices ─────────────

CREATE TABLE price_daily (
  security_id bigint NOT NULL REFERENCES security(id),
  d           date NOT NULL,
  close_adj   numeric NOT NULL,
  volume      bigint,
  PRIMARY KEY (security_id, d)
);

-- ───────────── training log: every rule the cases changed, and why ─────────────
CREATE TABLE rule_change (
  id         serial PRIMARY KEY,
  made_on    date NOT NULL,
  mechanism  text NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('new_rule', 'tuned', 'proposed', 'rejected', 'open_question')),
  change     text NOT NULL,
  evidence   text NOT NULL,          -- which cases, what they showed
  cases      int[] NOT NULL
);
ALTER TABLE case_study ADD COLUMN replay_at timestamptz;   -- the moment the case is scored at, if not first sight

-- ───────────── analysts: what equity researchers said, why, and how it turned out ─────────────
-- An analyst view is a claim from a source like any other: its belief comes from that analyst's track record.
-- Its numbers can stand in for company guidance; its reasoning ("because X supplies Y") is a link to test;
-- and scoring it against the outcome builds the track record. Full broker reports are licensed (e.g. FactSet);
-- public coverage of notes is used until that feed is connected.
CREATE TABLE analyst_view (
  id            bigserial PRIMARY KEY,
  source_id     bigint NOT NULL REFERENCES source(id),      -- the broker or analyst (kind 'analyst')
  analyst       text,                                        -- named analyst, when known
  entity_id     bigint NOT NULL REFERENCES entity(id),      -- the company the view is about
  event_id      bigint REFERENCES event(id),                -- the event it reacts to, if any
  published_at  timestamptz NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('rating', 'price_target', 'estimate', 'exposure', 'thesis')),
  rating_from   text, rating_to text,
  value_from    numeric, value_to numeric, unit text,        -- price target, EPS, revenue, or % of revenue at risk
  period        text,                                        -- FY2025, next 12 months...
  reasoning     text NOT NULL,                               -- the WHY, in their words or a close paraphrase
  claimed_link  jsonb,                                       -- e.g. {"rel":"supplies","src":"Samsung","dst":"NVIDIA","what":"HBM"}
  outcome       numeric,                                     -- what the same number turned out to be
  outcome_note  text,
  doc_id        bigint REFERENCES source_doc(id)
);
INSERT INTO rule_param VALUES
  ('analyst', 'estimate_weight', 0.8, 'confidence multiplier on an analyst exposure estimate vs company guidance (1.0)');

-- Triage queue fed by official event catalogs (catalog/catalog.py). A candidate becomes an event + claims only once a
-- mechanism can read it; known_at is the earliest moment it was legally public (public inspection beats publication).
CREATE TABLE event_candidate (
  id           bigserial PRIMARY KEY,
  catalog      text NOT NULL,                 -- fedreg, fedreg_pi, fed_press, fema, usgs
  ext_id       text NOT NULL,
  agency       text,
  kind         text,                          -- sanction, export_control, tariff, rate_decision, disaster, quake, approval, other
  title        text NOT NULL,
  url          text,
  occurred_at  timestamptz,
  known_at     timestamptz NOT NULL,
  published_at timestamptz,                   -- official publication, when later than known_at
  material     boolean NOT NULL DEFAULT false,
  attrs        jsonb NOT NULL DEFAULT '{}',
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  event_id     bigint REFERENCES event(id),
  UNIQUE (catalog, ext_id)
);
INSERT INTO rule_param VALUES
  ('driver', 'min_t',               3,   'a measured beta must be this many standard errors from zero: every priced ticker is tried, so t>2 alone would let ~1 in 20 through by chance'),
  ('driver', 'min_n',               50,  'daily observations needed; a ticker with a short history is not measured'),
  ('driver', 't_full',              4,   'confidence reaches belief x 1 at this t-stat (scales linearly below it)'),
  ('driver', 'earnings_elasticity', 1.5, 'own stock move, %, per 1% earnings miss/beat vs consensus (prior, uncalibrated)'),
  ('driver', 'window_days',         120, 'calendar days of daily prices before the event used to measure betas');

-- ───────────── channels: what a KIND of event usually moves, beyond its headline ─────────────
-- The open network: a war is not only an oil story. Each row says "events of this kind usually move this priced driver
-- this much on the first session", with the reason and the past cases the prior was tuned on (never the case being tested).
-- impact() applies every channel of the event's kind that no claim has already measured, at reduced confidence, and fans
-- each out through the stocks' measured betas to that driver, so names that never appear in the headline still get a call.
CREATE TABLE channel_rule (
  event_kind text NOT NULL,
  ticker     text NOT NULL,
  exchange   text NOT NULL,
  cause      text NOT NULL,          -- WHY this kind of event moves the driver: exposures are read for that cause only
  rationale  text NOT NULL,
  obs_on     date[] NOT NULL,        -- past cases' first sessions ...
  obs_move   numeric[] NOT NULL,     -- ... and the driver's % move on each. The prior is their median, leaving out any
  PRIMARY KEY (event_kind, ticker, exchange)   -- observation within 7 days of the event being predicted (no self-tuning)
);
INSERT INTO channel_rule VALUES
  ('conflict', 'BZ=F', 'NYMEX', 'supply', 'supply risk to oil (Gulf, Russia); route or outage not yet known',
   '{2019-09-16,2020-01-03,2022-02-24,2023-10-09,2024-04-15,2025-06-13}', '{14.6,3.5,2.3,4.2,-0.4,7.0}'),
  ('conflict', 'ITA', 'NYSEArca', 'any', 'expected defense spending and munitions replenishment',
   '{2019-09-16,2020-01-03,2022-02-24,2023-10-09,2024-04-15,2025-06-13}', '{1.0,1.1,2.8,4.4,-0.5,0.4}'),
  ('conflict', 'GLD', 'NYSEArca', 'any', 'safe-haven demand',
   '{2019-09-16,2020-01-03,2022-02-24,2023-10-09,2024-04-15,2025-06-13}', '{0.8,1.3,-0.6,1.8,1.9,1.3}'),
  ('conflict', '^VIX', 'INDEX', 'any', 'fear',
   '{2019-09-16,2020-01-03,2022-02-24,2023-10-09,2024-04-15,2025-06-13}', '{6.8,12.4,-2.3,1.4,11.1,15.5}');
INSERT INTO rule_param VALUES
  ('driver', 'orthogonalize', 1, '1: a price driver''s beta is measured on the part of its move the US market does not explain (supply, not demand); 0: raw'),
  ('driver', 'scale_odds', 0.87, 'size correction for election-odds drivers: tune_driver() on 4 cases (Brazil 2026, US 2024, Argentina 2023, Brazil 2022), held-out error 7.81 -> 7.59'),
  ('driver', 'scale_rate', 2.82, 'size correction for policy-rate surprises: tune_driver() on 4 cases (2001-01, 2001-04, 2008-01, 2020-03), held-out error 5.75 -> 5.56; dominated by 2001'),
  ('driver', 'scale_channel', 2.59, 'size correction for conflict channels (defense, fear, gold): tune_driver() on 3 cases, held-out error 2.76 -> 1.54'),
  ('driver', 'check_weight', 1, 'when the measured beta agrees with the reason, the size is this blend: w x beta + (1-w) x the reason''s elasticity'),
  ('driver', 'conf_no_check', 0.6, 'a causal call with no measured beta to check it against (thin or no price history)'),
  ('driver', 'conf_check_fails', 0.35, 'a causal call whose measured beta points the other way: kept (the reason stands) but flagged and down-weighted'),
  ('driver', 'channel_conf', 0.5, 'confidence of a channel the event''s KIND implies but no claim has measured yet (a prior, not news)');
