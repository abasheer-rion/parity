# Real exports used to test Verify's imports

Small excerpts of real broker, exchange and platform exports, published by their owners in open-source repositories under licences that allow copying. Each is used only to test that Verify reads the format correctly. Account numbers, names, user ids, emails and wallet addresses were replaced with placeholders (U1234567, 12345678, "Demo Trader", ACCOUNT-1, 00000000, user@example.com, REDACTED); no other cell was edited unless "Changes" says so. Rows were selected (not edited) to keep each file small. Fetched on 3 November 2026.

| File | Source (repository @ commit, path) | Licence | Changes |
| --- | --- | --- | --- |
| ibkr-flex-agusalex-taxcalc.csv | github.com/agusalex/tax_calculator @ e12a257adea5, ibkr_input.csv | Apache-2.0 | Header and 12 rows kept. Account replaced. |
| ibkr-flex-fingather.csv | github.com/marekskopal/fingather @ 65c105c61a04, backend/tests/Fixtures/Import/File/interactive_brokers_export.csv | MIT | Account replaced. |
| ibkr-activity-binnaculum.csv | github.com/DarioAlonsoCerezo/Binnaculum @ 29bee18bd359, src/Tests/Core.Tests/TestData/IBKR_Samples/InitialImport.csv | MIT | Statement block and the whole Trades section kept. |
| ibkr-activity-maisvalias.csv | github.com/Tomas-Silva-PT/maisvalias-tool @ 2833a72eca89, data/mockdata/interactivebrokers/Extrato.csv | MIT | Statement block and Trades section kept. Account replaced. |
| tos-redbean87.csv | github.com/redbean87/expo-trading-journal @ 3dd88c31abe2, assets/sample/2026-07-06-AccountStatement-fb.csv | MIT | Title, start of Cash Balance and 13 trade rows kept. Account replaced. |
| alpaca-activities-alpacapy.json | github.com/alpacahq/alpaca-py @ d000d525c2cb, tests/broker/broker_client/test_account_activities_routes.py | Apache-2.0 | The six FILL objects taken out of the test file as JSON. |
| binance-spot-trades-market-moonstats-2022.csv | github.com/idiglove/moonstats @ 79d0a0e75a84, src/csv/current/past3months_jun2_2022.csv | MIT | Header and 14 of 66 rows kept. |
| binance-statement-marmol-2025.csv | github.com/marmol-dev/portfolio-performance-converter @ 86e0284c43f9, tests/data/binance_sample.csv | MIT | User id replaced. |
| binance-statement-fingather-2022.csv | github.com/marekskopal/fingather @ 884e07ab12e4, backend/tests/Fixtures/Import/File/binance_export.csv | MIT | User id replaced. |
| binance-statement-invertimo-2021.csv | github.com/ilonajulczuk/invertimo @ 7d095138d15e, finance/binance_transaction_sample.csv | MIT | First 15 lines. User id replaced. |
| coinbase-pro-fills-gocryptoadmin-2019.csv | github.com/mariotoffia/gocryptoadmin @ f545d2005184, txlog/testfiles/cbx/cbx_buysell.csv | Apache-2.0 | None. |
| coinbase-pro-fills-yabc-2020.csv | github.com/robertkarl/yabc @ b65dcaa505b7, testdata/coinbase-pro/fills.csv | MIT | None. |
| coinbase-transactions-canion3d-2022.csv | github.com/canion3d/Trade_Cipher @ 77466d2f73e2, Coinbase-...-TransactionsHistoryReport-2022-08-05-21-38-03.csv | BSL-1.0 | First 22 lines. Email and user id replaced. |
| coinbase-transactions-delta-2024.csv | github.com/Delta-Compute/DeltaCFOAgent @ 514a388de133, {January..May}_2024_Coinbase.csv | MIT | Preamble and 14 rows from five monthly files. Name, user id and wallet addresses replaced. |
| coinbase-transactions-delta-2023-resaved.csv | same repository, Coinbase_May_2023_...csv | MIT | First 16 lines. Same replacements. |
| coinbase-transactions-dickwolff-2025.csv | github.com/dickwolff/Export-To-Ghostfolio @ bab815909035, samples/coinbase-export.csv | Apache-2.0 | None (the ids were already masked upstream). |
| kraken-trades-gocryptoadmin-2017.csv | github.com/mariotoffia/gocryptoadmin @ f545d2005184, txlog/testfiles/krk/krk_buysell.csv | Apache-2.0 | None. |
| kraken-ledgers-jhonnyjason-2022.csv | github.com/JhonnyJason/kraken-csv-to-xml @ dba24fbd6319, testing/transactions.csv | Unlicense | First 15 lines. |
| kraken-ledgers-vergi-2021.csv | github.com/vergi40/vergiFinance @ 3440c21e9b4f, vergiFinance.UnitTests/Resources/trx.csv | MIT | First 12 lines. |
| tradingview-pineforge-2026.csv | github.com/pineforge-4pass/pineforge-corpus @ adef1c63e650, validation/analyzer-anvil-percent-costs-01/tv_trades.csv | Apache-2.0 | Header, trades 1 to 6 and the open trade 325. |
| tradingview-aleksdrozy-2025.csv | github.com/aleks-drozy/fyp-trading-strategy @ aee274330a4b, backtests/NQ1_optimised.csv | MIT, (c) 2026 Aleksandrs Drozdovs | Header and the first 14 rows. |
| ninjatrader-toinetrades-2025.csv | github.com/AntoinePangas/Toine-Trades @ a1d31517824c, public/data/NinjaTrader-sample.csv | MIT | Account replaced. |
| tradovate-orders-drasticstatic-2026.csv | github.com/drasticstatic/trading-assistant-public-preview @ 9c2b0419fbaa, data/imports/2026/06-Jun/Tradovate/tradovate_orders_20260616.csv | MIT, (c) 2026 drasticstatic | Account replaced. |
| tradovate-positionhistory-tradetally-2026.csv | github.com/GeneBO98/tradetally @ 99cc2955, backend/tests/fixtures/tradovate-paired-trades-sample.csv | Apache-2.0 | Account replaced. |
| ctrader-abhidp-2026.xlsx | github.com/abhidp/trading-notional-volume-calculator @ 7a61a3c2, uploads/sample_ctrader.xlsx | MIT, (c) 2026 ABHI TRADES PTY LTD | None. |
| mt5_open_xml_positions.xlsx | same repository @ 7a61a3c226d8, uploads/sample_mt5.xlsx | MIT, (c) 2026 ABHI TRADES PTY LTD | None. |
| mt4_detailed_statement.htm | github.com/codecat92/apex-grid-ea @ 358b70567011, Masterdata-metavest-trading/DetailedStatement- All History.htm | MIT | 10 closed rows and both balance rows kept. Account and name replaced. The summary totals are the original ones, so they do not add up to the kept rows. |
| mt4_strategy_tester_id.htm | same repository @ 358b70567011, strategy-test-result/StrategyTester2.htm | MIT | First 30 of 65 order events kept. |
| mt5_report_history_en.html | github.com/PopovMP/mt-report-parser @ 881963084a11, test/res/ReportHistory-70358000.html | MIT (declared in package.json) | 10 positions, 20 orders, 21 deals and 3 open positions kept. Login and name replaced. |
| mt5_report_history_en.utf16le.html | made by us from the file above | as above | The same content saved as UTF-16 with a byte order mark, as the terminal writes it. |
| mt5_report_history_es.html | github.com/tradingguardianpro-hue/tevsys-landiing @ 72bcd41f4e8a, public/docs/evidencia-100k-historial-transacciones.html | MIT | None (the owner had already replaced the name, account and broker). |
| mt5_strategy_tester.html | github.com/Pusparaj99op/High-Frequency-Scalper @ 6c0d45912b1a, report/ReportTester-323911682.html | MIT | 20 of 140 orders and 21 of 141 deals kept. Still UTF-16 with a byte order mark. |
| myfxbook_export.csv | github.com/JustinGuese/python_tradingbot_framework @ 3d8939a47a47, data/ZenbotZero.csv | MIT | Header, 10 trades, 2 withdrawals and 1 deposit kept. |

