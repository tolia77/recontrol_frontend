// Tests for useAdminDevices hook
// vitest.config.ts has globals:false — all vitest APIs must be imported explicitly.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

import { useAdminDevices } from "./useAdminDevices";
import type { Device } from "src/types";

// ---- Mocks ----------------------------------------------------------------

const stableT = (k: string) => k;
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: stableT }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const stableToast = {
  success: mockToastSuccess,
  error: mockToastError,
  info: vi.fn(),
  warning: vi.fn(),
};
vi.mock("src/components/ui/Toast", () => ({
  useToast: () => stableToast,
}));

const mockListAll = vi.fn();
const mockRemove = vi.fn();
vi.mock("src/services/backend/devicesService", () => ({
  devicesService: {
    listAll: (...args: unknown[]) => mockListAll(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
  },
}));

// ---- Helpers ----------------------------------------------------------------

function makeDevice(id: string, name = `device-${id}`): Device {
  return {
    id,
    name,
    status: "active",
    last_active_at: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    user: { id: "u1", username: "alice", email: "alice@example.com", role: "client" },
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---- Tests ------------------------------------------------------------------

describe("useAdminDevices — load on mount", () => {
  beforeEach(() => {
    mockListAll.mockResolvedValue({ devices: [makeDevice("d1"), makeDevice("d2")], meta: null });
  });

  it("loads devices on mount; loading toggles", async () => {
    const { result } = renderHook(() => useAdminDevices());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockListAll).toHaveBeenCalled();
    expect(result.current.devices).toHaveLength(2);
    expect(result.current.devices[0].id).toBe("d1");
  });

  it("calls listAll with page and per_page params", async () => {
    const { result } = renderHook(() => useAdminDevices());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockListAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, per_page: 200 }),
    );
  });
});

describe("useAdminDevices — load error", () => {
  it("error -> toast.error(errors.loadFailed)", async () => {
    mockListAll.mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useAdminDevices());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockToastError).toHaveBeenCalledWith("errors.loadFailed");
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});

describe("useAdminDevices — filter params", () => {
  beforeEach(() => {
    mockListAll.mockResolvedValue({ devices: [], meta: null });
  });

  it("omits status key from listAll args when statusFilter is empty", async () => {
    const { result } = renderHook(() => useAdminDevices());

    await waitFor(() => expect(result.current.loading).toBe(false));

    const callArg = mockListAll.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg).not.toHaveProperty("status");
  });

  it("omits name key from listAll args when nameFilter is empty", async () => {
    const { result } = renderHook(() => useAdminDevices());

    await waitFor(() => expect(result.current.loading).toBe(false));

    const callArg = mockListAll.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg).not.toHaveProperty("name");
  });

  it("re-triggers loadDevices when statusFilter changes; passes status in params", async () => {
    const { result } = renderHook(() => useAdminDevices());

    await waitFor(() => expect(result.current.loading).toBe(false));
    const callsBefore = mockListAll.mock.calls.length;

    act(() => {
      result.current.setStatusFilter("active");
    });

    await waitFor(() => expect(mockListAll.mock.calls.length).toBeGreaterThan(callsBefore));

    const lastCall = mockListAll.mock.calls[mockListAll.mock.calls.length - 1][0] as Record<string, unknown>;
    expect(lastCall.status).toBe("active");
  });

  it("re-triggers loadDevices when nameFilter changes; passes name in params", async () => {
    const { result } = renderHook(() => useAdminDevices());

    await waitFor(() => expect(result.current.loading).toBe(false));
    const callsBefore = mockListAll.mock.calls.length;

    act(() => {
      result.current.setNameFilter("mydevice");
    });

    await waitFor(() => expect(mockListAll.mock.calls.length).toBeGreaterThan(callsBefore));

    const lastCall = mockListAll.mock.calls[mockListAll.mock.calls.length - 1][0] as Record<string, unknown>;
    expect(lastCall.name).toBe("mydevice");
  });
});

describe("useAdminDevices — handleDeleteConfirm", () => {
  beforeEach(() => {
    mockListAll.mockResolvedValue({ devices: [makeDevice("d1"), makeDevice("d2")], meta: null });
  });

  it("noop when deleteTarget is null", async () => {
    const { result } = renderHook(() => useAdminDevices());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleDeleteConfirm();
    });

    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("success: optimistically removes device from list and toasts messages.deleted", async () => {
    mockRemove.mockResolvedValue({});

    const { result } = renderHook(() => useAdminDevices());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.devices).toHaveLength(2);

    // Set delete target and wait for state to settle
    act(() => {
      result.current.setDeleteTarget(makeDevice("d1"));
    });

    await waitFor(() => expect(result.current.deleteTarget).not.toBeNull());

    await act(async () => {
      await result.current.handleDeleteConfirm();
    });

    await waitFor(() => expect(result.current.deleting).toBe(false));

    expect(mockRemove).toHaveBeenCalledWith("d1");
    // Optimistic removal: d1 is gone, d2 remains
    expect(result.current.devices.find((d) => d.id === "d1")).toBeUndefined();
    expect(result.current.devices.find((d) => d.id === "d2")).toBeDefined();
    expect(mockToastSuccess).toHaveBeenCalledWith("messages.deleted");
    expect(result.current.deleteTarget).toBeNull();
    expect(result.current.deleting).toBe(false);
  });

  it("error: toasts errors.deleteFailed; deleting and deleteTarget reset in finally", async () => {
    mockRemove.mockRejectedValue(new Error("delete fail"));

    const { result } = renderHook(() => useAdminDevices());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setDeleteTarget(makeDevice("d1"));
    });

    await waitFor(() => expect(result.current.deleteTarget).not.toBeNull());

    await act(async () => {
      await result.current.handleDeleteConfirm();
    });

    await waitFor(() => expect(result.current.deleting).toBe(false));

    expect(mockRemove).toHaveBeenCalledWith("d1");
    expect(mockToastError).toHaveBeenCalledWith("errors.deleteFailed");
    expect(result.current.deleting).toBe(false);
    expect(result.current.deleteTarget).toBeNull();
  });
});
