# @promptboard/vue-whiteboard

Vue wrapper for the core-whiteboard engine.

## Features

- `useWhiteboard` composable for Vue Composition API
- Reactive state management
- Full TypeScript support
- Easy integration with existing Vue apps

## Installation

```bash
npm install @promptboard/vue-whiteboard
```

## Usage

```vue
<script setup lang="ts">
import { useWhiteboard } from '@promptboard/vue-whiteboard';

const { canvasRef, isReady } = useWhiteboard();
</script>

<template>
  <canvas ref="canvasRef"></canvas>
</template>
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## License

Apache-2.0
