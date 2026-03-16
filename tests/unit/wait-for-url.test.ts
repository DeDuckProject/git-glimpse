import { describe, it, expect, vi, afterEach } from 'vitest';
import { waitForUrl } from '../../packages/action/src/index.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('waitForUrl', () => {
  it('resolves immediately when the URL returns ok on the first attempt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    await expect(waitForUrl('http://example.com', 5000)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries until the URL becomes reachable', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) return { ok: false };
      return { ok: true };
    }));
    // Use a generous timeout; polling delay is mocked via fake timers below
    vi.useFakeTimers();
    const promise = waitForUrl('http://example.com', 10000);
    // Advance past two 1-second poll delays
    await vi.advanceTimersByTimeAsync(2000);
    vi.useRealTimers();
    await promise;
    expect(calls).toBe(3);
  });

  it('throws when the URL never becomes reachable within the timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(waitForUrl('http://example.com', 500)).rejects.toThrow(
      'did not become ready'
    );
  });
});
