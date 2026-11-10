<script setup lang="ts">
import { ref } from "vue";
import { createErrorReporter, ErrorHost } from "../src";

const locale = ref<"en" | "sk">("en");
const reporter = createErrorReporter({ app: "diagnostic-playground", locale: () => locale.value });
let controller: AbortController | undefined;

function stall() {
  controller = new AbortController();
  void reporter
    .capture("/stalled?token=never-copy-this", { signal: controller.signal }, (response) => response.json(), { timeoutMs: 500 })
    .catch(() => {});
}

function slow() {
  void reporter.capture("/stalled", {}, (response) => response.json(), { timeoutMs: 3000, slowMs: 1000 }).catch(() => {});
}

function abort() {
  stall();
  controller?.abort();
}

function theme() {
  document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
}
</script>

<template>
  <main style="font: 16px system-ui; padding: 24px">
    <h1>Manual request diagnostics</h1>
    <p>No automatic telemetry.</p>
    <button @click="stall">Stall request</button>
    <button @click="slow">Slow request</button>
    <button @click="abort">Cancel request</button>
    <button @click="locale = locale === 'en' ? 'sk' : 'en'">SK / EN</button>
    <button @click="theme">Theme</button>
  </main>
  <ErrorHost :reporter="reporter" />
</template>
