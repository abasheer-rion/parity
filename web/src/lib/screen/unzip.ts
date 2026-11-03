// A small zip reader for the batch screen (DEC-0087), so a firm can drop one zip of per-account
// trade files. It reads the central directory and inflates each entry with the browser's own
// DecompressionStream("deflate-raw"), so no library is needed and nothing leaves the page.
// Stored (method 0) and deflated (method 8) entries only; encrypted or zip64 archives are
// refused with a plain message.

export class ZipError extends Error {}

export interface ZipEntry { name: string; bytes: Uint8Array }

export const ZIP_LIMITS = { files: 5_000, bytes: 200 * 1024 * 1024 };

export const isZip = (b: Uint8Array) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Every file in the archive (folders, hidden files and macOS extras left out). */
export async function readZip(buf: Uint8Array): Promise<ZipEntry[]> {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // The end of central directory record is in the last 64 KB plus 22 bytes.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new ZipError("This zip file looks damaged: its index was not found.");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  if (count === 0xffff || p === 0xffffffff) throw new ZipError("This zip is too large for the browser reader (zip64). Split it into smaller zips.");
  if (count > ZIP_LIMITS.files) throw new ZipError(`The zip has ${count.toLocaleString("en-US")} files. The screen reads up to ${ZIP_LIMITS.files.toLocaleString("en-US")} at once.`);
  const out: ZipEntry[] = [];
  let total = 0;
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || v.getUint32(p, true) !== 0x02014b50) throw new ZipError("This zip file looks damaged.");
    const flags = v.getUint16(p + 8, true);
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const usize = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    const base = name.split("/").pop() ?? "";
    if (name.endsWith("/") || name.startsWith("__MACOSX/") || base.startsWith(".") || !base) continue;
    if (flags & 1) throw new ZipError("This zip is password protected. Make one without a password.");
    total += usize;
    if (total > ZIP_LIMITS.bytes) throw new ZipError("The files in this zip add up to more than 200 MB. Split it into smaller zips.");
    if (v.getUint32(local, true) !== 0x04034b50) throw new ZipError("This zip file looks damaged.");
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const data = buf.subarray(start, start + csize);
    if (method === 0) out.push({ name, bytes: data.slice() });
    else if (method === 8) out.push({ name, bytes: await inflate(data) });
    else throw new ZipError(`"${base}" uses a compression this reader does not know. Save the zip with standard (deflate) compression.`);
  }
  return out;
}
