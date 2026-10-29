// Turn a typed event ("Iran bombs a Chinese port") into the scenario simulator's
// choices: a kind of event, the countries involved, their regions and the commodities at
// risk. Plain keyword matching, shown to the person so they can correct it; the matcher
// still only compares those choices with past events.
import type { Spec } from "./scenarios";

const TYPE_WORDS: [RegExp, string][] = [
  // The narrower kinds first, so "a bank run" is a bank run and not any financial crisis.
  [/\b(bitcoin|crypto|cryptocurrency|stablecoin|stablecoins|ether|ethereum|token|tokens)\b/, "crypto_crash"],
  [/\b(bank run|run on|deposits?|depositors|bank fails|bank failure|bank collapses?)\b/, "bank_run"],
  [/\b(sovereign default|defaults? on|debt crisis|debt restructuring|restructures? its debt|cannot pay its debts?|misses? a payment|bailout|bail out|imf loan)\b/, "sovereign_default"],
  [/\b(devalues?|devaluation|currency crash|currency crisis|peg breaks|breaks? the peg|lira|ruble|rouble|peso|rupee|real|yuan|won|baht|rand) (plunges?|crash(es)?|collapses?|falls?|tumbles?)\b|\b(devalues?|devaluation|currency crisis|currency crash)\b/, "currency_crisis"],
  [/\b(yields? (spike|spikes|jump|jumps|surge|surges|soar|soars)|bond (sell ?off|rout|crash)|inflation (shock|surprise|spike)|gilt|gilts|taper)\b/, "rate_shock"],
  [/\b(shipping|container|canal|port closure|ports? (shut|closed)|supply chain|chip shortage|factory lockdown)\b/, "supply_chain_shock"],
  [/\b(terror|terrorist|bombing at|hostage|gunmen)\b/, "terrorist_attack"],
  [/\b(invade|invades|invasion|war|wars|annex|occupy|occupies)\b/, "war"],
  [/\b(strike|strikes|bomb|bombs|bombed|missile|missiles|drone|drones|airstrike|attack|attacks|shell|shells|raid)\b/, "military_strike"],
  [/\b(sanction|sanctions|embargo|freeze|frozen|blacklist)\b/, "sanctions"],
  [/\b(tariff|tariffs|trade war|export ban|import ban|quota)\b/, "trade_war"],
  [/\b(opec|output cut|supply cut|pipeline|blockade|strait|refinery|oil field|production cut)\b/, "oil_supply_shock"],
  [/\b(pandemic|virus|outbreak|epidemic|flu|covid|lockdown)\b/, "pandemic"],
  [/\b(rate hike|rate cut|hikes rates|cuts rates|raises rates|central bank|fed|ecb|bank of japan|boj|snb|bank of england|peg)\b/, "central_bank_surprise"],
  [/\b(default|defaults|crash|collapse|collapses|bankrupt|bankruptcy|crisis|downgrade)\b/, "financial_crisis"],
  [/\b(election|elected|vote|referendum|wins)\b/, "election"],
  [/\b(coup|protest|protests|revolution|resigns|impeach|unrest|riots)\b/, "political_crisis"],
  [/\b(earthquake|hurricane|typhoon|flood|floods|tsunami|volcano|drought|wildfire)\b/, "natural_disaster"],
];

/** Names and adjectives people type, to the simulator's actor names. */
const ACTOR_WORDS: Record<string, string> = {
  us: "usa", usa: "usa", america: "usa", american: "usa", "united states": "usa", washington: "usa",
  uk: "uk", britain: "uk", british: "uk", england: "uk", london: "uk",
  china: "china", chinese: "china", beijing: "china",
  russia: "russia", russian: "russia", moscow: "russia",
  iran: "iran", iranian: "iran", tehran: "iran",
  israel: "israel", israeli: "israel",
  saudi: "saudi_arabia", "saudi arabia": "saudi_arabia",
  japan: "japan", japanese: "japan", tokyo: "japan",
  ukraine: "ukraine", ukrainian: "ukraine",
  taiwan: "taiwan", taiwanese: "taiwan",
  "north korea": "north_korea", "north korean": "north_korea", pyongyang: "north_korea",
  "south korea": "south_korea", "south korean": "south_korea", korea: "south_korea", korean: "south_korea",
  germany: "germany", german: "germany", france: "france", french: "france", italy: "italy", italian: "italy",
  spain: "spain", spanish: "spain", greece: "greece", greek: "greece", switzerland: "switzerland", swiss: "switzerland",
  canada: "canada", canadian: "canada", mexico: "mexico", mexican: "mexico",
  iraq: "iraq", iraqi: "iraq", kuwait: "kuwait", syria: "syria", syrian: "syria", lebanon: "lebanon",
  yemen: "yemen", houthi: "yemen", houthis: "yemen", libya: "libya", libyan: "libya", egypt: "egypt", egyptian: "egypt",
  turkey: "turkey", turkish: "turkey", india: "india", indian: "india", pakistan: "pakistan", pakistani: "pakistan",
  brazil: "brazil", brazilian: "brazil", venezuela: "venezuela", argentina: "argentina",
  indonesia: "indonesia", malaysia: "malaysia", thailand: "thailand", thai: "thailand", "hong kong": "hong_kong",
  australia: "australia", australian: "australia", norway: "norway", qatar: "qatar", uae: "uae", emirates: "uae",
  hamas: "hamas", hezbollah: "hezbollah", nato: "nato", opec: "opec", eu: "eu", europe: "eu", european: "eu",
  fed: "fed", ecb: "ecb", boj: "boj", snb: "snb", afghanistan: "afghanistan", georgia: "georgia", serbia: "serbia",
  "south africa": "south_africa", nigeria: "nigeria", venezuelan: "venezuela", chile: "chile", peru: "peru",
  ireland: "ireland", irish: "ireland", iceland: "iceland", cyprus: "cyprus", portugal: "portugal", portuguese: "portugal",
  "sri lanka": "sri_lanka", azerbaijan: "azerbaijan", armenia: "armenia", argentine: "argentina", dubai: "uae",
};

