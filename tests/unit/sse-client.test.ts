import { afterEach, describe, expect, it, vi } from "vitest";

// Drives the SSEClient reconnection state machine deterministically by mocking the
// eventsource-client library: each createEventSource call is scripted to deliver
// messages and/or disconnect, so retry + Last-Event-ID replay are tested without network.
interface FakeMsg {
  id: string;
  event: string;
  data: string;
}
interface FakeConfig {
  initialLastEventId?: string;
  onMessage: (m: FakeMsg) => void;
  onDisconnect: () => void;
}
interface Step {
  messages?: FakeMsg[];
  disconnect?: boolean;
}

const h = vi.hoisted(() => ({
  configs: [] as FakeConfig[],
  state: { script: [] as Step[] },
}));

vi.mock("eventsource-client", () => ({
  createEventSource: (config: FakeConfig) => {
    h.configs.push(config);
    const idx = h.configs.length - 1;
    // Drive callbacks after connectOnce finishes synchronous setup (heartbeat timer armed).
    void Promise.resolve().then(() => {
      const step = h.state.script[idx];
      if (!step) return;
      for (const m of step.messages ?? []) config.onMessage(m);
      if (step.disconnect) config.onDisconnect();
    });
    return { close: () => {} };
  },
}));

import { SSEClient } from "../../src/api/sse-client.ts";

function msg(event: string, data: unknown, id = ""): FakeMsg {
  return { id, event, data: JSON.stringify(data) };
}

function newClient(): SSEClient {
  return new SSEClient("http://api", vi.fn<() => Promise<boolean>>().mockResolvedValue(false));
}

describe("SSEClient reconnection", () => {
  afterEach(() => {
    h.configs.length = 0;
    h.state.script = [];
  });

  it("retries after a non-terminal disconnect and returns the eventual terminal event", async () => {
    h.state.script = [
      { disconnect: true }, // attempt 0: stream drops with no terminal event
      { messages: [msg("complete", { result_url: "http://x/result" }, "99")] }, // attempt 1
    ];
    const result = await newClient().streamJobEvents("job-1", vi.fn());
    expect(h.configs).toHaveLength(2);
    expect(result).toMatchObject({ result_url: "http://x/result" });
  });

  it("replays Last-Event-ID on reconnect after an event carrying an id", async () => {
    const onEvent = vi.fn();
    h.state.script = [
      { messages: [msg("progress", { percentage: 50 }, "42")], disconnect: true }, // attempt 0
      { messages: [msg("complete", { result_url: "http://x/r" }, "100")] }, // attempt 1
    ];
    await newClient().streamJobEvents("job-2", onEvent);
    expect(onEvent).toHaveBeenCalledTimes(1); // non-terminal progress dispatched to callback
    expect(h.configs[1]?.initialLastEventId).toBe("42"); // replayed on reconnect
  });
});
