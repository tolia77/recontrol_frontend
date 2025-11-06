import React from 'react';
import { Link } from 'react-router';
import logoFull from 'src/assets/img/logo-full.svg';

function Index() {
    return (
        <main className="min-h-screen bg-background">
            <section className="container mx-auto px-6 py-16 flex items-center justify-center">
                <div className="max-w-2xl text-center">
                    <img src={logoFull} alt="ReControl" className="mx-auto mb-8 h-14" />
                    <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4">Remote device control, simplified</h1>
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
                    <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                        <div className="p-4 bg-white border border-lightgray rounded-lg">
                            <h3 className="font-semibold mb-1">Live control</h3>
                            <p className="text-caption-small text-darkgray">Stream the screen and interact in real time.</p>
                        </div>
                        <div className="p-4 bg-white border border-lightgray rounded-lg">
                            <h3 className="font-semibold mb-1">Quick actions</h3>
                            <p className="text-caption-small text-darkgray">Execute common tasks with one click.</p>
                        </div>
                        <div className="p-4 bg-white border border-lightgray rounded-lg">
                            <h3 className="font-semibold mb-1">Secure access</h3>
                            <p className="text-caption-small text-darkgray">Your sessions are protected end‑to‑end.</p>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}

export default Index;