/** Each actor's home region, in the simulator's vocabulary. */
const ACTOR_REGION: Record<string, string> = {
  usa: "north_america", canada: "north_america", mexico: "latin_america", brazil: "latin_america", venezuela: "latin_america",
  argentina: "latin_america", chile: "latin_america", peru: "latin_america",
  uk: "europe", germany: "europe", france: "europe", italy: "europe", spain: "europe", greece: "europe", switzerland: "europe",
  norway: "europe", ireland: "europe", iceland: "europe", cyprus: "europe", portugal: "europe", eu: "europe", ecb: "europe", snb: "europe", nato: "europe", serbia: "europe", turkey: "europe",
  russia: "russia_cis", ukraine: "russia_cis", georgia: "russia_cis", azerbaijan: "russia_cis", armenia: "russia_cis",
  iran: "middle_east", israel: "middle_east", saudi_arabia: "middle_east", iraq: "middle_east", kuwait: "middle_east", syria: "middle_east",
  lebanon: "middle_east", yemen: "middle_east", hamas: "middle_east", hezbollah: "middle_east", qatar: "middle_east", uae: "middle_east",
  egypt: "middle_east", libya: "africa", opec: "middle_east", south_africa: "africa", nigeria: "africa",
  china: "east_asia", japan: "east_asia", taiwan: "east_asia", north_korea: "east_asia", south_korea: "east_asia", hong_kong: "east_asia",
  indonesia: "east_asia", malaysia: "east_asia", thailand: "east_asia", boj: "east_asia",
  india: "south_asia", pakistan: "south_asia", sri_lanka: "south_asia", afghanistan: "south_asia", australia: "oceania",
};

const COMMODITY_WORDS: [RegExp, string][] = [
  [/\b(oil|crude|opec|refinery|tanker|tankers|strait of hormuz|hormuz|pipeline|petrol|gasoline|barrel)\b/, "oil"],
  [/\b(gas|lng|natural gas)\b/, "gas"],
  [/\b(copper|metal|metals|aluminium|aluminum|nickel|iron ore|lithium|rare earths?)\b/, "metals"],
  [/\b(wheat|grain|grains|corn|soy|soybeans|rice|food)\b/, "grains"],
];

const SEVERITY_WORDS: [RegExp, number][] = [
  [/\b(nuclear|world war|full[- ]scale|catastroph|collapse of)\w*/, 5],
  [/\b(invade|invasion|war|massive|major|huge|closes?|shut|blockade)\w*/, 4],
  [/\b(strike|attack|bomb|sanction|tariff|default|crash)\w*/, 3],
  [/\b(threat|threatens|warns|tension|minor|small|skirmish)\w*/, 2],
];

/** What the words suggest. Empty parts mean "not mentioned". */
export function parseEvent(text: string): Pick<Spec, "type" | "actors" | "regions" | "commodities" | "severity"> {
  const t = ` ${text.toLowerCase().replace(/[^a-z\s'-]/g, " ").replace(/\s+/g, " ")} `;
  const type = TYPE_WORDS.find(([re]) => re.test(t))?.[1] ?? "";
  const actors: string[] = [];
  // Longer names first, so "north korea" wins over "korea".
  for (const word of Object.keys(ACTOR_WORDS).sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b${word.replace(/ /g, "\\s")}\\b`);
    if (re.test(t)) {
      const a = ACTOR_WORDS[word];
      if (!actors.includes(a)) actors.push(a);
    }
  }
  const tidy = actors.filter((a) => !(a === "south_korea" && actors.includes("north_korea") && !/south/.test(t)));
  const regions = [...new Set(tidy.map((a) => ACTOR_REGION[a]).filter(Boolean))];
  const commodities = COMMODITY_WORDS.filter(([re]) => re.test(t)).map(([, c]) => c);
  const severity = SEVERITY_WORDS.find(([re]) => re.test(t))?.[1] ?? 0;
  return { type, actors: tidy, regions, commodities, severity };
}
