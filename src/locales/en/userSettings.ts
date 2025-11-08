const userSettings = {
  title: 'User settings',
  loading: 'Loading user…',
  fields: {
    username: 'Username',
    email: 'Email',
    password: 'New password',
    passwordHelp: 'leave blank to keep current',
    passwordPlaceholder: 'Leave blank to keep existing password'
  },
  buttons: {
    save: 'Save changes',
    saving: 'Saving…',
    logout: 'Log out'
  },
  messages: {
    saved: 'Settings saved.'
  },
  errors: {
    loadFailed: 'Failed to load user.',
    saveFailed: 'Failed to save changes.',
    forbidden: 'You are not allowed to perform this action.',
    notLoggedIn: 'You must be logged in to view settings.'
  }
};
export default userSettings;
