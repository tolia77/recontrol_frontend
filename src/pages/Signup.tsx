import { useState } from 'react';
import logoFull from 'src/assets/img/logo-full.svg';
import { Link, useNavigate } from 'react-router';
import { registerRequest } from 'src/services/backend/authRequests';
import { saveTokens, saveUserId } from 'src/utils/auth';
import { useTranslation, Trans } from 'react-i18next';
import { Button } from 'src/components/ui/Button';

interface ApiError {
  response?: {
    status?: number;
    data?: Record<string, unknown>;
  };
}

function Signup() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors([]);

    if (password !== confirmPassword) {
      setErrors([t('signup.errors.passwordMismatch', 'Passwords do not match')]);
      return;
    }

    setLoading(true);

    try {
      const res = await registerRequest(username, email, password);
      saveTokens(res.data.access_token, res.data.refresh_token);
      saveUserId(res.data.user_id);
      navigate('/dashboard');
    } catch (error: unknown) {
      const err = error as ApiError;
      if (err?.response?.status === 400) {
        setErrors([t('signup.errors.invalidInput')]);
      } else if (err?.response?.status === 422) {
        const resp = err.response.data;
        if (resp && typeof resp === 'object') {
          const msgs: string[] = [];
          Object.entries(resp).forEach(([key, value]) => {
            const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
            if (Array.isArray(value)) {
              value.forEach(v => msgs.push(`${capitalizedKey} ${String(v)}`));
            } else {
              msgs.push(`${capitalizedKey} ${String(value)}`);
            }
          });
          setErrors(msgs.length ? msgs : [t('signup.errors.failed')]);
        } else {
          setErrors([t('signup.errors.failed')]);
        }
      } else {
        setErrors([t('signup.errors.failed')]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-tertiary/30 to-background">
      <div className="flex flex-col items-center space-y-8 p-8">
        <img src={logoFull} alt="logo" className="h-16" />
        <h1 className="text-3xl font-bold text-primary">{t('signup.title')}</h1>

        <form onSubmit={handleSubmit} className="space-y-4 min-w-[350px]">
          {errors.length > 0 && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-lg space-y-1">
              {errors.map(err => (
                <p key={err} className="text-error text-sm">{err}</p>
              ))}
            </div>
          )}

          <div>
            <label className="text-sm font-medium" htmlFor="username">
              {t('signup.username')}
            </label>
            <input
              className="w-full mt-1"
              type="text"
              id="username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="email">
              {t('signup.email')}
            </label>
            <input
              className="w-full mt-1"
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="password">
              {t('signup.password')}
            </label>
            <input
              className="w-full mt-1"
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="confirmPassword">
              {t('signup.confirm')}
            </label>
            <input
              className="w-full mt-1"
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" loading={loading} className="w-full">
            {t('signup.submit')}
          </Button>

          <p className="text-sm text-center">
            <Trans
              ns="auth"
              i18nKey="signup.haveAccount"
              components={{
                loginLink: <Link className="text-secondary hover:underline" to="/login" />
              }}
            />
          </p>
        </form>
      </div>
    </main>
  );
}

export default Signup;
