import { Link } from "react-router";
import { useTranslation, Trans } from "react-i18next";
import { Button } from "src/components/ui/Button";

interface FAQItem {
  q: string;
  a: string;
}

function Help() {
  const { t } = useTranslation("help");

  const groups: Array<{ key: string; title: string; items: FAQItem[] }> = [
    {
      key: "getting_started",
      title: t("groups.getting_started.title"),
      items: t("groups.getting_started.items", {
        returnObjects: true,
      }) as FAQItem[],
    },
    {
      key: "devices",
      title: t("groups.devices.title"),
      items: t("groups.devices.items", { returnObjects: true }) as FAQItem[],
    },
    {
      key: "sessions",
      title: t("groups.sessions.title"),
      items: t("groups.sessions.items", { returnObjects: true }) as FAQItem[],
    },
    {
      key: "account",
      title: t("groups.account.title"),
      items: t("groups.account.items", { returnObjects: true }) as FAQItem[],
    },
  ];

  return (
    <main className="bg-background min-h-screen">
      {/* Header banner */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="from-tertiary/60 via-background to-background h-full w-full bg-gradient-to-b" />
          <div className="bg-secondary/20 absolute -top-20 -left-20 h-64 w-64 rounded-full blur-3xl" />
          <div className="bg-accent/20 absolute -right-20 -bottom-20 h-64 w-64 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-6 py-10">
          <h1 className="text-primary mb-2 text-3xl font-extrabold tracking-tight md:text-4xl">
            {t("header.title")}
          </h1>
          <p className="text-darkgray">
            <Trans
              ns="help"
              i18nKey="header.subtitle"
              components={{
                signupLink: (
                  <Link to="/signup" className="text-secondary underline" />
                ),
              }}
            />
          </p>
        </div>
      </section>

      {/* Quick links */}
      <section className="container mx-auto px-6">
        <div className="flex flex-wrap gap-3">
          <Link to="/login">
            <Button variant="secondary">{t("actions.login")}</Button>
          </Link>
          <Link to="/signup">
            <Button>{t("actions.signup")}</Button>
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {groups.map((g) => (
              <FAQGroup key={g.key} title={g.title} faqs={g.items} />
            ))}
          </div>

          <aside className="lg:col-span-1">
            <div className="border-lightgray sticky top-6 rounded-xl border bg-white/90 p-5 shadow-sm backdrop-blur-sm">
              <h3 className="mb-2 font-semibold">
                {t("groups.more_help.title")}
              </h3>
              <p className="text-caption-small text-darkgray mb-4">
                {t("groups.more_help.description")}
              </p>
              <div className="space-y-2">
                <a
                  className="text-secondary block hover:underline"
                  href="#"
                  onClick={(e) => e.preventDefault()}
                >
                  {t("groups.more_help.docs_link")}
                </a>
                <a
                  className="text-secondary block hover:underline"
                  href="#"
                  onClick={(e) => e.preventDefault()}
                >
                  {t("groups.more_help.community_link")}
                </a>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

interface FAQGroupProps {
  title: string;
  faqs: FAQItem[];
}

function FAQGroup({ title, faqs }: FAQGroupProps) {
  return (
    <div className="mb-6">
      <h2 className="text-primary mb-3 text-2xl font-semibold">{title}</h2>
      <div className="divide-lightgray border-lightgray divide-y overflow-hidden rounded-xl border bg-white">
        {faqs.map((item, idx) => (
          <details key={idx} className="group">
            <summary className="hover:bg-background/60 flex cursor-pointer list-none items-center justify-between p-4 transition-colors">
              <span className="font-medium">{item.q}</span>
              <span className="bg-tertiary text-primary ml-4 inline-flex h-6 w-6 items-center justify-center rounded-full transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="text-darkgray text-body-small p-4 pt-0">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

export default Help;
