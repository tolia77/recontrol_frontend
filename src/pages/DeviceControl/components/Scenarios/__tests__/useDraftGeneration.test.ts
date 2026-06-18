/**
 * useDraftGeneration vitest.
 *
 * Drives the hook deterministically through every transition of the 5-state
 * machine. scenariosService.createDraft is vi.mocked with a manual deferred
 * promise so each test controls resolve / reject / abort timing without
 * touching real axios. Each example asserts on the FINAL state shape using
 * the discriminated union's `kind` discriminator.
 */

import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDraftGeneration } from "../useDraftGeneration";
import {
  scenariosService,
  type DraftResponse,
} from "src/services/backend/scenariosService.ts";

vi.mock("src/services/backend/scenariosService.ts", () => ({
  scenariosService: {
    createDraft: vi.fn(),
  },
}));

const createDraftMock = scenariosService.createDraft as ReturnType<
  typeof vi.fn
>;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeDraft(name = "mock"): DraftResponse {
  return {
    draft: {
      name,
      description: "mock description",
      command_steps: [
        { binary: "ls", args: ["-la"], cwd: "/", description: null },
      ],
    },
    quota: {
      tokens_used: 100,
      tokens_limit: 10000,
      drafts_used: 1,
      drafts_limit: 30,
    },
    usage: { total_tokens: 789 },
  };
}

