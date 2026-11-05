import re, pathlib, sys
p = pathlib.Path(sys.argv[1]); t = p.read_text(encoding="utf-8")
m = re.search(r"<<<<<<< [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n", t, re.S)
head, mine = m.group(1), m.group(2)
# drop my BIS fetcher: rate.* now use main's SDMX fetcher
mine = re.sub(r"def fetch_bis\(.*?\n\n\ndef parse_bis_csv\(.*?\n\n\n", "", mine, flags=re.S)
mine = mine.replace("def fetch_ecb(series", "def fetch_ecb_usd(series")
mine = mine.replace("def fetch_eia(series", "def fetch_eia_web(series")
mine = re.sub(r"\n\nFETCHERS = .*", "\n", mine, flags=re.S)
head = head.replace('"cftc": fetch_cftc, "eia": fetch_eia}',
                    '"cftc": fetch_cftc, "eia": fetch_eia, "ecb_usd": fetch_ecb_usd,\n            "oecd": fetch_oecd, "eia_web": fetch_eia_web}')
head_parts = head.split("\n\nFETCHERS = ")
new = head_parts[0] + "\n\n" + mine.rstrip("\n") + "\n\n\nFETCHERS = " + head_parts[1]
p.write_text(t[:m.start()] + new + t[m.end():], encoding="utf-8", newline="\n")
