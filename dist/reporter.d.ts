import { type ShallowRef } from "vue";
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
export declare function createErrorReporter(options?: ReporterOptions): ErrorReporter;
