// Core behavioral contract of the services class refactor: count-changing
// mutations must fire the usage-invalidation bus (via BaseService.refreshUsage)
// so proactive gate counts stay fresh; read/non-count methods must NOT.
// Spec: docs/superpowers/specs/2026-05-31-backend-services-class-refactor-design.md

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// Mock the axios instance BEFORE importing the services (same idiom as
// scenariosService.draft.test.ts) so each service's `this.api` is a spy.
vi.mock("src/services/backend/config.ts", () => ({
  backendInstance: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock the bus so we can assert refreshUsage() reached triggerUsageInvalidation.
vi.mock("src/utils/usageInvalidationBus.ts", () => ({
  triggerUsageInvalidation: vi.fn(),
  setUsageInvalidationHandler: vi.fn(),
}));

import { scenariosService } from "../scenariosService";
import { devicesService } from "../devicesService";
import { backendInstance } from "../config";
import { triggerUsageInvalidation } from "src/utils/usageInvalidationBus.ts";

const post = backendInstance.post as Mock;
const del = backendInstance.delete as Mock;
const get = backendInstance.get as Mock;
const patch = backendInstance.patch as Mock;
const trigger = triggerUsageInvalidation as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  post.mockResolvedValue({ data: { scenario: { id: "s1" } } });
  del.mockResolvedValue({ data: {} });
  get.mockResolvedValue({
    data: [],
    meta: { page: 1, per_page: 20, total: 0 },
  });
  patch.mockResolvedValue({ data: { scenario: { id: "s1" } } });
});

describe("usage invalidation on count-changing mutations", () => {
  it("scenariosService.create fires the bus once", async () => {
    await scenariosService.create({ name: "n", command_steps: [] });
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it("scenariosService.duplicate fires the bus once", async () => {
    await scenariosService.duplicate("s1");
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it("scenariosService.destroy fires the bus once", async () => {
    await scenariosService.destroy("s1");
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it("scenariosService.createDraft fires the bus once", async () => {
    post.mockResolvedValueOnce({
      data: {
        draft: { name: "", description: "", command_steps: [] },
        quota: { tokens_used: 0, tokens_limit: 0, drafts_used: 0, drafts_limit: 0 },
        usage: { total_tokens: 0 },
      },
    });
    await scenariosService.createDraft("prompt", "en");
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it("devicesService.remove fires the bus once", async () => {
    await devicesService.remove("d1");
    expect(trigger).toHaveBeenCalledTimes(1);
  });
});

describe("read / non-count methods do NOT fire the bus", () => {
  it("scenariosService.index / show / update stay silent", async () => {
    await scenariosService.index();
    await scenariosService.show("s1");
    await scenariosService.update("s1", { name: "x" });
    expect(trigger).not.toHaveBeenCalled();
  });

  it("devicesService.list / get / update stay silent", async () => {
    await devicesService.list();
    await devicesService.get("d1");
    await devicesService.update("d1", { name: "x" });
    expect(trigger).not.toHaveBeenCalled();
  });
});
