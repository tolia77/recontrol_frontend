/**
 * Frontend mirror of `recontrol_backend/app/services/irreversible_intent_catalog.rb`.
 *
 * Catastrophic-only catalog — refined from the original broader list to cover
 * only operations that are unrecoverable and system-wide destructive (e.g.
 * wiping a block device, deleting root-adjacent paths recursively). Mirrors the
 * refined backend `IrreversibleIntentCatalog` exactly.
 *
 * The `IRREVERSIBLE_IDS` tuple MUST stay in sync with the backend
 * `IrreversibleIntentCatalog.ids` method (same strings, same order); the parity
 * test in `__tests__/irreversibleIntentCatalog.test.ts` asserts the literal tuple.
 *
 * Used by its sibling `PolicyPreviewModal.tsx` (Plan 22.07) to render the red
 * left-border + "Irreversible" badge per POLICY-03 / D-22-06 without a server
 * round-trip. Colocated with its sole consumer (a peer of `exitCodeGlyphs.ts`).
 *
 * Pattern shape mirrors the backend:
 *   - `id`:         stable identifier (mirrored to backend `:id`)
 *   - `binaryRegex`: anchored match against the binary basename
 *   - `argMatch`:   optional — at least one arg must match
 *   - `arg2Match`:  optional — at least one (possibly the same) arg must also match
 *
 * `argMatch` + `arg2Match` are commutative on the argv array, so
 * `chmod -R 777 /etc` and `chmod 777 -R /etc` both flag (T-22-04 mitigation).
 *
 * The backend remains the runtime source of truth (T-22-05 mitigation); the
 * frontend mirror is presentational defense-in-depth.
 */

export const IRREVERSIBLE_IDS = [
  "rm_rf_root_adjacent",
  "dd_of_dev",
  "mkfs",
  "find_delete",
  "chmod_777_recursive",
] as const;

export type IrreversibleId = (typeof IRREVERSIBLE_IDS)[number];

export interface IrreversiblePattern {
  id: IrreversibleId;
  binaryRegex: RegExp;
  argMatch?: RegExp;
  arg2Match?: RegExp;
}

export interface IrreversibleCheckInput {
  binary: string;
  args: readonly string[];
}

export const IRREVERSIBLE_PATTERNS: readonly IrreversiblePattern[] = [
  {
    id: "rm_rf_root_adjacent",
    binaryRegex: /^rm$/,
    argMatch: /^-rf$|^-fr$|^-r$/,
    arg2Match: /^(\/|\/home|~|\$HOME)\/?$|^(\/etc|\/var|\/usr|\/boot|\/root)(\/|$)/,
  },
  { id: "dd_of_dev", binaryRegex: /^dd$/, argMatch: /^of=\/dev\// },
  { id: "mkfs", binaryRegex: /^mkfs(\..+)?$/ },
  { id: "find_delete", binaryRegex: /^find$/, argMatch: /^-delete$/ },
  {
    id: "chmod_777_recursive",
    binaryRegex: /^chmod$/,
    argMatch: /^-R$/,
    arg2Match: /^777$/,
  },
] as const;

/**
 * Returns true iff the (binary, args) shape matches one of the catalog
 * patterns. `binary` is matched as-is (no path stripping — callers are expected
 * to pass the basename, matching how the backend `CommandPolicy.evaluate`
 * treats the binary kwarg).
 */
export function isIrreversible({
  binary,
  args,
}: IrreversibleCheckInput): boolean {
  if (!binary) return false;
  return IRREVERSIBLE_PATTERNS.some((pattern) => {
    if (!pattern.binaryRegex.test(binary)) return false;
    if (!pattern.argMatch) return true;
    if (!args.some((a) => pattern.argMatch!.test(a))) return false;
    if (!pattern.arg2Match) return true;
    return args.some((a) => pattern.arg2Match!.test(a));
  });
}
