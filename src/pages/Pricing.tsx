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
    <div className="bg-surface-muted min-h-screen">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="from-primary/10 via-surface to-surface-muted h-full w-full bg-gradient-to-b" />
            <div className="bg-primary/20 absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl" />
          </div>
          <div className="container mx-auto px-6 pt-16 pb-10 text-center">
            <span className="text-primary text-caption font-semibold tracking-widest uppercase">
              {t("hero.eyebrow")}
            </span>
            <h1 className="text-primary mt-3 mb-4 text-display font-extrabold tracking-tight md:text-5xl">
              {t("hero.headline")}
            </h1>
            <p className="text-muted-foreground mx-auto max-w-2xl md:text-body-lg">
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

          <p className="text-muted-foreground text-caption mx-auto mt-8 max-w-2xl text-center">
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

interface PlanFeature {
  text: string;
  included: boolean;
}

function PlanCard({ planKey, highlighted }: PlanCardProps) {
  const { t } = useTranslation("pricing");
  const name = t(`plans.${planKey}.name`);
  const features = t(`plans.${planKey}.features`, {
    returnObjects: true,
  }) as PlanFeature[];

  return (
    <div
      className={`relative flex flex-col rounded-lg border bg-surface p-6 transition-shadow ${
        highlighted
          ? "border-primary shadow-overlay ring-1 ring-primary/30"
          : "border-border hover:shadow-sm"
      }`}
    >
      {highlighted && (
        <span className="bg-primary absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-caption font-semibold text-white">
          {t("popular")}
        </span>
      )}

      <div className="mb-5">
        <h2 className="text-primary text-heading font-bold">{name}</h2>
        <p className="text-muted-foreground text-caption mt-1">
          {t(`plans.${planKey}.tagline`)}
        </p>
      </div>

      <div className="mb-6 flex items-baseline gap-1">
        <span className="text-primary text-4xl font-extrabold tracking-tight">
          {t(`plans.${planKey}.price`)}
        </span>
        <span className="text-muted-foreground text-body">
          {t(`plans.${planKey}.period`)}
        </span>
      </div>

      <ul className="mb-8 flex flex-col gap-3">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2.5 text-body">
            {feature.included ? <CheckIcon /> : <ExcludedIcon />}
            <span className={feature.included ? "text-foreground" : "text-muted-foreground"}>
              {feature.text}
            </span>
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
      className="text-success mt-0.5 h-4 w-4 flex-shrink-0"
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

function ExcludedIcon() {
  return (
    <svg
      className="text-border mt-0.5 h-4 w-4 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h12" />
    </svg>
  );
}

export default Pricing;
