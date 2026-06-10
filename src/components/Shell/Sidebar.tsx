import { Link, NavLink } from "react-router";
import logo from "src/assets/img/logo-full-white-text.svg";
import dashboardIcon from "src/assets/img/icons/dashboard.svg";
import devicesIcon from "src/assets/img/icons/device.svg";
import scenariosIcon from "src/assets/img/icons/scenarios.svg";
import settingsIcon from "src/assets/img/icons/settings.svg";
import helpIcon from "src/assets/img/icons/help.svg";
import subscriptionIcon from "src/assets/img/icons/subscription.svg";
import { useTranslation } from "react-i18next";
import { getUserRole } from "src/utils/auth";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isMobile?: boolean;
}

function Sidebar({ isOpen = false, onClose, isMobile = false }: SidebarProps) {
  const { i18n, t } = useTranslation(["common"]);
  const role = getUserRole();

  const changeLanguage = (lng: string) => {
    void i18n.changeLanguage(lng);
  };

  const TopContent = (
    <>
      <Link to="/dashboard" onClick={onClose}>
        <img
          src={logo}
          alt="Logo"
          className="ml-[10px] h-[70px] object-cover pt-[10px]"
        />
      </Link>
      {/* Click delegation: any nav link closes the mobile drawer. onClose is
          undefined on desktop, so this is a harmless no-op there. */}
      <nav
        onClick={onClose}
        className="mt-[30px] space-y-[5px] pl-[10px] text-white"
      >
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex h-[45px] items-center gap-1 rounded-md transition-colors hover:bg-primary/8 ${
              isActive ? "bg-primary/8 font-semibold" : ""
            }`
          }
        >
          <img src={dashboardIcon} alt={t("nav.dashboard")} />
          <p>{t("nav.dashboard")}</p>
        </NavLink>
        <NavLink
          to="/devices"
          className={({ isActive }) =>
            `flex h-[45px] items-center gap-1 rounded-md transition-colors hover:bg-primary/8 ${
              isActive ? "bg-primary/8 font-semibold" : ""
            }`
          }
        >
          <img src={devicesIcon} alt={t("nav.devices")} />
          <p>{t("nav.devices")}</p>
        </NavLink>
        <NavLink
          to="/scenarios"
          className={({ isActive }) =>
            `flex h-[45px] items-center gap-1 rounded-md transition-colors hover:bg-primary/8 ${
              isActive ? "bg-primary/8 font-semibold" : ""
            }`
          }
        >
          <img src={scenariosIcon} alt={t("nav.scenarios")} />
          <p>{t("nav.scenarios")}</p>
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex h-[45px] items-center gap-1 rounded-md transition-colors hover:bg-primary/8 ${
              isActive ? "bg-primary/8 font-semibold" : ""
            }`
          }
        >
          <img src={settingsIcon} alt={t("nav.settings")} />
          <p>{t("nav.settings")}</p>
        </NavLink>
        <NavLink
          to="/subscription"
          className={({ isActive }) =>
            `flex h-[45px] items-center gap-1 rounded-md transition-colors hover:bg-primary/8 ${
              isActive ? "bg-primary/8 font-semibold" : ""
            }`
          }
        >
          <img src={subscriptionIcon} alt={t("nav.subscription")} />
          <p>{t("nav.subscription")}</p>
        </NavLink>
        {role === "admin" && (
          <>
            <div className="mt-2 mb-1 border-t border-white/20" />
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                `flex h-[45px] items-center gap-1 rounded-md transition-colors hover:bg-primary/8 ${
                  isActive ? "bg-primary/8 font-semibold" : ""
                }`
              }
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white/20 text-body text-white">
                U
              </span>
              <p>{t("nav.users")}</p>
            </NavLink>
            <NavLink
              to="/admin/subscriptions"
              className={({ isActive }) =>
                `flex h-[45px] items-center gap-1 rounded-md transition-colors hover:bg-primary/8 ${
                  isActive ? "bg-primary/8 font-semibold" : ""
                }`
              }
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white/20 text-body text-white">
                S
              </span>
              <p>{t("nav.adminSubscriptions")}</p>
            </NavLink>
            <NavLink
              to="/admin/devices"
              className={({ isActive }) =>
                `flex h-[45px] items-center gap-1 rounded-md transition-colors hover:bg-primary/8 ${
                  isActive ? "bg-primary/8 font-semibold" : ""
                }`
              }
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white/20 text-body text-white">
                D
              </span>
              <p>{t("nav.adminDevices")}</p>
            </NavLink>
            <NavLink
              to="/admin/ai-usage"
              className={({ isActive }) =>
                `flex h-[45px] items-center gap-1 rounded-md transition-colors hover:bg-primary/8 ${
                  isActive ? "bg-primary/8 font-semibold" : ""
                }`
              }
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white/20 text-body text-white">
                A
              </span>
              <p>{t("nav.aiUsage")}</p>
            </NavLink>
          </>
        )}
        <NavLink
          to="/help"
          className={({ isActive }) =>
            `flex h-[45px] items-center gap-1 rounded-md transition-colors hover:bg-primary/8 ${
              isActive ? "bg-primary/8 font-semibold" : ""
            }`
          }
        >
          <img src={helpIcon} alt="Help" />
          <p>{t("nav.help")}</p>
        </NavLink>
      </nav>
    </>
  );

  const LanguageSwitch = (
    <div className="mt-6 pl-[10px] text-white">
      <label className="mb-1 block text-xs tracking-wide uppercase opacity-70">
        {t("lang.switch_label")}
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => changeLanguage("en")}
          className={`rounded border px-2 py-1 text-xs transition-colors ${
            i18n.resolvedLanguage === "en"
              ? "text-primary bg-white"
              : "border-white/30 bg-white/10 hover:bg-white/20"
          }`}
        >
          {t("lang.english")}
        </button>
        <button
          type="button"
          onClick={() => changeLanguage("uk")}
          className={`rounded border px-2 py-1 text-xs transition-colors ${
            i18n.resolvedLanguage === "uk"
              ? "text-primary bg-white"
              : "border-white/30 bg-white/10 hover:bg-white/20"
          }`}
        >
          {t("lang.ukrainian")}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — always rendered on non-mobile; hidden by JSX on mobile */}
      {!isMobile && (
        <aside className="bg-primary fixed top-0 left-0 z-40 flex h-dvh w-[220px]">
          <div className="flex h-full flex-col">
            <div className="overflow-y-auto">{TopContent}</div>
            <div className="mt-auto pb-6">{LanguageSwitch}</div>
          </div>
        </aside>
      )}

      {/* Mobile drawer — stays mounted so it can slide in/out smoothly; visibility
          and interactivity are driven by isOpen, not mount/unmount. */}
      {isMobile && (
        <div
          className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`}
          aria-hidden={!isOpen}
        >
          {/* Backdrop — fades in/out */}
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
              isOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={onClose}
            aria-label="Close menu backdrop"
          />
          {/* Drawer panel — slides from the left */}
          <aside
            className={`bg-primary relative flex h-dvh w-[220px] flex-col shadow-xl transition-transform duration-300 ease-in-out ${
              isOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="overflow-y-auto px-0 pt-2">{TopContent}</div>
            <div className="mt-auto px-[10px] pb-6">{LanguageSwitch}</div>
          </aside>
        </div>
      )}
    </>
  );
}

export default Sidebar;
