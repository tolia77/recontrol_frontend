import { Link } from "react-router";
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
}

function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { i18n, t } = useTranslation(["common"]);
  const role = getUserRole();

  const changeLanguage = (lng: string) => {
    void i18n.changeLanguage(lng);
  };

  const TopContent = (
    <>
      <Link to="/dashboard">
        <img
          src={logo}
          alt="Logo"
          className="ml-[10px] h-[70px] object-cover pt-[10px]"
        />
      </Link>
      <nav className="mt-[30px] space-y-[5px] pl-[10px] text-white">
        <Link
          to="/dashboard"
          className="flex h-[45px] items-center gap-1 transition-opacity hover:opacity-80"
        >
          <img src={dashboardIcon} alt={t("nav.dashboard")} />
          <p>{t("nav.dashboard")}</p>
        </Link>
        <Link
          to="/devices"
          className="flex h-[45px] items-center gap-1 transition-opacity hover:opacity-80"
        >
          <img src={devicesIcon} alt={t("nav.devices")} />
          <p>{t("nav.devices")}</p>
        </Link>
        <Link
          to="/scenarios"
          className="flex h-[45px] items-center gap-1 transition-opacity hover:opacity-80"
        >
          <img src={scenariosIcon} alt={t("nav.scenarios")} />
          <p>{t("nav.scenarios")}</p>
        </Link>
        <Link
          to="/settings"
          className="flex h-[45px] items-center gap-1 transition-opacity hover:opacity-80"
        >
          <img src={settingsIcon} alt={t("nav.settings")} />
          <p>{t("nav.settings")}</p>
        </Link>
        <Link
          to="/subscription"
          className="flex h-[45px] items-center gap-1 transition-opacity hover:opacity-80"
        >
          <img src={subscriptionIcon} alt={t("nav.subscription")} />
          <p>{t("nav.subscription")}</p>
        </Link>
        {role === "admin" && (
          <Link
            to="/admin/users"
            className="flex h-[45px] items-center gap-1 transition-opacity hover:opacity-80"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white/20 text-sm text-white">
              U
            </span>
            <p>{t("nav.users")}</p>
          </Link>
        )}
        <Link
          to="/help"
          className="flex h-[45px] items-center gap-1 opacity-90 transition-opacity hover:opacity-100"
        >
          <img src={helpIcon} alt="Help" />
          <p>{t("nav.help")}</p>
        </Link>
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
      {/* Desktop sidebar */}
      <aside className="bg-primary fixed top-0 left-0 z-40 hidden h-screen w-[220px] md:flex">
        <div className="flex h-full flex-col">
          <div className="overflow-y-auto">{TopContent}</div>
          <div className="mt-auto pb-6">{LanguageSwitch}</div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            aria-label="Close menu backdrop"
          />
          <aside className="bg-primary relative flex h-full w-[220px] flex-col shadow-xl">
            <div className="flex items-center justify-end p-2">
              <button
                type="button"
                aria-label="Close menu"
                onClick={onClose}
                className="rounded p-2 text-white transition-colors hover:bg-white/10"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto px-0">{TopContent}</div>
            <div className="mt-auto px-[10px] pb-6">{LanguageSwitch}</div>
          </aside>
        </div>
      )}
    </>
  );
}

export default Sidebar;
