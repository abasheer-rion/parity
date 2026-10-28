"""Usage: pdftext.py URL_OR_PATH OUT_TXT  -- download (if URL) and extract text."""
import sys, subprocess, pathlib
from pypdf import PdfReader
src, out = sys.argv[1], pathlib.Path(sys.argv[2])
if src.startswith("http"):
    pdf = out.with_suffix(".pdf")
    subprocess.run(["curl", "-sSL", "--max-time", "90", "-A", "Mozilla/5.0", "-o", str(pdf), src], check=True)
else:
    pdf = pathlib.Path(src)
r = PdfReader(str(pdf))
text = "\n".join(f"=== page {i+1} ===\n" + (p.extract_text() or "") for i, p in enumerate(r.pages))
out.write_text(text, encoding="utf-8")
print(out.name, len(r.pages), "pages", len(text), "chars")
