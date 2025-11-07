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
          a: 'Click Sign up on the landing page or use the button above, then follow the steps to verify your email.'
        },
        {
          q: 'Do I need to install anything on my device?',
          a: 'Yes, you will register your device using the agent provided in the devices section of the app. Instructions are shown when adding a device.'
        }
      ]
    },
    devices: {
      title: 'Devices',
      items: [
        {
          q: 'How do I add a new device?',
          a: 'Go to Devices, click Add device (or the plus button), and follow the instructions to link your device with a one-time code.'
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
          q: 'I forgot my password—what do I do?',
          a: 'On the Log in page, click “Forgot password?” and follow the instructions to reset it.'
        },
        {
          q: 'How do I change my email or password?',
          a: 'Open your profile or account settings (top right avatar) and update your credentials.'
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
