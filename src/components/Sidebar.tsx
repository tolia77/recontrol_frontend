import { Link } from 'react-router';
import logo from 'src/assets/img/logo-full-white-text.svg';
import dashboardIcon from 'src/assets/img/icons/dashboard.svg';
import devicesIcon from 'src/assets/img/icons/device.svg';
import settingsIcon from 'src/assets/img/icons/settings.svg';
import helpIcon from 'src/assets/img/icons/help.svg';
import { useTranslation } from 'react-i18next';
import { getUserRole } from 'src/utils/auth';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { i18n, t } = useTranslation(['common']);
  const role = getUserRole();

  const changeLanguage = (lng: string) => {
    void i18n.changeLanguage(lng);
  };

  const TopContent = (
    <>
      <Link to="/dashboard">
        <img src={logo} alt="Logo" className="ml-[10px] pt-[10px] h-[70px] object-cover" />
      </Link>
      <nav className="space-y-[5px] text-white pl-[10px] mt-[30px]">
        <Link to="/dashboard" className="flex gap-1 h-[45px] items-center hover:opacity-80 transition-opacity">
          <img src={dashboardIcon} alt={t('nav.dashboard')} />
          <p>{t('nav.dashboard')}</p>
        </Link>
        <Link to="/devices" className="flex gap-1 h-[45px] items-center hover:opacity-80 transition-opacity">
          <img src={devicesIcon} alt={t('nav.devices')} />
          <p>{t('nav.devices')}</p>
        </Link>
        <Link to="/settings" className="flex gap-1 h-[45px] items-center hover:opacity-80 transition-opacity">
          <img src={settingsIcon} alt={t('nav.settings')} />
          <p>{t('nav.settings')}</p>
        </Link>
        {role === 'admin' && (
          <Link to="/admin/users" className="flex gap-1 h-[45px] items-center hover:opacity-80 transition-opacity">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white/20 text-white text-sm">
              U
            </span>
            <p>{t('nav.users')}</p>
          </Link>
        )}
        <Link to="/help" className="flex gap-1 h-[45px] items-center opacity-90 hover:opacity-100 transition-opacity">
          <img src={helpIcon} alt="Help" />
          <p>{t('nav.help')}</p>
        </Link>
      </nav>
    </>
  );

  const LanguageSwitch = (
    <div className="pl-[10px] mt-6 text-white">
      <label className="block text-xs uppercase tracking-wide opacity-70 mb-1">
        {t('lang.switch_label')}
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => changeLanguage('en')}
          className={`px-2 py-1 rounded text-xs border transition-colors ${
            i18n.resolvedLanguage === 'en'
              ? 'bg-white text-primary'
              : 'border-white/30 bg-white/10 hover:bg-white/20'
          }`}
        >
          {t('lang.english')}
        </button>
        <button
          type="button"
          onClick={() => changeLanguage('uk')}
          className={`px-2 py-1 rounded text-xs border transition-colors ${
            i18n.resolvedLanguage === 'uk'
              ? 'bg-white text-primary'
              : 'border-white/30 bg-white/10 hover:bg-white/20'
          }`}
        >
          {t('lang.ukrainian')}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed top-0 left-0 z-40 w-[220px] h-screen bg-primary">
        <div className="flex flex-col h-full">
          <div className="overflow-y-auto">{TopContent}</div>
          <div className="mt-auto pb-6">{LanguageSwitch}</div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            aria-label="Close menu backdrop"
          />
          <aside className="relative h-full w-[220px] bg-primary shadow-xl flex flex-col">
            <div className="flex items-center justify-end p-2">
              <button
                type="button"
                aria-label="Close menu"
                onClick={onClose}
                className="text-white p-2 hover:bg-white/10 rounded transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto px-0">{TopContent}</div>
            <div className="mt-auto pb-6 px-[10px]">{LanguageSwitch}</div>
          </aside>
        </div>
      )}
    </>
  );
}

export default Sidebar;
