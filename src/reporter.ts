import { shallowRef, type ShallowRef } from "vue";

export type FailureKind = "network" | "timeout" | "http" | "body" | "resource" | "unexpected";

export interface ErrorContext {
  method?: string;
  url?: string;
  status?: number;
  elapsedMs?: number;
  requestId?: string;
  kind?: FailureKind;
}

export interface Diagnostic {
  id: number;
  kind: FailureKind;
  report: string;
  count: number;
  slow: boolean;
}

export interface ErrorMessages {
  region: string;
  title: string;
  slow: string;
  details: string;
  close: string;
  copy: string;
  copied: string;
  failed: string;
  heading: string;
  privacy: string;
}

export interface CaptureOptions {
  /** deadline in ms for the request and `consume`; null disables it. a response returned from `consume` is cancelled only through `init.signal`. */
  timeoutMs?: number | null;
  /** shows a notice while the request is still pending after this many ms; it clears when the request settles. */
  slowMs?: number;
  /** shows no alert or notice, but still attaches the request context to the thrown error. */
  silent?: boolean;
}

export interface ReporterOptions {
  app?: string;
  build?: string;
  locale?: string | (() => string);
  messages?: Record<string, Partial<ErrorMessages>>;
  maxVisible?: number;
  requestIdHeader?: string;
  silenceClientErrors?: boolean;
  ignore?: (error: unknown) => boolean;
  dedupMs?: number;
  maxFrames?: number;
  timeoutMs?: number | null;
}

export interface ErrorReporter {
  entries: ShallowRef<Diagnostic[]>;
  messages(): ErrorMessages;
  report(error: unknown, context?: ErrorContext): Diagnostic | undefined;
  attach(error: unknown, context: ErrorContext): void;
  dismiss(id: number): void;
  capture<T>(url: string, init: RequestInit, consume: (response: Response) => Promise<T>, options?: CaptureOptions): Promise<T>;
  observeWindow(target: Window): () => void;
}

const english: ErrorMessages = {
  region: "Errors",
  title: "An error has occurred.",
  slow: "A request is taking longer than usual.",
  details: "Details",
  close: "Close",
  copy: "Copy report",
  copied: "Report copied",
  failed: "Copy failed. Select and copy the text below.",
  heading: "Error details",
  privacy: "This is the complete report that will be copied. Nothing is sent automatically. It includes the request ID and your browser's user agent. Error messages, request headers and bodies, and URL query values are left out. Parts of the URL that look secret are redacted on a best-effort basis.",
};

const builtInMessages: Record<string, ErrorMessages> = {
  en: english,
  sk: {
    region: "Chyby",
    title: "Vyskytla sa chyba.",
    slow: "Požiadavka trvá dlhšie ako zvyčajne.",
    details: "Podrobnosti",
    close: "Zavrieť",
    copy: "Kopírovať hlásenie",
    copied: "Hlásenie skopírované",
    failed: "Kopírovanie zlyhalo. Označte a skopírujte text nižšie.",
    heading: "Podrobnosti chyby",
    privacy: "Toto je celé hlásenie, ktoré sa skopíruje. Nič sa neposiela automaticky. Obsahuje ID požiadavky a identifikátor vášho prehliadača (user agent). Neobsahuje chybové správy, hlavičky ani telo požiadavky, ani hodnoty parametrov URL. Časti URL, ktoré vyzerajú ako tajné údaje, sa podľa možností skryjú.",
  },
};

const secretWord = /token|passw|secret|key|code|credential|session|auth|reset|invit|verif|confirm|magic|activat|unsubscribe/i;
const v8Frame = /^\s*at (?:(.+?) \()?((?:https?|file|blob):[^\s()]+?)(:\d+:\d+)\)?$/;
const geckoFrame = /^([^@]*)@((?:https?|file|blob):[^\s()]+?)(:\d+:\d+)$/;

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function opaque(text: string): boolean {
  return /[A-Za-z0-9_=-]{32,}/.test(text) || (/^[\w~=+-]{16,}$/.test(text) && /\d/.test(text) && /[A-Za-z]/.test(text));
}

function safePath(pathname: string): string {
  let afterSecret = false;
  return pathname.split("/").map((segment) => {
    const text = decode(segment);
    const redact = (afterSecret && text !== "") || text.includes("@") || opaque(text);
    afterSecret = secretWord.test(text);
    return redact ? "[redacted]" : segment;
  }).join("/");
}

function safeUrl(value: string): string {
  try {
    const url = new URL(value, "https://relative.invalid");
    if (url.protocol !== "http:" && url.protocol !== "https:") return `${url.protocol}[redacted]`;
    const origin = url.hostname === "relative.invalid" ? "" : url.origin;
    return `${origin}${safePath(url.pathname)}`.slice(0, 300);
  } catch {
    return "[unavailable]";
  }
}

