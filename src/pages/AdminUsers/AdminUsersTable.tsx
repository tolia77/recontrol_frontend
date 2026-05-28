import { useTranslation } from "react-i18next";
import { type UserResponse } from "src/services/backend/usersService";
import { Button, Input, Card, LoadingState, EmptyState } from "src/components/ui";
import { type EditableRowState } from "src/pages/AdminUsers/useAdminUsers";

export interface AdminUsersTableProps {
  users: UserResponse[];
  loading: boolean;
  editing: Record<string, EditableRowState>;
  beginEdit: (u: UserResponse) => void;
  cancelEdit: (id: number | string) => void;
  changeEditField: (
    id: number | string,
    field: keyof EditableRowState,
    value: string,
  ) => void;
  saveEdit: (row: EditableRowState) => Promise<void>;
  setDeleteUserTarget: (v: UserResponse | null) => void;
}

export default function AdminUsersTable({
  users,
  loading,
  editing,
  beginEdit,
  cancelEdit,
  changeEditField,
  saveEdit,
  setDeleteUserTarget,
}: AdminUsersTableProps) {
  const { t } = useTranslation("adminUsers");

  return (
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
                            u.role === "admin" ? "text-primary font-medium" : ""
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
                              changeEditField(u.id, "password", e.target.value)
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
  );
}
