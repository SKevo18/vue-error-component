import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ErrorHost from "../src/ErrorHost.vue";
import { createErrorReporter, type ErrorReporter } from "../src/reporter";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

function withStack(stack: string, message = "boom"): Error {
  const error = new Error(message);
  error.stack = stack;
  return error;
}

function parsed(reporter: ErrorReporter, index = 0) {
  return JSON.parse(reporter.entries.value[index]!.report);
}

describe("capture", () => {
  it("bounds a stalled body but leaves external cancellation silent", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    const reporter = createErrorReporter();
    const pending = reporter.capture("/odd", {}, async () => new Promise<never>(() => {}), { timeoutMs: 50 });
    const rejected = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(50);
    await rejected;
    expect(reporter.entries.value).toHaveLength(1);
    const controller = new AbortController();
    const cancelled = reporter.capture("/other", { signal: controller.signal }, async () => new Promise<never>(() => {}));
    const aborted = expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await aborted;
    expect(reporter.entries.value).toHaveLength(1);
  });

  it("rejects an external abort with an AbortError that keeps the signal's reason", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    const reporter = createErrorReporter();
    const controller = new AbortController();
    const reason = new Error("navigated away");
    const cancelled = reporter.capture("/other", { signal: controller.signal }, async () => new Promise<never>(() => {}));
    controller.abort(reason);
    await expect(cancelled).rejects.toMatchObject({ name: "AbortError", cause: reason });
    expect(reporter.entries.value).toHaveLength(0);
  });

  it("uses the reporter's default deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    const reporter = createErrorReporter({ timeoutMs: 100 });
    const pending = reporter.capture("/odd", {}, async () => new Promise<never>(() => {}));
    const rejected = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
  });

  it("shows a slow notice without aborting and clears it when the request settles", async () => {
    vi.useFakeTimers();
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn().mockReturnValue(new Promise<Response>((done) => {
      resolve = done;
    }));
    vi.stubGlobal("fetch", fetcher);
    const reporter = createErrorReporter();
    const pending = reporter.capture("/long", {}, (response) => response.json(), { timeoutMs: null, slowMs: 20 });
    await vi.advanceTimersByTimeAsync(40000);
    expect(fetcher.mock.calls[0]![1].signal.aborted).toBe(false);
    expect(reporter.entries.value).toHaveLength(1);
    expect(reporter.entries.value[0]!.slow).toBe(true);
    resolve(new Response('{"moss":7}'));
    await expect(pending).resolves.toEqual({ moss: 7 });
    expect(reporter.entries.value).toHaveLength(0);
  });

  it("keeps a returned raw response cancellable through the caller's signal", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("stream"));
    vi.stubGlobal("fetch", fetcher);
    const reporter = createErrorReporter();
    const controller = new AbortController();
    await reporter.capture("/raw", { signal: controller.signal }, async (response) => response, { timeoutMs: null });
    const signal: AbortSignal = fetcher.mock.calls[0]![1].signal;
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
  });

  it("keeps raw responses cancellable without AbortSignal.any", async () => {
    const any = AbortSignal.any;
    Object.defineProperty(AbortSignal, "any", { value: undefined, configurable: true, writable: true });
    try {
      const fetcher = vi.fn().mockResolvedValue(new Response("stream"));
      vi.stubGlobal("fetch", fetcher);
      const reporter = createErrorReporter();
      const controller = new AbortController();
      await reporter.capture("/raw", { signal: controller.signal }, async (response) => response, { timeoutMs: null });
      const signal: AbortSignal = fetcher.mock.calls[0]![1].signal;
      controller.abort();
      expect(signal.aborted).toBe(true);
    } finally {
      Object.defineProperty(AbortSignal, "any", { value: any, configurable: true, writable: true });
    }
  });

  it("reports malformed and failed body reads while preserving caller handled errors", async () => {
    const reporter = createErrorReporter();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));
    await expect(reporter.capture("/moss", {}, (response) => response.json())).rejects.toBeInstanceOf(SyntaxError);
    expect(parsed(reporter).kind).toBe("body");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers(), text: () => Promise.reject(new Error("broken stream")) }));
    await expect(reporter.capture("/birch", {}, (response) => response.text())).rejects.toThrow("broken stream");
    expect(reporter.entries.value).toHaveLength(2);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 422 })));
    await expect(reporter.capture("/form", {}, async () => {
      throw Object.assign(new Error("invalid"), { status: 422 });
    })).rejects.toThrow("invalid");
    expect(reporter.entries.value).toHaveLength(2);
  });

  it("reads the configured request ID header and can report client errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404, headers: { "X-Trace": "trace-1" } })));
    const reporter = createErrorReporter({ requestIdHeader: "X-Trace", silenceClientErrors: false });
    await expect(reporter.capture("/missing", {}, async () => undefined)).rejects.toThrow("HTTP request failed");
    expect(parsed(reporter)).toMatchObject({ kind: "http", status: 404, requestId: "trace-1" });
  });
});

