---
id: REF-0010
title: FX data sources, licences and resolution
type: reference
status: current
created: 2026-10-21
updated: 2026-10-21
authors: [ayan]
tags: [data, fx]
related: [REF-0003]
---

# FX data sources, licences and resolution

## In plain words

Where we get currency data beyond daily prices: the list of every currency, how big each currency's market is, and tick by tick prices. We only download automatically from sources whose terms allow it. For tick data no free source clearly allows that, so a person downloads the files and the engine imports them.

## Summary

| Need | Source we use | Automated? | Resolution | Cost |
| --- | --- | --- | --- | --- |
| Every currency, current and withdrawn | ISO 4217 lists from SIX Group ([DAT-0037](../datasets/0037-iso-4217-six.md)) | Yes | Reference list | Free |
| Market size and volume by currency and instrument | BIS Triennial Survey through the BIS API ([DAT-0038](../datasets/0038-bis-triennial-fx.md)) | Yes | One value per survey year | Free, cite the BIS |
| Millisecond ticks | HistData or TrueFX files downloaded by hand ([DAT-0017](../datasets/0017-histdata.md), [DAT-0032](../datasets/0032-truefx.md)) | No, import only | 1 ms | Free |
| Nanosecond ticks | Not bought yet. Best option: CME FX futures from Databento ([DAT-0041](../datasets/0041-databento-cme-fx.md)) | Would be, under a paid licence | 1 ns | 125 USD free credit, then pay per GB or from 199 USD a month |

The engine stores every tick time as a whole number of nanoseconds since 1970 in UTC. Millisecond data simply ends in six zeros, so nanosecond data fits later without changing anything.

## Sources and their terms

### ISO 4217 (every currency ever)

SIX Group keeps the official lists for ISO and publishes them as free XML files: List One for current currencies and List Three for withdrawn ones. SIX says it makes them available online and free of charge. No other licence text was found. The files sit in a folder that robots.txt allows. We fetch the two files once and cache them.

On 2026-10-21 that gave 178 current rows and 152 withdrawn rows, 307 distinct codes. A code can be withdrawn more than once: VEF has three rows.

### BIS Triennial Survey (market size and volume)

Every three years central banks measure FX trading in April. The BIS publishes the daily average by currency and by instrument through its SDMX API, dataflow `WS_DER_OTC_TOV`. The BIS terms allow reuse as long as the BIS is cited as the source, the use is not misleading and does not suggest BIS endorsement. The BIS can limit any IP address, so we make one call and cache the result.

Latest numbers (April 2025, net-net basis): about 9,510 billion USD a day in total, with the US dollar on one side of 89% of trades. Shares add up to 200% because each trade has two currencies.

### CFTC Commitments of Traders

Weekly positions in US currency futures, from the US futures regulator ([DAT-0039](../datasets/0039-cftc-cot.md)). Free, and the API needs no token for reasonable use. Catalogued, not built yet.

### CLS

CLS settles most large FX trades and sells volume data as CLSMarketData ([DAT-0040](../datasets/0040-cls-fx-volume.md)). It is a paid product with no public price, so we do not use it.

### Tick data: why nothing is automated

| Source | What the terms say | What we do |
| --- | --- | --- |
| Dukascopy | Bans any scraper, robot, bot or spider, and allows downloads only for personal, non-commercial use. | Never automated. A person may export files by hand. |
| TrueFX | Needs a login. Its terms are behind the login. | Never automated. Import files a person downloaded. |
| HistData | Free with no warranty. No licence for automated use, and automated delivery (FTP) is a paid add-on. | Import files a person downloaded. |
| OANDA, FXCM | Need an account and API terms. | Not checked in depth. |

Because none of them clearly allows automated research use, the engine has a tick source interface for a future licensed feed and an importer for files on disk.

## Millisecond versus nanosecond

Free FX tick data is stamped to the millisecond (one thousandth of a second). It is one dealer's or one network's quotes, not the whole market, because spot FX has no central exchange.

Nanosecond data (one billionth of a second) exists for exchange traded currency futures, mainly CME. Databento sells it with timestamps in nanoseconds since 1970. It costs money: new accounts get 125 USD of credit for history, then history is billed per GB, and live plans are 199, 1,750 or 4,500 USD a month. LSEG and other institutional vendors sell spot FX ticks at much higher prices with sales contracts. Nanosecond spot FX at a research budget does not exist.

## How to use it

```
parity currencies              # current currencies
parity currencies --all        # plus every withdrawn currency
parity market-size             # latest survey, all instruments
parity market-size --instrument B --year 2022      # spot only
parity market-size --currency EUR --instrument ""  # every instrument for the euro
parity ticks EURUSD --import ~/Downloads/HISTDATA_COM_ASCII_EURUSD_T202401.zip
parity ticks EURUSD --date 2024-01-02
parity serve                   # JSON API on http://127.0.0.1:8765
```

Add `--refresh` to download the currency list or the BIS table again.

The importer reads HistData Generic ASCII ticks (Eastern time with no daylight saving, converted to UTC), TrueFX monthly files (UTC), and our own CSV with a header `ts_ns,bid,ask,volume`. Zips work as they are. Each UTC day is stored at `engine/data/ticks/<PAIR>/<YYYY-MM-DD>.parquet`, and importing the same file twice adds nothing.

### API

`parity serve` starts a read-only API that listens on 127.0.0.1 only, so nothing outside this computer can reach it. That is why it has no login. Do not expose it through a tunnel without adding one.

| Endpoint | Returns |
| --- | --- |
| `/currencies?all=1` | The currency table. Leave out `all` for current currencies only. |
| `/market-size?year=2025&currency=EUR&instrument=B` | BIS turnover rows. All filters are optional. |
| `/ticks/EURUSD?date=2024-01-02&limit=1000` | A summary and the first ticks of that UTC day. |

Code: `engine/src/parity/data/currencies.py`, `market_size.py`, `ticks.py` and `engine/src/parity/api.py`.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [LOG-0005: Ayan work log, site rebuild, research expansion and sign-in](../log/2026-10-21-ayan-work-log-site-rebuild-research-expansion-and-sign-in.md)
<!-- backlinks:end -->
