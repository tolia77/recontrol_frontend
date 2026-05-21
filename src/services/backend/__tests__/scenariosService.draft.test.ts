// scenariosService.createDraft vitest (Phase 23 Plan 07 Task 1).
//
// Coverage:
//   - createDraft('test prompt', 'en') issues POST /scenarios/drafts with body
//     { prompt: 'test prompt' } and Accept-Language: en header.
//   - createDraft('тестовий', 'uk', signal) sends Accept-Language: uk AND
//     forwards the signal so aborting before resolution rejects the promise.
//   - Resolves with a typed DraftResponse having the four-key quota object.
//   - Type-level assertions: DraftStep.dry_intent_warning is optional;
//     DraftStep.description is string | null.

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// Mock the backend axios instance BEFORE importing scenariosService so the
// service picks up the spy. Same idiom existing tests use (vi.mock with a
// factory returning a mocked backendInstance with `.post` / `.get`).
vi.mock('src/services/backend/config.ts', () => {
  return {
    backendInstance: {
      post: vi.fn(),
      get: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  };
});

// Mock the access token helper so we don't depend on localStorage in tests.
vi.mock('src/utils/auth.ts', () => ({
  getAccessToken: () => 'test-jwt',
}));

import {
  scenariosService,
  type DraftResponse,
  type DraftStep,
  type DryIntentWarning,
  type DraftQuota,
} from '../scenariosService';
import { backendInstance } from '../config';

type PostMock = Mock<typeof backendInstance.post>;

function makeDraftResponse(overrides?: Partial<DraftResponse>): DraftResponse {
  return {
    draft: {
      name: 'Diagnose nginx',
      description: 'Check nginx service and recent logs.',
      command_steps: [
        {
          binary: 'systemctl',
          args: ['status', 'nginx'],
          cwd: '/',
          description: 'Check nginx service status',
        },
      ],
    },
    quota: {
      tokens_used: 100,
      tokens_limit: 100_000,
      drafts_used: 3,
      drafts_limit: 30,
    },
    usage: { total_tokens: 360 },
    ...overrides,
  };
}

describe('scenariosService.createDraft', () => {
  let postSpy: PostMock;

  beforeEach(() => {
    postSpy = backendInstance.post as unknown as PostMock;
    postSpy.mockReset();
    postSpy.mockResolvedValue({ data: makeDraftResponse() });
  });

  it('POSTs to /scenarios/drafts with body { prompt } and Accept-Language: en header (EN locale)', async () => {
    await scenariosService.createDraft('test prompt', 'en');

    expect(postSpy).toHaveBeenCalledTimes(1);
    const call = postSpy.mock.calls[0];
    expect(call[0]).toBe('/scenarios/drafts');
    expect(call[1]).toEqual({ prompt: 'test prompt' });
    const config = call[2] as {
      headers?: Record<string, string>;
      signal?: AbortSignal;
    };
    expect(config.headers).toMatchObject({
      Authorization: 'test-jwt',
      'Accept-Language': 'en',
    });
  });

  it('forwards AbortSignal so aborting before resolution rejects the promise', async () => {
    // Simulate axios behavior: when the request config.signal is aborted,
    // the call rejects with a CanceledError-like object.
    postSpy.mockImplementation((_url, _body, config) => {
      return new Promise((_resolve, reject) => {
        const signal = (
          config as { signal?: AbortSignal } | undefined
        )?.signal;
        if (signal) {
          if (signal.aborted) {
            reject(new DOMException('canceled', 'AbortError'));
            return;
          }
          signal.addEventListener('abort', () => {
            reject(new DOMException('canceled', 'AbortError'));
          });
        }
        // Never resolve without abort — caller must abort to settle.
      });
    });

    const controller = new AbortController();
    const promise = scenariosService.createDraft('тестовий', 'uk', controller.signal);

    // Verify the Accept-Language header was set to 'uk' AND the signal flowed
    // into the axios config.
    expect(postSpy).toHaveBeenCalledTimes(1);
    const call = postSpy.mock.calls[0];
    const config = call[2] as {
      headers?: Record<string, string>;
      signal?: AbortSignal;
    };
    expect(config.headers).toMatchObject({ 'Accept-Language': 'uk' });
    expect(config.signal).toBe(controller.signal);

    // Abort and assert the promise rejects.
    controller.abort();
    await expect(promise).rejects.toThrow();
  });

  it('resolves with a typed DraftResponse exposing the four-key quota object', async () => {
    const fixture = makeDraftResponse({
      quota: {
        tokens_used: 12_345,
        tokens_limit: 100_000,
        drafts_used: 7,
        drafts_limit: 30,
      },
    });
    postSpy.mockResolvedValueOnce({ data: fixture });

    const result = await scenariosService.createDraft('list services', 'en');

    // Top-level shape
    expect(result.draft).toBeDefined();
    expect(result.draft.name).toBe('Diagnose nginx');
    expect(Array.isArray(result.draft.command_steps)).toBe(true);

    // Exact 4-key quota contract (AI-06 / AI-07).
    expect(Object.keys(result.quota).sort()).toEqual(
      ['drafts_limit', 'drafts_used', 'tokens_limit', 'tokens_used'].sort()
    );
    expect(result.quota.tokens_used).toBe(12_345);
    expect(result.quota.drafts_limit).toBe(30);
  });

  it('exposes correctly-typed DraftStep / DryIntentWarning / DraftQuota interfaces', () => {
    // Type-level assertions — TypeScript compiles iff the interfaces are
    // shaped as the plan requires. The expect() calls are runtime-trivial; the
    // value is in the compile-time structural checks above each.

    // DraftStep.description is `string | null` (the model may emit JSON null;
    // mustn't be widened to undefined).
    const stepWithNullDescription: DraftStep = {
      binary: 'ls',
      args: ['-la'],
      cwd: '/tmp',
      description: null,
    };
    expect(stepWithNullDescription.description).toBeNull();

    // DraftStep.dry_intent_warning is OPTIONAL (may be absent entirely).
    const stepWithoutWarning: DraftStep = {
      binary: 'pwd',
      args: [],
      cwd: '/',
      description: 'Print working directory',
    };
    expect(stepWithoutWarning.dry_intent_warning).toBeUndefined();

    // DryIntentWarning has both pattern + message_key (AI-05 contract).
    const warning: DryIntentWarning = {
      pattern: 'find_delete',
      message_key: 'scenarios.ai.dry_intent.find_delete',
    };
    const stepWithWarning: DraftStep = {
      ...stepWithoutWarning,
      dry_intent_warning: warning,
    };
    expect(stepWithWarning.dry_intent_warning?.pattern).toBe('find_delete');
    expect(stepWithWarning.dry_intent_warning?.message_key).toMatch(
      /^scenarios\.ai\.dry_intent\.[a-z_]+$/
    );

    // DraftQuota has exactly the four ledger-mirror keys.
    const quota: DraftQuota = {
      tokens_used: 0,
      tokens_limit: 100,
      drafts_used: 0,
      drafts_limit: 30,
    };
    expect(quota.drafts_limit - quota.drafts_used).toBe(30);
  });
});
