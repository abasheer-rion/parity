-- WHY each company depends on each driver: business-model exposures, written from what the company does (filings, sector
-- classifications, the pre-event "who wins if X" notes that were public at the time), never from how it traded on the event.
-- A driver call needs one of these; the measured beta (priced_on) only checks it. Elasticity = the stock's % move per 1%
-- driver move (per odds point for elections), sign = its direction when the driver goes UP. `when` = the causes of the
-- driver's move the reason holds for: any | demand | supply (any supply shock) | route_risk (a chokepoint threatened:
-- voyages lengthen, Gulf fuel exports stop) | crude_outage (production destroyed: fewer cargoes, crude dearer than fuel).
-- A fuel bill hurts whatever lifted oil; tankers and refiners win on a threatened route and lose on a crude outage.
INSERT INTO source (id, name, kind, domain, is_primary, prior_confirmed, prior_retracted) VALUES
  (241, 'Parity research (business-model exposures)', 'research', NULL, false, 0, 0);
INSERT INTO source_doc (id, source_id, kind, url, title, published_at) VALUES
  (220, 241, 'analysis', NULL, 'Exposure map: oil, conflict channels, Korea memory, Brazil, US and Argentina elections', '2019-01-01');

CREATE OR REPLACE FUNCTION expose(p_driver bigint, p_known date, p_rows jsonb) RETURNS int LANGUAGE sql AS $$
  INSERT INTO link (src_id, dst_id, rel, attrs, evidence, confidence, source_id, known_at)
  SELECT s.entity_id, p_driver, 'exposed_to',
         jsonb_build_object('elasticity', (r->>3)::numeric, 'channel', r->>2, 'why', r->>4,
                            'when', coalesce(r->5, '["any"]'::jsonb)),
         'manual', 0.7, 220, p_known
  FROM jsonb_array_elements(p_rows) r JOIN security s ON s.ticker = r->>0 AND s.exchange = r->>1
  RETURNING 1
$$;
CREATE OR REPLACE FUNCTION ent(p_ticker text, p_exchange text) RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT entity_id FROM security WHERE ticker = p_ticker AND exchange = p_exchange
$$;

