export const pricing = {
  hero: {
    eyebrow: "Тарифи",
    headline: "Тарифи, що ростуть разом із вами",
    sub: "Почніть безкоштовно. Оновлюйте план, коли потрібно більше пристроїв, сценаріїв і можливостей AI. Ціни в гривнях, щомісячна оплата.",
  },
  popular: "Найпопулярніший",
  cta: {
    free: "Почати",
    paid: "Обрати {{plan}}",
  },
  billingNote:
    "Платні плани оплачуються щомісяця у гривнях (₴). Скасуйте будь-коли — план діє до кінця оплаченого періоду.",
  plans: {
    free: {
      name: "Безкоштовний",
      price: "₴0",
      period: "назавжди",
      tagline: "Щоб спробувати",
      features: [
        { text: "2 пристрої", included: true },
        { text: "3 сценарії", included: true },
        { text: "2 000 AI-токенів / день", included: true },
        { text: "AI-чернетки", included: false },
        { text: "Спільний доступ до пристроїв", included: false },
      ],
    },
    pro: {
      name: "Pro",
      price: "₴199",
      period: "/міс.",
      tagline: "Для активних користувачів",
      features: [
        { text: "10 пристроїв", included: true },
        { text: "25 сценаріїв", included: true },
        { text: "10 000 AI-токенів / день", included: true },
        { text: "30 AI-чернеток / день", included: true },
        { text: "Спільний доступ до пристроїв", included: true },
      ],
    },
    advanced: {
      name: "Advanced",
      price: "₴499",
      period: "/міс.",
      tagline: "Для команд, що зростають",
      features: [
        { text: "50 пристроїв", included: true },
        { text: "Необмежено сценаріїв", included: true },
        { text: "50 000 AI-токенів / день", included: true },
        { text: "30 AI-чернеток / день", included: true },
        { text: "Спільний доступ до пристроїв", included: true },
      ],
    },
    business: {
      name: "Business",
      price: "₴1 499",
      period: "/міс.",
      tagline: "Для організацій",
      features: [
        { text: "Необмежено пристроїв", included: true },
        { text: "Необмежено сценаріїв", included: true },
        { text: "200 000 AI-токенів / день", included: true },
        { text: "100 AI-чернеток / день", included: true },
        { text: "Спільний доступ до пристроїв", included: true },
      ],
    },
  },
};
