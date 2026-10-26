"""Pull the specific details out of a headline and summary with rules, no AI model.

The headline says what happened; the summary often says how much, for how long, who and where. Each
  extractor returns
short normalized strings, so a story's facts cost a few tokens and line up with the fields a claim
  needs:
  money     "$95B", "-$2.1B"           -> claim magnitude in usd
  pct       "-30% output", "+12% shares"-> claim magnitude in pct, with the thing it measures when
    the text says
  duration  "1 month" (+ days: 30)     -> claim duration_days
  timeline  "restart by Q2 2027"       -> when something is expected to resume, close or take effect
  people    "CEO: Brian Niccol"        -> claim object (leader_departed / leader_appointed)
  places    "Naka plant", "Phoenix"    -> facility to link, dateline city
  qty       "40,000 vehicles"          -> units affected
  terms     "force majeure"            -> watch phrases from the watch_term table (edit it to add
    your own)
"""

import re

NUM_WORDS = {
    "a": 1,
    "an": 1,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "a few": 3,
    "several": 4,
    "a couple of": 2,
}
UNIT_DAYS = {"day": 1, "week": 7, "month": 30, "quarter": 91, "year": 365}
SCALE = {
    "trillion": 1e12,
    "tn": 1e12,
    "t": 1e12,
    "billion": 1e9,
    "bn": 1e9,
    "b": 1e9,
    "million": 1e6,
    "mn": 1e6,
    "m": 1e6,
    "mln": 1e6,
    "thousand": 1e3,
    "k": 1e3,
}
DOWN = (
    r"(cut|cuts|cutting|fell|fall|falls|drop|drops|dropped|declin\w*|down|lower\w*|reduc\w*|"
    r"slash\w*|plung\w*|sank|sink\w*"
    r"|lost|lose|loses|loss|shrank|shrink\w*|tumbl\w*|slump\w*|miss\w*|decreas\w*|halv\w*)"
)
UP = (
    r"(rose|rise|rises|rising|up|gain\w*|jump\w*|surg\w*|soar\w*|climb\w*|increas\w*|rais\w*|"
    r"boost\w*|grew|grow\w*|beat\w*|hik\w*)"
)
ROLES = (
    r"(Chief Executive Officer|Chief Executive|Chief Financial Officer|Chief Operating Officer|CEO|"
    r"CFO|COO|CTO|Chairman|"
    r"Chairwoman|Chair|President|Founder|Co-Founder|Governor|Minister|Secretary|Commissioner|Prime "
    r"Minister)"
)
ROLES_ANY = (
    r"(?i:(chief executive officer|chief executive|chief financial officer|chief operating officer|"
    r"ceo|cfo|coo|cto|"
    r"chairman|chairwoman|chair|president|governor|minister))"
)
NAME = r"([A-Z][a-z]+(?:[- ][A-Z]\.?)?(?: [A-Z][a-z'\-]+){1,2})"
FACILITY = (
    r"(plant|factory|fab|foundry|mine|refinery|smelter|port|terminal|pipeline|warehouse|facility|"
    r"site|mill|works|field|line)"
)
MONTHS = (
    "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|"
    "Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec"
)
WHEN = (
    rf"(Q[1-4](?: \d{{4}})?|(?:the )?(?:first|second|third|fourth) quarter(?: of \d{{4}})?|"
    rf"(?:early|mid|late|end of|the end of) (?:{MONTHS}|\d{{4}}|the year|next year)"
    rf"|(?:{MONTHS})(?: \d{{1,2}})?(?:,? \d{{4}})?|\d{{4}}|next (?:week|month|quarter|year)|this "
    rf"(?:week|month|quarter|year))"
)
QTY_UNITS = (
    r"(plants|factories|mines|lines|companies|firms|entities|vehicles|cars|units|barrels|bpd|"
    r"barrels per day|tons|tonnes|wafers|chips|jobs|employees|workers|staff|stores|"
    r"homes|customers|users|passengers|flights|shares|megawatts|MW|GW|ounces|bushels)"
)


def _num(s):
    return float(s.replace(",", ""))


def _short(x):
    for div, suf in ((1e12, "T"), (1e9, "B"), (1e6, "M"), (1e3, "K")):
        if abs(x) >= div:
            v = x / div
            return f"{v:.1f}".rstrip("0").rstrip(".") + suf
    return f"{x:.0f}"


def _sign(text, start, window=40):
    """+1 or -1 from the nearest direction word before a number ("cut output by 30%"), 0 when the
    text gives none.
    """
    left = text[max(0, start - window) : start].lower()
    d = [m.end() for m in re.finditer(rf"\b{DOWN}\b", left)]
    u = [m.end() for m in re.finditer(rf"\b{UP}\b", left)]
    if not d and not u:
        return 0
    return -1 if (max(d) if d else -1) > (max(u) if u else -1) else 1