-- Oil (Brent). Per 1% oil move.
SELECT count(*) FROM expose(180, '2019-01-01', '[
  ["FRO","NYSE","revenue",0.3,"crude tanker: a threatened route lengthens voyages and lifts day rates",["route_risk"]],
  ["FRO","NYSE","revenue",-0.2,"crude tanker: lost production means fewer cargoes to carry",["crude_outage"]],
  ["DHT","NYSE","revenue",0.3,"crude tanker: day rates on longer routes",["route_risk"]],
  ["DHT","NYSE","revenue",-0.2,"crude tanker: fewer cargoes",["crude_outage"]],
  ["INSW","NYSE","revenue",0.3,"crude and product tankers: day rates on longer routes",["route_risk"]],
  ["INSW","NYSE","revenue",-0.2,"tankers: fewer cargoes",["crude_outage"]],
  ["STNG","NYSE","revenue",0.3,"product tanker: product dislocations lift rates",["route_risk"]],
  ["STNG","NYSE","revenue",-0.2,"tankers: fewer cargoes",["crude_outage"]],
  ["LPG","NYSE","revenue",0.2,"LPG carrier: Gulf exports rerouted, longer voyages",["route_risk"]],
  ["VLO","NYSE","margin",0.4,"refiner: a threatened route cuts Gulf fuel exports, product cracks widen",["route_risk"]],
  ["VLO","NYSE","margin",-0.2,"refiner: a crude-only outage lifts its input faster than fuel prices",["crude_outage"]],
  ["MPC","NYSE","margin",0.4,"refiner: product cracks widen",["route_risk"]],
  ["MPC","NYSE","margin",-0.2,"refiner: crude cost squeeze",["crude_outage"]],
  ["PSX","NYSE","margin",0.3,"refiner (plus chemicals, midstream): cracks",["route_risk"]],
  ["PSX","NYSE","margin",-0.15,"refiner: crude cost squeeze",["crude_outage"]],
  ["XOM","NYSE","revenue",0.4,"integrated producer: realised price",["any"]],
  ["CVX","NYSE","revenue",0.4,"integrated producer: realised price",["any"]],
  ["SHEL","LSE","revenue",0.4,"integrated producer and trader",["any"]],
  ["BP","LSE","revenue",0.4,"integrated producer",["any"]],
  ["EQNR","NYSE","revenue",0.5,"oil and European gas producer outside the Gulf",["any"]],
  ["LNG","NYSE","revenue",0.3,"US LNG exporter: oil-indexed and spot gas rise with a Gulf scare",["supply"]],
  ["VG","NYSE","revenue",0.4,"US LNG exporter selling spot cargoes",["supply"]],
  ["DAL","NYSE","cost",-0.4,"jet fuel ~25% of costs, partly hedged",["any"]],
  ["UAL","Nasdaq","cost",-0.5,"jet fuel ~25% of costs, unhedged",["any"]],
  ["AAL","Nasdaq","cost",-0.5,"jet fuel, unhedged, high leverage",["any"]],
  ["LHA","XETRA","cost",-0.3,"jet fuel, largely hedged",["any"]],
  ["AF","EPA","cost",-0.3,"jet fuel, hedged, thin margins",["any"]],
  ["DAL","NYSE","demand",0.3,"oil rising on strong demand means travel demand is strong",["demand"]],
  ["UAL","Nasdaq","demand",0.3,"travel demand",["demand"]],
  ["AAL","Nasdaq","demand",0.3,"travel demand",["demand"]],
  ["CCL","NYSE","cost",-0.4,"bunker fuel ~10-15% of costs, unhedged, high leverage",["any"]],
  ["RCL","NYSE","cost",-0.3,"bunker fuel, partly hedged",["any"]],
  ["NCLH","NYSE","cost",-0.4,"bunker fuel, high leverage",["any"]],
  ["CCL","NYSE","demand",0.3,"discretionary demand",["demand"]],
  ["RCL","NYSE","demand",0.3,"discretionary demand",["demand"]],
  ["NCLH","NYSE","demand",0.3,"discretionary demand",["demand"]],
  ["LYB","NYSE","cost",0.2,"US ethane cracker: oil-based (naphtha) rivals'' costs rise faster",["any"]],
  ["DOW","NYSE","cost",0.2,"US ethane cracker advantage",["any"]],
  ["BAS","XETRA","cost",-0.3,"European naphtha and gas feedstock",["any"]],
  ["CF","NYSE","margin",0.3,"US-gas nitrogen: world fertiliser prices follow oil and LNG up, its gas does not",["supply"]],
  ["RELIANCE","NSE","margin",0.1,"Indian refiner/exporter, offset by retail and telecom",["any"]],
  ["BPCL","NSE","cost",-0.3,"state fuel retailer: pump prices held, crude cost passed late",["any"]],
  ["IOC","NSE","cost",-0.3,"state fuel retailer: under-recoveries",["any"]],
  ["5020","TSE","margin",0.3,"Japanese refiner: inventory gains",["any"]],
  ["010950","KRX","margin",0.4,"Korean export refiner (Aramco-owned): cracks and inventory gains",["any"]],
  ["096770","KRX","margin",0.3,"Korean refiner (plus batteries)",["any"]],
  ["9101","TSE","revenue",0.2,"shipping: rerouting tightens capacity and lifts rates",["route_risk"]],
  ["9104","TSE","revenue",0.2,"shipping incl. tankers and LNG carriers: longer routes",["route_risk"]],
  ["9107","TSE","revenue",0.2,"shipping: rerouting lifts rates",["route_risk"]],
  ["NIFTYBEES","NSE","cost",-0.1,"India imports ~85% of its oil",["any"]]
]');

