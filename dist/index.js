import { Fragment, Teleport, computed, createBlock, createCommentVNode, createElementBlock, createElementVNode, createTextVNode, createVNode, defineComponent, isRef, nextTick, normalizeClass, openBlock, ref, renderList, shallowRef, toDisplayString, unref } from "vue";
import { CircleAlert, Clock, Copy, X } from "@lucide/vue";
// src/ErrorHost.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = ["aria-label"];
var _hoisted_2 = ["role"];
var _hoisted_3 = { class: "vec-alert-content" };
var _hoisted_4 = { key: 0 };
var _hoisted_5 = ["onClick"];
var _hoisted_6 = ["aria-label", "onClick"];
var _hoisted_7 = { class: "vec-dialog-header" };
var _hoisted_8 = { id: "vec-error-heading" };
var _hoisted_9 = ["aria-label"];
var _hoisted_10 = { id: "vec-error-hint" };
var _hoisted_11 = {
	tabindex: "0",
	class: "vec-report"
};
var _hoisted_12 = { class: "vec-dialog-footer" };
var _hoisted_13 = {
	class: "vec-copy-status",
	role: "status"
};
// src/ErrorHost.vue
var ErrorHost_default = /* @__PURE__ */ defineComponent({
	__name: "ErrorHost",
	props: { reporter: {} },
	setup(__props) {
		const props = __props;
		const messages = computed(() => props.reporter.messages());
		const dialog = ref();
		const selected = ref();
		const copyStatus = ref("");
		let previousFocus = null;
		let pressedBackdrop = false;
		async function details(entry) {
			previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			selected.value = entry;
			copyStatus.value = "";
			await nextTick();
			dialog.value?.showModal();
		}
		function close() {
			dialog.value?.close();
		}
		function closed() {
			selected.value = void 0;
			previousFocus?.focus();
		}
		function onBackdrop(event) {
			const element = dialog.value;
			if (!element || event.target !== element) return false;
			const rect = element.getBoundingClientRect();
			return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
		}
		function clicked(event) {
			if (pressedBackdrop && onBackdrop(event)) close();
			pressedBackdrop = false;
		}
		async function copy() {
			if (!selected.value) return;
			try {
				await navigator.clipboard.writeText(selected.value.report);
				copyStatus.value = messages.value.copied;
			} catch {
				copyStatus.value = messages.value.failed;
			}
		}
		return (_ctx, _cache) => {
			return openBlock(), createBlock(Teleport, { to: "body" }, [createElementVNode("section", {
				class: "vec-errors",
				"aria-label": messages.value.region
			}, [(openBlock(true), createElementBlock(Fragment, null, renderList(__props.reporter.entries.value, (entry) => {
				return openBlock(), createElementBlock("article", {
					key: entry.id,
					class: normalizeClass(["vec-alert", { "vec-slow": entry.slow }]),
					role: entry.slow ? "status" : "alert"
				}, [
					entry.slow ? (openBlock(), createBlock(unref(Clock), {
						key: 0,
						class: "vec-icon",
						size: 20
					})) : (openBlock(), createBlock(unref(CircleAlert), {
						key: 1,
						class: "vec-icon",
						size: 20
					})),
					createElementVNode("div", _hoisted_3, [createElementVNode("p", null, [createTextVNode(toDisplayString(entry.slow ? messages.value.slow : messages.value.title) + " ", 1), entry.count > 1 ? (openBlock(), createElementBlock("span", _hoisted_4, "(" + toDisplayString(entry.count) + ")", 1)) : createCommentVNode("", true)]), createElementVNode("button", {
						class: "vec-link",
						type: "button",
						onClick: ($event) => details(entry)
					}, toDisplayString(messages.value.details), 9, _hoisted_5)]),
					createElementVNode("button", {
						class: "vec-icon-button",
						type: "button",
						"aria-label": messages.value.close,
						onClick: ($event) => __props.reporter.dismiss(entry.id)
					}, [createVNode(unref(X), { size: 18 })], 8, _hoisted_6)
				], 10, _hoisted_2);
			}), 128))], 8, _hoisted_1), createElementVNode("dialog", {
				ref_key: "dialog",
				ref: dialog,
				class: "vec-dialog",
				"aria-labelledby": "vec-error-heading",
				"aria-describedby": "vec-error-hint",
				onClose: closed,
				onPointerdown: _cache[0] || (_cache[0] = ($event) => isRef(pressedBackdrop) ? pressedBackdrop.value = onBackdrop($event) : pressedBackdrop = onBackdrop($event)),
				onClick: clicked
			}, [selected.value ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
				createElementVNode("header", _hoisted_7, [createElementVNode("h2", _hoisted_8, toDisplayString(messages.value.heading), 1), createElementVNode("button", {
					class: "vec-icon-button",
					type: "button",
					"aria-label": messages.value.close,
					autofocus: "",
					onClick: close
				}, [createVNode(unref(X), { size: 20 })], 8, _hoisted_9)]),
				createElementVNode("p", _hoisted_10, toDisplayString(messages.value.hint), 1),
				createElementVNode("pre", _hoisted_11, toDisplayString(selected.value.report), 1),
				createElementVNode("footer", _hoisted_12, [createElementVNode("button", {
					class: "vec-button",
					type: "button",
					onClick: copy
				}, [createVNode(unref(Copy), { size: 16 }), createTextVNode(toDisplayString(messages.value.copy), 1)]), createElementVNode("button", {
					class: "vec-button",
					type: "button",
					onClick: close
				}, toDisplayString(messages.value.close), 1)]),
				createElementVNode("p", _hoisted_13, toDisplayString(copyStatus.value), 1)
			], 64)) : createCommentVNode("", true)], 544)]);
		};
	}
});
// src/reporter.ts
var english = {
	region: "Errors",
	title: "An error has occurred.",
	slow: "A request is taking longer than usual.",
	details: "Details",
	close: "Close",
	copy: "Copy report",
	copied: "Report copied",
	failed: "Copy failed. Select and copy the text below.",
	heading: "Error details",
	hint: "Send this report to support."
};
var builtInMessages = {
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
		hint: "Pošlite toto hlásenie podpore."
	}
};
var secretWord = /token|passw|secret|key|code|credential|session|auth|reset|invit|verif|confirm|magic|activat|unsubscribe/i;
var v8Frame = /^\s*at (?:(.+?) \()?((?:https?|file|blob):[^\s()]+?)(:\d+:\d+)\)?$/;
var geckoFrame = /^([^@]*)@((?:https?|file|blob):[^\s()]+?)(:\d+:\d+)$/;
function decode(segment) {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}
function opaque(text) {
	return /[A-Za-z0-9_=-]{32,}/.test(text) || /^[\w~=+-]{16,}$/.test(text) && /\d/.test(text) && /[A-Za-z]/.test(text);
}
function safePath(pathname) {
	let afterSecret = false;
	return pathname.split("/").map((segment) => {
		const text = decode(segment);
		const redact = afterSecret && text !== "" || text.includes("@") || opaque(text);
		afterSecret = secretWord.test(text);
		return redact ? "[redacted]" : segment;
	}).join("/");
}
function safeUrl(value) {
	try {
		const url = new URL(value, "https://relative.invalid");
		if (url.protocol !== "http:" && url.protocol !== "https:") return `${url.protocol}[redacted]`;
		return `${url.hostname === "relative.invalid" ? "" : url.origin}${safePath(url.pathname)}`.slice(0, 300);
	} catch {
		return "[unavailable]";
	}
}
function safeLabel(value) {
	return value?.replace(/[^a-zA-Z0-9 ._:/@+-]/g, "_").slice(0, 120) || void 0;
}
function safeText(text, limit) {
	return text.replace(/\b((?:https?|wss?):\/\/[^\s?#]+)[?#]\S*/gi, "$1").replace(/\b(?:password|passwd|authorization|cookie|token|secret|api[-_]?key|csrf)\s*[:=]\s*(?:(?:bearer|basic)\s+)?\S+/gi, "[redacted]").replace(/\b(?:bearer|basic)\s+[\w.~+/=-]{8,}/gi, "[redacted]").replace(/[^\s@/:]+@[^\s@/:]+/g, "[redacted]").replace(/[A-Za-z0-9_=-]{32,}/g, "[redacted]").replace(/\s+/g, " ").trim().slice(0, limit);
}
function messageOf(error) {
	if (typeof error === "string") return error;
	const message = error && typeof error === "object" ? error.message : void 0;
	return typeof message === "string" ? message : void 0;
}
function consoleText(value) {
	if (value instanceof Error) return `${value.name}: ${value.message}`;
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(value) ?? String(value);
	} catch {
		return String(value);
	}
}
function safeFrames(error, limit) {
	if (!(error instanceof Error) || !error.stack) return [];
	const frames = [];
	for (const line of error.stack.split("\n")) {
		if (frames.length >= limit) break;
		const v8 = v8Frame.exec(line);
		if (v8) {
			const location = `${safeUrl(v8[2])}${v8[3]}`;
			frames.push(v8[1] ? `at ${safeText(v8[1], 120)} (${location})` : `at ${location}`);
			continue;
		}
		const gecko = geckoFrame.exec(line);
		if (gecko) frames.push(`${safeText(gecko[1], 120)}@${safeUrl(gecko[2])}${gecko[3]}`);
	}
	return frames;
}
function linkSignals(own, external) {
	if (typeof AbortSignal.any === "function") return AbortSignal.any([own.signal, external]);
	if (external.aborted) own.abort(external.reason);
	else external.addEventListener("abort", () => own.abort(external.reason), { once: true });
	return own.signal;
}
function cancellation(reason) {
	if (reason instanceof Error && reason.name === "AbortError") return reason;
	return Object.assign(new DOMException("Request cancelled", "AbortError"), { cause: reason });
}
function createErrorReporter(options = {}) {
	const entries = shallowRef([]);
	const contexts = /* @__PURE__ */ new WeakMap();
	const seen = /* @__PURE__ */ new WeakSet();
	const recent = /* @__PURE__ */ new Map();
	const dedupMs = options.dedupMs ?? 1e4;
	let sequence = 0;
	/** recent console.error and console.warn lines, oldest first, filled by observeWindow */
	const consoleLines = [];
	const maxConsole = Math.max(0, options.maxConsole ?? 10);
	const messages = () => {
		const locale = typeof options.locale === "function" ? options.locale() : options.locale ?? "en";
		return {
			...english,
			...options.messages?.en,
			...builtInMessages[locale],
			...options.messages?.[locale]
		};
	};
	const ignored = (error) => {
		if (options.ignore?.(error)) return true;
		if (!error || typeof error !== "object") return false;
		const e = error;
		if (e.name === "AbortError" || e.handled === true) return true;
		return (options.silenceClientErrors ?? true) && typeof e.status === "number" && e.status >= 400 && e.status < 500;
	};
	const attach = (error, context) => {
		if (error && typeof error === "object") contexts.set(error, {
			...contexts.get(error),
			...context
		});
	};
	const dismiss = (id) => {
		entries.value = entries.value.filter((entry) => entry.id !== id);
	};
	const show = (kind, data, slow) => {
		const diagnostic = {
			id: ++sequence,
			kind,
			count: 1,
			slow,
			report: JSON.stringify(data, null, 2)
		};
		entries.value = [...entries.value, diagnostic].slice(-Math.max(1, options.maxVisible ?? 3));
		return diagnostic;
	};
	const describe = (error, ctx, now) => {
		const kind = ctx.kind ?? "unexpected";
		const url = ctx.url ? safeUrl(ctx.url) : void 0;
		const method = ctx.method?.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 16);
		const frames = safeFrames(error, options.maxFrames ?? 20);
		const name = error instanceof Error ? error.name : typeof error;
		const message = messageOf(error);
		return {
			kind,
			data: {
				application: safeLabel(options.app),
				build: safeLabel(options.build),
				time: new Date(now).toISOString(),
				kind,
				error: message === void 0 ? void 0 : safeText(error instanceof Error ? `${name}: ${message}` : message, 500),
				method,
				url,
				status: Number.isFinite(ctx.status) ? ctx.status : void 0,
				elapsedMs: Number.isFinite(ctx.elapsedMs) ? Math.round(ctx.elapsedMs) : void 0,
				requestId: safeLabel(ctx.requestId),
				page: typeof location === "undefined" ? void 0 : safeUrl(location.href),
				browser: typeof navigator === "undefined" ? void 0 : navigator.userAgent.replace(/[^a-zA-Z0-9 ._()/;-]/g, "").slice(0, 240),
				online: typeof navigator === "undefined" ? void 0 : navigator.onLine,
				stack: frames.length ? frames : void 0,
				console: consoleLines.length ? [...consoleLines] : void 0
			},
			fingerprint: [
				kind,
				method,
				url,
				ctx.status,
				name,
				frames[0]
			].join(" ")
		};
	};
	const report = (error, context = {}) => {
		if (ignored(error)) return;
		const saved = error && typeof error === "object" ? contexts.get(error) : void 0;
		if (error && typeof error === "object") {
			if (seen.has(error)) return;
			seen.add(error);
		}
		const now = Date.now();
		const { kind, data, fingerprint } = describe(error, {
			...saved,
			...context
		}, now);
		const previous = recent.get(fingerprint);
		const visible = previous && now - previous.at < dedupMs ? entries.value.find((entry) => entry.id === previous.id) : void 0;
		if (visible) {
			const updated = {
				...visible,
				count: visible.count + 1
			};
			entries.value = entries.value.map((entry) => entry.id === visible.id ? updated : entry);
			return updated;
		}
		for (const [key, value] of recent) if (now - value.at >= dedupMs) recent.delete(key);
		const diagnostic = show(kind, data, false);
		recent.set(fingerprint, {
			id: diagnostic.id,
			at: now
		});
		return diagnostic;
	};
	const capture = async (url, init, consume, opts = {}) => {
		const external = init.signal ?? void 0;
		const controller = new AbortController();
		const signal = external ? linkSignals(controller, external) : controller.signal;
		const started = Date.now();
		const context = {
			method: init.method ?? "GET",
			url,
			kind: "network"
		};
		const deadline = opts.timeoutMs === void 0 ? options.timeoutMs ?? 3e4 : opts.timeoutMs;
		let timeout;
		let notice;
		let interrupt;
		const interrupted = new Promise((_, reject) => {
			interrupt = reject;
		});
		const cancel = () => interrupt(cancellation(external.reason));
		external?.addEventListener("abort", cancel, { once: true });
		const timer = deadline === null ? void 0 : globalThis.setTimeout(() => {
			timeout = Object.assign(/* @__PURE__ */ new Error("Request deadline exceeded"), { name: "TimeoutError" });
			controller.abort(timeout);
			interrupt(timeout);
		}, Math.max(1, deadline));
		const slowTimer = !opts.slowMs || opts.silent ? void 0 : globalThis.setTimeout(() => {
			const { kind, data } = describe(void 0, {
				...context,
				kind: "timeout",
				elapsedMs: Date.now() - started
			}, Date.now());
			notice = show(kind, data, true);
		}, opts.slowMs);
		const operation = async () => {
			if (external?.aborted) throw cancellation(external.reason);
			const response = await fetch(url, {
				...init,
				signal
			});
			context.status = response.status;
			context.requestId = response.headers.get(options.requestIdHeader ?? "X-Request-ID") ?? void 0;
			context.kind = response.ok ? "body" : "http";
			const result = await consume(response);
			if (!response.ok) throw Object.assign(/* @__PURE__ */ new Error("HTTP request failed"), { status: response.status });
			return result;
		};
		try {
			return await Promise.race([operation(), interrupted]);
		} catch (error) {
			if (external?.aborted && !timeout) throw cancellation(external.reason);
			const failure = timeout ?? error;
			const finalContext = {
				...context,
				elapsedMs: Date.now() - started,
				kind: timeout ? "timeout" : context.kind
			};
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
	const observeWindow = (target) => {
		const onError = (event) => {
			if (event instanceof ErrorEvent && event.error) {
				report(event.error);
				return;
			}
			const resource = event.target;
			const url = resource?.src ?? resource?.href;
			if (url) report(/* @__PURE__ */ new Error("Resource failed to load"), {
				url,
				kind: "resource",
				method: "GET"
			});
		};
		const onRejection = (event) => report(event.reason);
		target.addEventListener("error", onError, true);
		target.addEventListener("unhandledrejection", onRejection);
		const output = target.console;
		const hooks = (maxConsole ? ["error", "warn"] : []).map((level) => {
			const original = output[level];
			const hook = (...args) => {
				consoleLines.push(`${(/* @__PURE__ */ new Date()).toISOString().slice(11, 23)} ${level}: ${safeText(args.map(consoleText).join(" "), 500)}`);
				consoleLines.splice(0, consoleLines.length - maxConsole);
				original.apply(output, args);
			};
			output[level] = hook;
			return {
				level,
				original,
				hook
			};
		});
		return () => {
			target.removeEventListener("error", onError, true);
			target.removeEventListener("unhandledrejection", onRejection);
			for (const { level, original, hook } of hooks) if (output[level] === hook) output[level] = original;
		};
	};
	return {
		entries,
		messages,
		report,
		attach,
		dismiss,
		capture,
		observeWindow
	};
}
export { ErrorHost_default as ErrorHost, createErrorReporter };
