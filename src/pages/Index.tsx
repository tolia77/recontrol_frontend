import { Link } from "react-router";
import logoFull from "src/assets/img/logo-full.svg";
import connectIcon from "src/assets/img/icons/connect.svg";
import dashboardIcon from "src/assets/img/icons/dashboard.svg";
import deviceIcon from "src/assets/img/icons/device.svg";
import settingsIcon from "src/assets/img/icons/settings.svg";
import { useTranslation, Trans } from "react-i18next";
import Button from "src/components/ui/Button";

function Index() {
  const { t } = useTranslation("index");

  return (
    <main className="bg-background min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="from-tertiary/60 via-background to-background h-full w-full bg-gradient-to-b" />
          <div className="bg-secondary/20 absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl" />
          <div className="bg-accent/20 absolute -right-24 -bottom-24 h-72 w-72 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto flex items-center justify-center px-6 py-20">
          <div className="max-w-3xl text-center">
            <img src={logoFull} alt="ReControl" className="mx-auto mb-8 h-16" />
            <h1 className="text-primary mb-4 text-4xl font-extrabold tracking-tight md:text-6xl">
              {t("hero.headline")}
            </h1>
            <p className="text-body text-darkgray mb-8 md:text-lg">
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
        <h2 className="text-primary mb-6 text-center text-2xl font-semibold">
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
                className="text-primary bg-white hover:bg-gray-100"
              >
                {t("cta.login")}
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="bg-secondary hover:opacity-90">
                {t("cta.signup")}
              </Button>
            </Link>
          </div>
          <div className="text-caption-small mt-6 text-white/80">
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
    </main>
  );
}

interface FeatureCardProps {
  icon: string;
  title: string;
  text: string;
}

function FeatureCard({ icon, title, text }: FeatureCardProps) {
  return (
    <div className="border-lightgray rounded-xl border bg-white/90 p-5 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center gap-3">
        <span className="bg-tertiary inline-flex h-9 w-9 items-center justify-center rounded-lg">
          <img src={icon} alt="" className="h-5 w-5" />
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-caption-small text-darkgray">{text}</p>
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
    <div className="border-lightgray rounded-xl border bg-white p-5 transition-shadow hover:shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <span className="bg-secondary inline-flex h-8 w-8 items-center justify-center rounded-full font-semibold text-white">
          {number}
        </span>
        <h4 className="font-semibold">{title}</h4>
      </div>
      <p className="text-caption-small text-darkgray">{text}</p>
    </div>
  );
}

export default Index;
