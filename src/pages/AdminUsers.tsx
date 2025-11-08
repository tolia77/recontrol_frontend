import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getUserRole, getUserId, saveUserRole } from 'src/utils/auth.ts';
import { listUsersRequest, createUserAdminRequest, updateUserAdminRequest, deleteUserAdminRequest, type UserResponse } from 'src/services/backend/usersRequests.ts';

interface EditableRowState {
  id: number | string;
  username: string;
  email: string;
  role: string;
  password: string;
  saving: boolean;
}

const AdminUsers: React.FC = () => {
  const { t } = useTranslation('adminUsers');
  const currentRole = getUserRole();
  const currentUserId = getUserId();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create form state
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'user' });
  const [creating, setCreating] = useState(false);

  // Editing state map
  const [editing, setEditing] = useState<Record<string, EditableRowState>>({});

  const loadUsers = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await listUsersRequest();
      setUsers(res.data);
    } catch (e: any) {
      setError(t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const beginEdit = (u: UserResponse) => {
    setEditing(prev => ({ ...prev, [String(u.id)]: { id: u.id, username: u.username, email: u.email, role: u.role || 'user', password: '', saving: false } }));
  };
  const cancelEdit = (id: number | string) => {
    setEditing(prev => { const copy = { ...prev }; delete copy[String(id)]; return copy; });
  };
  const changeEditField = (id: number | string, field: keyof EditableRowState, value: string) => {
    setEditing(prev => ({ ...prev, [String(id)]: { ...prev[String(id)], [field]: value } }));
  };

  const saveEdit = async (row: EditableRowState) => {
    setEditing(prev => ({ ...prev, [String(row.id)]: { ...row, saving: true } }));
    setError(null); setSuccess(null);
    try {
      const payload: any = {};
      if (row.username.trim() !== users.find(u => u.id === row.id)?.username) payload.username = row.username.trim();
      if (row.email.trim() !== users.find(u => u.id === row.id)?.email) payload.email = row.email.trim();
      if (row.password.trim().length > 0) payload.password = row.password.trim();
      if (row.role !== users.find(u => u.id === row.id)?.role) payload.role = row.role;
      const res = await updateUserAdminRequest(row.id, payload);
      setUsers(prev => prev.map(u => u.id === row.id ? res.data : u));
      // If current user updated own role adjust localStorage
      if (String(row.id) === String(currentUserId) && res.data.role) {
        saveUserRole(res.data.role);
      }
      setSuccess(t('messages.saved'));
      cancelEdit(row.id);
    } catch (e: any) {
      if (e?.response?.status === 422) {
        const resp = e.response.data;
        const msgs: string[] = [];
        if (resp && typeof resp === 'object') {
          Object.entries(resp).forEach(([k, v]) => {
            const keyCap = k.charAt(0).toUpperCase() + k.slice(1);
            if (Array.isArray(v)) v.forEach(x => msgs.push(`${keyCap} ${String(x)}`)); else msgs.push(`${keyCap} ${String(v)}`);
          });
        }
        setError(msgs.join('\n') || t('errors.saveFailed'));
      } else if (e?.response?.status === 403) {
        setError(t('errors.forbidden'));
      } else {
        setError(t('errors.saveFailed'));
      }
    } finally {
      setEditing(prev => ({ ...prev, [String(row.id)]: { ...row, saving: false } }));
    }
  };

  const handleDelete = async (u: UserResponse) => {
    if (!window.confirm(t('messages.deleteConfirm'))) return;
    setError(null); setSuccess(null);
    try {
      await deleteUserAdminRequest(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
      setSuccess(t('messages.deleted'));
      // If self deleted clear role
      if (String(u.id) === String(currentUserId)) {
        saveUserRole(null);
      }
    } catch (e: any) {
      setError(t('errors.deleteFailed'));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true); setError(null); setSuccess(null);
    try {
      const res = await createUserAdminRequest({
        username: newUser.username.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        role: newUser.role
      });
      setUsers(prev => [...prev, res.data]);
      setSuccess(t('messages.created'));
      setNewUser({ username: '', email: '', password: '', role: 'user' });
    } catch (e: any) {
      if (e?.response?.status === 422) {
        const resp = e.response.data;
        const msgs: string[] = [];
        if (resp && typeof resp === 'object') {
          Object.entries(resp).forEach(([k, v]) => {
            const keyCap = k.charAt(0).toUpperCase() + k.slice(1);
            if (Array.isArray(v)) v.forEach(x => msgs.push(`${keyCap} ${String(x)}`)); else msgs.push(`${keyCap} ${String(v)}`);
          });
        }
        setError(msgs.join('\n') || t('errors.createFailed'));
      } else if (e?.response?.status === 403) {
        setError(t('errors.forbidden'));
      } else {
        setError(t('errors.createFailed'));
      }
    } finally {
      setCreating(false);
    }
  };

  if (currentRole !== 'admin') {
    return <div className="p-6"><p className="text-sm text-gray-600">{t('errors.forbidden')}</p></div>;
  }

  return (
    <div className="px-5 lg:px-10 mt-6 mb-10">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">{t('title')}</h1>
          <p className="text-sm text-gray-600">{t('subtitle')}</p>
        </div>
        <button onClick={() => loadUsers()} className="btn-secondary h-9">↻</button>
      </div>

      {/* Create user */}
      <form onSubmit={handleCreate} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6 space-y-3 max-w-xl">
        <h2 className="text-lg font-semibold">{t('create.title')}</h2>
        {error && <pre className="text-error whitespace-pre-wrap text-xs">{error}</pre>}
        {success && <p className="text-green-600 text-xs">{success}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs flex flex-col gap-1">
            {t('create.username')}
            <input type="text" value={newUser.username} onChange={e => setNewUser(s => ({ ...s, username: e.target.value }))} required />
          </label>
          <label className="text-xs flex flex-col gap-1">
            {t('create.email')}
            <input type="email" value={newUser.email} onChange={e => setNewUser(s => ({ ...s, email: e.target.value }))} required />
          </label>
          <label className="text-xs flex flex-col gap-1">
            {t('create.password')}
            <input type="password" value={newUser.password} onChange={e => setNewUser(s => ({ ...s, password: e.target.value }))} required />
          </label>
          <label className="text-xs flex flex-col gap-1">
            {t('create.role')}
            <select value={newUser.role} onChange={e => setNewUser(s => ({ ...s, role: e.target.value }))}>
              <option value="user">{t('roles.user')}</option>
              <option value="admin">{t('roles.admin')}</option>
            </select>
          </label>
        </div>
        <button type="submit" className="btn-primary" disabled={creating}>{creating ? t('messages.creating') : t('create.submit')}</button>
      </form>

      {/* Users table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h2 className="text-lg font-semibold mb-4">{t('title')}</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-lightgray)', borderTopColor: 'var(--color-primary)' }} />
            {t('messages.loading')}
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-600">{t('messages.empty')}</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white shadow-sm">
                <tr className="text-left text-gray-700 border-b">
                  <th className="px-2 py-2">{t('table.username')}</th>
                  <th className="px-2 py-2">{t('table.email')}</th>
                  <th className="px-2 py-2">{t('table.role')}</th>
                  <th className="px-2 py-2">{t('table.created')}</th>
                  <th className="px-2 py-2">{t('table.updated')}</th>
                  <th className="px-2 py-2">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const edit = editing[String(u.id)];
                  const isEditing = !!edit;
                  return (
                    <tr key={u.id} className="border-b last:border-b-0 hover:bg-gray-50 align-top">
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <input className="small-input w-full" value={edit.username} onChange={e => changeEditField(u.id, 'username', e.target.value)} />
                        ) : (
                          u.username
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <input className="small-input w-full" value={edit.email} onChange={e => changeEditField(u.id, 'email', e.target.value)} />
                        ) : (
                          u.email
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <select className="small-input w-full" value={edit.role} onChange={e => changeEditField(u.id, 'role', e.target.value)}>
                            <option value="user">{t('roles.user')}</option>
                            <option value="admin">{t('roles.admin')}</option>
                          </select>
                        ) : (
                          <span className={u.role === 'admin' ? 'text-primary font-medium' : ''}>{u.role}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-500">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                      <td className="px-2 py-2 text-xs text-gray-500">{u.updated_at ? new Date(u.updated_at).toLocaleDateString() : '-'}</td>
                      <td className="px-2 py-2 space-y-1">
                        {!isEditing && (
                          <div className="flex gap-2 flex-wrap">
                            <button className="btn-secondary" onClick={() => beginEdit(u)}>{t('table.edit')}</button>
                            <button className="btn-danger" onClick={() => handleDelete(u)}>{t('table.delete')}</button>
                          </div>
                        )}
                        {isEditing && (
                          <div className="flex gap-2 flex-wrap">
                            <input type="password" className="small-input" placeholder={t('create.password')} value={edit.password} onChange={e => changeEditField(u.id, 'password', e.target.value)} />
                            <button className="btn-primary" disabled={edit.saving} onClick={() => saveEdit(edit)}>{edit.saving ? t('messages.updating') : t('table.save')}</button>
                            <button className="btn-secondary" disabled={edit.saving} onClick={() => cancelEdit(u.id)}>{t('table.cancel')}</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;