function safeLabel(value: string | undefined): string | undefined {
  return value?.replace(/[^a-zA-Z0-9 ._:/@+-]/g, "_").slice(0, 120) || undefined;
}

function safeName(name: string): string {
  return name
    .replace(/\b(?:password|authorization|cookie|token|secret|api[-_]?key|csrf)\s*[:=]\s*\S+/gi, "[redacted]")
    .replace(/[^\s@/:]+@[^\s@/:]+/g, "[redacted]")
    .replace(/[A-Za-z0-9_=-]{32,}/g, "[redacted]")
    .slice(0, 120);
}

function safeFrames(error: unknown, limit: number): string[] {
  if (!(error instanceof Error) || !error.stack) return [];
  const frames: string[] = [];
  for (const line of error.stack.split("\n")) {
    if (frames.length >= limit) break;
    const v8 = v8Frame.exec(line);
    if (v8) {
      const location = `${safeUrl(v8[2]!)}${v8[3]}`;
      frames.push(v8[1] ? `at ${safeName(v8[1])} (${location})` : `at ${location}`);
      continue;
    }
    const gecko = geckoFrame.exec(line);
    if (gecko) frames.push(`${safeName(gecko[1]!)}@${safeUrl(gecko[2]!)}${gecko[3]}`);
  }
  return frames;
}

function linkSignals(own: AbortController, external: AbortSignal): AbortSignal {
  if (typeof AbortSignal.any === "function") return AbortSignal.any([own.signal, external]);
  if (external.aborted) own.abort(external.reason);
  else external.addEventListener("abort", () => own.abort(external.reason), { once: true });
  return own.signal;
}

function cancellation(reason: unknown): Error {
  if (reason instanceof Error && reason.name === "AbortError") return reason;
  return Object.assign(new DOMException("Request cancelled", "AbortError"), { cause: reason });
}

