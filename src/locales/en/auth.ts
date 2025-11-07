const auth = {
  login: {
    title: 'Log in to your account',
    email: 'Email',
    password: 'Password',
    submit: 'Log In',
    noAccount: "Don't have an account? <signupLink>Sign up</signupLink>",
    errors: {
      invalid: 'Invalid email or password.'
    }
  },
  signup: {
    title: 'Sign up your account',
    username: 'Username',
    email: 'Email',
    password: 'Password',
    confirm: 'Confirm Password',
    submit: 'Sign Up',
    haveAccount: 'Already have an account? <loginLink>Log in</loginLink>',
    errors: {
      invalidInput: 'Invalid input.',
      failed: 'Sign up failed.'
    }
  }
};
export default auth;

