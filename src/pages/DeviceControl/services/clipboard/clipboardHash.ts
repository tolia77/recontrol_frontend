// Browser-side twin of desktop ClipboardSyncService.ComputeHash16:
// SHA-256 over UTF-8 bytes -> first 8 bytes -> 16-char lowercase hex.
// Output is byte-equal to the desktop helper for identical input bytes.
//
// Parameter is `Uint8Array<ArrayBuffer>` (not `Uint8Array<ArrayBufferLike>`) to
// match the strict `BufferSource` shape that `crypto.subtle.digest` expects in
// TS 5.7+ DOM lib types; `new TextEncoder().encode(...)` already returns this.
export async function hashHex16(
  utf8: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", utf8);
  const view = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < 8; i += 1) {
    hex += view[i].toString(16).padStart(2, "0");
  }
  return hex;
}