def money(text):
    out = []
    for m in re.finditer(
        r"(?<![\w.])(US)?\$\s?(\d[\d,]*(?:\.\d+)?)\s?(trillion|billion|million|thousand|bn|mn|mln|"
        r"tn|[tbmk])?\b",
        text,
        re.I,
    ):
        v = _num(m.group(2)) * SCALE.get((m.group(3) or "").lower(), 1)
        if v < 1e5:  # share prices and small sums are noise for the reasoner
            continue
        s = _sign(text, m.start())
        out.append(("-" if s < 0 else "") + "$" + _short(v))
    return out


def pct(text):
    out = []
    for m in re.finditer(r"(\d+(?:\.\d+)?)\s?(%|percent\b|per cent\b)", text, re.I):
        s = _sign(text, m.start())
        after = re.match(
            r"\s*(?:of |in )?(?:its |the |their )?(?:[a-z]+ ){0,2}?((?:global |annual |monthly |"
            r"daily )?"
            r"(?:output|production|capacity|revenue|sales|shares|stake|workforce|jobs|supply|"
            r"exports|imports"
            r"|profit|earnings|margin|market share|volume|demand|deliveries|shipments|staff))",
            text[m.end() :],
            re.I,
        )
        what = after.group(1).lower() if after else ""
        if not what:
            before = re.search(
                r"(output|production|capacity|revenue|sales|shares|stock|profit|earnings|exports|"
                r"imports|"
                r"deliveries|shipments|workforce|tariffs?|duty|duties)\b[^.%]{0,50}$",
                text[max(0, m.start() - 70) : m.start()],
                re.I,
            )
            what = before.group(1).lower() if before else ""
            if what in ("shares", "stock"):  # "Chipotle shares fell 7.5%": whose shares
                co = re.search(
                    r"\b([A-Z][\w&.\-]+)(?:'s)? (?:shares|stock)\b[^.%]{0,40}$",
                    text[max(0, m.start() - 70) : m.start()],
                )
                what = f"{co.group(1)} {what}" if co else what
        if not what:  # "Starbucks jumped 24%": the company that moved
            who = re.search(
                r"\b([A-Z][\w&.\-]+)(?:'s)?(?: (?:shares|stock))?\s+(?:[a-z]+\s+){1,"
                r"2}(?:by\s+)?(?:about\s+|nearly\s+|around\s+|almost\s+)?$",
                text[max(0, m.start() - 45) : m.start()],
            )
            what = (
                who.group(1)
                if who and who.group(1) not in ("The", "It", "Its", "A", "In", "And", "While")
                else ""
            )
        out.append(
            f"{'+' if s > 0 else '-' if s < 0 else ''}{m.group(1)}%" + (f" {what}" if what else "")
        )
    return out


def duration(text):
    out = []
    # "for two weeks", "within one month", "a 3 to 6 month hit", "a two-week halt"; not "three
    # months ended June 30"
    rx = (
        rf"\b(?:(?:for|within|up to|about|around|at least|more than|over|nearly|lasting|last|take|"
        rf"takes|in|another|next|a|an)\s+)?"
        rf"(\d+|{'|'.join(sorted(NUM_WORDS, key=len, reverse=True))})(?:\s*(?:to|-)\s*(\d+|"
        rf"{'|'.join(k for k in NUM_WORDS if ' ' not in k)}))?[\s\-]+(day|week|month|quarter|"
        rf"year)s?\b(?! ended)"
    )
    for m in re.finditer(rx, text, re.I):
        n = m.group(2) or m.group(1)
        n = NUM_WORDS.get(n.lower(), None) if not n.isdigit() else int(n)
        if not n or (
            m.group(1).lower() in ("a", "an")
            and not m.group(2)
            and m.group(0)[:2].lower() in ("a ", "an")
        ):
            continue  # "a month" alone is too vague to be a duration
        unit = m.group(3).lower()
        out.append((f"{n} {unit}" + ("s" if n != 1 else ""), n * UNIT_DAYS[unit]))
    return out


def timeline(text):
    out = []
    rx = (
        rf"\b(resum\w*|restart\w*|reopen\w*|return\w* to (?:full )?(?:production|service|"
        rf"operation)|complet\w*|close[sd]?|clos\w*|"
        rf"effective|tak\w* effect|expected|expects|by|until|through|beginning|starting|launch\w*|"
        rf"deadline)\b[^.;]{{0,40}}?\b{WHEN}"
    )
    for m in re.finditer(rx, text, re.I):
        verb = m.group(1).lower()
        verb = {"by": "by", "until": "until", "through": "until"}.get(
            verb, re.sub(r"(ed|ing|s)$", "", verb)
        )
        out.append(f"{verb} {m.group(2)}")
    return out


