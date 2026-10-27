// Countries for the trade profile and the demo leaderboard. The person picks their own
// country from this list; Parity never guesses it from the address or the browser.
// Each ISO 3166-1 alpha-2 code maps to one of seven regions. This list must agree with
// public.country_region() in supabase/migrations/20261112000000_trade_profile.sql: a
// code missing here, or in another region, would rank a trader in the wrong place.
//
// Edge choices (as in the database): Mexico, Central America and the Caribbean are Latin
// America. Egypt and the rest of North Africa are Africa. Turkey and Russia are Europe. The
// Caucasus and Central Asia are Asia. US minor outlying islands are Oceania.

export const REGIONS = ["Africa", "Asia", "Europe", "Latin America", "Middle East", "North America", "Oceania"] as const;
export type Region = (typeof REGIONS)[number];

const BY_REGION: Record<Region, string> = {
  Africa: "AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TF TG TN TZ UG YT ZA ZM ZW",
  Asia: "AF AM AZ BD BN BT CN GE HK ID IN IO JP KG KH KP KR KZ LA LK MM MN MO MV MY NP PH PK SG TH TJ TL TM TW UZ VN",
  Europe: "AD AL AT AX BA BE BG BV BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM TR UA VA XK",
  "Latin America": "AG AI AR AW BB BL BO BQ BR BS BZ CL CO CR CU CW DM DO EC FK GD GF GP GS GT GY HN HT JM KN KY LC MF MQ MS MX NI PA PE PR PY SR SV SX TC TT UY VC VE VG VI",
  "Middle East": "AE BH IL IQ IR JO KW LB OM PS QA SA SY YE",
  "North America": "BM CA GL PM US",
  Oceania: "AS AU CC CK CX FJ FM GU HM KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV UM VU WF WS",
};

const REGION_OF = new Map<string, Region>();
for (const r of REGIONS) for (const code of BY_REGION[r].split(" ")) REGION_OF.set(code, r);

/** The region a country code belongs to, or null for an unknown or empty code. */
export function regionOf(code: string | null | undefined): Region | null {
  return code ? REGION_OF.get(code.toUpperCase()) ?? null : null;
}

let names: Intl.DisplayNames | null = null;
/** The country's English name from the browser, or the code when the browser has none. */
export function countryName(code: string): string {
  try {
    names ??= new Intl.DisplayNames(["en"], { type: "region" });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

export interface Country { code: string; name: string; region: Region }

/** Every country on offer, sorted by name. */
export function countries(): Country[] {
  return [...REGION_OF].map(([code, region]) => ({ code, name: countryName(code), region })).sort((a, b) => a.name.localeCompare(b.name));
}
