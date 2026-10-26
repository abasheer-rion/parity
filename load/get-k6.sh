#!/usr/bin/env bash
# Downloads the official k6 release into tools/k6/ (git-ignored), checks it against the
# release's published SHA-256 list, and unpacks it there. No global install.
# Usage: load/get-k6.sh            (pinned version below)
#        K6_VERSION=v2.3.0 load/get-k6.sh
set -euo pipefail
K6_VERSION="${K6_VERSION:-v2.3.0}"
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/tools/k6"
bin="$dest/k6"

if [ -x "$bin" ] && "$bin" version 2>/dev/null | grep -q "${K6_VERSION#v}"; then
  echo "k6 ${K6_VERSION} already in tools/k6"; exit 0
fi

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) plat=macos-arm64; ext=zip ;;
  Darwin-x86_64) plat=macos-amd64; ext=zip ;;
  Linux-x86_64) plat=linux-amd64; ext=tar.gz ;;
  Linux-aarch64|Linux-arm64) plat=linux-arm64; ext=tar.gz ;;
  *) echo "No k6 build for $(uname -s)-$(uname -m)"; exit 1 ;;
esac

name="k6-${K6_VERSION}-${plat}"
base="https://github.com/grafana/k6/releases/download/${K6_VERSION}"
# Unpack in an empty folder: downloads are untrusted until the checksum matches.
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
curl -fsSL -o "$work/$name.$ext" "$base/$name.$ext"
curl -fsSL -o "$work/checksums.txt" "$base/k6-${K6_VERSION}-checksums.txt"
want="$(grep " $name.$ext\$" "$work/checksums.txt" | awk '{print $1}')"
got="$(shasum -a 256 "$work/$name.$ext" | awk '{print $1}')"
if [ -z "$want" ] || [ "$want" != "$got" ]; then
  echo "Checksum mismatch for $name.$ext (want ${want:-none}, got $got)"; exit 1
fi
mkdir -p "$work/x"
if [ "$ext" = zip ]; then unzip -q "$work/$name.$ext" -d "$work/x"; else tar -xzf "$work/$name.$ext" -C "$work/x"; fi
mkdir -p "$dest"
install -m 755 "$work/x/$name/k6" "$bin"
echo "k6 ${K6_VERSION} checked (sha256 $got) and put in tools/k6/k6"
