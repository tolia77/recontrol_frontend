export const NON_TEXT_THRESHOLD = 0.2;

export function normalizeClipboard(raw: string): {
  text: string;
  refused: boolean;
} {
  // Step 1 (D-13): strip embedded NUL bytes
  const stripped = raw.replace(/\0/g, "");
  // Step 2 (D-13, CLIP-07): CRLF then lone CR -> LF (order is load-bearing)
  const lf = stripped.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Step 3 (D-13, CLIP-08): >20% control chars (excluding \t \n \r) -> refuse.
  // for-of iterates by code point (matches C# char iteration on the BMP);
  // surrogate halves of non-BMP code points are not in the Cc category, so the
  // refusal count is symmetric with C#'s GetUnicodeCategory(char) walk.
  if (lf.length === 0) return { text: lf, refused: false };
  let control = 0;
  for (const ch of lf) {
    if (ch === "\t" || ch === "\n" || ch === "\r") continue;
    const code = ch.codePointAt(0)!;
    if (code <= 0x1f || code === 0x7f || (code >= 0x80 && code <= 0x9f))
      control += 1;
  }
  return { text: lf, refused: control / lf.length > NON_TEXT_THRESHOLD };
}
