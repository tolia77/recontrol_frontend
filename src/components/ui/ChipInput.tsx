import {
  useCallback,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

export interface ChipInputProps {
  value: string[];
  onChange: (chips: string[]) => void;
  placeholder?: string;
  /** Cap on total chips (default 32). */
  maxChips?: number;
  /** Cap on per-chip length (default 1024). */
  maxChipLength?: number;
  disabled?: boolean;
  "aria-label"?: string;
  "data-testid"?: string;
  /** Notifies when a chip is rejected because of a cap. */
  onChipOverflow?: (reason: "count" | "length") => void;
}

const DEFAULT_MAX_CHIPS = 32;
const DEFAULT_MAX_CHIP_LENGTH = 1024;

export default function ChipInput({
  value,
  onChange,
  placeholder,
  maxChips = DEFAULT_MAX_CHIPS,
  maxChipLength = DEFAULT_MAX_CHIP_LENGTH,
  disabled = false,
  onChipOverflow,
  ...aria
}: ChipInputProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commitDraft = useCallback(
    (raw: string): boolean => {
      const trimmed = raw.trim();
      if (!trimmed) return false;
      if (trimmed.length > maxChipLength) {
        onChipOverflow?.("length");
        return false;
      }
      if (value.length >= maxChips) {
        onChipOverflow?.("count");
        return false;
      }
      onChange([...value, trimmed]);
      return true;
    },
    [value, onChange, maxChips, maxChipLength, onChipOverflow],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === "Tab") {
      if (draft.trim()) {
        e.preventDefault();
        if (commitDraft(draft)) setDraft("");
      }
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      e.preventDefault();
      onChange(value.slice(0, -1));
    } else if (e.key === ",") {
      // Commit on comma too (common chip-input convention).
      if (draft.trim()) {
        e.preventDefault();
        if (commitDraft(draft)) setDraft("");
      }
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const text = e.clipboardData.getData("text");
    if (!text) return;
    // Split on whitespace, no quote awareness.
    const tokens = text.split(/\s+/).filter((t) => t.length > 0);
    if (tokens.length <= 1) return; // single token → let default paste fill the input
    e.preventDefault();
    let remaining = maxChips - value.length;
    const accepted: string[] = [];
    for (const t of tokens) {
      if (remaining <= 0) {
        onChipOverflow?.("count");
        break;
      }
      if (t.length > maxChipLength) {
        onChipOverflow?.("length");
        continue;
      }
      accepted.push(t);
      remaining -= 1;
    }
    if (accepted.length) onChange([...value, ...accepted]);
  };

  const removeChip = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
    inputRef.current?.focus();
  };

  return (
    <div
      className="border-border focus-within:border-primary flex flex-wrap items-center gap-1 rounded-sm border px-2 py-1"
      data-testid={aria["data-testid"]}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((chip, i) => (
        <span
          key={`${chip}-${i}`}
          className="inline-flex items-center gap-1 rounded-sm bg-surface-muted px-2 py-0.5 text-body"
        >
          <span className="break-all">{chip}</span>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              removeChip(i);
            }}
            aria-label={`Remove ${chip}`}
            disabled={disabled}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder={value.length === 0 ? placeholder : ""}
        disabled={disabled}
        aria-label={aria["aria-label"]}
        className="min-w-[6ch] flex-1 border-none bg-transparent text-sm outline-none"
      />
    </div>
  );
}