describe("report", () => {
  it("keeps the error message without its secrets and deduplicates repeated objects and failure storms", () => {
    const reporter = createErrorReporter({ app: "orchard", build: "abc123" });
    const stack = "Error: password=hunter2\n    at load (https://alice:secret@example.test/api/item?token=hidden#secret:2:4)\n    at token=hidden (https://example.test/chunk.js?api_key=private:2:4)";
    const message = "password=hunter2 Authorization: Bearer secret-body for bob@example.test at https://example.test/x?sig=signed-url failed";
    const error = withStack(stack, message);
    const context = { method: "GET", url: "https://alice:secret@example.test/api/item?token=hidden&password=hunter2#secret", kind: "network" as const };
    reporter.report(error, context);
    reporter.report(error, context);
    reporter.report(withStack(stack, "different arbitrary server body"), context);
    expect(reporter.entries.value).toHaveLength(1);
    expect(reporter.entries.value[0]!.count).toBe(2);
    const report = reporter.entries.value[0]!.report;
    for (const secret of ["hunter2", "alice", "hidden", "private", "secret-body", "bob@", "signed-url"]) expect(report).not.toContain(secret);
    expect(parsed(reporter).error).toBe("Error: [redacted] [redacted] for [redacted] at https://example.test/x failed");
    expect(parsed(reporter).url).toBe("https://example.test/api/item");
    expect(parsed(reporter).stack).toEqual(["at load (https://example.test/api/item:2:4)", "at [redacted] (https://example.test/chunk.js:2:4)"]);
  });

  it("keeps the message of thrown strings and error-like objects", () => {
    const reporter = createErrorReporter({ maxVisible: 5 });
    reporter.report("plain failure");
    reporter.report({ message: "object failure" });
    reporter.report(42);
    expect(reporter.entries.value.map((entry) => JSON.parse(entry.report).error)).toEqual(["plain failure", "object failure", undefined]);
  });

  it("keeps distinct context-free errors apart", () => {
    const reporter = createErrorReporter();
    reporter.report(withStack("TypeError: a\n    at one (https://example.test/a.js:1:1)"));
    reporter.report(withStack("TypeError: b\n    at two (https://example.test/b.js:1:1)"));
    reporter.report(Object.assign(withStack("RangeError: c\n    at one (https://example.test/a.js:1:1)"), { name: "RangeError" }));
    expect(reporter.entries.value.map((entry) => entry.count)).toEqual([1, 1, 1]);
  });

  it("starts a new alert after the configured dedup window", () => {
    vi.useFakeTimers();
    const reporter = createErrorReporter({ dedupMs: 100 });
    const stack = "Error: x\n    at one (https://example.test/a.js:1:1)";
    reporter.report(withStack(stack));
    reporter.report(withStack(stack));
    vi.advanceTimersByTime(100);
    reporter.report(withStack(stack));
    expect(reporter.entries.value.map((entry) => entry.count)).toEqual([2, 1]);
  });

  it("keeps Firefox and Safari frames", () => {
    const reporter = createErrorReporter();
    reporter.report(withStack("load@https://example.test/assets/chunk.js?v=1:2:4\nrender/<@https://example.test/assets/app.js:10:3\n@https://example.test/assets/app.js:1:1"));
    reporter.report(withStack("fetchItems@https://example.test/assets/chunk.js:7:9\nglobal code@https://example.test/assets/app.js:1:1\nmodule code"));
    expect(parsed(reporter, 0).stack).toEqual(["load@https://example.test/assets/chunk.js:2:4", "render/<@https://example.test/assets/app.js:10:3", "@https://example.test/assets/app.js:1:1"]);
    expect(parsed(reporter, 1).stack).toEqual(["fetchItems@https://example.test/assets/chunk.js:7:9", "global code@https://example.test/assets/app.js:1:1"]);
  });

  it("drops server stack traces embedded in messages and limits frames", () => {
    const reporter = createErrorReporter({ maxFrames: 1 });
    reporter.report(withStack("Error: upstream failed\n\tat com.acme.Service.charge(Service.java:42)\n    at handler (/srv/app/index.js:3:9)\n    at fetchData (https://example.test/app.js:5:1)\n    at main (https://example.test/app.js:9:1)"));
    expect(parsed(reporter).stack).toEqual(["at fetchData (https://example.test/app.js:5:1)"]);
  });

  it("redacts encoded emails and token-like path segments", () => {
    const reporter = createErrorReporter({ maxVisible: 10 });
    const paths = [
      "/users/alice%40example.test/profile",
      "/reset-password/s3cr3t/confirm",
      "/invite/abc",
      "/tokens/abc",
      "/files/V1StGXR8_Z5jdHi6B-myT",
      "/assets/index-BqK3x9Za.js",
    ];
    for (const [index, path] of paths.entries()) reporter.report(new Error("x"), { url: path, kind: "http", status: 500 + index });
    const urls = reporter.entries.value.map((entry) => JSON.parse(entry.report).url);
    expect(urls).toEqual([
      "/users/[redacted]/profile",
      "/reset-password/[redacted]/confirm",
      "/invite/[redacted]",
      "/tokens/[redacted]",
      "/files/[redacted]",
      "/assets/index-BqK3x9Za.js",
    ]);
  });

  it("summarizes data, file and blob URLs without their payload", () => {
    const reporter = createErrorReporter({ maxVisible: 3 });
    reporter.report(new Error("x"), { url: "data:text/plain,secret-payload", kind: "resource" });
    reporter.report(new Error("x"), { url: "file:///Users/alice/app.js", kind: "resource" });
    reporter.report(new Error("x"), { url: `https://example.test/${"a/".repeat(400)}`, kind: "resource" });
    const urls = reporter.entries.value.map((entry) => JSON.parse(entry.report).url);
    expect(urls.slice(0, 2)).toEqual(["data:[redacted]", "file:[redacted]"]);
    expect(urls[2]).toHaveLength(300);
  });

  it("keeps private class method names in frames", () => {
    const reporter = createErrorReporter();
    reporter.report(withStack("Error: x\n    at Store.#load (https://example.test/app.js:5:1)"));
    expect(parsed(reporter).stack).toEqual(["at Store.#load (https://example.test/app.js:5:1)"]);
  });

  it("ignores errors chosen by the host", () => {
    const reporter = createErrorReporter({ ignore: (error) => error instanceof Error && "code" in error && error.code === "aborted" });
    expect(reporter.report(Object.assign(new Error("x"), { code: "aborted" }))).toBeUndefined();
    expect(reporter.report(Object.assign(new Error("x"), { handled: true }))).toBeUndefined();
    expect(reporter.report(Object.assign(new Error("x"), { status: 409 }))).toBeUndefined();
    expect(reporter.entries.value).toHaveLength(0);
  });

  it("dismisses entries and keeps only the newest maxVisible", () => {
    const reporter = createErrorReporter({ maxVisible: 2 });
    const ids = [1, 2, 3].map((status) => reporter.report(new Error("x"), { url: "/a", kind: "http", status })!.id);
    expect(reporter.entries.value.map((entry) => entry.id)).toEqual(ids.slice(1));
    reporter.dismiss(ids[1]!);
    expect(reporter.entries.value.map((entry) => entry.id)).toEqual([ids[2]]);
  });

  it("merges custom messages over the built-in locales", () => {
    const reporter = createErrorReporter({ locale: "de", messages: { de: { title: "Ein Fehler ist aufgetreten." } } });
    expect(reporter.messages()).toMatchObject({ title: "Ein Fehler ist aufgetreten.", close: "Close" });
    expect(createErrorReporter({ locale: "sk" }).messages().region).toBe("Chyby");
  });
});