-- Conflict channels: a war moves defense spending, safe havens and fear, whatever oil does.
SELECT count(*) FROM expose(ent('ITA','NYSEArca'), '2019-01-01', '[
  ["LMT","NYSE","demand",0.9,"US prime contractor: missiles, F-35"],
  ["NOC","NYSE","demand",0.9,"US prime: munitions, strike, space"],
  ["RTX","NYSE","demand",0.7,"Raytheon missiles and air defense (plus civil aero)"],
  ["GD","NYSE","demand",0.6,"munitions, combat vehicles, submarines"],
  ["LHX","NYSE","demand",0.8,"defense electronics"],
  ["RHM","XETRA","demand",1.2,"European ammunition leader: rearmament"],
  ["BA","LSE","demand",1.0,"BAE Systems: munitions, combat systems"]
]');
SELECT count(*) FROM expose(ent('^VIX','INDEX'), '2019-01-01', '[
  ["CCL","NYSE","fear",-0.15,"discretionary travel bookings pause when fear jumps; leveraged equity"],
  ["RCL","NYSE","fear",-0.12,"discretionary travel"],
  ["NCLH","NYSE","fear",-0.15,"discretionary travel, leveraged"],
  ["LHA","XETRA","fear",-0.08,"travel near the conflict zone"],
  ["AF","EPA","fear",-0.08,"travel near the conflict zone"]
]');

-- SK Hynix results -> the memory cycle. Per 1% of Hynix's own move.
SELECT count(*) FROM expose(ent('000660','KRX'), '2026-01-01', '[
  ["005930","KRX","peer",0.5,"memory peer: same DRAM/HBM price cycle"],
  ["005935","KRX","peer",0.5,"Samsung preferred shares"],
  ["402340","KRX","peer",0.8,"SK Square: holding company whose main asset is ~20% of Hynix"],
  ["042700","KRX","revenue",0.5,"Hanmi: HBM bonders sold mainly to Hynix"],
  ["240810","KOSDAQ","revenue",0.3,"memory equipment"],
  ["036930","KOSDAQ","revenue",0.3,"memory equipment"],
  ["039030","KOSDAQ","revenue",0.3,"memory laser equipment"],
  ["009150","KRX","peer",0.2,"components into the same AI/server cycle"],
  ["MU","Nasdaq","peer",0.5,"memory peer: DRAM/HBM pricing"],
  ["SNDK","Nasdaq","peer",0.4,"NAND peer: same memory pricing cycle"],
  ["285A","TSE","peer",0.4,"Kioxia: NAND peer"],
  ["WDC","Nasdaq","peer",0.2,"storage: data-centre build-out"],
  ["STX","Nasdaq","peer",0.2,"storage: data-centre build-out"],
  ["8035","TSE","revenue",0.3,"Tokyo Electron: memory capex"],
  ["6857","TSE","revenue",0.3,"Advantest: memory/HBM test"],
  ["6146","TSE","revenue",0.3,"Disco: HBM grinding/dicing"],
  ["ASML","Nasdaq","revenue",0.2,"lithography: memory capex"],
  ["TSM","NYSE","peer",0.15,"AI chip cycle"],
  ["069500","KRX","index",0.25,"KOSPI ETF: Hynix and Samsung are ~35% of it"]
]');

