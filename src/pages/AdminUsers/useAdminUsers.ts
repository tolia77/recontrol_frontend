import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getUserId, saveUserRole } from "src/utils/auth";
import {
  usersService,
  type UserResponse,
} from "src/services/backend/usersService";
import { getErrorMessage } from "src/utils/getErrorMessage";
import { useToast } from "src/components/ui/Toast";

export interface EditableRowState {
  id: number | string;
  username: string;
  email: string;
  role: string;
  password: string;
  saving: boolean;
}

export interface UseAdminUsersReturn {
  loading: boolean;
  users: UserResponse[];
  newUser: { username: string; email: string; password: string; role: string };
  setNewUser: React.Dispatch<
    React.SetStateAction<{
      username: string;
      email: string;
      password: string;
      role: string;
    }>
  >;
  creating: boolean;
  editing: Record<string, EditableRowState>;
  deleteUserTarget: UserResponse | null;
  setDeleteUserTarget: (v: UserResponse | null) => void;
  deleting: boolean;
  loadUsers: () => Promise<void>;
  beginEdit: (u: UserResponse) => void;
  cancelEdit: (id: number | string) => void;
  changeEditField: (
    id: number | string,
    field: keyof EditableRowState,
    value: string,
  ) => void;
  saveEdit: (row: EditableRowState) => Promise<void>;
  handleDeleteConfirm: () => Promise<void>;
  handleCreate: (e: React.FormEvent) => Promise<void>;
}

/**
 * Owns all user-CRUD state for AdminUsers: load, create, in-place edit, and delete flows.
 *
 * Plain useState (transitions are independent, no interrelation).
 */
export function useAdminUsers(): UseAdminUsersReturn {
  const { t } = useTranslation("adminUsers");
  const toast = useToast();
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
  const [deleteUserTarget, setDeleteUserTarget] =
    useState<UserResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const users = await usersService.list();
      setUsers(users);
    } catch {
      toast.error(t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const beginEdit = useCallback((u: UserResponse) => {
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
  }, []);

  const cancelEdit = useCallback((id: number | string) => {
    setEditing((prev) => {
      const copy = { ...prev };
      delete copy[String(id)];
      return copy;
    });
  }, []);

  const changeEditField = useCallback(
    (id: number | string, field: keyof EditableRowState, value: string) => {
      setEditing((prev) => ({
        ...prev,
        [String(id)]: { ...prev[String(id)], [field]: value },
      }));
    },
    [],
  );

  const saveEdit = useCallback(
    async (row: EditableRowState) => {
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

        const updated = await usersService.updateAdmin(row.id, payload);
        setUsers((prev) => prev.map((u) => (u.id === row.id ? updated : u)));

        if (String(row.id) === String(currentUserId) && updated.role) {
          saveUserRole(updated.role);
        }

        toast.success(t("messages.saved"));
        cancelEdit(row.id);
      } catch (e) {
        const status = (e as { response?: { status?: number } }).response
          ?.status;
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
    },
    [users, currentUserId, t, toast, cancelEdit],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteUserTarget) return;
    const u = deleteUserTarget;
    setDeleting(true);
    try {
      await usersService.removeAdmin(u.id);
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
  }, [deleteUserTarget, currentUserId, t, toast]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setCreating(true);

      try {
        const created = await usersService.createAdmin({
          username: newUser.username.trim(),
          email: newUser.email.trim(),
          password: newUser.password,
          role: newUser.role,
        });
        setUsers((prev) => [...prev, created]);
        toast.success(t("messages.created"));
        setNewUser({ username: "", email: "", password: "", role: "user" });
      } catch (e) {
        const status = (e as { response?: { status?: number } }).response
          ?.status;
        if (status === 403) {
          toast.error(t("errors.forbidden"));
        } else {
          toast.error(getErrorMessage(e) || t("errors.createFailed"));
        }
      } finally {
        setCreating(false);
      }
    },
    [newUser, t, toast],
  );

  return useMemo(
    () => ({
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
    }),
    [
      loading,
      users,
      newUser,
      creating,
      editing,
      deleteUserTarget,
      deleting,
      loadUsers,
      beginEdit,
      cancelEdit,
      changeEditField,
      saveEdit,
      handleDeleteConfirm,
      handleCreate,
    ],
  );
}
