import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getUserRole, getUserId, saveUserRole } from 'src/utils/auth';
import {
  listUsersRequest,
  createUserAdminRequest,
  updateUserAdminRequest,
  deleteUserAdminRequest,
  type UserResponse
} from 'src/services/backend/usersRequests';
import { useToast } from 'src/components/ui/Toast';
import { Button } from 'src/components/ui/Button';
import { Spinner } from 'src/components/ui/Spinner';

interface EditableRowState {
  id: number | string;
  username: string;
  email: string;
  role: string;
  password: string;
  saving: boolean;
}

interface ApiError {
  response?: {
    status?: number;
    data?: Record<string, unknown>;
  };
}

const AdminUsers = () => {
  const { t } = useTranslation('adminUsers');
  const toast = useToast();

  const currentRole = getUserRole();
  const currentUserId = getUserId();

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'user' });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Record<string, EditableRowState>>({});

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUsersRequest();
      setUsers(res.data);
    } catch {
      toast.error(t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const beginEdit = (u: UserResponse) => {
    setEditing(prev => ({
      ...prev,
      [String(u.id)]: {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role || 'user',
        password: '',
        saving: false
      }
    }));
  };

  const cancelEdit = (id: number | string) => {
    setEditing(prev => {
      const copy = { ...prev };
      delete copy[String(id)];
      return copy;
    });
  };

  const changeEditField = (id: number | string, field: keyof EditableRowState, value: string) => {
    setEditing(prev => ({
      ...prev,
      [String(id)]: { ...prev[String(id)], [field]: value }
    }));
  };

  const saveEdit = async (row: EditableRowState) => {
    setEditing(prev => ({ ...prev, [String(row.id)]: { ...row, saving: true } }));

    try {
      const payload: Record<string, string> = {};
      const originalUser = users.find(u => u.id === row.id);

      if (row.username.trim() !== originalUser?.username) payload.username = row.username.trim();
      if (row.email.trim() !== originalUser?.email) payload.email = row.email.trim();
      if (row.password.trim().length > 0) payload.password = row.password.trim();
      if (row.role !== originalUser?.role) payload.role = row.role;

      const res = await updateUserAdminRequest(row.id, payload);
      setUsers(prev => prev.map(u => u.id === row.id ? res.data : u));

      if (String(row.id) === String(currentUserId) && res.data.role) {
        saveUserRole(res.data.role);
      }

      toast.success(t('messages.saved'));
      cancelEdit(row.id);
    } catch (e) {
      const err = e as ApiError;
      if (err?.response?.status === 422) {
        const resp = err.response.data;
        const msgs: string[] = [];
        if (resp && typeof resp === 'object') {
          Object.entries(resp).forEach(([k, v]) => {
            const keyCap = k.charAt(0).toUpperCase() + k.slice(1);
            if (Array.isArray(v)) {
              v.forEach(x => msgs.push(`${keyCap} ${String(x)}`));
            } else {
              msgs.push(`${keyCap} ${String(v)}`);
            }
          });
        }
        toast.error(msgs.join(', ') || t('errors.saveFailed'));
      } else if (err?.response?.status === 403) {
        toast.error(t('errors.forbidden'));
      } else {
        toast.error(t('errors.saveFailed'));
      }
    } finally {
      setEditing(prev => ({ ...prev, [String(row.id)]: { ...row, saving: false } }));
    }
  };

  const handleDelete = async (u: UserResponse) => {
    if (!window.confirm(t('messages.deleteConfirm'))) return;

    try {
      await deleteUserAdminRequest(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
      toast.success(t('messages.deleted'));

      if (String(u.id) === String(currentUserId)) {
        saveUserRole(null);
      }
    } catch {
      toast.error(t('errors.deleteFailed'));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await createUserAdminRequest({
        username: newUser.username.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        role: newUser.role
      });
      setUsers(prev => [...prev, res.data]);
      toast.success(t('messages.created'));
      setNewUser({ username: '', email: '', password: '', role: 'user' });
    } catch (e) {
      const err = e as ApiError;
      if (err?.response?.status === 422) {
        const resp = err.response.data;
        const msgs: string[] = [];
        if (resp && typeof resp === 'object') {
          Object.entries(resp).forEach(([k, v]) => {
            const keyCap = k.charAt(0).toUpperCase() + k.slice(1);
            if (Array.isArray(v)) {
              v.forEach(x => msgs.push(`${keyCap} ${String(x)}`));
            } else {
              msgs.push(`${keyCap} ${String(v)}`);
            }
          });
        }
        toast.error(msgs.join(', ') || t('errors.createFailed'));
      } else if (err?.response?.status === 403) {
        toast.error(t('errors.forbidden'));
      } else {
        toast.error(t('errors.createFailed'));
      }
    } finally {
      setCreating(false);
    }
  };

  if (currentRole !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">{t('errors.forbidden')}</p>
      </div>
    );
  }

  return (
    <div className="px-5 lg:px-10 mt-6 mb-10">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">{t('title')}</h1>
          <p className="text-sm text-gray-600">{t('subtitle')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => loadUsers()}>
          ↻
        </Button>
      </div>

      {/* Create user form */}
      <form onSubmit={handleCreate} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6 space-y-3 max-w-xl">
        <h2 className="text-lg font-semibold">{t('create.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs">{t('create.username')}</label>
            <input
              type="text"
              value={newUser.username}
              onChange={e => setNewUser(s => ({ ...s, username: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs">{t('create.email')}</label>
            <input
              type="email"
              value={newUser.email}
              onChange={e => setNewUser(s => ({ ...s, email: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs">{t('create.password')}</label>
            <input
              type="password"
              value={newUser.password}
              onChange={e => setNewUser(s => ({ ...s, password: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs">{t('create.role')}</label>
            <select
              value={newUser.role}
              onChange={e => setNewUser(s => ({ ...s, role: e.target.value }))}
              className="px-3 py-2 border border-lightgray rounded-lg text-sm"
            >
              <option value="user">{t('roles.user')}</option>
              <option value="admin">{t('roles.admin')}</option>
            </select>
          </div>
        </div>
        <Button type="submit" loading={creating}>
          {creating ? t('messages.creating') : t('create.submit')}
        </Button>
      </form>

      {/* Users table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h2 className="text-lg font-semibold mb-4">{t('title')}</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Spinner size="sm" />
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
                          <input
                            className="small-input w-full"
                            value={edit.username}
                            onChange={e => changeEditField(u.id, 'username', e.target.value)}
                          />
                        ) : (
                          u.username
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <input
                            className="small-input w-full"
                            value={edit.email}
                            onChange={e => changeEditField(u.id, 'email', e.target.value)}
                          />
                        ) : (
                          u.email
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <select
                            className="small-input w-full"
                            value={edit.role}
                            onChange={e => changeEditField(u.id, 'role', e.target.value)}
                          >
                            <option value="user">{t('roles.user')}</option>
                            <option value="admin">{t('roles.admin')}</option>
                          </select>
                        ) : (
                          <span className={u.role === 'admin' ? 'text-primary font-medium' : ''}>
                            {u.role}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-500">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-500">
                        {u.updated_at ? new Date(u.updated_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-2 py-2 space-y-1">
                        {!isEditing && (
                          <div className="flex gap-2 flex-wrap">
                            <Button variant="secondary" size="sm" onClick={() => beginEdit(u)}>
                              {t('table.edit')}
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => handleDelete(u)}>
                              {t('table.delete')}
                            </Button>
                          </div>
                        )}
                        {isEditing && (
                          <div className="flex gap-2 flex-wrap items-center">
                            <input
                              type="password"
                              className="small-input"
                              placeholder={t('create.password')}
                              value={edit.password}
                              onChange={e => changeEditField(u.id, 'password', e.target.value)}
                            />
                            <Button
                              size="sm"
                              loading={edit.saving}
                              onClick={() => saveEdit(edit)}
                            >
                              {edit.saving ? t('messages.updating') : t('table.save')}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={edit.saving}
                              onClick={() => cancelEdit(u.id)}
                            >
                              {t('table.cancel')}
                            </Button>
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