describe("observeWindow", () => {
  it("reports runtime errors, rejections and resource failures until cleanup", () => {
    const reporter = createErrorReporter({ maxVisible: 10 });
    const stop = reporter.observeWindow(window);
    window.dispatchEvent(new ErrorEvent("error", { error: withStack("Error: x\n    at one (https://example.test/a.js:1:1)") }));
    window.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: withStack("Error: y\n    at two (https://example.test/b.js:1:1)") }));
    const image = document.createElement("img");
    document.body.append(image);
    image.src = "https://example.test/assets/logo.png?sig=secret";
    image.dispatchEvent(new Event("error"));
    expect(reporter.entries.value.map((entry) => entry.kind)).toEqual(["unexpected", "unexpected", "resource"]);
    expect(JSON.parse(reporter.entries.value[2]!.report).url).toBe("https://example.test/assets/logo.png");
    stop();
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("after") }));
    expect(reporter.entries.value).toHaveLength(3);
  });

  it("adds the last console errors and warnings to reports, without secrets, until cleanup", () => {
    const original = { error: window.console.error, warn: window.console.warn };
    const silenced = vi.fn();
    window.console.error = silenced;
    window.console.warn = silenced;
    try {
      const reporter = createErrorReporter({ maxConsole: 2 });
      const stop = reporter.observeWindow(window);
      console.warn("first, dropped");
      console.error("sync failed:", new TypeError("token=abc123 rejected"));
      console.warn("retrying", { page: 3 });
      reporter.report(withStack("Error: x\n    at one (https://example.test/a.js:1:1)"));
      const lines: string[] = parsed(reporter).console;
      expect(lines.map((line) => line.replace(/^\d\d:\d\d:\d\d\.\d{3} /, ""))).toEqual(["error: sync failed: TypeError: [redacted] rejected", 'warn: retrying {"page":3}']);
      expect(silenced).toHaveBeenCalledTimes(3);
      stop();
      expect(window.console.error).toBe(silenced);
      expect(window.console.warn).toBe(silenced);
    } finally {
      Object.assign(window.console, original);
    }
  });

  it("keeps no console lines when maxConsole is 0", () => {
    const reporter = createErrorReporter({ maxConsole: 0 });
    const before = window.console.error;
    const stop = reporter.observeWindow(window);
    expect(window.console.error).toBe(before);
    reporter.report(new Error("x"));
    expect(parsed(reporter).console).toBeUndefined();
    stop();
  });
});

