// The app's own log, kept on the computer so a problem can be traced afterwards (DEC-0059):
// pages loaded, pages that failed or crashed, errors a page printed, blank pages found and
// repainted. One file, at most about 1 MB: when it fills, the older half is dropped. It never
// holds cookies, tokens or anything typed into a page; page errors are cut to 300 characters
// and anything that looks like a token is removed.
//
//   Mac      ~/Library/Logs/Parity/parity.log
//   Windows  %APPDATA%\Parity\logs\parity.log
const fs = require("node:fs");
const path = require("node:path");

const MAX = 1024 * 1024;

/** Removes anything that looks like a secret: JWTs, bearer tokens, long hex or base64 runs. */
function scrub(text) {
  return String(text)
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[token]")
    .replace(/(bearer|token|key|secret|password)([=: ]+)[^\s&"']+/gi, "$1$2[hidden]")
    .replace(/[A-Za-z0-9+/_-]{40,}/g, "[long value]")
    .slice(0, 600);
}

function create(dir) {
  const file = path.join(dir, "parity.log");
  let queue = [];
  let timer = null;
  const flush = () => {
    timer = null;
    const lines = queue.join("");
    queue = [];
    fs.mkdir(dir, { recursive: true }, () => {
      fs.stat(file, (_e, st) => {
        const write = () => fs.appendFile(file, lines, () => {});
        if (!st || st.size < MAX) { write(); return; }
        fs.readFile(file, "utf8", (err, text) => {
          if (err) { write(); return; }
          fs.writeFile(file, text.slice(Math.floor(text.length / 2)), () => write());
        });
      });
    });
  };
  return {
    file,
    write(msg) {
      queue.push(`${new Date().toISOString()} ${scrub(msg)}\n`);
      if (!timer) timer = setTimeout(flush, 500);
    },
  };
}

module.exports = { create, scrub };
