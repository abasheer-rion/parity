# Recorded venue answers for the broker connector tests

Answers shaped exactly like the official documentation's examples for each call the connectors make (DEC-0091), with made-up values: no account, key, token or secret here belongs to anyone. Fetched and shaped on 3 November 2026.

| File | Call | Shape from |
| --- | --- | --- |
| ibkr-send-ok.xml, ibkr-fail-1015.xml, ibkr-get-1019.xml | Flex Web Service SendRequest and GetStatement | interactivebrokers.com/docs/web-api/api-reference/send-request, get-statement, flex-web-service/error-codes |
| ibkr-statement.xml | A Flex XML statement with four Trade elements | Interactive Brokers' Flex attribute names; not checked against a real XML statement (the CSV path uses the reader tested on real exports) |
| alpaca-token.json, alpaca-token-trading.json, alpaca-account.json | OAuth token exchange, GET /v2/account | docs.alpaca.markets using-oauth2-and-trading-api, getaccount |
| coinbase-permissions-*.json, coinbase-fills-*.json | key_permissions, orders/historical/fills | docs.cdp.coinbase.com get-api-key-permissions, list-fills |
| kraken-keyinfo-*.json, kraken-trades.json, kraken-assetpairs.json | GetApiKeyInfo, TradesHistory, AssetPairs | docs.kraken.com get-api-key-info, get-trades-history, get-tradable-asset-pairs |
| binance-*.json | apiRestrictions, account, myTrades | developers.binance.com api-key-permission; binance-spot-api-docs rest-api.md |
| bybit-*.json | user/query-api, execution/list | bybit-exchange.github.io/docs/v5 apikey-info, order/execution |

The Alpaca fills reuse `../verify/real/alpaca-activities-alpacapy.json` and the Interactive Brokers CSV statement reuses `../verify/real/ibkr-flex-agusalex-taxcalc.csv` (both listed in `../verify/real/SOURCES.md`). The Kraken secret in the tests is the example secret Kraken publishes on its authentication page.
