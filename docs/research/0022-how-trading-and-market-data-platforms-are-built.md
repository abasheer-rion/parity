---
id: RES-0022
title: How trading and market data platforms are built
type: research
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [crypto, data, fx, infra]
related: [REF-0019, DEC-0046, RES-0021, REF-0015, DEC-0005, DEC-0019]
---

# How trading and market data platforms are built

## In plain words

We read how the big trading systems are put together, from the Bloomberg Terminal to forex platforms, crypto exchanges and the apps that let you trade through a broker. They all do two jobs. One carries prices from the market to your screen. The other carries your order from your screen to the market and back. The exchanges that match orders race in millionths of a second; the apps that only show prices work in tenths of a second, and that is the part Parity resembles. This note records what each system does at every step, how fast, and what a three-person company can copy. The plan we drew from it is in [REF-0019](../reference/0019-latency-budget-and-target-architecture.md).

## Summary

Gathered on 24 October 2026 from public documentation, engineering posts, papers, regulators and filings. Several sites refused automated reads (Bloomberg, IBKR's newer docs, Coinbase's blog, Robinhood's blog); where a claim rests on a secondary source or could not be checked, it says so.

| System | Market data path | Order path | Latency it works at | Persistence and failover | Tooling seen |
| --- | --- | --- | --- | --- | --- |
| Bloomberg Terminal and B-PIPE | Bloomberg data centres to a local process (bbcomm) on the desktop, or to a B-PIPE or Server API host at the customer; subscriptions per field, optionally conflated to an interval | Separate trading functions; not part of the data API | Not published; the API offers conflation "to improve the bandwidth usage and the latency" | Client-side failover over a list of hosts; Comdb2 replicated across more than two data centres; BlazingMQ for messaging | C++, embedded V8 and Chromium, more than 50 million lines of JavaScript, Comdb2, BlazingMQ |
| LSEG Real-Time and Workspace | Feed handlers normalise at source into one data model; RTDS distributes it inside a firm (hub and spoke), or the cloud service serves it over WebSocket | Not part of the data platform | Full Tick feed carries 9 million price updates a second; no latency figures published | Feed blending with automatic failover; server lists in the SDK | RWF binary format over TCP, reliable multicast or shared memory; JSON over WebSocket |
| EBS Market and LSEG FX Matching | Venue price feed; EBS moved from 100 ms to 20 ms updates in 2016 and 5 ms for some clients in 2017 | Central limit order books; EBS on CME Globex with engines in New York and London | Millisecond feeds, with randomised latency floors at FX venues | Not public | CME iLink 3 and MDP 3.0, FIX, XML API, dedicated lines |
| MetaTrader 4 and 5 | Broker's trade server streams quotes to desktop, web and mobile clients through access servers; MT4's Data Center proxy takes quote load off the server | Client to broker's trade server; the broker fills internally (B-book) or passes to liquidity providers through a bridge (A-book) | About 100 ms from a home connection; MetaQuotes' VPS claims 0 to 5 ms, with 96% of broker servers within 10 ms | Broker runs separate trade and history servers; trade servers hidden behind access points | Bridges such as PrimeXM XCore, oneZero Hub, Gold-i; FIX to liquidity providers |
| cTrader | Open API over TCP or WebSocket, Protobuf or JSON, through AWS Global Accelerator to the nearest proxy | Same API or FIX 4.4 | 50 requests a second per connection; heartbeat every 10 s | Separate demo and live hosts | Protobuf, FIX 4.4 |
| LMAX Exchange | Venue feed from the matching engine | FIX into a single-threaded in-memory business logic processor | Under 50 microseconds matching; 6 million orders a second on one thread (2011 hardware) | Event sourcing: every input journaled and replicated, nightly snapshot, restart in under a minute; third copy at the DR site | The Disruptor ring buffer, Java |
| Interactive Brokers | TWS or IB Gateway on the user's machine streams aggregated snapshots several times a second; 100 market data lines by default | App to local TWS or Gateway socket, then IB's servers, then smart routing | 50 messages a second from the client; historical data pacing rules | Not public | The TWS API over a local socket |
| OANDA v20 | HTTP chunked stream, one JSON line per price, heartbeat every 5 s, at most 4 prices a second per instrument | REST orders, 120 requests a second | 250 ms conflation on prices | Separate practice and live environments | REST, streaming HTTP |
| Hyperliquid | WebSocket feeds (trades, book, mids, user events) from non-validating API nodes | Signed actions into its own chain; matching, margin and liquidation on chain (HyperCore) | Median 0.2 s, p99 0.9 s end to end for co-located clients; about 200,000 orders a second | Every order, cancel and fill is in the chain; nodes write about 100 GB a day | HyperBFT consensus (a HotStuff variant), Rust node |
| Coinbase Exchange | Public and authenticated WebSocket feeds with per-product sequence numbers; batched level 2 every 50 ms; FIX market data | FIX 5.0 SP2 order entry with a separate drop copy | Not published | Guaranteed-delivery channels, sequence gaps detectable; weekly FIX reset | FIX, WebSocket |
| Kraken | WebSocket v2 with book checksums (CRC32 of the top 10 levels) and a level 3 feed; FIX 4.4 | FIX 4.4 behind HAProxy pinned per session; REST; cancel on disconnect by default | About 2 ms from AWS London, about 200 microseconds from colocation | Not public | Rust services (150,000 requests a second per instance, p99.9 under 3 ms) |
| Binance | WebSocket streams, book diffs every 100 or 1000 ms; binary SBE streams every 20 to 50 ms | REST, WebSocket API, FIX 4.4 with Ed25519 keys | Rate limits by weight; drop copy delayed 1 s | Data served from the matching engine, then memory, then database | SBE, FIX |
| TradingView | Its own feeds from 100 or more exchanges and 50 or more brokers; chart library customers supply their own datafeed (getBars, subscribeBars) | Charting Library's trading terminal calls a broker adapter the customer writes | Real-time exchange add-ons; delayed data 10 to 20 minutes behind | Not public | HTML5 canvas charts (Lightweight Charts, which Parity already uses) |
| Robinhood | Not public in detail | Introducing broker plus its own clearing broker; payment for order flow was most of 2020 transaction revenue | Not public | Self-clearing: its own clearing broker | Kafka and Faust, its Python stream processor |
| Alpaca | WebSocket for trades, quotes and bars; free IEX feed or the paid consolidated SIP feed | Trading API for one's own account; Broker API for apps that open accounts for end users | Not published | Alpaca is custodian and clearing firm | JSON or msgpack WebSocket, REST, SSE event streams |

**The pattern across all of them**

1. **Prices.** A feed handler per source, one normalised internal format, a sequence number per instrument so a gap is detected and the client resubscribes, conflation for slow consumers, and fan-out by multicast inside a data centre or by WebSocket to the outside. Coinbase, Kraken and Binance all tell clients to keep sequence numbers or checksums and rebuild the book on a gap.
2. **Orders.** A session (FIX or an API), risk checks before anything else, then matching (venues) or routing (brokers), with a separate drop copy or event stream reporting fills. Order entry is kept on separate hosts or ports from market data at Coinbase, Kraken and Binance.
3. **Persistence.** The input log is the record: LMAX journals every event and rebuilds from a snapshot plus replay; kdb+ tickerplants write a log that the real-time database replays on restart; Hyperliquid's chain is its log.
4. **Speed comes from doing less.** LMAX runs its business logic on one thread with no database and no locks. The Disruptor's whole point is avoiding queues, which "add hundreds of microseconds".
5. **Retail screens are conflated.** OANDA sends at most 4 prices a second; IBKR sends aggregated snapshots; Binance offers 100 ms and 1,000 ms book streams. A human cannot read faster, and conflation keeps slow connections from falling behind.

## Bloomberg and LSEG

### Bloomberg Terminal, BLPAPI and B-PIPE

- **One API, four products.** Desktop API, Server API, B-PIPE and Platform "share the same programming interface and behave almost identically". The enterprise products (Server API, B-PIPE, Platform) differ in that the customer's application must do "authentication, authorization and permissioning before distributing/receiving data", through the `//blp/apiauth` service ([BLPAPI Core Developer Guide](https://data.bloomberglp.com/professional/sites/10/2017/03/BLPAPI-Core-Developer-Guide.pdf)).
- **Where the data comes from.** Desktop API programs always talk to a local process, bbcomm, on localhost port 8194; enterprise programs talk to a Server API or B-PIPE host. Once subscribed, "continuous or intervalized tick updates will be sent from the Bloomberg Data Center" until the subscription ends (same guide).
- **Subscription and request.** Streaming prices (`//blp/mktdata`) are subscriptions to named fields; reference data (`//blp/refdata`) is request and response. Market depth is B-PIPE only. A subscription can ask for an interval, for example `IBM US Equity?fields=BID,ASK&interval=2` for at least 2 seconds between updates. Large answers come in chunks, and conflation exists "to improve the bandwidth usage and the latency" (same guide).
- **Failover is in the client.** The program is given a list of hosts and turns on automatic restart; on a disconnect it moves to the next host and resubscribes (same guide).
- **The desktop.** The Terminal is a Windows application that usually connects through a router Bloomberg installs on site, or over the internet as Bloomberg Anywhere; the back end began as Fortran and C and moved towards C++ and embedded JavaScript; there were 325,000 subscribers in 2022; Launchpad is a screen of small linked windows called components ([Wikipedia, Bloomberg Terminal](https://en.wikipedia.org/wiki/Bloomberg_Terminal)). Bloomberg says it has more than 50 million lines of JavaScript and more than 10,000 apps in the Terminal, moved apps to server-side JavaScript from 2005 and client-side around 2012, and embeds "the V8 engine and Chromium directly to create our own JavaScript platform" ([Bloomberg, adopting TypeScript at scale](https://www.techatbloomberg.com/blog/10-insights-adopting-typescript-at-scale/), read through an archive.org copy). Its public Chromium fork names the two uses, blpwtk2 and blpwebview ([bloomberg/chromium.bb](https://github.com/bloomberg/chromium.bb)).
- **Storage.** Comdb2 is Bloomberg's own relational database: one master and replicants, optimistic concurrency, commits acknowledged by every node by default, clusters spread over more than two data centres so losing one site does not break agreement, and a client library that picks the lowest-latency node and reconnects by itself. The paper mentions "a real-time market data feed, delivered using a highly-resilient custom architecture" ([Scotti et al., Comdb2, VLDB 2016](https://www.vldb.org/pvldb/vol9/p1377-scotti.pdf), [bloomberg/comdb2](https://github.com/bloomberg/comdb2)).
- **Messaging.** BlazingMQ is Bloomberg's message queue, in C++, "battle-tested in production at Bloomberg for 8+ years", with priority, fan-out and broadcast routing ([bloomberg/blazingmq](https://github.com/bloomberg/blazingmq), [concepts](https://bloomberg.github.io/blazingmq/docs/introduction/concepts/)). A leader manages the cluster, each storage shard has one primary that replicates to the others, storage is memory-mapped journals written in order, and a crashed node syncs from its peers before going live again ([clustering](https://bloomberg.github.io/blazingmq/docs/architecture/clustering/)). Its benchmarks: a 3-node cluster at 60,000 messages a second had p50 1.5 ms and p99 4.9 ms; broadcast to 10 consumers p50 0.6 ms and p99 1.2 ms ([benchmarks](https://bloomberg.github.io/blazingmq/docs/performance/benchmarks/)).
- **How it stays fast, as far as public sources show:** its own network into customer sites, conflation chosen per subscription, permissioning done once at the edge, and a thick client that holds the connection so applications talk to a local process. Unconfirmed: B-PIPE's managed appliance model, its exchange count and any latency figures.

### LSEG Real-Time and Workspace (formerly Refinitiv, TREP and Elektron)

- The Real-Time SDK has a low-level transport and codec layer (ETA, formerly the Ultra Performance API that the distribution system itself uses) and an easier layer (EMA), in C++, Java and C# ([Real-Time SDK](https://github.com/Refinitiv/Real-Time-SDK)). ETA speaks a binary format (RWF) over TCP, HTTP, WebSocket, reliable and unreliable UDP multicast and shared memory. A distribution server serves consumers; publishers push to a data hub over TCP or reliable multicast, which may drop multicast packets under heavy load ([ETA readme](https://raw.githubusercontent.com/Refinitiv/Real-Time-SDK/master/Cpp-C/Eta/README.md)). EMA takes a list of servers for failover ([EMA readme](https://raw.githubusercontent.com/Refinitiv/Real-Time-SDK/master/Cpp-C/Ema/README.md)).
- The WebSocket API carries JSON: log in, request items, receive refresh, update and status messages, with ping and pong to check the line; domains include market price, market by price and market by order ([WebSocket API spec](https://raw.githubusercontent.com/Refinitiv/websocket-api/master/WebsocketAPI_ProtocolSpecification.pdf)). It works against an in-house distribution system or the cloud service ([websocket-api](https://github.com/Refinitiv/websocket-api)).
- The Real-Time Distribution System has more than 15,000 licences and 500,000 active users, routes hub and spoke or peer to peer, permissions through DACS, and blends feeds with automatic failover; it can be run by the customer or by LSEG, including in the cloud ([RTDS](https://www.lseg.com/en/data-analytics/market-data/data-management/real-time-distribution-system)). The cloud feed runs in AWS us-east-1 and eu-west-1 ([Real-Time Optimized](https://www.lseg.com/en/data-analytics/market-data/data-management/real-time-delayed-optimized-market-data)). The Full Tick feed carries "9 million price updates per second", 2.5 TB a day from more than 500 exchanges, normalised at source into one data model ([Full Tick](https://www.lseg.com/en/data-analytics/market-data/data-feeds/real-time-full-tick-data)). Ultra Direct offers low-latency feed handlers with arbitration, book building and replay of recorded traffic, without published latency figures ([Ultra Direct](https://www.lseg.com/en/data-analytics/market-data/data-feeds/real-time-ultra-direct)). The LSEG pages were read through archive.org copies.
- Refinitiv Workspace became LSEG Workspace in 2023 ([Wikipedia, Refinitiv](https://en.wikipedia.org/wiki/Refinitiv)). Its desktop stack is not public.

## FX venues: EBS and LSEG FX Matching

- EBS was founded by banks in 1990, bought by ICAP in 2006 and by CME in 2018, and is the main venue for EUR/USD, USD/JPY and several other pairs ([Wikipedia, EBS](https://en.wikipedia.org/wiki/Electronic_Broking_Services)). EBS Market now runs on CME Globex "with dedicated matching engines in New York and London" ([EBS Market](https://www.cmegroup.com/markets/ebs/ebs-market.html)); order entry and market data use CME's iLink 3 and MDP 3.0, and an XML or FIX API runs over dedicated lines ([EBS connectivity](https://www.cmegroup.com/markets/ebs/ebs-connectivity.html)). CME's pages were read through archive.org copies.
- The BIS reports that EBS's price feed went from every 100 ms to every 20 ms in September 2016, then to 5 ms ("EBS Ultra") for qualifying liquidity providers in February 2017 at extra cost, and that about 70% of EBS orders come from algorithms. ParFX introduced randomised pauses of milliseconds in 2013, and EBS and Reuters Matching followed with their own versions, so that being a few microseconds faster stops paying ([BIS, Monitoring of fast-paced electronic markets](https://www.bis.org/publications/monitoring-fast-paced-electronic-markets.pdf)).
- LSEG FX Matching (formerly Reuters Matching) dates from 1992, has more than 4,000 users at 600 clients, sells premium low-latency data in Equinix LD4, and gives prime brokers real-time credit limits and kill switches ([LSEG FX Matching](https://www.lseg.com/en/fx/venues/spot-matching-forwards-matching)).
- The lesson for us: the interbank FX venues deliberately slow everyone to milliseconds, and their feeds tick every 5 to 100 ms. Retail FX data that refreshes a few times a second is already close to what the venues publish.
- Unconfirmed: the exact size of the EBS latency floor and whether matching also runs in Tokyo.

## Retail FX platforms

### MetaTrader 4 and 5

- MT4 is client and server. The broker runs MT4 Server (trades and archives), Administrator, Manager and Data Center, a proxy that takes quote load off the main server ([MetaTrader 4](https://en.wikipedia.org/wiki/MetaTrader_4)).
- MT5 spreads its jobs over separate trade, history and access servers. Adding servers raises capacity, and trade servers can sit "hidden behind multiple access points which will serve like shells" against attacks. Brokers manage it through a Manager terminal and Manager API ([MT5 for brokers](https://www.metatrader5.com/en/brokers)). Brokers keep full control of their servers and MetaQuotes says it does not see client data ([MetaQuotes for brokers](https://www.metaquotes.net/en/metatrader5/brokers)).
- Clients connect to a configured host and port ([MT5 settings](https://www.metatrader5.com/en/terminal/help/startworking/settings)). MetaQuotes' hosted VPS claims 0 to 5 ms to the broker against about 100 ms from home, 96% of broker servers within 10 ms, and 30 or more hosting points ([MQL5 VPS](https://www.mql5.com/en/vps)).
- **The bridge model.** A broker either keeps the other side of a client's trade (B-book) or passes it to banks and ECNs (A-book) through a bridge. PrimeXM XCore links MT4, MT5 and FIX clients to liquidity providers with aggregation, A-book, B-book and audit trails, in Equinix New York, London, Tokyo and Singapore ([PrimeXM XCore](https://primexm.com/xcore)). oneZero Hub is hosted price and risk management in parallel C++, routing "tens of millions of trades daily", with colocation in NY4, LD4 and TY3 ([oneZero Hub](https://www.onezero.com/hub-technology/)). Gold-i MatrixNET is a FIX liquidity bridge with aggregation ([Gold-i MatrixNET](http://www.gold-i.com/matrix-net)). MetaQuotes began restricting third-party bridge plugins around 2012 to 2013 ([MetaTrader 4](https://en.wikipedia.org/wiki/MetaTrader_4)).
- Unconfirmed: the exact roles of MT5 backup and gateway servers, which sit behind a login.

### cTrader

- Open API takes Protobuf on port 5035 or JSON on 5036, over TCP or WebSocket, at live and demo hosts, through AWS Global Accelerator to the nearest proxy ([cTrader endpoints](https://help.ctrader.com/open-api/proxies-endpoints/)).
- 50 requests a second per connection, 5 a second for history, and a two-step login (the app, then the trading account) ([cTrader Open API](https://help.ctrader.com/open-api/)). Each message starts with a 4-byte length ([framing](https://help.ctrader.com/open-api/sending-receiving-protobuf/)); a heartbeat every 10 s keeps the connection ([connection](https://help.ctrader.com/open-api/connection/)). Spot and depth subscriptions and market, limit, stop, market range and stop limit orders ([messages](https://help.ctrader.com/open-api/messages/)). FIX 4.4 is offered too ([cTrader FIX](https://help.ctrader.com/fix/)).

### OANDA v20

- Practice and live run on separate hosts; 120 REST requests a second (then HTTP 429), 20 active streams, 2 new connections a second ([OANDA development guide](https://developer.oanda.com/rest-live-v20/development-guide/)).
- The price stream is chunked HTTP with one JSON object per line, a heartbeat every 5 s, an optional snapshot on connect, and at most 4 prices a second per instrument: only the last price in each 250 ms window is sent ([OANDA pricing stream](https://developer.oanda.com/rest-live-v20/pricing-ep/)). Access uses a personal token tied to an OANDA account ([OANDA v20](https://developer.oanda.com/rest-live-v20/introduction/)).

### Interactive Brokers

- An app opens a socket to TWS or IB Gateway on the same machine (ports 7496 live, 7497 paper, 4001 and 4002 for the Gateway); up to 32 apps per session; one thread reads messages and another runs the callbacks ([TWS API connection](https://interactivebrokers.github.io/tws-api/connection.html)).
- Clients may send up to 50 messages a second ([TWS API introduction](https://interactivebrokers.github.io/tws-api/introduction.html)); 100 market data lines by default ([market data](https://interactivebrokers.github.io/tws-api/market_data.html)); streaming data is "aggregate snapshots taken several times per second", and regulatory snapshots cost $0.01 each ([market data requests](https://interactivebrokers.github.io/tws-api/md_request.html)). Historical requests are paced: no identical request within 15 s, no more than 60 in 10 minutes ([historical limits](https://interactivebrokers.github.io/tws-api/historical_limitations.html)); tick-by-tick is limited to one request per instrument per 15 s ([tick data](https://interactivebrokers.github.io/tws-api/tick_data.html)).
- The design point: the heavy client (TWS or the Gateway) holds the connection to IB, and user code talks to it locally. The newer Client Portal Web API and FIX details were behind pages that refused us.

## LMAX Exchange and the Disruptor

- LMAX's business logic processor runs on one thread, entirely in memory, with no database. Durability comes from event sourcing: input events are journaled and replicated before processing. It handled 6 million orders a second on a 3 GHz dual-socket quad-core machine with 32 GB of RAM. The input ring buffer has 20 million slots and each output 4 million; unmarshalling, journaling and replication run as consumers on the ring. Two processors run in the main data centre and a third at the disaster recovery site; a nightly snapshot plus a day's replay restarts the system in under a minute ([Fowler, The LMAX Architecture](https://martinfowler.com/articles/lmax.html)).
- The Disruptor is a pre-allocated ring buffer with sequence numbers, one writer per slot and cache-line padding. Mean latency per hop in a three-stage pipeline was 52 ns against 32,757 ns for Java's ArrayBlockingQueue ([Disruptor technical paper](https://lmax-exchange.github.io/disruptor/disruptor.html)). The original paper reports "over 25 million messages per second and latencies lower than 50 nanoseconds", and that queues "add hundreds of microseconds" ([Disruptor 1.0 paper](https://lmax-exchange.github.io/disruptor/files/Disruptor-1.0.pdf)).
- The venue today claims matching under 50 microseconds, 800,000 orders a second at peak and 100,000 sustained, a central limit order book with firm liquidity, and matching in LD4, NY4, TY3 and SG1 ([LMAX Exchange](https://www.lmax.com/exchange)).

## Crypto venues

### Hyperliquid

- Its own chain runs HyperBFT, a HotStuff variant. End-to-end latency for a co-located client is 0.2 s at the median and 0.9 s at p99, at about 200,000 orders a second. The order book is fully on chain; HyperCore does matching and margin and HyperEVM runs general contracts ([HyperCore overview](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/overview)).
- Price-time priority, matched per block; within a block, other actions run first, then cancels, then new orders ([order book](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/order-book)). Margin and risk checks happen in the clearinghouse ([clearinghouse](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/clearinghouse)).
- API servers are non-validating nodes that pass a transaction into consensus and answer only after the block commits ([API servers](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/api-servers)). REST and WebSocket feeds for trades, book, mids and user events; clients must expect disconnects ([API](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api), [WebSocket](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket)). Limits: 1,200 weight a minute per IP, 10 WebSockets per IP and 1,000 subscriptions ([rate limits](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits)).
- Anyone can run a node (16 vCPU, 128 GB RAM, 500 GB SSD; Tokyo for the lowest latency); it writes about 100 GB a day of trades, fills and order states and can serve the info API locally ([Hyperliquid node](https://github.com/hyperliquid-dex/node)).

### Coinbase

- A public WebSocket feed and an authenticated "Direct" feed; Coinbase recommends Direct as primary and the public feed as failover. Every product has a sequence number, and a jump of more than one means a dropped message; the servers "receive market data in a manner that can result in dropped messages". Subscribe within 5 s of connecting ([Coinbase feed overview](https://docs.cdp.coinbase.com/exchange/websocket-feed/overview)).
- Channels include a heartbeat every second, level 2 with guaranteed delivery (needs auth), level 2 batched every 50 ms (no auth), order-by-order level 3, and tickers per match or batched every 5 s ([channels](https://docs.cdp.coinbase.com/exchange/websocket-feed/channels)).
- FIX 5.0 SP2 on separate hosts for order entry, market data and drop copy, TLS 1.2, no resend requests, a weekly reset and deploy windows that log sessions out ([FIX connectivity](https://docs.cdp.coinbase.com/exchange/fix-api/connectivity)). Public REST is 10 requests a second per IP; FIX allows 100 requests a second per session ([rate limits](https://docs.cdp.coinbase.com/exchange/introduction/rate-limits-overview)).
- Coinbase Prime adds custody and a smart order router across connected venues, with REST, FIX and WebSocket APIs ([Coinbase Prime](https://docs.cdp.coinbase.com/prime/introduction/welcome)). The matching engine's internals and its cloud setup were not on any page we could open.

### Kraken

- Spot REST, WebSocket v2 and FIX 4.4; about 2 ms from AWS London against about 200 microseconds from colocation in Equinix London ([Kraken API intro](https://docs.kraken.com/api/docs/guides/global-intro)).
- Book depths from 10 to 1,000, each message with a CRC32 checksum of the top 10 levels so a client can prove its book is right ([book channel](https://docs.kraken.com/api/docs/websocket-v2/book)); a level 3 feed of individual orders; idle connections dropped within a minute ([WebSocket intro](https://docs.kraken.com/api/docs/guides/spot-ws-intro)).
- FIX sessions are pinned to one gateway by HAProxy so message order holds; cancel on disconnect is on by default ([Kraken FIX](https://docs.kraken.com/api/docs/guides/fix-intro)).
- Kraken ported about 500,000 lines of PHP to Rust endpoint by endpoint, checking each against the old one; its Tokio-based services reached 150,000 requests a second per instance with p99.9 under 3 ms ([Oxidizing Kraken](https://blog.kraken.com/post/7964/oxidizing-kraken-improving-kraken-infrastructure-using-rust)).

### Binance

- WebSocket connections last 24 hours; ping every 20 s; book diffs every 100 or 1,000 ms; a documented recipe for keeping a local book (buffer, fetch a snapshot, drop stale events, restart on a gap) ([Binance streams](https://raw.githubusercontent.com/binance/binance-spot-api-docs/master/web-socket-streams.md)).
- Binary SBE streams update the book every 20 ms and the top 20 levels every 50 ms ([SBE streams](https://raw.githubusercontent.com/binance/binance-spot-api-docs/master/sbe-market-data-streams.md)).
- REST is limited by request weight (6,000 a minute) and orders (50 per 10 s); data comes from the matching engine, then memory, then the database, in order of freshness ([REST API](https://raw.githubusercontent.com/binance/binance-spot-api-docs/master/rest-api.md)). FIX 4.4 order entry, a drop copy delayed by 1 s, and FIX market data ([FIX API](https://raw.githubusercontent.com/binance/binance-spot-api-docs/master/fix-api.md)).
- Unconfirmed: the matching engine throughput claims often quoted, and colocation in AWS Tokyo.

## Charting and broker apps

### TradingView

- Lightweight Charts, which Parity's charts already use, is an HTML5 canvas library under Apache 2.0 that requires attribution to TradingView ([lightweight-charts](https://github.com/tradingview/lightweight-charts)). TradingView also licenses Advanced Charts and a Trading Platform ([charting products](https://www.tradingview.com/charting-library-docs/latest/getting_started/)).
- With the licensed libraries the customer supplies the data: a JavaScript datafeed with `onReady`, `resolveSymbol`, `getBars` and `subscribeBars`, called asynchronously ([Datafeed API](https://www.tradingview.com/charting-library-docs/latest/connecting_data/Datafeed-API/)). The official streaming example builds bars from trades arriving over a crypto WebSocket ([streaming tutorial](https://www.tradingview.com/charting-library-docs/latest/tutorials/implement_datafeed_tutorial/Streaming-Implementation)). Orders go through a broker adapter the customer writes; the library draws the ticket and account panels and the broker's back end executes ([trading terminal](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/)). That split, a chart that takes any feed and a ticket that calls any broker, is the shape of DEC-0046's `Broker` interface.
- On its own site TradingView covers 3.5 million instruments from more than 100 exchanges, 50 broker feeds and 50 crypto exchanges, sells real-time exchange add-ons from $1 to $152 a month, and shows delayed data 10 to 20 minutes behind ([data coverage](https://www.tradingview.com/data-coverage/)). Exchange fees are not included in paid plans, and US stocks show Cboe data by default with NASDAQ, NYSE or ARCA real time as add-ons ([TradingView support](https://www.tradingview.com/support/solutions/43000471705/)). Its back end and WebSocket protocol are not public.

### Robinhood

- Robinhood built Faust, a Python port of Kafka Streams with tables in RocksDB and changelogs in Kafka, for pipelines processing "billions of events every day" ([Faust](https://github.com/robinhood/faust)).
- Its 2021 S-1 describes Robinhood Financial as the introducing broker and Robinhood Securities as the clearing broker, a platform "entirely cloud-based and built on proprietary, API-driven services", and payment for order flow as most of 2020's transaction revenue ([Robinhood S-1](https://www.sec.gov/Archives/edgar/data/1783879/000162828021013318/robinhoods-1.htm)). Its 2025 10-K says crypto orders go to third-party market makers or exchange liquidity providers ([Robinhood 10-K 2025](https://www.sec.gov/Archives/edgar/data/1783879/000178387926000023/hood-20251231.htm)). Routing and execution-quality reports are published ([Robinhood legal](https://robinhood.com/us/en/about/legal/)).

### Alpaca

- The Trading API is for one's own account; the Broker API is for apps that open accounts for end users ([Broker API](https://docs.alpaca.markets/docs/about-broker-api)). Three models, with Alpaca as custodian and clearing firm in each: a fully disclosed broker-dealer (which does its own KYC), omnibus, and RIA ([use cases](https://docs.alpaca.markets/docs/use-cases)).
- Account opening goes submitted, approved, active; Alpaca runs KYC for apps and advisers, and status changes arrive as an event stream ([account opening](https://docs.alpaca.markets/docs/account-opening)). Funding by ACH through Plaid, wires, and journals ([funding](https://docs.alpaca.markets/docs/funding-accounts)).
- Market data: a free IEX feed (30 WebSocket symbols) and Algo Trader Plus at $99 a month for the consolidated SIP feed ([market data plans](https://docs.alpaca.markets/docs/about-market-data-api)); WebSocket messages for trades, quotes, bars, corrections and trading status, in JSON or msgpack ([streaming](https://docs.alpaca.markets/docs/streaming-market-data), [real-time stocks](https://docs.alpaca.markets/docs/real-time-stock-pricing-data)).

## Tooling the industry uses

| Tool | What it is | Who uses it for what | Numbers |
| --- | --- | --- | --- |
| kdb+ and q | Column store and language for time series | The tick setup: feed handler, tickerplant with a log, real-time database for today, historical database at end of day; restart by replaying the log | About 1 microsecond for a small real-time update, 7.7 to 34 microseconds in heavier engines ([kdb+tick white paper](https://code.kx.com/q/wp/rt-tick/), [kdb-tick scripts](https://github.com/KxSystems/kdb-tick)) |
| Aeron | Reliable UDP unicast, multicast and shared-memory messaging, with Archive (record and replay) and Cluster (Raft-replicated state machines) | Order books, RFQ systems and sequencers ([Aeron](https://github.com/real-logic/aeron), [Aeron Cluster](https://aeron.io/docs/aeron-cluster/overview/)) | Kernel bypass in the C driver |
| Chronicle Queue | Memory-mapped persisted journal for the JVM | Low-latency logs between processes | Under 1 microsecond between JVMs, p99 0.78 microseconds for 40-byte messages ([Chronicle Queue](https://github.com/OpenHFT/Chronicle-Queue)) |
| Kafka | Distributed log | Event pipelines at broker apps (Robinhood's Faust runs on it) | Milliseconds, not microseconds |
| FIX and FIX engines | The standard order and market data protocol; QuickFIX/J (Java) and QuickFIX/n (.NET) are open source engines | Every venue and broker above except the crypto WebSocket APIs offers FIX ([FIX protocol](https://www.fixtrading.org/standards/fix-protocol/), [FIX standards](https://www.fixtrading.org/standards/), [QuickFIX/J](https://github.com/quickfix-j/quickfixj), [QuickFIX/n](https://github.com/connamara/quickfixn)) | Versions 4.2, 4.4 and 5.0 SP2 still common |
| Time sync | PTP (IEEE 1588) hardware clocks in data centres; NTP elsewhere | EU rules: within 100 microseconds of UTC for venues with a gateway-to-gateway latency of 1 ms or less and for high-frequency trading, 1 ms for others, 1 s for voice trades ([MiFID II RTS 25](https://www.legislation.gov.uk/eur/2017/574/annex)). US: within 50 ms of NIST for the audit trail, 1 s for manual orders ([FINRA Rule 6820](https://www.finra.org/rules-guidance/rulebooks/finra-rules/6820)). AWS offers PTP hardware clocks on some instances ([AWS time sync](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/set-time.html)) | |
| Wire capture | Passive capture of every packet with nanosecond timestamps | Measuring every hop and rebuilding every order, for latency and regulation (Corvil, up to 200 Gbps) ([Pico Corvil](https://www.pico.net/corvil/)) | |

## What is realistic for a three-person company

| Copy | Skip |
| --- | --- |
| One normalised tick shape and a sequence number per instrument, with gap detection and resubscribe | Matching engines, kdb+, Aeron, Chronicle, FIX engines |
| Conflation to a few updates a second per symbol for screens, as OANDA and IBKR do | Every tick to every browser |
| An append-only input log (files in object storage) as the audit trail and replay source | A database on the hot path |
| Market data and order entry on separate paths, with order events on their own stream | Mixing them on one connection |
| Separate practice and live environments, as OANDA and cTrader keep | One environment with a flag |
| Measuring every hop with the source's own timestamp, as wire-capture vendors do for banks | Hardware clocks and colocation |
| Holding nothing for customers; a broker carries accounts and orders (Alpaca, DriveWealth) | Becoming a venue or a broker ([DEC-0019](../decisions/0019-real-trading-later-what-it-would-legally-take.md)) |

Our latency floor is the browser's network, tens of milliseconds. That puts Parity next to OANDA's and IBKR's retail streams, not next to LMAX's matching engine, which matches the line drawn in [DEC-0005](../decisions/0005-no-microsecond-trading-in-the-poc.md). How the same platforms lay out their screens is in [RES-0021](0021-how-trading-platforms-lay-out-a-workspace.md); what their data costs is in [REF-0015](../reference/0015-getting-close-to-bloomberg-data-sources-costs-and-licences.md).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0046: Payments through Stripe, and real trading only through a regulated broker](../decisions/0046-payments-through-stripe-and-real-trading-only-through-a-regulated-broker.md)
- [REF-0019: Latency budget and target architecture](../reference/0019-latency-budget-and-target-architecture.md)
<!-- backlinks:end -->
