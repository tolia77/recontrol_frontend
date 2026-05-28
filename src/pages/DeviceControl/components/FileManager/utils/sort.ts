import type { FileEntry } from "src/pages/DeviceControl/services/files/filesProtocol.generated";
import type { SortState } from "src/pages/DeviceControl/components/FileManager/types";
import { classify } from "./fileTypes";

/**
 * Folders-first comparator. Within each bucket (directories first, then
 * files), compare by the selected column. Name uses `localeCompare` with the
 * default locale. Size uses numeric diff. Modified compares epoch ms. Type
 * compares `classify(name)` alphabetically with name as tiebreaker.
 *
 * Folders ALWAYS precede files regardless of sort direction -- this is
 * Windows Explorer behavior and CONTEXT-locked for Phase 10.
 */
export function compareEntries(
  a: FileEntry,
  b: FileEntry,
  sort: SortState,
): number {
  if (a.isDirectory !== b.isDirectory) {
    return a.isDirectory ? -1 : 1;
  }
  const dir = sort.direction === "asc" ? 1 : -1;
  switch (sort.column) {
    case "name":
      return a.name.localeCompare(b.name) * dir;
    case "size": {
      const diff = (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0);
      if (diff !== 0) return diff * dir;
      return a.name.localeCompare(b.name) * dir;
    }
    case "modified": {
      const at = new Date(a.modifiedUtc).getTime();
      const bt = new Date(b.modifiedUtc).getTime();
      const safeA = Number.isFinite(at) ? at : 0;
      const safeB = Number.isFinite(bt) ? bt : 0;
      if (safeA !== safeB) return (safeA - safeB) * dir;
      return a.name.localeCompare(b.name) * dir;
    }
    case "type": {
      const byType = classify(a.name).localeCompare(classify(b.name)) * dir;
      if (byType !== 0) return byType;
      return a.name.localeCompare(b.name);
    }
  }
}
