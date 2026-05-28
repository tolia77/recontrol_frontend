import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "src/components/ui";

export const ManualKeyboardControls: React.FC<{
  disabled: boolean;
  addAction?: (action: any) => void;
}> = ({ disabled, addAction }) => {
  const { t } = useTranslation("deviceControl");
  const [keyInput, setKeyInput] = useState<string>("");
  const [textInput, setTextInput] = useState<string>("");

  const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
  const CLICK_DELAY_MS = 50;

  const send = useCallback(
    (type: string, payload: Record<string, any>) => {
      if (!addAction || disabled) return;
      addAction({ id: crypto.randomUUID(), type, payload });
    },
    [addAction, disabled],
  );

  const sendKeyDown = useCallback(
    (key: string) => {
      send("keyboard.keyDown", { Key: key });
    },
    [send],
  );

  const sendKeyUp = useCallback(
    (key: string) => {
      send("keyboard.keyUp", { Key: key });
    },
    [send],
  );

  const keyPress = useCallback(
    async (key: string) => {
      if (!key) return;
      sendKeyDown(key);
      await sleep(CLICK_DELAY_MS);
      sendKeyUp(key);
    },
    [sendKeyDown, sendKeyUp],
  );

  const typeText = useCallback(
    async (text: string) => {
      if (!text) return;
      for (const ch of text) {
        await keyPress(ch);
        await sleep(CLICK_DELAY_MS);
      }
    },
    [keyPress],
  );

  return (
    <div className="space-y-6">
      <h3 className="text-text mb-4 text-lg font-semibold">
        {t("manual.keyboard.title")}
      </h3>

      {/* Single Key Section */}
      <div className="border-lightgray bg-tertiary rounded-lg border p-4">
        <h4 className="text-text mb-3 text-sm font-medium">
          {t("manual.keyboard.singleKey")}
        </h4>
        <div className="space-y-3">
          <label className="flex flex-col text-sm">
            <span className="text-darkgray mb-1">
              {t("manual.keyboard.keyLabel")}
            </span>
            <Input
              type="text"
              className="px-2 py-1 text-xs"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              disabled={disabled}
              placeholder="e.g. A, Enter, VK_F1"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled || !keyInput}
              onClick={() => sendKeyDown(keyInput)}
            >
              {t("manual.keyboard.keyDown")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled || !keyInput}
              onClick={() => sendKeyUp(keyInput)}
            >
              {t("manual.keyboard.keyUp")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={disabled || !keyInput}
              onClick={() => {
                void keyPress(keyInput);
              }}
            >
              {t("manual.keyboard.keyPress")}
            </Button>
          </div>
        </div>
      </div>

      {/* Type Text Section */}
      <div className="border-lightgray bg-tertiary rounded-lg border p-4">
        <h4 className="text-text mb-3 text-sm font-medium">
          {t("manual.keyboard.typeText")}
        </h4>
        <div className="space-y-3">
          <label className="flex flex-col text-sm">
            <span className="text-darkgray mb-1">
              {t("manual.keyboard.textToType")}
            </span>
            <Input
              type="text"
              className="px-2 py-1 text-xs"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={disabled}
              placeholder="Hello World"
            />
          </label>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={disabled || !textInput}
              onClick={() => {
                void typeText(textInput);
              }}
            >
              {t("manual.keyboard.typeText")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled || !textInput}
              onClick={() => setTextInput("")}
            >
              {t("manual.keyboard.clear")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
