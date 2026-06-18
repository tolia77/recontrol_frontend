/**
 * Path helpers shared across the File Manager panel and later transfer code.
 *
 * The desktop returns paths verbatim (e.g. `C:\Users\me\Docs` on Windows or
 * `/home/me/Documents` on POSIX). These helpers stay fully string-level; they
 * do NOT touch the filesystem. The canonical shape is `(parts, sep)` for
 * joinPath -- consumed by both the breadcrumb caller and the move/copy
 * destination builder.
 */

export type PathSeparator = "/" | "\\";

/**
 * Detect the path separator from a root path. Windows roots look like
 * `C:\foo` (drive letter + colon + backslash or forward slash) or contain a
 * backslash anywhere; otherwise POSIX.
 */
export function detectSeparator(rootPath: string): PathSeparator {
  if (/^[A-Za-z]:[\\/]/.test(rootPath)) return "\\";
  if (rootPath.includes("\\")) return "\\";
  return "/";
}

/**
 * Split a path into segments using the given separator. Empty segments are
 * filtered. On Windows, the leading drive letter is preserved as its own
 * segment (e.g. `C:\Users\me` -> `['C:', 'Users', 'me']`). On POSIX, the
 * leading `/` is absorbed so `/home/me` -> `['home', 'me']`.
 */
export function splitIntoSegments(path: string, sep: PathSeparator): string[] {
  if (!path) return [];
  // On Windows, handle `C:\...` or `C:/...` by keeping `C:` as the first segment.
  if (sep === "\\") {
    const m = /^([A-Za-z]:)([\\/]?)(.*)$/.exec(path);
    if (m) {
      const drive = m[1];
      const rest = m[3];
      const restSegments = rest.split(/[\\/]/).filter((s) => s.length > 0);
      return [drive, ...restSegments];
    }
    return path.split(/[\\/]/).filter((s) => s.length > 0);
  }
  // POSIX
  return path.split("/").filter((s) => s.length > 0);
}

/**
 * Join an array of segments with the given separator.
 *
 * - Canonical signature: `(parts: string[], sep: PathSeparator)`.
 * - On Windows, when the first segment looks like a drive letter (`C:`), the
 *   drive is kept at index 0 and the separator glues it to the remainder
 *   (`['C:', 'Users'] + '\\' -> 'C:\\Users'`).
 * - On POSIX, if the first segment is empty string, a leading `/` is
 *   preserved (`['', 'home'] + '/' -> '/home'`); otherwise segments are joined
 *   as-is and the caller is responsible for prepending `/` if the path is
 *   absolute. For the typical sidebar-root/breadcrumb case the caller receives
 *   roots from `detectSeparator` and should pass the segments from
 *   `splitIntoSegments` plus a leading-empty segment on POSIX, OR rely on the
 *   helper `ensureLeadingSlash` semantics described in the breadcrumb wiring.
 *
 * NOTE: This helper deliberately does NOT collapse drive letters or remove
 * duplicate separators -- callers pass clean parts.
 */
export function joinPath(parts: string[], sep: PathSeparator): string {
  if (parts.length === 0) return "";
  if (sep === "\\") {
    // Windows: if the first part is a drive letter (e.g. `C:`), glue with `\`.
    const [head, ...tail] = parts;
    if (/^[A-Za-z]:$/.test(head)) {
      if (tail.length === 0) return `${head}\\`;
      return `${head}\\${tail.join("\\")}`;
    }
    return parts.join("\\");
  }
  // POSIX: if first part is '' treat as absolute root.
  if (parts[0] === "") {
    const tail = parts.slice(1).filter((s) => s.length > 0);
    return `/${tail.join("/")}`;
  }
  return parts.join("/");
}

/**
 * Return the parent of `path`, or null if already at the root for its
 * platform. "Root" means a bare drive letter on Windows (`C:\`) or `/` on
 * POSIX.
 */
export function parentPath(path: string, sep: PathSeparator): string | null {
  const segments = splitIntoSegments(path, sep);
  if (segments.length === 0) return null;
  if (sep === "\\") {
    // Windows: if only a drive letter remains, we're at the root.
    if (segments.length === 1 && /^[A-Za-z]:$/.test(segments[0])) {
      return null;
    }
    const parent = segments.slice(0, -1);
    return joinPath(parent, "\\");
  }
  // POSIX
  if (segments.length === 1) {
    return "/";
  }
  // Preserve leading slash for absolute POSIX paths.
  const parent = segments.slice(0, -1);
  return joinPath(["", ...parent], "/");
}

/**
 * Is `candidate` the same as, or under, `ancestorRoot`? Used by the sidebar to
 * highlight the active root when the listing is inside it.
 */
export function isAncestor(ancestorRoot: string, candidate: string): boolean {
  if (!ancestorRoot || !candidate) return false;
  if (candidate === ancestorRoot) return true;
  const sep = detectSeparator(ancestorRoot);
  // Normalize trailing separators on the ancestor so we match exactly one
  // separator boundary, not a suffix match.
  const rootTrimmed = ancestorRoot.replace(/[\\/]+$/, "");
  const separatorChar = sep;
  return (
    candidate.startsWith(rootTrimmed + separatorChar) ||
    candidate.startsWith(rootTrimmed + (sep === "\\" ? "/" : "\\"))
  );
}
