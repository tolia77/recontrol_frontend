import { Link } from 'react-router';
import { useTranslation, Trans } from 'react-i18next';
import { Button } from 'src/components/ui/Button';

interface FAQItem {
  q: string;
  a: string;
}

function Help() {
  const { t } = useTranslation('help');

  const groups: Array<{ key: string; title: string; items: FAQItem[] }> = [
    { key: 'getting_started', title: t('groups.getting_started.title'), items: t('groups.getting_started.items', { returnObjects: true }) as FAQItem[] },
    { key: 'devices', title: t('groups.devices.title'), items: t('groups.devices.items', { returnObjects: true }) as FAQItem[] },
    { key: 'sessions', title: t('groups.sessions.title'), items: t('groups.sessions.items', { returnObjects: true }) as FAQItem[] },
    { key: 'account', title: t('groups.account.title'), items: t('groups.account.items', { returnObjects: true }) as FAQItem[] },
  ];

  return (
    <main className="min-h-screen bg-background">
      {/* Header banner */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="h-full w-full bg-gradient-to-b from-tertiary/60 via-background to-background" />
          <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        </div>
        <div className="container mx-auto px-6 py-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-primary tracking-tight mb-2">
            {t('header.title')}
          </h1>
          <p className="text-darkgray">
            <Trans
              ns="help"
              i18nKey="header.subtitle"
              components={{ signupLink: <Link to="/signup" className="text-secondary underline" /> }}
            />
          </p>
        </div>
      </section>

      {/* Quick links */}
      <section className="container mx-auto px-6">
        <div className="flex flex-wrap gap-3">
          <Link to="/login">
            <Button variant="secondary">{t('actions.login')}</Button>
          </Link>
          <Link to="/signup">
            <Button>{t('actions.signup')}</Button>
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {groups.map(g => (
              <FAQGroup key={g.key} title={g.title} faqs={g.items} />
            ))}
          </div>

          <aside className="lg:col-span-1">
            <div className="p-5 rounded-xl border border-lightgray bg-white/90 backdrop-blur-sm shadow-sm sticky top-6">
              <h3 className="font-semibold mb-2">{t('groups.more_help.title')}</h3>
              <p className="text-caption-small text-darkgray mb-4">{t('groups.more_help.description')}</p>
              <div className="space-y-2">
                <a
                  className="block text-secondary hover:underline"
                  href="#"
                  onClick={(e) => e.preventDefault()}
                >
                  {t('groups.more_help.docs_link')}
                </a>
                <a
                  className="block text-secondary hover:underline"
                  href="#"
                  onClick={(e) => e.preventDefault()}
                >
                  {t('groups.more_help.community_link')}
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
      <h2 className="text-2xl font-semibold text-primary mb-3">{title}</h2>
      <div className="divide-y divide-lightgray rounded-xl border border-lightgray bg-white overflow-hidden">
        {faqs.map((item, idx) => (
          <details key={idx} className="group">
            <summary className="cursor-pointer list-none p-4 flex items-center justify-between hover:bg-background/60 transition-colors">
              <span className="font-medium">{item.q}</span>
              <span className="ml-4 h-6 w-6 inline-flex items-center justify-center rounded-full bg-tertiary text-primary group-open:rotate-45 transition-transform">
                +
              </span>
            </summary>
            <div className="p-4 pt-0 text-darkgray text-body-small">{item.a}</div>
          </details>
        ))}
      </div>
    </div>
  );
}

export default Help;
