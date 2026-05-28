import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { scenarios as scenariosEn } from "../../../../../locales/en/scenarios";
import PolicyPreviewModal, {
  formatShellPreview,
  type PolicyPreviewModalCommandStep,
} from "../PolicyPreviewModal";
import type {
  PolicyPreviewResponse,
  PolicyPreviewStep,
} from "../../../../../services/backend/scenariosService";

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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStep(
  step_index: number,
  decision: "allow" | "needs_confirm" | "deny",
  overrides: Partial<PolicyPreviewStep> = {},
): PolicyPreviewStep {
  return {
    step_index,
    id: `step-${step_index}`,
    decision,
    reason: `mock-reason-${step_index}`,
    resolved_binary: `/usr/bin/mock-${step_index}`,
    ...overrides,
  };
}

function makeCommandStep(
  id: string,
  binary: string,
  args: string[] = [],
  cwd = "/",
  description?: string,
): PolicyPreviewModalCommandStep {
  return { id, binary, args, cwd, description };
}

function makeResponse(
  steps: PolicyPreviewStep[],
  overrides: Partial<PolicyPreviewResponse> = {},
): PolicyPreviewResponse {
  return {
    steps,
    current_policy_version: "v9",
    policy_drift: false,
    ...overrides,
  };
}

const defaultProps = {
  open: true,
  loading: false,
  scenarioName: "Diagnose nginx",
  deviceName: "device-12",
  deviceId: "dev-abc",
  canChangeDevice: false,
  onApprove: () => {},
  onCancel: () => {},
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PolicyPreviewModal", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(
      <PolicyPreviewModal
        {...defaultProps}
        open={false}
        response={null}
        commandSteps={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the loading spinner when loading and response is null", () => {
    render(
      <PolicyPreviewModal
        {...defaultProps}
        loading
        response={null}
        commandSteps={[]}
      />,
    );
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders the error string when error is set", () => {
    render(
      <PolicyPreviewModal
        {...defaultProps}
        response={null}
        commandSteps={[]}
        error="boom"
      />,
    );
    expect(screen.getByTestId("policy-preview-error").textContent).toContain(
      "boom",
    );
  });

  it("renders one row per step in step_index order", () => {
    const response = makeResponse([
      makeStep(0, "allow"),
      makeStep(1, "allow"),
      makeStep(2, "allow"),
    ]);
    const commandSteps = [
      makeCommandStep("step-0", "ls", ["-la"]),
      makeCommandStep("step-1", "echo", ["hi"]),
      makeCommandStep("step-2", "whoami"),
    ];
    render(
      <PolicyPreviewModal
        {...defaultProps}
        response={response}
        commandSteps={commandSteps}
      />,
    );
    const rows = screen.getAllByTestId(/^policy-preview-step-/);
    expect(rows).toHaveLength(3);
    expect(rows[0].getAttribute("data-testid")).toBe("policy-preview-step-0");
    expect(rows[1].getAttribute("data-testid")).toBe("policy-preview-step-1");
    expect(rows[2].getAttribute("data-testid")).toBe("policy-preview-step-2");
  });

  it("formats the shell-like preview with quoted args containing whitespace", () => {
    expect(formatShellPreview("rm", ["-rf", "a b"])).toBe('rm -rf "a b"');
    expect(formatShellPreview("echo", ["plain"])).toBe("echo plain");
    expect(formatShellPreview("say", ['quote"inside'])).toBe(
      'say quote"inside',
    );
    expect(formatShellPreview("say", ['has space "quote"'])).toBe(
      'say "has space \\"quote\\""',
    );
    expect(formatShellPreview("ls", [])).toBe("ls");
  });

  it("shows the verdict badge with the correct color class per decision", () => {
    const response = makeResponse([
      makeStep(0, "allow"),
      makeStep(1, "needs_confirm"),
      makeStep(2, "deny"),
    ]);
    const commandSteps = [
      makeCommandStep("step-0", "ls"),
      makeCommandStep("step-1", "apt"),
      makeCommandStep("step-2", "shutdown"),
    ];
    render(
      <PolicyPreviewModal
        {...defaultProps}
        response={response}
        commandSteps={commandSteps}
      />,
    );
    const allow = screen.getByTestId("policy-preview-verdict-0");
    const needsConfirm = screen.getByTestId("policy-preview-verdict-1");
    const deny = screen.getByTestId("policy-preview-verdict-2");
    expect(allow.className).toContain("green");
    expect(needsConfirm.className).toContain("amber");
    expect(deny.className).toContain("red");
  });

  it("renders the deny banner with one line per denied step, capped at 3 with overflow", () => {
    const denySteps = [
      makeStep(0, "deny", { reason: "r0" }),
      makeStep(1, "deny", { reason: "r1" }),
      makeStep(2, "deny", { reason: "r2" }),
      makeStep(3, "deny", { reason: "r3" }),
      makeStep(4, "deny", { reason: "r4" }),
    ];
    const commandSteps = denySteps.map((s) =>
      makeCommandStep(s.id, "rm", ["-rf", "/"]),
    );
    render(
      <PolicyPreviewModal
        {...defaultProps}
        response={makeResponse(denySteps)}
        commandSteps={commandSteps}
      />,
    );
    const banner = screen.getByTestId("policy-preview-deny-banner");
    const lines = within(banner).getAllByTestId(/^policy-preview-deny-line-/);
    expect(lines).toHaveLength(3);
    expect(
      within(banner).getByTestId("policy-preview-deny-overflow").textContent,
    ).toContain("2");
  });

  it("does NOT render the [Run all] button when any step has decision=deny", () => {
    const response = makeResponse([makeStep(0, "allow"), makeStep(1, "deny")]);
    const commandSteps = [
      makeCommandStep("step-0", "ls"),
      makeCommandStep("step-1", "rm", ["-rf", "/tmp/x"]),
    ];
    render(
      <PolicyPreviewModal
        {...defaultProps}
        response={response}
        commandSteps={commandSteps}
      />,
    );
    expect(screen.queryByTestId("policy-preview-run-all")).toBeNull();
    expect(screen.getByTestId("policy-preview-dismiss")).toBeDefined();
  });

  it("auto-expands denied steps into the execve structured view without click", () => {
    const response = makeResponse([makeStep(0, "allow"), makeStep(1, "deny")]);
    const commandSteps = [
      makeCommandStep("step-0", "ls"),
      makeCommandStep("step-1", "rm", ["-rf", "/tmp/x"], "/var"),
    ];
    render(
      <PolicyPreviewModal
        {...defaultProps}
        response={response}
        commandSteps={commandSteps}
      />,
    );
    expect(screen.getByTestId("policy-preview-structured-1")).toBeDefined();
    expect(screen.queryByTestId("policy-preview-structured-0")).toBeNull();
  });

  it("renders the drift banner when policy_drift=true", () => {
    const response = makeResponse([makeStep(0, "allow")], {
      policy_drift: true,
    });
    const commandSteps = [makeCommandStep("step-0", "ls")];
    render(
      <PolicyPreviewModal
        {...defaultProps}
        response={response}
        commandSteps={commandSteps}
      />,
    );
    const drift = screen.getByTestId("policy-preview-drift-banner");
    expect(drift.textContent).toContain("Policy has tightened");
  });

  it("flags irreversible-intent steps with border-l-4 border-error and amber Irreversible badge", () => {
    const response = makeResponse([makeStep(0, "allow")]);
    const commandSteps = [makeCommandStep("step-0", "rm", ["-rf", "/tmp/x"])];
    render(
      <PolicyPreviewModal
        {...defaultProps}
        response={response}
        commandSteps={commandSteps}
      />,
    );
    const row = screen.getByTestId("policy-preview-step-0");
    expect(row.className).toContain("border-l-4");
    expect(row.className).toContain("border-error");
    const badge = screen.getByTestId("policy-preview-irreversible-0");
    expect(badge.textContent?.toLowerCase()).toContain("irreversible");
  });

  it("toggles the expanded view for non-denied steps when [▾] is clicked", () => {
    const response = makeResponse([makeStep(0, "allow")]);
    const commandSteps = [makeCommandStep("step-0", "ls", ["-la"])];
    render(
      <PolicyPreviewModal
        {...defaultProps}
        response={response}
        commandSteps={commandSteps}
      />,
    );
    expect(screen.queryByTestId("policy-preview-structured-0")).toBeNull();
    fireEvent.click(screen.getByTestId("policy-preview-expand-0"));
    expect(screen.getByTestId("policy-preview-structured-0")).toBeDefined();
    fireEvent.click(screen.getByTestId("policy-preview-expand-0"));
    expect(screen.queryByTestId("policy-preview-structured-0")).toBeNull();
  });

  it("calls onApprove when [Run all] is clicked (no deny path)", () => {
    const onApprove = vi.fn();
    const response = makeResponse([makeStep(0, "allow"), makeStep(1, "allow")]);
    const commandSteps = [
      makeCommandStep("step-0", "ls"),
      makeCommandStep("step-1", "pwd"),
    ];
    render(
      <PolicyPreviewModal
        {...defaultProps}
        response={response}
        commandSteps={commandSteps}
        onApprove={onApprove}
      />,
    );
    fireEvent.click(screen.getByTestId("policy-preview-run-all"));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when [Dismiss] is clicked", () => {
    const onCancel = vi.fn();
    const response = makeResponse([makeStep(0, "allow")]);
    const commandSteps = [makeCommandStep("step-0", "ls")];
    render(
      <PolicyPreviewModal
        {...defaultProps}
        response={response}
        commandSteps={commandSteps}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId("policy-preview-dismiss"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the backdrop is clicked", () => {
    const onCancel = vi.fn();
    const response = makeResponse([makeStep(0, "allow")]);
    const commandSteps = [makeCommandStep("step-0", "ls")];
    render(
      <PolicyPreviewModal
        {...defaultProps}
        response={response}
        commandSteps={commandSteps}
        onCancel={onCancel}
      />,
    );
    fireEvent.mouseDown(screen.getByTestId("policy-preview-backdrop"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onCancel when clicking inside the card", () => {
    const onCancel = vi.fn();
    const response = makeResponse([makeStep(0, "allow")]);
    const commandSteps = [makeCommandStep("step-0", "ls")];
    render(
      <PolicyPreviewModal
        {...defaultProps}
        response={response}
        commandSteps={commandSteps}
        onCancel={onCancel}
      />,
    );
    fireEvent.mouseDown(screen.getByTestId("policy-preview-card"));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel on Escape key press", () => {
    const onCancel = vi.fn();
    const response = makeResponse([makeStep(0, "allow")]);
    const commandSteps = [makeCommandStep("step-0", "ls")];
    render(
      <PolicyPreviewModal
        {...defaultProps}
        response={response}
        commandSteps={commandSteps}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("renders the [Change device ▾] button only when canChangeDevice=true", () => {
    const response = makeResponse([makeStep(0, "allow")]);
    const commandSteps = [makeCommandStep("step-0", "ls")];
    const { rerender } = render(
      <PolicyPreviewModal
        {...defaultProps}
        response={response}
        commandSteps={commandSteps}
        canChangeDevice={false}
      />,
    );
    expect(screen.queryByTestId("policy-preview-change-device")).toBeNull();
    rerender(
      <PolicyPreviewModal
        {...defaultProps}
        response={response}
        commandSteps={commandSteps}
        canChangeDevice
        onChangeDevice={() => {}}
      />,
    );
    expect(screen.getByTestId("policy-preview-change-device")).toBeDefined();
  });
});
