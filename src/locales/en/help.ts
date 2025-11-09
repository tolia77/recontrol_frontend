// English translations for Help page
const help = {
  header: {
    title: 'Help & FAQ',
    subtitle: 'Find quick answers to common questions. Still stuck? <signupLink>create an account</signupLink> and reach out.'
  },
  actions: {
    login: 'Log in',
    signup: 'Sign up'
  },
  groups: {
    getting_started: {
      title: 'Getting started',
      items: [
        {
          q: 'What is ReControl?',
          a: 'ReControl lets you securely view and control your devices from anywhere—stream screens, send keyboard/mouse input, and run commands.'
        },
        {
          q: 'How do I create an account?',
          a: 'Click Sign up on the landing page or use the button above to create an account.'
        },
        {
          q: 'Do I need to install anything on my device?',
          a: 'Yes — you need to download our desktop application using the link in the Devices section (link will be provided).'
        }
      ]
    },
    devices: {
      title: 'Devices',
      items: [
        {
          q: 'How do I add a new device?',
          a: 'Download our application (link) and log in to your account. Your device will be automatically connected.'
        },
        {
          q: 'What does the device status mean?',
          a: 'Active means the device is online and reachable. Inactive means it is offline or not connected to the service.'
        }
      ]
    },
    sessions: {
      title: 'Sessions & Control',
      items: [
        {
          q: 'Can I send keyboard and mouse input?',
          a: 'Yes. Start a session from Devices or Dashboard, then use the control toolbar to send keyboard and mouse events.'
        },
        {
          q: 'Is the connection secure?',
          a: 'All sessions are encrypted in transit. You can also configure permissions and time limits in device settings.'
        }
      ]
    },
    account: {
      title: 'Account & Security',
      items: [
        {
          q: 'How do I change my email or password?',
          a: 'Open your profile from the sidebar (Profile tab) and update your credentials there.'
        },
        {
          q: 'How do I share a device with someone?',
          a: 'Open the device settings, choose "Share", and enter the email address of the user you want to share with. You can assign permissions and expiration.'
        }
      ]
    },
    more_help: {
      title: 'Need more help?',
      description: 'Our docs and community are here for you.',
      docs_link: 'Documentation (coming soon)',
      community_link: 'Community forum (coming soon)'
    }
  },
  lang: {
    switch_label: 'Language',
    english: 'English',
    ukrainian: 'Ukrainian'
  }
};

export default help;
