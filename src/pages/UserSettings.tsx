import React, { useEffect, useState } from 'react';
import { getUserId, clearTokens, saveUserRole, saveUserId } from 'src/utils/auth.ts';
import { getUserRequest, updateUserSelfRequest } from 'src/services/backend/usersRequests.ts';
import { logoutRequest } from 'src/services/backend/authRequests.ts';
import type { UserResponse } from 'src/services/backend/usersRequests.ts';
import { useTranslation } from 'react-i18next';

function UserSettings() {
  const { t } = useTranslation('userSettings');
  const userId = getUserId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [user, setUser] = useState<UserResponse | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!userId) { setLoading(false); return; }
      try {
        const res = await getUserRequest(userId);
        setUser(res.data);
        setUsername(res.data.username);
        setEmail(res.data.email);
      } catch (err) {
        setErrors([t('errors.loadFailed')]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [userId, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]); setSuccess(null);
    if (!userId) { return; }
    setSaving(true);
    try {
      const payload: { username?: string; email?: string; password?: string } = {};
      if (username !== user?.username) payload.username = username;
      if (email !== user?.email) payload.email = email;
      if (password.length > 0) payload.password = password;

      const res = await updateUserSelfRequest(userId, payload);
      setUser(res.data);
      setPassword('');
      setSuccess(t('messages.saved'));
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
        setErrors(msgs.length ? msgs : [t('errors.saveFailed')]);
      } else if (resp?.status === 403) {
        setErrors([t('errors.forbidden')]);
      } else {
        setErrors([t('errors.saveFailed')]);
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
      clearTokens();
      saveUserRole(null);
      saveUserId('');
      window.location.replace('/login');
    }
  }

  if (loading) {
    return <div className="p-6"><p>{t('loading')}</p></div>;
  }

  if (!userId) {
    return <div className="p-6"><p>{t('errors.notLoggedIn')}</p></div>;
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-semibold mb-4">{t('title')}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.length > 0 && (
          <div className="space-y-1">
            {errors.map(err => <p key={err} className="text-error text-sm">{err}</p>)}
          </div>
        )}
        {success && <p className="text-green-600 text-sm">{success}</p>}
        <div>
          <label className="text-body-small" htmlFor="username">{t('fields.username')}</label>
          <input
            id="username"
            type="text"
            className="w-full"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-body-small" htmlFor="email">{t('fields.email')}</label>
          <input
            id="email"
            type="email"
            className="w-full"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-body-small" htmlFor="password">{t('fields.password')} <span className="opacity-60">({t('fields.passwordHelp')})</span></label>
          <input
            id="password"
            type="password"
            className="w-full"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={t('fields.passwordPlaceholder')}
          />
        </div>
        <button type="submit" className="button-primary" disabled={saving}>{saving ? t('buttons.saving') : t('buttons.save')}</button>
      </form>
      <button type="button" onClick={handleLogout} disabled={logoutLoading} className="btn-danger w-full mt-8">
        {logoutLoading ? '…' : t('userSettings:buttons.logout')}
      </button>
    </div>
  );
}

export default UserSettings;
