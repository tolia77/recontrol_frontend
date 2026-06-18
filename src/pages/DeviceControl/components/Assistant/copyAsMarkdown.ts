import type { Row, ToolRow } from "./transcriptReducer";

/**
 * Serialize a list of transcript rows into a single Markdown string.
 *
 * Output: operator messages → ">" blockquote; assistant messages → markdown
 * pass-through; tool cards → fenced bash code block with the shell-style
 * command line, status badge, and stdout (and stderr / error if present).
 * Rows are emitted in transcript order separated by a blank line.
 *
 * Pure function: no DOM, no side effects, deterministic for any given Row[].
 *
 * Notes:
 *   - ANSI codes have already been stripped by the backend, so this
 *     serializer does not strip again.
 *   - The streaming caret element from AssistantMessage is purely visual and
 *     never lands in `row.markdown`; the serializer does not need to filter it.
 *   - Tool args are joined as space-delimited strings rather than rendered as
 *     JSON; this matches the on-screen `$ <command> <args>` shape and is
 *     more readable when pasted into a chat / issue tracker.
 */
export function copyAsMarkdown(rows: Row[]): string {
  const parts: string[] = [];
  for (const row of rows) {
    if (row.kind === "operator") {
      parts.push(`> ${row.text.replace(/\n/g, "\n> ")}`);
    } else if (row.kind === "assistant") {
      parts.push(row.markdown);
    } else if (row.kind === "tool") {
      parts.push(serializeToolRow(row));
    }
  }
  return parts.join("\n\n");
}

function serializeToolRow(row: ToolRow): string {
  const argsText = row.args.map((a) => String(a)).join(" ");
  const cmdLine = `$ ${row.command}${argsText ? ` ${argsText}` : ""}`;
  const elapsed =
    row.endedAt !== undefined
      ? ` (ran in ${((row.endedAt - row.startedAt) / 1000).toFixed(1)}s)`
      : "";
  const header = `**[${row.state}]**${elapsed}`;

  const lines: string[] = [header, "```bash", cmdLine];
  const stdout = row.result?.stdout?.trim();
  if (stdout) {
    lines.push("");
    lines.push(stdout);
  }
  const stderr = row.result?.stderr?.trim();
  if (stderr) {
    lines.push("");
    lines.push(`# stderr:\n${stderr}`);
  }
  if (row.result?.error) {
    lines.push("");
    lines.push(`# error: ${row.result.error}`);
  }
  lines.push("```");
  return lines.join("\n");
}
