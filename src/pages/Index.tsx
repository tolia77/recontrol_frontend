import { Link } from "react-router";
import SiteHeader from "src/components/Shell/SiteHeader";
import connectIcon from "src/assets/img/icons/connect.svg";
import dashboardIcon from "src/assets/img/icons/dashboard.svg";
import deviceIcon from "src/assets/img/icons/device.svg";
import settingsIcon from "src/assets/img/icons/settings.svg";
import { useTranslation, Trans } from "react-i18next";
import Button from "src/components/ui/Button";

function Index() {
  const { t } = useTranslation("index");

  return (
    <div className="bg-surface-muted min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="from-primary/10 via-surface to-surface-muted h-full w-full bg-gradient-to-b" />
          <div className="bg-primary/20 absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl" />
          <div className="bg-success/20 absolute -right-24 -bottom-24 h-72 w-72 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto flex items-center justify-center px-6 py-20">
          <div className="max-w-3xl text-center">
            <h1 className="text-primary mb-4 text-display font-extrabold tracking-tight md:text-6xl">
              {t("hero.headline")}
            </h1>
            <p className="text-body text-muted-foreground mb-8 md:text-body-lg">
              {t("hero.sub")}
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/login">
                <Button size="lg">{t("hero.login")}</Button>
              </Link>
              <Link to="/signup">
                <Button variant="secondary" size="lg">
                  {t("hero.signup")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={connectIcon}
            title={t("features.gridTitle1")}
            text={t("features.gridText1")}
          />
          <FeatureCard
            icon={dashboardIcon}
            title={t("features.gridTitle2")}
            text={t("features.gridText2")}
          />
          <FeatureCard
            icon={deviceIcon}
            title={t("features.gridTitle3")}
            text={t("features.gridText3")}
          />
          <FeatureCard
            icon={settingsIcon}
            title={t("features.gridTitle4")}
            text={t("features.gridText4")}
          />
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-6 py-12">
        <h2 className="text-primary mb-6 text-center text-title font-semibold">
          {t("how.title")}
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Step
            number={1}
            title={t("how.step1.title")}
            text={t("how.step1.text")}
          />
          <Step
            number={2}
            title={t("how.step2.title")}
            text={t("how.step2.text")}
          />
          <Step
            number={3}
            title={t("how.step3.title")}
            text={t("how.step3.text")}
          />
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-primary">
        <div className="container mx-auto px-6 py-10 text-center text-white">
          <h3 className="mb-2 text-2xl font-semibold md:text-3xl">
            {t("cta.title")}
          </h3>
          <p className="mb-6 text-white/90">{t("cta.sub")}</p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/login">
              <Button
                variant="secondary"
                className="text-primary bg-surface hover:bg-surface-muted"
              >
                {t("cta.login")}
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="hover:bg-primary-hover">
                {t("cta.signup")}
              </Button>
            </Link>
          </div>
          <div className="text-caption mt-6 text-white/80">
            <Trans
              ns="index"
              i18nKey="cta.help"
              components={{
                helpLink: <Link to="/help" className="text-white underline" />,
              }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

interface FeatureCardProps {
  icon: string;
  title: string;
  text: string;
}

function FeatureCard({ icon, title, text }: FeatureCardProps) {
  return (
    <div className="border-border rounded-lg border bg-surface p-5 transition-shadow hover:shadow-sm backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className="bg-primary/10 inline-flex h-9 w-9 items-center justify-center rounded-md">
          <img src={icon} alt="" className="h-5 w-5" />
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-caption text-muted-foreground">{text}</p>
    </div>
  );
}

interface StepProps {
  number: number;
  title: string;
  text: string;
}

function Step({ number, title, text }: StepProps) {
  return (
    <div className="border-border rounded-lg border bg-surface p-5 transition-shadow hover:shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <span className="bg-primary inline-flex h-8 w-8 items-center justify-center rounded-full font-semibold text-white">
          {number}
        </span>
        <h4 className="font-semibold">{title}</h4>
      </div>
      <p className="text-caption text-muted-foreground">{text}</p>
    </div>
  );
}

export default Index;
