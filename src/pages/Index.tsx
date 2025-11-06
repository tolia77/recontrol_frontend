import React from 'react';
import { Link } from 'react-router';
import logoFull from 'src/assets/img/logo-full.svg';
import connectIcon from 'src/assets/img/icons/connect.svg';
import dashboardIcon from 'src/assets/img/icons/dashboard.svg';
import deviceIcon from 'src/assets/img/icons/device.svg';
import settingsIcon from 'src/assets/img/icons/settings.svg';

function Index() {
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
                            Remote device control, simplified
                        </h1>
                        <p className="text-body md:text-lg text-darkgray mb-8">
                            Securely manage and control your devices from anywhere. Stream screens, send inputs,
                            and run commands with confidence.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <Link to="/login" className="button-primary inline-flex items-center justify-center px-6 py-2">
                                Log in
                            </Link>
                            <Link to="/signup" className="button-secondary inline-flex items-center justify-center px-6 py-2">
                                Sign up
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Feature grid */}
            <section className="container mx-auto px-6 py-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FeatureCard icon={connectIcon} title="Instant connect" text="Connect to devices securely with a single click." />
                    <FeatureCard icon={dashboardIcon} title="Unified dashboard" text="Overview of all your devices and sessions." />
                    <FeatureCard icon={deviceIcon} title="Live control" text="Stream screens, send keyboard and mouse input." />
                    <FeatureCard icon={settingsIcon} title="Granular controls" text="Fine‑tune permissions and session settings." />
                </div>
            </section>

            {/* How it works */}
            <section className="container mx-auto px-6 py-12">
                <h2 className="text-2xl font-semibold text-primary mb-6 text-center">How it works</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Step number={1} title="Create an account" text="Sign up and verify your email to get started." />
                    <Step number={2} title="Add a device" text="Register your device and establish a secure link." />
                    <Step number={3} title="Take control" text="Start a live session to view and control instantly." />
                </div>
            </section>

            {/* CTA band */}
            <section className="bg-primary">
                <div className="container mx-auto px-6 py-10 text-center text-white">
                    <h3 className="text-2xl md:text-3xl font-semibold mb-2">Ready to take control?</h3>
                    <p className="text-white/90 mb-6">Log in to continue or create a free account in seconds.</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link to="/login" className="inline-flex items-center justify-center bg-white text-primary px-6 py-2 rounded-lg min-h-[40px]">
                            Log in
                        </Link>
                        <Link to="/signup" className="inline-flex items-center justify-center bg-secondary text-white px-6 py-2 rounded-lg min-h-[40px]">
                            Sign up
                        </Link>
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