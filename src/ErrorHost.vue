<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { CircleAlert, Clock, Copy, X } from "@lucide/vue";
import type { Diagnostic, ErrorReporter } from "./reporter";
import "./style.css";

const props = defineProps<{ reporter: ErrorReporter }>();
const messages = computed(() => props.reporter.messages());
const dialog = ref<HTMLDialogElement>();
const selected = ref<Diagnostic>();
const copyStatus = ref("");
let previousFocus: HTMLElement | null = null;
let pressedBackdrop = false;

async function details(entry: Diagnostic) {
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
  selected.value = undefined;
  previousFocus?.focus();
}

// clicks on the dialog padding and text selections released outside the report also target the dialog itself
function onBackdrop(event: MouseEvent): boolean {
  const element = dialog.value;
  if (!element || event.target !== element) return false;
  const rect = element.getBoundingClientRect();
  return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
}

function clicked(event: MouseEvent) {
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
</script>

<template>
  <Teleport to="body">
    <section class="vec-errors" :aria-label="messages.region">
      <article
        v-for="entry in reporter.entries.value"
        :key="entry.id"
        :class="['vec-alert', { 'vec-slow': entry.slow }]"
        :role="entry.slow ? 'status' : 'alert'"
      >
        <Clock v-if="entry.slow" class="vec-icon" :size="20" />
        <CircleAlert v-else class="vec-icon" :size="20" />
        <div class="vec-alert-content">
          <p>
            {{ entry.slow ? messages.slow : messages.title }}
            <span v-if="entry.count > 1">({{ entry.count }})</span>
          </p>
          <button class="vec-link" type="button" @click="details(entry)">{{ messages.details }}</button>
        </div>
        <button class="vec-icon-button" type="button" :aria-label="messages.close" @click="reporter.dismiss(entry.id)">
          <X :size="18" />
        </button>
      </article>
    </section>
    <dialog
      ref="dialog"
      class="vec-dialog"
      aria-labelledby="vec-error-heading"
      aria-describedby="vec-error-privacy"
      @close="closed"
      @pointerdown="pressedBackdrop = onBackdrop($event)"
      @click="clicked"
    >
      <template v-if="selected">
        <header class="vec-dialog-header">
          <h2 id="vec-error-heading">{{ messages.heading }}</h2>
          <button class="vec-icon-button" type="button" :aria-label="messages.close" autofocus @click="close">
            <X :size="20" />
          </button>
        </header>
        <p id="vec-error-privacy">{{ messages.privacy }}</p>
        <pre tabindex="0" class="vec-report">{{ selected.report }}</pre>
        <footer class="vec-dialog-footer">
          <button class="vec-button" type="button" @click="copy"><Copy :size="16" />{{ messages.copy }}</button>
          <button class="vec-button" type="button" @click="close">{{ messages.close }}</button>
        </footer>
        <p class="vec-copy-status" role="status">{{ copyStatus }}</p>
      </template>
    </dialog>
  </Teleport>
</template>