describe("ErrorHost", () => {
  async function openDialog() {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText }, userAgent: "test browser", onLine: true });
    const reporter = createErrorReporter();
    reporter.report(new Error("password=body-secret"), { url: "/weird?token=secret", kind: "network" });
    const wrapper = mount(ErrorHost, { props: { reporter }, attachTo: document.body });
    document.querySelector<HTMLButtonElement>(".vec-link")!.click();
    await nextTick();
    await nextTick();
    const dialog = document.querySelector<HTMLDialogElement>("dialog")!;
    return { wrapper, dialog, writeText };
  }

  it("copies exactly the sanitized report displayed in the keyboard dialog", async () => {
    const { wrapper, dialog, writeText } = await openDialog();
    expect(dialog.open).toBe(true);
    document.querySelector<HTMLButtonElement>(".vec-dialog-footer button")!.click();
    await nextTick();
    expect(writeText).toHaveBeenCalledWith(document.querySelector("pre")!.textContent);
    expect(writeText.mock.calls[0]![0]).not.toContain("secret");
    dialog.close();
    await nextTick();
    wrapper.unmount();
  });

  it("closes only when both press and release land on the backdrop", async () => {
    const { wrapper, dialog } = await openDialog();
    dialog.getBoundingClientRect = () => DOMRect.fromRect({ x: 100, y: 100, width: 200, height: 200 });
    const press = (target: Element, type: string, x: number) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: 150 }));
    press(dialog, "pointerdown", 110);
    press(dialog, "click", 110);
    expect(dialog.open).toBe(true);
    press(document.querySelector("pre")!, "pointerdown", 150);
    press(dialog, "click", 50);
    expect(dialog.open).toBe(true);
    press(dialog, "pointerdown", 50);
    press(dialog, "click", 50);
    expect(dialog.open).toBe(false);
    wrapper.unmount();
  });

  it("renders slow notices as status messages", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<never>(() => {})));
    const reporter = createErrorReporter({ locale: "sk" });
    const wrapper = mount(ErrorHost, { props: { reporter }, attachTo: document.body });
    void reporter.capture("/slow", {}, async () => undefined, { timeoutMs: null, slowMs: 10 });
    await vi.advanceTimersByTimeAsync(10);
    const notice = document.querySelector(".vec-alert")!;
    expect(notice.getAttribute("role")).toBe("status");
    expect(notice.textContent).toContain("Požiadavka trvá dlhšie ako zvyčajne.");
    expect(document.querySelector(".vec-errors")!.getAttribute("aria-label")).toBe("Chyby");
    expect(document.querySelector(".vec-errors")!.hasAttribute("aria-live")).toBe(false);
    wrapper.unmount();
  });
});
