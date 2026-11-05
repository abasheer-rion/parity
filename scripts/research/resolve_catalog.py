import re, pathlib, sys
p = pathlib.Path(sys.argv[1]); t = p.read_text(encoding="utf-8")
m = re.search(r"<<<<<<< [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n", t, re.S)
head, mine = m.group(1), m.group(2)
head = re.sub(r"\n\nCATALOG: dict.*", "\n", head, flags=re.S)
mine = re.sub(r"\n\nCATALOG: dict.*", "\n", mine, flags=re.S)
mine = mine.replace('Series(f"fx.{ccy}", "ecb", ccy,', 'Series(f"fx.{ccy}", "ecb_usd", ccy,')
mine = mine.replace('Series(f"rate.{ccy}", "bis", cc,', 'Series(f"rate.{ccy}", "bis", f"WS_CBPOL/D.{cc}",')
mine = mine.replace('Series(f"curve.{sym}{n}", "eia", ', 'Series(f"curve.{sym}{n}", "eia_web", ')
cat = ('\n\nCATALOG: dict[str, Series] = {\n'
       '    s.key: s for s in _FX + _RATES + _OTHER + _REER + _FX_WIDE + _YIELDS + _FACTORS\n'
       '    + _INDUSTRIES + _BOND_TR + _WIDER + _EM_FX + _EM_RATES + _CURVES + _FUTURES + _VOL\n'
       '}\n')
new = head.rstrip("\n") + "\n\n" + mine.rstrip("\n") + cat
p.write_text(t[:m.start()] + new + t[m.end():], encoding="utf-8", newline="\n")