-- Brazil: a Lula (left) win. Per odds point: state-controlled firms (interference, dividend policy), domestic
-- rate-sensitive names (looser fiscal path -> higher rates), brokers/exchanges (flows, rates) fall; exporters with dollar
-- revenue gain against the index as the real weakens. Values below are per 100 points, divided by 100.
CREATE OR REPLACE FUNCTION expose_brazil_left(p_driver bigint, p_known date) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM expose(p_driver, p_known, (SELECT jsonb_agg(jsonb_build_array(r->>0, r->>1, r->>2, (r->>3)::numeric / 100, r->>4))
    FROM jsonb_array_elements('[
    ["PETR4","B3","policy",-15,"state-controlled: fuel pricing and dividend interference"],
    ["PBR","NYSE","policy",-15,"Petrobras ADR: state interference"],
    ["BBAS3","B3","policy",-12,"state bank: directed lending, dividends"],
    ["AXIA3","B3","policy",-8,"privatised utility: governance pushback risk"],
    ["SBSP3","B3","policy",-6,"Sabesp: privatisation politics"],
    ["CSMG3","B3","policy",-6,"Copasa: state water, privatisation plan"],
    ["MGLU3","B3","rates",-15,"domestic retailer, leveraged: fiscal risk -> higher rates"],
    ["CEAB3","B3","rates",-12,"domestic apparel retail"],
    ["LREN3","B3","rates",-10,"domestic apparel retail"],
    ["ASAI3","B3","rates",-10,"cash-and-carry, leveraged"],
    ["CYRE3","B3","rates",-12,"homebuilder: mortgage rates"],
    ["MRVE3","B3","rates",-10,"homebuilder (low income): rates, partly helped by housing programmes"],
    ["RENT3","B3","rates",-12,"car rental: leveraged, rates"],
    ["COGN3","B3","rates",-10,"education, leveraged"],
    ["XP","Nasdaq","rates",-20,"broker: flows and rates"],
    ["BPAC11","B3","rates",-15,"investment bank: market activity"],
    ["B3SA3","B3","rates",-15,"exchange: volumes and foreign flows"],
    ["NU","NYSE","rates",-12,"consumer credit: rates and defaults"],
    ["ITUB4","B3","rates",-4,"private bank: diversified, higher rates partly help"],
    ["BBDC4","B3","rates",-6,"private bank: consumer credit"],
    ["BBSE3","B3","rates",5,"insurer: higher rates lift float income"],
    ["VALE3","B3","revenue",8,"dollar revenue: a weaker real lifts it against the index"],
    ["SUZB3","B3","revenue",12,"pulp exporter: dollar revenue, real costs"],
    ["EMBJ3","B3","revenue",12,"Embraer: dollar revenue"],
    ["WEGE3","B3","revenue",8,"half of revenue abroad"],
    ["JBSS3","B3","revenue",8,"meat exporter, dollar revenue"],
    ["BOVA11","B3","index",-15,"Ibovespa ETF"],
    ["EWZ","NYSEArca","index",-20,"MSCI Brazil in dollars: index plus currency"],
    ["BRL=X","FX","fx",10,"dollars per real: fiscal risk weakens the real"]
  ]') r)) $$;

-- US: a Trump win. Per odds point (per-100 values / 100): the published "Trump trade" baskets of 2024.
SELECT count(*) FROM expose(200, '2024-06-01', (SELECT jsonb_agg(jsonb_build_array(r->>0, r->>1, r->>2, (r->>3)::numeric / 100, r->>4))
  FROM jsonb_array_elements('[
  ["DJT","Nasdaq","policy",30,"Trump Media: value tied to the candidate"],
  ["TSLA","Nasdaq","policy",10,"owner allied with the campaign; lighter regulation"],
  ["JPM","NYSE","policy",6,"bank deregulation, capital rules, steeper curve"],
  ["GS","NYSE","policy",8,"deals and trading under lighter regulation"],
  ["BAC","NYSE","policy",6,"bank deregulation"],
  ["WFC","NYSE","policy",8,"asset cap and regulation"],
  ["KRE","NYSEArca","policy",10,"regional banks: deregulation, domestic growth"],
  ["XLF","NYSEArca","policy",6,"financials"],
  ["IWM","NYSEArca","policy",4,"small caps: domestic, tax cuts"],
  ["COIN","Nasdaq","policy",15,"crypto-friendly regulation"],
  ["MSTR","Nasdaq","policy",15,"bitcoin holder"],
  ["BTC-USD","FX","policy",8,"crypto-friendly regulation"],
  ["GEO","NYSE","policy",20,"private prisons and immigration detention"],
  ["CXW","NYSE","policy",20,"private prisons and immigration detention"],
  ["ENPH","Nasdaq","policy",-15,"residential solar: IRA credits at risk"],
  ["RUN","Nasdaq","policy",-20,"residential solar: IRA credits at risk, leveraged"],
  ["SEDG","Nasdaq","policy",-15,"solar inverters: IRA"],
  ["TAN","NYSEArca","policy",-12,"solar ETF: IRA"],
  ["FSLR","Nasdaq","policy",-8,"solar maker: IRA credits at risk, tariffs partly protect it"],
  ["NEE","NYSE","policy",-5,"renewables developer"],
  ["NUE","NYSE","policy",6,"steel tariffs"],
  ["STLD","Nasdaq","policy",6,"steel tariffs"],
  ["HUM","NYSE","policy",5,"Medicare Advantage friendlier rates"],
  ["UNH","NYSE","policy",3,"Medicare Advantage"],
  ["CVS","NYSE","policy",3,"Medicare Advantage (Aetna)"],
  ["TLT","Nasdaq","rates",-4,"long Treasuries: wider deficits, tariffs -> inflation"],
  ["EWW","NYSEArca","trade",-10,"Mexico: tariff threats"],
  ["MXN=X","FX","trade",6,"pesos per dollar: tariff threats"],
  ["EURUSD=X","FX","trade",-3,"dollar strength on tariffs"],
  ["CNY=X","FX","trade",2,"yuan per dollar: tariffs"],
  ["FXI","NYSEArca","trade",-8,"China: tariffs"],
  ["BABA","NYSE","trade",-8,"China: tariffs"],
  ["PDD","Nasdaq","trade",-8,"China exporter via Temu: tariffs, de minimis"],
  ["NIO","NYSE","trade",-8,"China EVs: tariffs"],
  ["TM","NYSE","trade",-3,"auto tariffs"],
  ["7203","TSE","trade",-3,"auto tariffs"],
  ["VOW3","XETRA","trade",-4,"European autos: tariffs"],
  ["BMW","XETRA","trade",-4,"European autos: tariffs"]
]') r));

-- Argentina: a Milei win. Per odds point: privatisation, an end to controls and subsidies, dollarisation talk.
SELECT count(*) FROM expose(201, '2023-07-01', (SELECT jsonb_agg(jsonb_build_array(r->>0, r->>1, r->>2, (r->>3)::numeric / 100, r->>4))
  FROM jsonb_array_elements('[
  ["YPF","NYSE","policy",30,"state oil company: pricing freedom, privatisation talk"],
  ["GGAL","Nasdaq","policy",20,"bank: normalisation, lower country risk"],
  ["BMA","NYSE","policy",20,"bank"],
  ["SUPV","NYSE","policy",20,"bank"],
  ["BBAR","NYSE","policy",20,"bank"],
  ["PAM","NYSE","policy",20,"utility/energy: tariff normalisation"],
  ["TGS","NYSE","policy",20,"gas transport: tariff normalisation"],
  ["CEPU","NYSE","policy",20,"power generation: tariffs"],
  ["EDN","NYSE","policy",25,"power distribution: frozen tariffs unfrozen"],
  ["TEO","NYSE","policy",15,"telecom: price controls end"],
  ["LOMA","NYSE","policy",15,"cement: construction recovery"],
  ["CRESY","Nasdaq","policy",15,"agriculture/real estate: export taxes cut"],
  ["IRS","NYSE","policy",15,"real estate"],
  ["VIST","NYSE","policy",15,"Vaca Muerta producer: export freedom"],
  ["CAAP","NYSE","policy",8,"airports concession"],
  ["ARGT","NYSEArca","index",10,"Argentina ETF (half is MercadoLibre)"],
  ["MELI","Nasdaq","index",3,"MercadoLibre: Argentina is a minority of revenue"]
]') r));

SELECT expose_brazil_left(190, '2026-01-01'), expose_brazil_left(196, '2022-06-01');

-- Intel results -> the PC and chip chain (2000). Per 1% of Intel's own move.
SELECT count(*) FROM expose(ent('INTC','Nasdaq'), '2000-01-01', '[
  ["AMD","Nasdaq","peer",0.4,"x86 rival: same PC demand"],
  ["MU","Nasdaq","peer",0.4,"PC DRAM: same PC demand"],
  ["TXN","NYSE","peer",0.3,"chips into PCs and phones: same cycle"],
  ["ADI","NYSE","peer",0.2,"analog chips: same cycle, less PC"],
  ["NVDA","Nasdaq","peer",0.3,"PC graphics: same PC demand"],
  ["AMAT","Nasdaq","revenue",0.4,"chip equipment: Intel is a top customer, capex follows demand"],
  ["KLAC","Nasdaq","revenue",0.4,"chip equipment: capex"],
  ["LRCX","Nasdaq","revenue",0.4,"chip equipment: capex"],
  ["HPQ","NYSE","demand",0.2,"PC maker: Intel''s miss is weak PC demand (Europe)"],
  ["MSFT","Nasdaq","demand",0.15,"Windows/Office ship with PCs"],
  ["AAPL","Nasdaq","demand",0.1,"PC demand"],
  ["IBM","NYSE","demand",0.1,"PCs and servers"],
  ["SMH","Nasdaq","index",0.5,"semiconductor ETF: Intel is a top weight"],
  ["XLK","NYSEArca","index",0.25,"tech ETF: Intel and its chain are a large share"],
  ["QQQ","Nasdaq","index",0.25,"Nasdaq-100: tech-heavy"]
]');
-- Apple results -> its suppliers and the PC market (2000).
SELECT count(*) FROM expose(ent('AAPL','Nasdaq'), '2000-01-01', '[
  ["MSI","NYSE","revenue",0.1,"Motorola: PowerPC chip supplier"],
  ["IBM","NYSE","revenue",0.05,"PowerPC chip supplier"],
  ["HPQ","NYSE","demand",0.15,"consumer PC demand: back-to-school was weak"],
  ["INTC","Nasdaq","demand",0.1,"PC demand"],
  ["MSFT","Nasdaq","demand",0.05,"Office for Mac; PC demand"]
]');

-- US policy-rate surprise (cases 21-24). Per +1 point of surprise TIGHTENING (a cut is negative). Market (SPY, raw): a
-- round prior of -1% per 25bp, the textbook discount-rate + credit-conditions effect, uncalibrated. Every other row is vs
-- the market (abnormal): long-duration growth and levered rate-sensitive demand move more than the market, defensives
-- with regulated or staple cash flows less (so they lag a cut-driven rally: + per point of tightening).
SELECT count(*) FROM expose(202, '2000-01-01', '[
  ["SPY","NYSEArca","valuation",-4,"the market: lower discount rate and easier credit"],
  ["QQQ","Nasdaq","valuation",-3,"long-duration growth: most value in far-off cash flows; high market beta"],
  ["XLK","NYSEArca","valuation",-3,"tech: long duration, high beta"],
  ["CSCO","Nasdaq","valuation",-4,"growth multiple, capex-cycle demand that credit eases"],
  ["ORCL","Nasdaq","valuation",-4,"growth multiple, corporate IT budgets"],
  ["INTC","Nasdaq","valuation",-3,"cyclical chip demand, high beta"],
  ["MSFT","Nasdaq","valuation",-2,"growth multiple, net cash"],
  ["AMZN","Nasdaq","valuation",-4,"long-duration growth, consumer spending"],
  ["EBAY","Nasdaq","valuation",-4,"long-duration growth"],
  ["NVDA","Nasdaq","valuation",-4,"long-duration growth, cyclical chips"],
  ["AAPL","Nasdaq","valuation",-2,"consumer hardware, cyclical"],
  ["XLY","NYSEArca","demand",-2,"consumer discretionary: financed spending"],
  ["IWM","NYSEArca","credit",-2,"small firms: bank-dependent, floating-rate debt"],
  ["LEN","NYSE","demand",-4,"homebuilder: mortgage rates set demand; levered land"],
  ["PHM","NYSE","demand",-4,"homebuilder: mortgage rates"],
  ["KBH","NYSE","demand",-4,"homebuilder: mortgage rates"],
  ["DHI","NYSE","demand",-4,"homebuilder: mortgage rates"],
  ["TOL","NYSE","demand",-4,"homebuilder: mortgage rates"],
  ["SCHW","NYSE","revenue",-4,"broker: trading volume and margin lending rise with easier money; high beta"],
  ["MS","NYSE","revenue",-3,"broker and underwriter: deal and trading activity"],
  ["GS","NYSE","revenue",-3,"underwriter and trader: deal activity"],
  ["XLF","NYSEArca","credit",-1,"financials: cheaper funding and fewer defaults, less net interest margin"],
  ["JPM","NYSE","credit",-1,"bank: credit relief vs margin squeeze; capital markets"],
  ["BAC","NYSE","credit",-1,"bank: credit relief vs margin squeeze"],
  ["C","NYSE","credit",-1,"bank: credit relief, capital markets"],
  ["WFC","NYSE","credit",-0.5,"bank: deposit-funded, margin squeeze offsets mortgage volume"],
  ["XLU","NYSEArca","valuation",2,"utilities: regulated returns, low beta: lags a cut-driven rally"],
  ["DUK","NYSE","valuation",2,"utility: regulated returns, low beta"],
  ["SO","NYSE","valuation",2,"utility: regulated returns, low beta"],
  ["XLP","NYSEArca","valuation",2,"staples: steady demand, low beta"],
  ["PG","NYSE","valuation",2,"staples: steady demand, low beta"],
  ["KO","NYSE","valuation",2,"staples: steady demand, low beta"],
  ["JNJ","NYSE","valuation",2,"healthcare staple, low beta"],
  ["MO","NYSE","valuation",2,"tobacco: steady cash, low beta"],
  ["XLE","NYSEArca","valuation",1,"energy: priced on oil, not rates"],
  ["XOM","NYSE","valuation",1,"oil major: priced on oil, low beta"],
  ["CVX","NYSE","valuation",1,"oil major: priced on oil, low beta"]
]'::jsonb);

-- Fed-day 2-year yield (cases 25-39). The same reasons as the policy-rate surprise (202), per +1 point of tightening: a
-- path surprise reaches stocks through the same discount rate, credit and demand channels. The size is the yield
-- class's own scale, tuned across cases, not assumed. Three names that 2001 lacked: REITs, unprofitable growth, and
-- regional banks (deposit-funded, their bond books lose value as yields rise: 2023 made that a reason, not a pattern).
-- Schwab is re-reasoned, not copied: by 2018 most of its revenue was net interest on client cash (the drift logged from
-- the 2020 cut, case 24), so higher short rates now help it.
SELECT count(*) FROM expose(203, '2018-01-01', (
  SELECT jsonb_agg(jsonb_build_array(s.ticker, s.exchange, l.attrs->>'channel', (l.attrs->>'elasticity')::numeric, l.attrs->>'why'))
  FROM link l JOIN security s ON s.entity_id = l.src_id AND s.is_primary
  WHERE l.dst_id = 202 AND l.rel = 'exposed_to' AND s.ticker <> 'SCHW') || '[
  ["SCHW","NYSE","revenue",2,"broker-bank: most revenue is net interest on client sweep cash, which higher short rates widen"],
  ["XLRE","NYSEArca","valuation",-3,"real estate: valued on cap rates that track yields; levered"],
  ["ARKK","NYSEArca","valuation",-6,"unprofitable growth: all value in far-off cash flows, needs funding markets open"],
  ["KRE","NYSEArca","credit",-2,"regional banks: bond books lose value and deposits reprice as yields rise"]
]'::jsonb);
