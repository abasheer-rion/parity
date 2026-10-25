#!/usr/bin/env python3
"""A local preview of the blog and news pages, drafts and posts in review included (DEC-0053).

    npm run newsroom:preview          # then open http://127.0.0.1:4410/blog/

Builds into web/.newsroom-preview/ (ignored by git) with a banner on every unpublished post and
noindex on every page, then serves it on 127.0.0.1 only. Nothing here touches the real site.
"""
from __future__ import annotations

import functools
import http.server
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import model  # noqa: E402
from build import build_into  # noqa: E402

PORT = 4410


def main() -> int:
    out = model.ROOT / "web/.newsroom-preview"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    pub = model.ROOT / "web/public"
    for name in ("brand", "favicon.svg", "favicon-32.png", "apple-touch-icon.png"):
        src = pub / name
        if src.is_dir():
            shutil.copytree(src, out / name)
        elif src.exists():
            shutil.copyfile(src, out / name)
    try:
        build_into(out, preview=True)
    except model.ValidationError as err:
        print("newsroom preview: published posts have problems:\n  - " + "\n  - ".join(err.problems), file=sys.stderr)
        return 1
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(out))
    print(f"newsroom preview: http://127.0.0.1:{PORT}/blog/ and http://127.0.0.1:{PORT}/news/ (Ctrl+C to stop)")
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler) as srv:
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
