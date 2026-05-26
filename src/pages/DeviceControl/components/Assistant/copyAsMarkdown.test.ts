import { describe, it, expect } from "vitest";
import { copyAsMarkdown } from "./copyAsMarkdown";
import type { Row } from "./transcriptReducer";

describe("copyAsMarkdown", () => {
  it("serializes operator messages as blockquotes", () => {
    const rows: Row[] = [
      { kind: "operator", id: "o1", text: "list files", ts: 0 },
    ];
    expect(copyAsMarkdown(rows)).toBe("> list files");
  });

  it("passes assistant markdown through unchanged", () => {
    const rows: Row[] = [
      {
        kind: "assistant",
        id: "a1",
        markdown: "**Hello** world",
        isStreaming: false,
      },
    ];
    expect(copyAsMarkdown(rows)).toBe("**Hello** world");
  });

  it("serializes tool rows with command, status, elapsed time, and stdout", () => {
    const rows: Row[] = [
      {
        kind: "tool",
        toolCallId: "t1",
        label: "Run command",
        command: "ls",
        args: ["-la"],
        state: "done",
        startedAt: 1000,
        endedAt: 2200,
        result: { stdout: "file1\nfile2", exit: 0 },
      },
    ];
    const md = copyAsMarkdown(rows);
    expect(md).toContain("$ ls -la");
    expect(md).toContain("file1");
    expect(md).toContain("file2");
    expect(md).toContain("1.2s");
    expect(md).toContain("[done]");
    expect(md).toContain("```bash");
  });

  it("serializes a denied tool row with the state label but no stdout", () => {
    const rows: Row[] = [
      {
        kind: "tool",
        toolCallId: "t1",
        label: "rm -rf /",
        command: "rm",
        args: ["-rf", "/"],
        state: "denied",
        startedAt: 1000,
        endedAt: 1500,
        result: { error: "denied_by_operator" },
      },
    ];
    const md = copyAsMarkdown(rows);
    expect(md).toContain("[denied]");
    expect(md).toContain("$ rm -rf /");
    expect(md).toContain("# error: denied_by_operator");
  });

  it("emits stderr in a separate section when present", () => {
    const rows: Row[] = [
      {
        kind: "tool",
        toolCallId: "t1",
        label: "failing call",
        command: "cat",
        args: ["/no/such/file"],
        state: "error",
        startedAt: 0,
        endedAt: 100,
        result: {
          stderr: "cat: /no/such/file: No such file or directory",
          exit: 1,
        },
      },
    ];
    const md = copyAsMarkdown(rows);
    expect(md).toContain("# stderr:");
    expect(md).toContain("No such file or directory");
  });

  it("omits elapsed time when the row has not finished yet", () => {
    const rows: Row[] = [
      {
        kind: "tool",
        toolCallId: "t1",
        label: "running",
        command: "sleep",
        args: ["5"],
        state: "running",
        startedAt: 1000,
      },
    ];
    const md = copyAsMarkdown(rows);
    expect(md).toContain("[running]");
    expect(md).not.toMatch(/ran in /);
  });

  it("separates rows with a blank line", () => {
    const rows: Row[] = [
      { kind: "operator", id: "o1", text: "q", ts: 0 },
      { kind: "assistant", id: "a1", markdown: "a", isStreaming: false },
    ];
    expect(copyAsMarkdown(rows)).toBe("> q\n\na");
  });

  it("escapes multi-line operator text into a multi-line blockquote", () => {
    const rows: Row[] = [
      { kind: "operator", id: "o1", text: "line1\nline2", ts: 0 },
    ];
    expect(copyAsMarkdown(rows)).toBe("> line1\n> line2");
  });

  it("returns an empty string for an empty transcript", () => {
    expect(copyAsMarkdown([])).toBe("");
  });

  it("preserves transcript order across mixed row kinds", () => {
    const rows: Row[] = [
      { kind: "operator", id: "o1", text: "check uptime", ts: 0 },
      {
        kind: "assistant",
        id: "a1",
        markdown: "Sure, running now.",
        isStreaming: false,
      },
      {
        kind: "tool",
        toolCallId: "t1",
        label: "uptime",
        command: "uptime",
        args: [],
        state: "done",
        startedAt: 0,
        endedAt: 1000,
        result: { stdout: "12:34 up 1 day", exit: 0 },
      },
    ];
    const md = copyAsMarkdown(rows);
    const operatorIdx = md.indexOf("> check uptime");
    const assistantIdx = md.indexOf("Sure, running now.");
    const toolIdx = md.indexOf("$ uptime");
    expect(operatorIdx).toBeGreaterThanOrEqual(0);
    expect(assistantIdx).toBeGreaterThan(operatorIdx);
    expect(toolIdx).toBeGreaterThan(assistantIdx);
  });
});
