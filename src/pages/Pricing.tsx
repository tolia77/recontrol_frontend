import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import SiteHeader from "src/components/Shell/SiteHeader";
import Button from "src/components/ui/Button";

type PlanKey = "free" | "pro" | "advanced" | "business";

// Tier order matches the backend catalog (ascending price). "advanced" is the
// highlighted tier. Feature copy is sourced from i18n and mirrors the enforced
// PlanEntitlements limits, not marketing approximations.
const PLAN_ORDER: PlanKey[] = ["free", "pro", "advanced", "business"];
const HIGHLIGHTED: PlanKey = "advanced";

function Pricing() {
  const { t } = useTranslation("pricing");

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="from-tertiary/60 via-background to-background h-full w-full bg-gradient-to-b" />
            <div className="bg-secondary/20 absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl" />
          </div>
          <div className="container mx-auto px-6 pt-16 pb-10 text-center">
            <span className="text-secondary text-caption-small font-semibold tracking-widest uppercase">
              {t("hero.eyebrow")}
            </span>
            <h1 className="text-primary mt-3 mb-4 text-4xl font-extrabold tracking-tight md:text-5xl">
              {t("hero.headline")}
            </h1>
            <p className="text-darkgray mx-auto max-w-2xl md:text-lg">
              {t("hero.sub")}
            </p>
          </div>
        </section>

        {/* Plan grid */}
        <section className="container mx-auto px-6 pb-12">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PLAN_ORDER.map((key) => (
              <PlanCard
                key={key}
                planKey={key}
                highlighted={key === HIGHLIGHTED}
              />
            ))}
          </div>

          <p className="text-darkgray text-caption-small mx-auto mt-8 max-w-2xl text-center">
            {t("billingNote")}
          </p>
        </section>
      </main>
    </div>
  );
}

interface PlanCardProps {
  planKey: PlanKey;
  highlighted: boolean;
}

function PlanCard({ planKey, highlighted }: PlanCardProps) {
  const { t } = useTranslation("pricing");
  const name = t(`plans.${planKey}.name`);
  const features = t(`plans.${planKey}.features`, {
    returnObjects: true,
  }) as string[];

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-white p-6 transition-shadow ${
        highlighted
          ? "border-secondary shadow-lg ring-1 ring-secondary/30"
          : "border-lightgray shadow-sm hover:shadow-md"
      }`}
    >
      {highlighted && (
        <span className="bg-secondary absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm">
          {t("popular")}
        </span>
      )}

      <div className="mb-5">
        <h2 className="text-primary text-lg font-bold">{name}</h2>
        <p className="text-darkgray text-caption-small mt-1">
          {t(`plans.${planKey}.tagline`)}
        </p>
      </div>

      <div className="mb-6 flex items-baseline gap-1">
        <span className="text-primary text-4xl font-extrabold tracking-tight">
          {t(`plans.${planKey}.price`)}
        </span>
        <span className="text-darkgray text-sm">
          {t(`plans.${planKey}.period`)}
        </span>
      </div>

      <ul className="mb-8 flex flex-col gap-3">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            <CheckIcon />
            <span className="text-text">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        <Link to="/signup" className="block">
          <Button
            variant={highlighted ? "primary" : "secondary"}
            size="md"
            className="w-full"
          >
            {planKey === "free"
              ? t("cta.free")
              : t("cta.paid", { plan: name })}
          </Button>
        </Link>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="text-accent mt-0.5 h-4 w-4 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default Pricing;