beforeEach(() => {
  createDraftMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDraftGeneration", () => {
  it("1. starts in { kind: idle }", () => {
    const { result } = renderHook(() => useDraftGeneration());
    expect(result.current.state).toEqual({ kind: "idle" });
  });

  it("2. generate() synchronously sets state to generating with a startedAt timestamp", () => {
    const d = defer<DraftResponse>();
    createDraftMock.mockReturnValueOnce(d.promise);

    const { result } = renderHook(() => useDraftGeneration());
    const before = Date.now();

    act(() => {
      // Don't await — we want to inspect the synchronous transition.
      void result.current.generate("p", "en");
    });

    expect(result.current.state.kind).toBe("generating");
    if (result.current.state.kind === "generating") {
      expect(result.current.state.startedAt).toBeGreaterThanOrEqual(before);
      expect(result.current.state.startedAt).toBeLessThanOrEqual(Date.now());
    }

    // Verify the service got our prompt + locale + an AbortSignal. No platform
    // was supplied, so the 4th arg is undefined (device-less generation).
    expect(createDraftMock).toHaveBeenCalledWith(
      "p",
      "en",
      expect.any(AbortSignal),
      undefined,
    );

    // Resolve to settle the promise so React doesn't warn about a hanging
    // act-scope.
    act(() => {
      d.resolve(makeDraft());
    });
  });

  it("2b. forwards the target platform to createDraft when supplied", () => {
    const d = defer<DraftResponse>();
    createDraftMock.mockReturnValueOnce(d.promise);

    const { result } = renderHook(() => useDraftGeneration());

    act(() => {
      void result.current.generate("p", "en", "windows");
    });

    expect(createDraftMock).toHaveBeenCalledWith(
      "p",
      "en",
      expect.any(AbortSignal),
      "windows",
    );

    act(() => {
      d.resolve(makeDraft());
    });
  });

  it("3. resolve transitions to { kind: success, draft }", async () => {
    const d = defer<DraftResponse>();
    createDraftMock.mockReturnValueOnce(d.promise);
    const draft = makeDraft("resolved");

    const { result } = renderHook(() => useDraftGeneration());

    await act(async () => {
      const p = result.current.generate("hello", "en");
      d.resolve(draft);
      await p;
    });

    expect(result.current.state).toEqual({ kind: "success", draft });
  });

  it("4a. reject with backend error envelope maps error.response.data.error → code", async () => {
    const d = defer<DraftResponse>();
    createDraftMock.mockReturnValueOnce(d.promise);

    const { result } = renderHook(() => useDraftGeneration());

    await act(async () => {
      const p = result.current.generate("x", "en");
      d.reject({
        response: {
          data: {
            error: {
              code: "draft_unparseable",
              message: "Draft failed schema validation",
              details: {},
            },
          },
        },
      });
      await p;
    });

    expect(result.current.state.kind).toBe("error");
    if (result.current.state.kind === "error") {
      expect(result.current.state.code).toBe("draft_unparseable");
      expect(result.current.state.details).toBeDefined();
    }
  });

  it('4b. reject without structured body falls back to code = "network"', async () => {
    const d = defer<DraftResponse>();
    createDraftMock.mockReturnValueOnce(d.promise);

    const { result } = renderHook(() => useDraftGeneration());

    await act(async () => {
      const p = result.current.generate("x", "en");
      d.reject(new Error("ECONNREFUSED"));
      await p;
    });

    expect(result.current.state.kind).toBe("error");
    if (result.current.state.kind === "error") {
      expect(result.current.state.code).toBe("network");
    }
  });

  it("5. cancel() mid-generate aborts the controller AND transitions to cancelled (not error)", async () => {
    const d = defer<DraftResponse>();
    let capturedSignal: AbortSignal | undefined;
    createDraftMock.mockImplementationOnce(
      (_p: string, _l: string, signal?: AbortSignal) => {
        capturedSignal = signal;
        return d.promise;
      },
    );

    const { result } = renderHook(() => useDraftGeneration());

    act(() => {
      void result.current.generate("p", "en");
    });

    expect(result.current.state.kind).toBe("generating");
    expect(capturedSignal?.aborted).toBe(false);

    act(() => {
      result.current.cancel();
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.state).toEqual({ kind: "cancelled" });

    // Settle the promise as rejected (as axios would after an abort) — should
    // remain in 'cancelled', NOT flip to 'error'.
    await act(async () => {
      d.reject(new DOMException("aborted", "AbortError"));
      // Give the catch branch a microtask to run.
      await Promise.resolve();
    });

    expect(result.current.state).toEqual({ kind: "cancelled" });
  });

  it("6. a second generate() while previous is in-flight aborts the prior controller", () => {
    const d1 = defer<DraftResponse>();
    const d2 = defer<DraftResponse>();
    const signals: AbortSignal[] = [];
    createDraftMock.mockImplementation(
      (_p: string, _l: string, signal?: AbortSignal) => {
        if (signal) signals.push(signal);
        return signals.length === 1 ? d1.promise : d2.promise;
      },
    );

    const { result } = renderHook(() => useDraftGeneration());

    act(() => {
      void result.current.generate("p1", "en");
    });
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);

    act(() => {
      void result.current.generate("p2", "en");
    });

    // Prior controller must have been aborted by the new generate().
    expect(signals[0].aborted).toBe(true);
    expect(signals).toHaveLength(2);
    expect(signals[1].aborted).toBe(false);

    // Settle to avoid hanging promises.
    act(() => {
      d1.reject(new DOMException("aborted", "AbortError"));
      d2.resolve(makeDraft());
    });
  });

  it("7. unmount cleanup aborts the in-flight controller", () => {
    const d = defer<DraftResponse>();
    let capturedSignal: AbortSignal | undefined;
    createDraftMock.mockImplementationOnce(
      (_p: string, _l: string, signal?: AbortSignal) => {
        capturedSignal = signal;
        return d.promise;
      },
    );

    const { result, unmount } = renderHook(() => useDraftGeneration());

    act(() => {
      void result.current.generate("p", "en");
    });

    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);

    // Settle to clean up.
    act(() => {
      d.reject(new DOMException("aborted", "AbortError"));
    });
  });

  it("8. reset() from any non-idle state transitions to { kind: idle }", async () => {
    const d = defer<DraftResponse>();
    createDraftMock.mockReturnValueOnce(d.promise);

    const { result } = renderHook(() => useDraftGeneration());

    await act(async () => {
      const p = result.current.generate("x", "en");
      d.reject({
        response: {
          data: {
            error: {
              code: "draft_unsafe",
              message: "Draft contains unsafe commands",
              details: {},
            },
          },
        },
      });
      await p;
    });

    expect(result.current.state.kind).toBe("error");

    act(() => {
      result.current.reset();
    });
    expect(result.current.state).toEqual({ kind: "idle" });

    // Also exercise reset from cancelled.
    const d2 = defer<DraftResponse>();
    createDraftMock.mockReturnValueOnce(d2.promise);
    act(() => {
      void result.current.generate("y", "en");
    });
    act(() => {
      result.current.cancel();
    });
    expect(result.current.state.kind).toBe("cancelled");
    act(() => {
      result.current.reset();
    });
    expect(result.current.state).toEqual({ kind: "idle" });

    // Cleanup
    act(() => {
      d2.reject(new DOMException("aborted", "AbortError"));
    });
  });

  it("9. late resolve after cancel does NOT overwrite cancelled with success", async () => {
    const d = defer<DraftResponse>();
    createDraftMock.mockReturnValueOnce(d.promise);

    const { result } = renderHook(() => useDraftGeneration());

    act(() => {
      void result.current.generate("p", "en");
    });
    act(() => {
      result.current.cancel();
    });
    expect(result.current.state).toEqual({ kind: "cancelled" });

    // Server "wins the race" and resolves after the abort.
    await act(async () => {
      d.resolve(makeDraft("late"));
      await Promise.resolve();
    });

    expect(result.current.state).toEqual({ kind: "cancelled" });
  });
});
