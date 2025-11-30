import { useEffect, useState } from 'react';
import { getUserId, clearAuth } from 'src/utils/auth';
import { getUserRequest, updateUserSelfRequest } from 'src/services/backend/usersRequests';
import { logoutRequest } from 'src/services/backend/authRequests';
import type { UserResponse } from 'src/services/backend/usersRequests';
import { useTranslation } from 'react-i18next';
import { useToast } from 'src/components/ui/Toast';
import { Button } from 'src/components/ui/Button';
import { LoadingOverlay } from 'src/components/ui/Spinner';

function UserSettings() {
  const { t } = useTranslation('userSettings');
  const toast = useToast();
  const userId = getUserId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [user, setUser] = useState<UserResponse | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    async function load() {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        const res = await getUserRequest(userId);
        setUser(res.data);
        setUsername(res.data.username);
        setEmail(res.data.email);
      } catch {
        toast.error(t('errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [userId, t, toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setSaving(true);
    try {
      const payload: { username?: string; email?: string; password?: string } = {};
      if (username !== user?.username) payload.username = username;
      if (email !== user?.email) payload.email = email;
      if (password.length > 0) payload.password = password;

      const res = await updateUserSelfRequest(userId, payload);
      setUser(res.data);
      setPassword('');
      toast.success(t('messages.saved'));
    } catch (error) {
      const resp = (error as { response?: { status?: number; data?: unknown } }).response;
      if (resp?.status === 422) {
        const data = resp.data;
        const msgs: string[] = [];
        if (data && typeof data === 'object') {
          Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
            const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
            if (Array.isArray(value)) {
              value.forEach(v => msgs.push(`${capitalizedKey} ${String(v)}`));
            } else {
              msgs.push(`${capitalizedKey} ${String(value)}`);
            }
          });
        }
        toast.error(msgs.length ? msgs.join(', ') : t('errors.saveFailed'));
      } else if (resp?.status === 403) {
        toast.error(t('errors.forbidden'));
      } else {
        toast.error(t('errors.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLogoutLoading(true);
    try {
      await logoutRequest();
    } catch {
      // ignore error; proceed with local cleanup
    } finally {
      clearAuth();
      window.location.replace('/login');
    }
  }

  if (loading) {
    return <LoadingOverlay message={t('loading')} />;
  }

  if (!userId) {
    return (
      <div className="p-6">
        <p>{t('errors.notLoggedIn')}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-semibold mb-4">{t('title')}</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-text" htmlFor="username">
            {t('fields.username')}
          </label>
          <input
            id="username"
            type="text"
            className="w-full mt-1"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium text-text" htmlFor="email">
            {t('fields.email')}
          </label>
          <input
            id="email"
            type="email"
            className="w-full mt-1"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium text-text" htmlFor="password">
            {t('fields.password')}{' '}
            <span className="opacity-60">({t('fields.passwordHelp')})</span>
          </label>
          <input
            id="password"
            type="password"
            className="w-full mt-1"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={t('fields.passwordPlaceholder')}
          />
        </div>

        <Button type="submit" loading={saving}>
          {saving ? t('buttons.saving') : t('buttons.save')}
        </Button>
      </form>

      <Button
        variant="danger"
        onClick={handleLogout}
        loading={logoutLoading}
        className="w-full mt-8"
      >
        {t('buttons.logout')}
      </Button>
    </div>
  );
}

export default UserSettings;
