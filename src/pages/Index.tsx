import React from 'react';
import { Link } from 'react-router';
import logoFull from 'src/assets/img/logo-full.svg';
import connectIcon from 'src/assets/img/icons/connect.svg';
import dashboardIcon from 'src/assets/img/icons/dashboard.svg';
import deviceIcon from 'src/assets/img/icons/device.svg';
import settingsIcon from 'src/assets/img/icons/settings.svg';
import { useTranslation, Trans } from 'react-i18next';

function Index() {
    const { t } = useTranslation('index');
    return (
        <main className="min-h-screen bg-background">
            {/* Hero */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 -z-10">
                    {/* soft gradient background */}
                    <div className="h-full w-full bg-gradient-to-b from-tertiary/60 via-background to-background" />
                    {/* decorative blobs */}
                    <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />
                    <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
                </div>
                <div className="container mx-auto px-6 py-20 flex items-center justify-center">
                    <div className="max-w-3xl text-center">
                        <img src={logoFull} alt="ReControl" className="mx-auto mb-8 h-16" />
                        <h1 className="text-4xl md:text-6xl font-extrabold text-primary tracking-tight mb-4">
                            {t('hero.headline')}
                        </h1>
                        <p className="text-body md:text-lg text-darkgray mb-8">
                            {t('hero.sub')}
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <Link to="/login" className="button-primary inline-flex items-center justify-center px-6 py-2">
                                {t('hero.login')}
                            </Link>
                            <Link to="/signup" className="button-secondary inline-flex items-center justify-center px-6 py-2">
                                {t('hero.signup')}
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Feature grid */}
            <section className="container mx-auto px-6 py-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FeatureCard icon={connectIcon} title={t('features.gridTitle1')} text={t('features.gridText1')} />
                    <FeatureCard icon={dashboardIcon} title={t('features.gridTitle2')} text={t('features.gridText2')} />
                    <FeatureCard icon={deviceIcon} title={t('features.gridTitle3')} text={t('features.gridText3')} />
                    <FeatureCard icon={settingsIcon} title={t('features.gridTitle4')} text={t('features.gridText4')} />
                </div>
            </section>

            {/* How it works */}
            <section className="container mx-auto px-6 py-12">
                <h2 className="text-2xl font-semibold text-primary mb-6 text-center">{t('how.title')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Step number={1} title={t('how.step1.title')} text={t('how.step1.text')} />
                    <Step number={2} title={t('how.step2.title')} text={t('how.step2.text')} />
                    <Step number={3} title={t('how.step3.title')} text={t('how.step3.text')} />
                </div>
            </section>

            {/* CTA band */}
            <section className="bg-primary">
                <div className="container mx-auto px-6 py-10 text-center text-white">
                    <h3 className="text-2xl md:text-3xl font-semibold mb-2">{t('cta.title')}</h3>
                    <p className="text-white/90 mb-6">{t('cta.sub')}</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link to="/login" className="inline-flex items-center justify-center bg-white text-primary px-6 py-2 rounded-lg min-h-[40px]">
                            {t('cta.login')}
                        </Link>
                        <Link to="/signup" className="inline-flex items-center justify-center bg-secondary text-white px-6 py-2 rounded-lg min-h-[40px]">
                            {t('cta.signup')}
                        </Link>
                    </div>
                    <div className="mt-6 text-white/80 text-caption-small">
                        <Trans ns="index" i18nKey="cta.help" components={{ helpLink: <Link to="/help" className="underline text-white" /> }} />
                    </div>
                </div>
            </section>
        </main>
    );
}

function FeatureCard({ icon, title, text }: { icon: string; title: string; text: string }) {
    return (
        <div className="p-5 rounded-xl border border-lightgray bg-white/90 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-tertiary">
                    <img src={icon} alt="" className="h-5 w-5" />
                </span>
                <h3 className="font-semibold">{title}</h3>
            </div>
            <p className="text-caption-small text-darkgray">{text}</p>
        </div>
    );
}

function Step({ number, title, text }: { number: number; title: string; text: string }) {
    return (
        <div className="p-5 rounded-xl border border-lightgray bg-white">
            <div className="flex items-center gap-3 mb-2">
                <span className="h-8 w-8 rounded-full bg-secondary text-white inline-flex items-center justify-center font-semibold">
                    {number}
                </span>
                <h4 className="font-semibold">{title}</h4>
            </div>
            <p className="text-caption-small text-darkgray">{text}</p>
        </div>
    );
}

export default Index;