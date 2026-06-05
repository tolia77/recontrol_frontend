import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AssistantHeader from "./AssistantHeader";
import type { PanelStatus } from "./transcriptReducer";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function renderHeader(status: PanelStatus, onNewChat = vi.fn()) {
  render(
    <AssistantHeader
      status={status}
      stepCount={0}
      onStop={() => {}}
      onCopy={() => {}}
      onNewChat={onNewChat}
    />,
  );
  return onNewChat;
}

function newChatButton(): HTMLButtonElement {
  return screen.getByTestId("assistant-new-chat-button") as HTMLButtonElement;
}

describe("AssistantHeader New chat button", () => {
  it("renders enabled when idle and fires onNewChat on click", () => {
    const onNewChat = renderHeader("idle");
    const btn = newChatButton();
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it("is disabled while streaming", () => {
    renderHeader("streaming");
    expect(newChatButton().disabled).toBe(true);
  });

  it("is disabled while awaiting confirmation", () => {
    renderHeader("awaiting_confirmation");
    expect(newChatButton().disabled).toBe(true);
  });

  it("is enabled after an error (lets the user start over)", () => {
    renderHeader("error");
    expect(newChatButton().disabled).toBe(false);
  });

  it("is enabled when quota is halted (lets the user clear the transcript)", () => {
    renderHeader("halted_quota");
    expect(newChatButton().disabled).toBe(false);
  });
});
