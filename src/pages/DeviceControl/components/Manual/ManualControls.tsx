import React, { useState } from "react";
import ManualMouseControls from "./ManualMouseControls.tsx";
import ManualKeyboardControls from "./ManualKeyboardControls.tsx";
import ManualPowerControls from "./ManualPowerControls.tsx";
import ManualTerminalControls from "./ManualTerminalControls.tsx";
import { useTranslation } from "react-i18next";
import type { CommandAction } from "src/pages/DeviceControl/types";
import type { PermissionsSubset } from "src/types";

type ManualSection = "mouse" | "keyboard" | "power" | "terminal";

const ManualControls: React.FC<{
  disabled: boolean;
  addAction?: (action: CommandAction) => void;
  results?: { id: string; status: string; result: string }[];
  processes?: {
    Pid: number;
    Name: string;
    MemoryMB?: number;
    CpuTime?: string;
    StartTime?: string;
  }[];
  processesLoading?: boolean;
  requestListProcesses?: () => void;
  killProcess?: (pid: number) => void;
  permissions?: PermissionsSubset;
}> = ({
  disabled,
  addAction,
  results,
  processes,
  processesLoading,
  requestListProcesses,
  killProcess,
  permissions,
}) => {
  const { t } = useTranslation("deviceControl");
  const [activeSection, setActiveSection] = useState<ManualSection>("mouse");

  const canMouse = !!permissions?.access_mouse;
  const canKeyboard = !!permissions?.access_keyboard;
  const canPower = !!permissions?.manage_power;
  const canTerminal = !!permissions?.access_terminal;

  const SectionNotice: React.FC<{ allowed: boolean }> = ({ allowed }) =>
    !allowed ? (
      <div className="mb-4 rounded-sm border border-warning/20 bg-warning/10 px-3 py-2 text-body text-warning">
        {t("manual.noPermission")}
      </div>
    ) : null;

  return (
    <div className="flex flex-1 flex-col items-center bg-surface-muted p-8">
      <div className="bg-surface border-border w-4xl rounded-md border">
        {/* Section Tabs */}
        <div className="border-border border-b">
          <div className="flex">
            <button
              onClick={() => setActiveSection("mouse")}
              className={`flex-1 px-4 py-3 text-body font-medium transition-colors duration-150 ${
                activeSection === "mouse"
                  ? "border-b-2 border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-primary/8"
              }`}
            >
              {t("manual.tabs.mouse")}
            </button>
            <button
              onClick={() => setActiveSection("keyboard")}
              className={`flex-1 px-4 py-3 text-body font-medium transition-colors duration-150 ${
                activeSection === "keyboard"
                  ? "border-b-2 border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-primary/8"
              }`}
            >
              {t("manual.tabs.keyboard")}
            </button>
            <button
              onClick={() => setActiveSection("power")}
              className={`flex-1 px-4 py-3 text-body font-medium transition-colors duration-150 ${
                activeSection === "power"
                  ? "border-b-2 border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-primary/8"
              }`}
            >
              {t("manual.tabs.power")}
            </button>
            <button
              onClick={() => setActiveSection("terminal")}
              className={`flex-1 px-4 py-3 text-body font-medium transition-colors duration-150 ${
                activeSection === "terminal"
                  ? "border-b-2 border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-primary/8"
              }`}
            >
              {t("manual.tabs.terminal")}
            </button>
          </div>
        </div>

        {/* Section Content */}
        <div className="p-6">
          {activeSection === "mouse" && (
            <>
              <SectionNotice allowed={canMouse} />
              <ManualMouseControls
                disabled={disabled || !canMouse}
                addAction={addAction}
              />
            </>
          )}
          {activeSection === "keyboard" && (
            <>
              <SectionNotice allowed={canKeyboard} />
              <ManualKeyboardControls
                disabled={disabled || !canKeyboard}
                addAction={addAction}
              />
            </>
          )}
          {activeSection === "power" && (
            <>
              <SectionNotice allowed={canPower} />
              <ManualPowerControls
                disabled={disabled || !canPower}
                addAction={addAction}
              />
            </>
          )}
          {activeSection === "terminal" && (
            <>
              <SectionNotice allowed={canTerminal} />
              <ManualTerminalControls
                disabled={disabled || !canTerminal}
                addAction={addAction}
                results={results}
                processes={processes}
                processesLoading={processesLoading}
                requestListProcesses={requestListProcesses}
                killProcess={killProcess}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManualControls;