def people(text):
    out = []
    for m in re.finditer(rf"\b{ROLES}\s*,?\s+{NAME}", text):
        out.append(f"{m.group(1)}: {m.group(2)}")
    for m in re.finditer(
        rf"\b(?:named|names|appoint\w*|hir\w*|tapp\w*|"
        rf"promot\w*)\s+(?:[A-Z][\w&]+'s\s+)?{NAME}\s+(?:as\s+)?(?:its\s+|the\s+)?(?:new\s+|"
        rf"interim\s+)?{ROLES_ANY}",
        text,
    ):
        out.append(f"{m.group(2).title()}: {m.group(1)}")
    for m in re.finditer(
        rf"\b(?:replac\w*|succeed\w*|ousted|ousting|fired|firing)\s+(?:[A-Z][\w&]+'s\s+)?{NAME}",
        text,
    ):
        out.append(f"out: {m.group(1)}")
    for m in re.finditer(
        rf"{NAME},\s+(?:the\s+)?(?:company's\s+|its\s+|[A-Z][\w&.]+(?: "
        rf"[A-Z][\w&.]+)?'s\s+)?(?:new\s+|former\s+|interim\s+)?{ROLES}\b",
        text,
    ):
        out.append(f"{m.group(2)}: {m.group(1)}")
    norm = {
        "Chief Executive Officer": "CEO",
        "Chief Executive": "CEO",
        "Chief Financial Officer": "CFO",
        "Chief Operating Officer": "COO",
        "Ceo": "CEO",
        "Cfo": "CFO",
        "Coo": "COO",
        "Cto": "CTO",
    }
    return [norm.get(p.split(":")[0], p.split(":")[0]) + ":" + p.split(":", 1)[1] for p in out]


def places(text):
    out = [
        f"{m.group(1)} {m.group(2).lower()}"
        for m in re.finditer(rf"\b((?:[A-Z][\w\-]+ ){{0,2}}[A-Z][\w\-]+)\s+{FACILITY}\b", text)
        if m.group(1).split()[0] not in ("The", "A", "An", "Its", "Their", "Our", "This", "That")
    ]
    dl = re.search(
        r"(?:^|\. )\s*([A-Z][A-Z .&'\-]{2,40}?)(?:,\s*[A-Z][A-Za-z.]+)?\s*--\s*\((?:BUSINESS WIRE|"
        r"GLOBE NEWSWIRE|PRNewswire)",
        text,
    )
    if dl:
        out += [c.strip().title() for c in dl.group(1).split("&") if c.strip()]
    return out


def qty(text):
    return [
        f"{m.group(1)} {m.group(2)}"
        for m in re.finditer(
            rf"\b(\d{{1,3}}(?:,\d{{3}})+|\d+(?:\.\d+)? (?:million|billion|thousand)|"
            rf"\d+)\s+(?:[A-Z][a-z]+\s+)?{QTY_UNITS}\b",
            text,
        )
        if not re.fullmatch(r"(19|20)\d\d", m.group(1))
    ]


def terms(text, watch):
    low = text.lower()
    return [
        label for term, label in watch if re.search(rf"(?<!\w){re.escape(term.lower())}(?!\w)", low)
    ]


def extract(text, watch=()):
    """All facts in one dict of short lists; empty keys dropped. `watch` is [(term, label)] from
    the watch_term table.
    """
    d = duration(text)
    f = {
        "money": money(text),
        "pct": pct(text),
        "duration": [x for x, _ in d],
        "timeline": timeline(text),
        "people": people(text),
        "places": places(text),
        "qty": qty(text),
        "terms": terms(text, watch),
    }
    f = {k: list(dict.fromkeys(v))[:4] for k, v in f.items() if v}
    if d:
        f["days"] = max(x for _, x in d)
    return f


def line(f):
    """The facts as one short line for the digest: "-30% output · 1 month · CEO: Brian Niccol ·
    Naka plant".
    """
    parts = []
    for k in ("money", "pct", "qty", "duration", "timeline", "people", "places", "terms"):
        parts += f.get(k, [])[: 3 if k != "terms" else 4]
    return " · ".join(parts)


def merge(a, b):
    out = dict(a)
    for k, v in b.items():
        if k == "days":
            out[k] = max(out.get(k, 0), v)
        else:
            out[k] = list(dict.fromkeys(out.get(k, []) + v))[:6]
    return out
