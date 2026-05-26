import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getUserRole, getUserId, saveUserRole } from "src/utils/auth";
import {
  listUsersRequest,
  createUserAdminRequest,
  updateUserAdminRequest,
  deleteUserAdminRequest,
  type UserResponse,
} from "src/services/backend/usersService";
import { getErrorMessage } from "src/utils/getErrorMessage";
import { useToast } from "src/components/ui/Toast";
import {
  Button,
  Input,
  Card,
  LoadingState,
  EmptyState,
  ConfirmModal,
} from "src/components/ui";

interface EditableRowState {
  id: number | string;
  username: string;
  email: string;
  role: string;
  password: string;
  saving: boolean;
}

const AdminUsers = () => {
  const { t } = useTranslation("adminUsers");
  const toast = useToast();

  const currentRole = getUserRole();
  const currentUserId = getUserId();

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    role: "user",
  });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Record<string, EditableRowState>>({});
  const [deleteUserTarget, setDeleteUserTarget] = useState<UserResponse | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUsersRequest();
      setUsers(res.data);
    } catch {
      toast.error(t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const beginEdit = (u: UserResponse) => {
    setEditing((prev) => ({
      ...prev,
      [String(u.id)]: {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role || "user",
        password: "",
        saving: false,
      },
    }));
  };

  const cancelEdit = (id: number | string) => {
    setEditing((prev) => {
      const copy = { ...prev };
      delete copy[String(id)];
      return copy;
    });
  };

  const changeEditField = (
    id: number | string,
    field: keyof EditableRowState,
    value: string,
  ) => {
    setEditing((prev) => ({
      ...prev,
      [String(id)]: { ...prev[String(id)], [field]: value },
    }));
  };

  const saveEdit = async (row: EditableRowState) => {
    setEditing((prev) => ({
      ...prev,
      [String(row.id)]: { ...row, saving: true },
    }));

    try {
      const payload: Record<string, string> = {};
      const originalUser = users.find((u) => u.id === row.id);

      if (row.username.trim() !== originalUser?.username)
        payload.username = row.username.trim();
      if (row.email.trim() !== originalUser?.email)
        payload.email = row.email.trim();
      if (row.password.trim().length > 0)
        payload.password = row.password.trim();
      if (row.role !== originalUser?.role) payload.role = row.role;

      const res = await updateUserAdminRequest(row.id, payload);
      setUsers((prev) => prev.map((u) => (u.id === row.id ? res.data : u)));

      if (String(row.id) === String(currentUserId) && res.data.role) {
        saveUserRole(res.data.role);
      }

      toast.success(t("messages.saved"));
      cancelEdit(row.id);
    } catch (e) {
      const status = (e as { response?: { status?: number } }).response?.status;
      if (status === 403) {
        toast.error(t("errors.forbidden"));
      } else {
        toast.error(getErrorMessage(e) || t("errors.saveFailed"));
      }
    } finally {
      setEditing((prev) => ({
        ...prev,
        [String(row.id)]: { ...row, saving: false },
      }));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteUserTarget) return;
    const u = deleteUserTarget;
    setDeleting(true);
    try {
      await deleteUserAdminRequest(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast.success(t("messages.deleted"));
      if (String(u.id) === String(currentUserId)) {
        saveUserRole(null);
      }
    } catch {
      toast.error(t("errors.deleteFailed"));
    } finally {
      setDeleting(false);
      setDeleteUserTarget(null);
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
        role: newUser.role,
      });
      setUsers((prev) => [...prev, res.data]);
      toast.success(t("messages.created"));
      setNewUser({ username: "", email: "", password: "", role: "user" });
    } catch (e) {
      const status = (e as { response?: { status?: number } }).response?.status;
      if (status === 403) {
        toast.error(t("errors.forbidden"));
      } else {
        toast.error(getErrorMessage(e) || t("errors.createFailed"));
      }
    } finally {
      setCreating(false);
    }
  };

  if (currentRole !== "admin") {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">{t("errors.forbidden")}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 mb-10 px-5 lg:px-10">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mb-1 text-3xl font-bold">{t("title")}</h1>
          <p className="text-sm text-gray-600">{t("subtitle")}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          aria-label={t("refreshLabel")}
          onClick={() => loadUsers()}
        >
          ↻
        </Button>
      </div>

      {/* Create user form */}
      <Card className="mb-6 max-w-xl">
        <form onSubmit={handleCreate} className="space-y-3">
          <h2 className="text-lg font-semibold">{t("create.title")}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              label={t("create.username")}
              type="text"
              value={newUser.username}
              onChange={(e) =>
                setNewUser((s) => ({ ...s, username: e.target.value }))
              }
              required
            />
            <Input
              label={t("create.email")}
              type="email"
              value={newUser.email}
              onChange={(e) =>
                setNewUser((s) => ({ ...s, email: e.target.value }))
              }
              required
            />
            <Input
              label={t("create.password")}
              type="password"
              value={newUser.password}
              onChange={(e) =>
                setNewUser((s) => ({ ...s, password: e.target.value }))
              }
              required
            />
            <div className="flex flex-col gap-1">
              <label className="text-text text-sm font-medium">
                {t("create.role")}
              </label>
              <select
                value={newUser.role}
                onChange={(e) =>
                  setNewUser((s) => ({ ...s, role: e.target.value }))
                }
                className="border-lightgray rounded-lg border px-3 py-2 text-sm"
              >
                <option value="user">{t("roles.user")}</option>
                <option value="admin">{t("roles.admin")}</option>
              </select>
            </div>
          </div>
          <Button type="submit" loading={creating}>
            {creating ? t("messages.creating") : t("create.submit")}
          </Button>
        </form>
      </Card>

      {/* Users table */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold">{t("title")}</h2>
        {loading ? (
          <LoadingState message={t("messages.loading")} />
        ) : users.length === 0 ? (
          <EmptyState title={t("messages.empty")} />
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-background sticky top-0 shadow-sm">
                <tr className="text-text border-b text-left">
                  <th className="px-2 py-2">{t("table.username")}</th>
                  <th className="px-2 py-2">{t("table.email")}</th>
                  <th className="px-2 py-2">{t("table.role")}</th>
                  <th className="px-2 py-2">{t("table.created")}</th>
                  <th className="px-2 py-2">{t("table.updated")}</th>
                  <th className="px-2 py-2">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const edit = editing[String(u.id)];
                  const isEditing = !!edit;

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-tertiary border-b align-top last:border-b-0"
                    >
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <Input
                            className="w-full"
                            value={edit.username}
                            onChange={(e) =>
                              changeEditField(u.id, "username", e.target.value)
                            }
                          />
                        ) : (
                          u.username
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <Input
                            type="email"
                            className="w-full"
                            value={edit.email}
                            onChange={(e) =>
                              changeEditField(u.id, "email", e.target.value)
                            }
                          />
                        ) : (
                          u.email
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <select
                            className="border-lightgray w-full rounded-lg border px-3 py-2 text-sm"
                            value={edit.role}
                            onChange={(e) =>
                              changeEditField(u.id, "role", e.target.value)
                            }
                          >
                            <option value="user">{t("roles.user")}</option>
                            <option value="admin">{t("roles.admin")}</option>
                          </select>
                        ) : (
                          <span
                            className={
                              u.role === "admin"
                                ? "text-primary font-medium"
                                : ""
                            }
                          >
                            {u.role}
                          </span>
                        )}
                      </td>
                      <td className="text-darkgray px-2 py-2 text-xs">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="text-darkgray px-2 py-2 text-xs">
                        {u.updated_at
                          ? new Date(u.updated_at).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="space-y-1 px-2 py-2">
                        {!isEditing && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => beginEdit(u)}
                            >
                              {t("table.edit")}
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setDeleteUserTarget(u)}
                            >
                              {t("table.delete")}
                            </Button>
                          </div>
                        )}
                        {isEditing && (
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              type="password"
                              placeholder={t("create.password")}
                              value={edit.password}
                              onChange={(e) =>
                                changeEditField(
                                  u.id,
                                  "password",
                                  e.target.value,
                                )
                              }
                            />
                            <Button
                              size="sm"
                              loading={edit.saving}
                              onClick={() => saveEdit(edit)}
                            >
                              {edit.saving
                                ? t("messages.updating")
                                : t("table.save")}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={edit.saving}
                              onClick={() => cancelEdit(u.id)}
                            >
                              {t("table.cancel")}
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
      </Card>

      <ConfirmModal
        open={deleteUserTarget !== null}
        dangerous
        title={t("messages.deleteConfirm.title")}
        body={t("messages.deleteConfirm.body")}
        confirmLabel={t("messages.deleteConfirm.confirm")}
        cancelLabel={t("messages.deleteConfirm.cancel")}
        isBusy={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteUserTarget(null)}
      />
    </div>
  );
};

export default AdminUsers;
