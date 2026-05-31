import { useState } from "react";
import { Link, NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import logoFull from "src/assets/img/logo-full.svg";
import Button from "src/components/ui/Button";
import { isAuthenticated } from "src/utils/auth";

/**
 * Public marketing header shown on the landing and pricing pages (the routes
 * that render without the app sidebar Layout). Sticky, translucent, and
 * responsive: nav links collapse into a toggle panel below the `md` breakpoint.
 */
function SiteHeader() {
  const { t } = useTranslation("index");
  const [open, setOpen] = useState(false);
  const loggedIn = isAuthenticated();

  const navLinks = [
    { to: "/pricing", label: t("header.pricing") },
    { to: "/help", label: t("header.help") },
  ];

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors hover:text-primary ${
      isActive ? "text-primary" : "text-darkgray"
    }`;

  return (
    <header className="border-lightgray/70 bg-background/80 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link
          to="/"
          className="rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
          onClick={() => setOpen(false)}
        >
          <img src={logoFull} alt="ReControl" className="h-8 w-auto" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <NavLink key={link.to} to={link.to} className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {loggedIn ? (
            <Link to="/dashboard">
              <Button variant="secondary" size="sm">
                {t("header.dashboard")}
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  {t("header.login")}
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm">{t("header.signup")}</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? t("header.closeMenu") : t("header.openMenu")}
          onClick={() => setOpen((v) => !v)}
          className="text-primary hover:bg-tertiary inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 md:hidden"
        >
          {open ? (
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 7h16M4 12h16M4 17h16"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile panel */}
      {open && (
        <div className="border-lightgray/70 bg-background/95 border-t backdrop-blur-md md:hidden">
          <div className="container mx-auto flex flex-col gap-1 px-6 py-4">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-tertiary ${
                    isActive ? "text-primary" : "text-darkgray"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <div className="border-lightgray/70 mt-3 flex flex-col gap-2 border-t pt-3">
              {loggedIn ? (
                <Link to="/dashboard" onClick={() => setOpen(false)}>
                  <Button variant="secondary" size="md" className="w-full">
                    {t("header.dashboard")}
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)}>
                    <Button variant="secondary" size="md" className="w-full">
                      {t("header.login")}
                    </Button>
                  </Link>
                  <Link to="/signup" onClick={() => setOpen(false)}>
                    <Button size="md" className="w-full">
                      {t("header.signup")}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default SiteHeader;
