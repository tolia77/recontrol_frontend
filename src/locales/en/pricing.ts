export const pricing = {
  hero: {
    eyebrow: "Pricing",
    headline: "Plans that scale with you",
    sub: "Start free. Upgrade when you need more devices, scenarios, and AI power. Prices in UAH, billed monthly.",
  },
  popular: "Most popular",
  cta: {
    free: "Get started",
    paid: "Choose {{plan}}",
  },
  billingNote:
    "Paid plans are billed monthly in UAH (₴). Cancel anytime — your plan stays active until the end of the billing period.",
  plans: {
    free: {
      name: "Free",
      price: "₴0",
      period: "forever",
      tagline: "For trying things out",
      features: [
        { text: "2 devices", included: true },
        { text: "3 scenarios", included: true },
        { text: "2,000 AI tokens / day", included: true },
        { text: "AI drafts", included: false },
        { text: "Device sharing", included: false },
      ],
    },
    pro: {
      name: "Pro",
      price: "₴199",
      period: "/mo",
      tagline: "For power users",
      features: [
        { text: "10 devices", included: true },
        { text: "25 scenarios", included: true },
        { text: "10,000 AI tokens / day", included: true },
        { text: "30 AI drafts / day", included: true },
        { text: "Device sharing", included: true },
      ],
    },
    advanced: {
      name: "Advanced",
      price: "₴499",
      period: "/mo",
      tagline: "For growing teams",
      features: [
        { text: "50 devices", included: true },
        { text: "Unlimited scenarios", included: true },
        { text: "50,000 AI tokens / day", included: true },
        { text: "30 AI drafts / day", included: true },
        { text: "Device sharing", included: true },
      ],
    },
    business: {
      name: "Business",
      price: "₴1,499",
      period: "/mo",
      tagline: "For organizations",
      features: [
        { text: "Unlimited devices", included: true },
        { text: "Unlimited scenarios", included: true },
        { text: "200,000 AI tokens / day", included: true },
        { text: "100 AI drafts / day", included: true },
        { text: "Device sharing", included: true },
      ],
    },
  },
};
