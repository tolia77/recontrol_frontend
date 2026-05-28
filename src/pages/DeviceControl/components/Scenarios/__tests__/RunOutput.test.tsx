import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { scenarios as scenariosEn } from "../../../../../locales/en/scenarios";
import { RunOutput } from "../RunOutput";
import type { ToolRow } from "../../Assistant/transcriptReducer";

afterEach(() => cleanup());

beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next.use(initReactI18next).init({
      lng: "en",
      fallbackLng: "en",
      ns: ["scenarios"],
      defaultNS: "scenarios",
      resources: {
        en: { scenarios: scenariosEn },
      },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
  } else {
    await i18next.changeLanguage("en");
  }
});

function makeRow(overrides: Partial<ToolRow> = {}): ToolRow {
  return {
    kind: "tool",
    toolCallId: "tc-001",
    label: "List files",
    command: "ls",
    args: ["-la", "/tmp"],
    cwd: "/tmp",
    state: "done",
    startedAt: 1_000,
    endedAt: 2_000,
    result: { stdout: "output", exit: 0 },
    ...overrides,
  };
}

describe("RunOutput", () => {
  it("renders ToolCallCard verbatim for non-skipped rows", () => {
    const row = makeRow();
    render(<RunOutput row={row} />);
    // ToolCallCard renders with data-testid `tool-call-card-${toolCallId}`
    expect(screen.getByTestId(`tool-call-card-${row.toolCallId}`)).toBeTruthy();
    // No skipped wrapper present
    expect(
      screen.queryByTestId(`run-output-skipped-${row.toolCallId}`),
    ).toBeNull();
  });

  it("wraps in opacity-50 when skippedReason is set", () => {
    const row = makeRow({ toolCallId: "tc-skip" });
    render(<RunOutput row={row} skippedReason="previous_step_failed" />);
    const wrapper = screen.getByTestId(`run-output-skipped-${row.toolCallId}`);
    expect(wrapper).toBeTruthy();
    expect(wrapper.className).toContain("opacity-50");
    // Inner ToolCallCard still rendered
    expect(screen.getByTestId(`tool-call-card-${row.toolCallId}`)).toBeTruthy();
  });

  it("renders the skipped overlay label ⊘ + localized text", () => {
    const row = makeRow({ toolCallId: "tc-skip-2" });
    render(<RunOutput row={row} skippedReason="user_stopped" />);
    const wrapper = screen.getByTestId(`run-output-skipped-${row.toolCallId}`);
    // EN locale: scenarios.history.stepStatus.skipped = 'Skipped'
    expect(wrapper.textContent).toContain("⊘");
    expect(wrapper.textContent).toContain("Skipped");
  });

  it("does NOT modify the row object passed in", () => {
    const row = makeRow({ toolCallId: "tc-frozen" });
    const snapshot = JSON.parse(JSON.stringify(row));
    render(<RunOutput row={row} skippedReason="previous_step_failed" />);
    expect(row).toEqual(snapshot);
  });

  it("empty-string skippedReason is treated as absent (no wrapper)", () => {
    const row = makeRow({ toolCallId: "tc-empty" });
    render(<RunOutput row={row} skippedReason="" />);
    expect(
      screen.queryByTestId(`run-output-skipped-${row.toolCallId}`),
    ).toBeNull();
    expect(screen.getByTestId(`tool-call-card-${row.toolCallId}`)).toBeTruthy();
  });
});
