import React from 'react';
import { Link } from 'react-router';

function Help() {
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
          <h1 className="text-3xl md:text-4xl font-extrabold text-primary tracking-tight mb-2">Help & FAQ</h1>
          <p className="text-darkgray">Find quick answers to common questions. Still stuck? <Link to="/signup" className="text-secondary underline">create an account</Link> and reach out.</p>
        </div>
      </section>

      {/* Quick links */}
      <section className="container mx-auto px-6">
        <div className="flex flex-wrap gap-3">
          <Link to="/login" className="button-secondary inline-flex items-center justify-center">Log in</Link>
          <Link to="/signup" className="button-primary inline-flex items-center justify-center">Sign up</Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <FAQGroup title="Getting started" faqs={[
              {
                q: 'What is ReControl?',
                a: 'ReControl lets you securely view and control your devices from anywhere—stream screens, send keyboard/mouse input, and run commands.'
              },
              {
                q: 'How do I create an account?',
                a: 'Click Sign up on the landing page or use the button above, then follow the steps to verify your email.'
              },
              {
                q: 'Do I need to install anything on my device?',
                a: 'Yes, you will register your device using the agent provided in the devices section of the app. Instructions are shown when adding a device.'
              }
            ]} />

            <FAQGroup title="Devices" faqs={[
              {
                q: 'How do I add a new device?',
                a: 'Go to Devices, click Add device (or the plus button), and follow the instructions to link your device with a one-time code.'
              },
              {
                q: 'What does the device status mean?',
                a: 'Active means the device is online and reachable. Inactive means it is offline or not connected to the service.'
              }
            ]} />

            <FAQGroup title="Sessions & Control" faqs={[
              {
                q: 'Can I send keyboard and mouse input?',
                a: 'Yes. Start a session from Devices or Dashboard, then use the control toolbar to send keyboard and mouse events.'
              },
              {
                q: 'Is the connection secure?',
                a: 'All sessions are encrypted in transit. You can also configure permissions and time limits in device settings.'
              }
            ]} />

            <FAQGroup title="Account & Security" faqs={[
              {
                q: 'I forgot my password—what do I do?',
                a: 'On the Log in page, click “Forgot password?” and follow the instructions to reset it.'
              },
              {
                q: 'How do I change my email or password?',
                a: 'Open your profile or account settings (top right avatar) and update your credentials.'
              }
            ]} />
          </div>

          <aside className="lg:col-span-1">
            <div className="p-5 rounded-xl border border-lightgray bg-white/90 backdrop-blur-sm shadow-sm">
              <h3 className="font-semibold mb-2">Need more help?</h3>
              <p className="text-caption-small text-darkgray mb-4">Our docs and community are here for you.</p>
              <div className="space-y-2">
                <a className="block text-secondary underline" href="#" onClick={(e)=>e.preventDefault()}>Documentation (coming soon)</a>
                <a className="block text-secondary underline" href="#" onClick={(e)=>e.preventDefault()}>Community forum (coming soon)</a>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function FAQGroup({ title, faqs }: { title: string; faqs: { q: string; a: string }[] }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-semibold text-primary mb-3">{title}</h2>
      <div className="divide-y divide-lightgray rounded-xl border border-lightgray bg-white overflow-hidden">
        {faqs.map((item, idx) => (
          <details key={idx} className="group open:shadow-none">
            <summary className="cursor-pointer list-none p-4 flex items-center justify-between hover:bg-background/60">
              <span className="font-medium">{item.q}</span>
              <span className="ml-4 h-6 w-6 inline-flex items-center justify-center rounded-full bg-tertiary text-primary">+</span>
            </summary>
            <div className="p-4 pt-0 text-darkgray text-body-small">{item.a}</div>
          </details>
        ))}
      </div>
    </div>
  );
}

export default Help;

