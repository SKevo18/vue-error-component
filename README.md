# @skevo18/vue-error-component

A Vue 3 component and reporter that show a generic alert when a request or script fails, with a details dialog holding a plain-text diagnostic report the user can copy for support. The report is built from redacted metadata (method, URL path without query, status, timing, request ID, user agent, stack frames) rather than error messages, and nothing is ever sent automatically. It exists so apps get consistent, privacy-conscious failure reporting without adding a telemetry service.

## Usage

```sh
bun add github:SKevo18/vue-error-component
```

Peer dependencies: `vue` ^3.5 and `@lucide/vue`.

```vue
<script setup lang="ts">
import { createErrorReporter, ErrorHost } from "@skevo18/vue-error-component";
import "@skevo18/vue-error-component/style.css";

const reporter = createErrorReporter({ app: "my-app", locale: "en" });
reporter.observeWindow(window);

async function load() {
  return reporter.capture("/api/items", {}, (response) => response.json());
}
</script>

<template>
  <button @click="load">Load</button>
  <ErrorHost :reporter="reporter" />
</template>
```

## License

MIT
