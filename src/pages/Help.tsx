import { Link } from "react-router";
import { useTranslation, Trans } from "react-i18next";
import Button from "src/components/ui/Button";

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
    <main className="bg-surface-muted min-h-screen">
      {/* Header banner */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="from-primary/10 via-surface to-surface-muted h-full w-full bg-gradient-to-b" />
          <div className="bg-primary/20 absolute -top-20 -left-20 h-64 w-64 rounded-full blur-3xl" />
          <div className="bg-success/20 absolute -right-20 -bottom-20 h-64 w-64 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-6 py-10">
          <h1 className="text-primary mb-2 text-display font-extrabold tracking-tight md:text-4xl">
            {t("header.title")}
          </h1>
          <p className="text-muted-foreground">
            <Trans
              ns="help"
              i18nKey="header.subtitle"
              components={{
                signupLink: (
                  <Link to="/signup" className="text-primary underline" />
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
            <div className="border-border sticky top-6 rounded-lg border bg-surface p-5 backdrop-blur-sm">
              <h3 className="mb-2 font-semibold">
                {t("groups.more_help.title")}
              </h3>
              <p className="text-caption text-muted-foreground mb-4">
                {t("groups.more_help.description")}
              </p>
              <div className="space-y-2">
                <a
                  className="text-primary block hover:underline"
                  href="#"
                  onClick={(e) => e.preventDefault()}
                >
                  {t("groups.more_help.docs_link")}
                </a>
                <a
                  className="text-primary block hover:underline"
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
      <h2 className="text-primary mb-3 text-title font-semibold">{title}</h2>
      <div className="divide-border border-border divide-y overflow-hidden rounded-lg border bg-surface">
        {faqs.map((item, idx) => (
          <details key={idx} className="group">
            <summary className="hover:bg-surface-muted/60 flex cursor-pointer list-none items-center justify-between p-4 transition-colors">
              <span className="font-medium">{item.q}</span>
              <span className="bg-primary/10 text-primary ml-4 inline-flex h-6 w-6 items-center justify-center rounded-full transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="text-muted-foreground text-body p-4 pt-0">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

export default Help;