export function createErrorReporter(options: ReporterOptions = {}): ErrorReporter {
  const entries = shallowRef<Diagnostic[]>([]);
  const contexts = new WeakMap<object, ErrorContext>();
  const seen = new WeakSet<object>();
  const recent = new Map<string, { id: number; at: number }>();
  const dedupMs = options.dedupMs ?? 10000;
  let sequence = 0;

  const messages = (): ErrorMessages => {
    const locale = typeof options.locale === "function" ? options.locale() : options.locale ?? "en";
    return { ...english, ...options.messages?.en, ...builtInMessages[locale], ...options.messages?.[locale] };
  };

  const ignored = (error: unknown): boolean => {
    if (options.ignore?.(error)) return true;
    if (!error || typeof error !== "object") return false;
    const e = error as { name?: unknown; status?: unknown; handled?: unknown };
    if (e.name === "AbortError" || e.handled === true) return true;
    return (options.silenceClientErrors ?? true) && typeof e.status === "number" && e.status >= 400 && e.status < 500;
  };

  const attach = (error: unknown, context: ErrorContext) => {
    if (error && typeof error === "object") contexts.set(error, { ...contexts.get(error), ...context });
  };

  const dismiss = (id: number) => {
    entries.value = entries.value.filter((entry) => entry.id !== id);
  };

  const show = (kind: FailureKind, data: object, slow: boolean): Diagnostic => {
    const diagnostic: Diagnostic = { id: ++sequence, kind, count: 1, slow, report: JSON.stringify(data, null, 2) };
    entries.value = [...entries.value, diagnostic].slice(-Math.max(1, options.maxVisible ?? 3));
    return diagnostic;
  };

  const describe = (error: unknown, ctx: ErrorContext, now: number) => {
    const kind = ctx.kind ?? "unexpected";
    const url = ctx.url ? safeUrl(ctx.url) : undefined;
    const method = ctx.method?.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 16);
    const frames = safeFrames(error, options.maxFrames ?? 20);
    const name = error instanceof Error ? error.name : typeof error;
    const data = {
      application: safeLabel(options.app),
      build: safeLabel(options.build),
      time: new Date(now).toISOString(),
      kind,
      method,
      url,
      status: Number.isFinite(ctx.status) ? ctx.status : undefined,
      elapsedMs: Number.isFinite(ctx.elapsedMs) ? Math.round(ctx.elapsedMs!) : undefined,
      requestId: safeLabel(ctx.requestId),
      browser: typeof navigator === "undefined" ? undefined : navigator.userAgent.replace(/[^a-zA-Z0-9 ._()/;-]/g, "").slice(0, 240),
      online: typeof navigator === "undefined" ? undefined : navigator.onLine,
      stack: frames.join("\n") || undefined,
    };
    return { kind, data, fingerprint: [kind, method, url, ctx.status, name, frames[0]].join(" ") };
  };

  const report = (error: unknown, context: ErrorContext = {}): Diagnostic | undefined => {
    if (ignored(error)) return;
    const saved = error && typeof error === "object" ? contexts.get(error) : undefined;
    if (error && typeof error === "object") {
      if (seen.has(error)) return;
      seen.add(error);
    }
    const now = Date.now();
    const { kind, data, fingerprint } = describe(error, { ...saved, ...context }, now);
    const previous = recent.get(fingerprint);
    const visible = previous && now - previous.at < dedupMs ? entries.value.find((entry) => entry.id === previous.id) : undefined;
    if (visible) {
      const updated = { ...visible, count: visible.count + 1 };
      entries.value = entries.value.map((entry) => entry.id === visible.id ? updated : entry);
      return updated;
    }
    for (const [key, value] of recent) if (now - value.at >= dedupMs) recent.delete(key);
    const diagnostic = show(kind, data, false);
    recent.set(fingerprint, { id: diagnostic.id, at: now });
    return diagnostic;
  };

  const capture = async <T>(url: string, init: RequestInit, consume: (response: Response) => Promise<T>, opts: CaptureOptions = {}): Promise<T> => {
    const external = init.signal ?? undefined;
    const controller = new AbortController();
    // the caller's signal must keep cancelling a response body that outlives this call
    const signal = external ? linkSignals(controller, external) : controller.signal;
    const started = Date.now();
    const context: ErrorContext = { method: init.method ?? "GET", url, kind: "network" };
    const deadline = opts.timeoutMs === undefined ? options.timeoutMs ?? 30000 : opts.timeoutMs;
    let timeout: Error | undefined;
    let notice: Diagnostic | undefined;
    let interrupt!: (reason: unknown) => void;
    const interrupted = new Promise<never>((_, reject) => {
      interrupt = reject;
    });
    const cancel = () => interrupt(cancellation(external!.reason));
    external?.addEventListener("abort", cancel, { once: true });
    const timer = deadline === null ? undefined : globalThis.setTimeout(() => {
      timeout = Object.assign(new Error("Request deadline exceeded"), { name: "TimeoutError" });
      controller.abort(timeout);
      interrupt(timeout);
    }, Math.max(1, deadline));
    const slowTimer = !opts.slowMs || opts.silent ? undefined : globalThis.setTimeout(() => {
      const { kind, data } = describe(undefined, { ...context, kind: "timeout", elapsedMs: Date.now() - started }, Date.now());
      notice = show(kind, data, true);
    }, opts.slowMs);
    const operation = async () => {
      if (external?.aborted) throw cancellation(external.reason);
      const response = await fetch(url, { ...init, signal });
      context.status = response.status;
      context.requestId = response.headers.get(options.requestIdHeader ?? "X-Request-ID") ?? undefined;
      context.kind = response.ok ? "body" : "http";
      const result = await consume(response);
      if (!response.ok) throw Object.assign(new Error("HTTP request failed"), { status: response.status });
      return result;
    };
    try {
      return await Promise.race([operation(), interrupted]);
    } catch (error) {
      if (external?.aborted && !timeout) throw cancellation(external.reason);
      const failure = timeout ?? error;
      const finalContext = { ...context, elapsedMs: Date.now() - started, kind: timeout ? "timeout" as const : context.kind };
      attach(failure, finalContext);
      if (!opts.silent) report(failure, finalContext);
      throw failure;
    } finally {
      clearTimeout(timer);
      clearTimeout(slowTimer);
      external?.removeEventListener("abort", cancel);
      if (notice) dismiss(notice.id);
    }
  };

  const observeWindow = (target: Window) => {
    const onError = (event: Event) => {
      if (event instanceof ErrorEvent && event.error) {
        report(event.error);
        return;
      }
      const resource = event.target as { src?: string; href?: string } | null;
      const url = resource?.src ?? resource?.href;
      if (url) report(new Error("Resource failed to load"), { url, kind: "resource", method: "GET" });
    };
    const onRejection = (event: PromiseRejectionEvent) => report(event.reason);
    target.addEventListener("error", onError, true);
    target.addEventListener("unhandledrejection", onRejection);
    return () => {
      target.removeEventListener("error", onError, true);
      target.removeEventListener("unhandledrejection", onRejection);
    };
  };

  return { entries, messages, report, attach, dismiss, capture, observeWindow };
}
