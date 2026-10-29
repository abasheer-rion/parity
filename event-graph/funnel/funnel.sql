-- The news funnel's own database (`funnel`), kept apart from `eg` because build.sh drops and rebuilds `eg`.
-- Raw items land here, are deduped into stories, tagged with tickers and a kind by rules (no AI model), and only
-- material stories are handed to eg.event_candidate (funnel.py promote), which is safe to re-run after every rebuild.

CREATE TABLE IF NOT EXISTS feed (          -- one polled endpoint: its schedule, caching headers and what it cost us
  id            text PRIMARY KEY,          -- 'bw:home', 'gdelt_doc:3', 'gdelt_events', 'alpaca_news'
  adapter       text NOT NULL,
  arg           text,                      -- the feed URL or query the adapter reads
  every_s       integer NOT NULL,          -- normal gap between polls
  license       text NOT NULL,             -- the terms that let us read it; copied onto every promoted story
  enabled       boolean NOT NULL DEFAULT true,
  next_at       timestamptz NOT NULL DEFAULT now(),
  etag          text,                      -- conditional GET: an unchanged feed answers 304 with no body
  last_modified text,
  cursor        text,                      -- adapter state: GDELT's last file, Alpaca's last article time
  last_ok       timestamptz,
  fails         integer NOT NULL DEFAULT 0,-- consecutive failures; the gap doubles with each (capped at 6 hours)
  last_error    text,
  polls         bigint NOT NULL DEFAULT 0,
  not_modified  bigint NOT NULL DEFAULT 0,
  bytes_in      bigint NOT NULL DEFAULT 0,
  items_in      bigint NOT NULL DEFAULT 0,
  items_new     bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS story (         -- one real-world story, however many outlets carried it
  id              bigserial PRIMARY KEY,
  title           text NOT NULL,           -- the earliest item's headline
  kind            text,                    -- capacity_loss, leader_change, guidance, deal, financial_stress, policy, conflict, ...
  material        boolean NOT NULL DEFAULT false,
  tickers         text[] NOT NULL DEFAULT '{}',
  countries       text[] NOT NULL DEFAULT '{}',
  publishers      text[] NOT NULL DEFAULT '{}',
  n_items         integer NOT NULL DEFAULT 0,
  tokens          text[] NOT NULL DEFAULT '{}',  -- the headline's word set, for matching later copies
  first_published timestamptz,             -- earliest time any copy says it was published
  first_seen      timestamptz NOT NULL DEFAULT now(),  -- when OUR funnel first saw it: the latency we can act on
  updated_at      timestamptz NOT NULL DEFAULT now(),
  promoted_at     timestamptz
);
CREATE INDEX IF NOT EXISTS story_seen ON story (first_seen);
CREATE INDEX IF NOT EXISTS story_tickers ON story USING gin (tickers);

CREATE TABLE IF NOT EXISTS item (          -- one copy of a story from one feed: headline and a short summary only
  id           bigserial PRIMARY KEY,
  url_key      text NOT NULL UNIQUE,       -- sha256 of the canonical URL (tracking parameters stripped)
  url          text NOT NULL,
  feed_id      text NOT NULL REFERENCES feed(id),
  publisher    text,
  title        text NOT NULL,
  summary      text,                       -- capped at 300 characters; the full article is never fetched
  published_at timestamptz,
  seen_at      timestamptz NOT NULL DEFAULT now(),
  tickers      text[] NOT NULL DEFAULT '{}',
  attrs        jsonb NOT NULL DEFAULT '{}',
  story_id     bigint REFERENCES story(id)
);
CREATE INDEX IF NOT EXISTS item_story ON item (story_id);
CREATE INDEX IF NOT EXISTS item_seen ON item (seen_at);

-- Details pulled from the headline and the feed's full description by facts.py (rules, no model): amounts, percentages,
-- durations, timelines, people and roles, places, quantities and watch terms. A story's facts merge its copies' facts.
ALTER TABLE item  ADD COLUMN IF NOT EXISTS facts jsonb NOT NULL DEFAULT '{}';
ALTER TABLE story ADD COLUMN IF NOT EXISTS facts jsonb NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS story_facts ON story USING gin (facts);

CREATE TABLE IF NOT EXISTS watch_term (    -- words and phrases worth flagging wherever they appear; add your own
  term  text PRIMARY KEY,                  -- matched case-insensitively as a whole phrase
  label text NOT NULL,                     -- what the digest shows
  note  text
);
INSERT INTO watch_term (term, label, note) VALUES
  ('force majeure', 'force majeure', 'a supplier says it cannot deliver: the clearest supply-loss signal'),
  ('sole supplier', 'sole supplier', 'no substitute: loss passes straight to customers'),
  ('single source', 'single source', NULL), ('sole source', 'sole source', NULL),
  ('allocation', 'allocation', 'a supplier rationing output among customers'),
  ('shortage', 'shortage', NULL), ('backlog', 'backlog', NULL), ('inventory', 'inventory', NULL),
  ('price increase', 'price increase', NULL), ('price hike', 'price increase', NULL), ('surcharge', 'surcharge', NULL),
  ('halt', 'halt', NULL), ('halted', 'halt', NULL), ('suspend', 'suspension', NULL), ('suspended', 'suspension', NULL),
  ('restart', 'restart', NULL), ('resume', 'restart', NULL), ('reopen', 'restart', NULL),
  ('plant closure', 'plant closure', NULL), ('new plant', 'new plant', NULL), ('capacity expansion', 'capacity expansion', NULL),
  ('layoffs', 'layoffs', NULL), ('job cuts', 'layoffs', NULL), ('strike', 'strike', NULL), ('lockout', 'lockout', NULL),
  ('recall', 'recall', NULL), ('outage', 'outage', NULL), ('cyberattack', 'cyberattack', NULL), ('ransomware', 'cyberattack', NULL),
  ('fire', 'fire', NULL), ('explosion', 'explosion', NULL), ('flood', 'flood', NULL), ('earthquake', 'earthquake', NULL),
  ('drought', 'drought', NULL), ('hurricane', 'hurricane', NULL), ('typhoon', 'typhoon', NULL),
  ('guidance', 'guidance', NULL), ('profit warning', 'profit warning', NULL), ('preliminary results', 'preliminary results', NULL),
  ('going concern', 'going concern', NULL), ('chapter 11', 'bankruptcy', NULL), ('bankruptcy', 'bankruptcy', NULL),
  ('downgrade', 'downgrade', NULL), ('covenant', 'covenant', NULL), ('liquidity', 'liquidity', NULL),
  ('entity list', 'entity list', NULL), ('export license', 'export license', NULL), ('export controls', 'export controls', NULL),
  ('sanctions', 'sanctions', NULL), ('embargo', 'embargo', NULL), ('tariff', 'tariff', NULL), ('tariffs', 'tariff', NULL),
  ('antitrust', 'antitrust', NULL), ('subpoena', 'subpoena', NULL), ('class action', 'class action', NULL),
  ('investigation', 'investigation', NULL), ('consent decree', 'consent decree', NULL),
  ('fda approval', 'FDA approval', NULL), ('complete response letter', 'FDA rejection', NULL),
  ('supply agreement', 'supply agreement', NULL), ('contract', 'contract', NULL), ('award', 'award', NULL),
  ('buyback', 'buyback', NULL), ('dividend cut', 'dividend cut', NULL), ('delisting', 'delisting', NULL),
  ('rate cut', 'rate cut', NULL), ('rate hike', 'rate hike', NULL), ('blockade', 'blockade', NULL), ('ceasefire', 'ceasefire', NULL)
ON CONFLICT (term) DO NOTHING;

-- The landing zone: every entry every source gives us, uncut and before any rule looks at it, so new rules can
-- re-read the past (funnel.py normalize --again). An entry the source edits later lands again as a new version.
CREATE TABLE IF NOT EXISTS raw (
  id            bigserial PRIMARY KEY,
  feed_id       text NOT NULL REFERENCES feed(id),
  ext_key       text NOT NULL,             -- the source's own id: guid, accession number, event id, or the link
  version       text NOT NULL,             -- sha256 of body
  url           text,
  title         text,
  published_at  timestamptz,               -- when the source says it happened or was posted
  seen_at       timestamptz NOT NULL DEFAULT now(),  -- when we first had it: seen_at - published_at is our lag
  backfill      boolean NOT NULL DEFAULT false,      -- came in on a feed's first poll: old news, not lag
  body          jsonb NOT NULL,            -- the entry as the source gave it (XML as a dict, JSON as is)
  normalized_at timestamptz,
  UNIQUE (feed_id, ext_key, version)
);
CREATE INDEX IF NOT EXISTS raw_todo ON raw (id) WHERE normalized_at IS NULL;
CREATE INDEX IF NOT EXISTS raw_seen ON raw (seen_at);
ALTER TABLE item ADD COLUMN IF NOT EXISTS raw_id bigint REFERENCES raw(id);
ALTER TABLE feed ADD COLUMN IF NOT EXISTS needs text;   -- env var(s) that must be set, else the feed is skipped

-- ───────────── the bridge to the engine (bridge.py) ─────────────
-- Conflict articles per country pair per day, from GDELT: the baseline an escalation is measured against.
CREATE TABLE IF NOT EXISTS conflict_day (
  pair      text NOT NULL,                 -- 'RUS-UKR': the two ISO-3 codes in order
  day       date NOT NULL,
  articles  integer NOT NULL,              -- articles behind the day's root conflict events (CAMEO 18-20) ...
  files     integer NOT NULL,              -- ... in this many of the day's 96 fifteen-minute files
  PRIMARY KEY (pair, day)
);
-- What the bridge decided for each material story, and why: the list of what the engine cannot read yet.
CREATE TABLE IF NOT EXISTS bridge (
  story_id    bigint PRIMARY KEY REFERENCES story(id),
  decided_at  timestamptz NOT NULL DEFAULT now(),
  status      text NOT NULL,               -- 'event' (handed to the engine) or 'waiting' (nothing reads it yet)
  reason      text NOT NULL,
  escalation  bigint
);
-- An escalation the bridge handed to the engine as an event.
CREATE TABLE IF NOT EXISTS escalation (
  id           bigserial PRIMARY KEY,
  pair         text NOT NULL,
  detected_at  timestamptz NOT NULL DEFAULT now(),
  articles_24h integer NOT NULL,
  baseline     numeric NOT NULL,           -- median articles a day over the 30 days before
  eg_event_id  bigint                      -- the event in eg; re-created after a rebuild, calls are not
);
-- What the engine called, frozen when it was said, kept here because build.sh drops eg. Scored later against prices.
CREATE TABLE IF NOT EXISTS live_call (
  id            bigserial PRIMARY KEY,
  escalation_id bigint REFERENCES escalation(id),
  made_at       timestamptz NOT NULL DEFAULT now(),
  ticker        text,
  name          text NOT NULL,
  mechanism     text NOT NULL,
  direction     smallint NOT NULL,
  impact        numeric NOT NULL,          -- % abnormal return on the first session, for driver calls
  conf          numeric NOT NULL,
  path          text NOT NULL
);