## Licence notices

**MIT.** Copyright (c) the owners of the repositories marked MIT above. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

**Apache-2.0.** The files marked Apache-2.0 are excerpts of works licensed under the Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0). They are distributed on an "AS IS" basis, without warranties or conditions of any kind. The changes made are listed in the table.

**BSL-1.0.** Boost Software License, Version 1.0 (https://www.boost.org/LICENSE_1_0.txt). Permission is hereby granted, free of charge, to any person or organization obtaining a copy of the software and accompanying documentation covered by this license (the "Software") to use, reproduce, display, distribute, execute, and transmit the Software, and to prepare derivative works of the Software, and to permit third-parties to whom the Software is furnished to do so, all subject to the following: The copyright notices in the Software and this entire statement, including the above license grant, this restriction and the following disclaimer, must be included in all copies of the Software, in whole or in part, and all derivative works of the Software, unless such copies or derivative works are solely in the form of machine-executable object code generated by a source language processor. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE COPYRIGHT HOLDERS OR ANYONE DISTRIBUTING THE SOFTWARE BE LIABLE FOR ANY DAMAGES OR OTHER LIABILITY, WHETHER IN CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

**Unlicense.** Released into the public domain by its author.

## Layouts copied from real exports (../layout)

The files in `../layout` copy the header, quoting, number and date formats of real exports that we could see but not republish (no licence, or GPL), with numbers we made up: the Binance spot "Pair" layout and Binance USDS-M futures trade history (seen in real 2021 to 2026 exports), Tradovate's Performance report, thinkorswim spreads and futures, Kraken's 2026 trades.csv header, an Interactive Brokers Flex file with header and trailer records, and Bybit's closed positions export from a Unified Trading Account (`bybit-closed-positions.csv`: header, quoting, the "08:02 2026-11-02" times, Long and Short, the JSON fee cells and the 0E-8 zero, seen in github.com/PanzerKunst/athena-finance-website @ a6a94575772d, no licence; its Realized P&L was checked to equal the price difference less the opening, closing and funding fees).
