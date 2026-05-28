import { useTranslation } from "react-i18next";
import { getUserRole } from "src/utils/auth";
import {
  Button,
  Input,
  Card,
  ConfirmModal,
} from "src/components/ui";
import { useAdminUsers } from "./AdminUsers.hook";
import AdminUsersTable from "./AdminUsers/AdminUsersTable";

const AdminUsers = () => {
  const { t } = useTranslation("adminUsers");

  const currentRole = getUserRole();

  const {
    loading,
    users,
    newUser,
    setNewUser,
    creating,
    editing,
    deleteUserTarget,
    setDeleteUserTarget,
    deleting,
    loadUsers,
    beginEdit,
    cancelEdit,
    changeEditField,
    saveEdit,
    handleDeleteConfirm,
    handleCreate,
  } = useAdminUsers();

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
      <AdminUsersTable
        users={users}
        loading={loading}
        editing={editing}
        beginEdit={beginEdit}
        cancelEdit={cancelEdit}
        changeEditField={changeEditField}
        saveEdit={saveEdit}
        setDeleteUserTarget={setDeleteUserTarget}
      />

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
