# ECG Viewer

Embeddable React component for displaying DICOM 12-lead Resting ECGs. WebGL
rendering, fully theme-able via CSS custom properties, no UI controls bundled
in the canvas — host applications drive everything through props, a ref API,
and standard mouse/keyboard.

Josselin Duchateau @ IHU Liryc

## Features

- DICOM Resting 12-Lead ECG parser (SOP 1.2.840.10008.5.1.4.1.1.9.1.1) running
  server-side; binary Float32 wire transfer for low overhead.
- Three clinical layouts: **12 × 1** (continuous), **6 × 2**, **3 × 4** (with
  full-duration rhythm strip below).
- Time scale (25 / 50 mm/s) and amplitude scale (5 / 10 / 20 mm/mV) cycled
  via clickable on-canvas chips.
- 1 mm horizontal ≡ 1 mm vertical on screen, at all scales (reference 96 DPI).
- Layout-invariant page height (the canvas size is locked to the 10 mm/mV
  reference so amplitude changes don't reflow).
- Fit-best: the page always fills width *or* height of its container while
  preserving aspect ratio.
- Crisp **ctrl/⌘ + wheel zoom** around the cursor (re-rendered at higher
  resolution, not CSS-scaled). Bounded [1×, 5×]. Pan via two-finger trackpad
  swipe or middle-mouse drag.
- **Caliper measurement tool**: click-drag in the trace area to create a
  caliper. Direction of the drag selects mode:
  - dominantly horizontal → **time** (full-height vertical bars, ms readout)
  - dominantly vertical → **amplitude** (full-width horizontal bars, mV readout)

  Click+drag the value label to move a caliper; hover + <kbd>D</kbd> /
  <kbd>Delete</kbd> / <kbd>Backspace</kbd> to remove it.
- PNG export of the current view via ref API.

## Project layout

```
ecg-viewer/
├── shared/ecgTypes.ts     # types shared between client and server
├── server/
│   ├── index.ts           # Fastify backend (binary wire format)
│   ├── parseDicomEcg.ts   # DICOM parser (uses dicom-parser)
│   └── samples/*.dcm      # demo files served by the backend
├── src/
│   ├── components/
│   │   ├── ECGViewer.tsx  # the React component (forwardRef)
│   │   └── ECGViewer.css  # all viewer styles + CSS variables
│   ├── webgl/
│   │   ├── EcgRenderer.ts # canvas + WebGL renderer
│   │   ├── shaders.ts     # GLSL sources + compile helpers
│   │   ├── theme.ts       # CSS-variable theme reader
│   │   └── layouts.ts     # 12×1 / 6×2 / 3×4 grid descriptors
│   ├── api.ts             # frontend fetch wrappers + binary decoder
│   ├── types.ts           # ViewerOptions, Caliper, etc.
│   ├── App.tsx, App.css   # demo app (sample switcher + export button)
│   └── main.tsx
└── public/, vite.config.ts, tsconfig*.json, package.json
```

## Getting started

```bash
npm install
npm run dev        # both client (5173) and server (3001) via concurrently
npm run build      # production build of the demo SPA
npm run build:lib  # library build for npm publishing (dist-lib/)
npm run test       # vitest (parser, wire format, layouts)
npm run typecheck
```

The demo app at <http://localhost:5173> auto-loads sample 1 and provides a
header to switch between the bundled sample files or upload your own `.dcm`.

## Using the React component

```tsx
import { useRef } from 'react';
import { ECGViewer, type ECGViewerHandle } from 'ecg-viewer/components/ECGViewer';
import { loadSample } from 'ecg-viewer/api';

function Demo() {
  const ref = useRef<ECGViewerHandle>(null);
  const [record, setRecord] = useState(null);

  useEffect(() => { loadSample('1').then(setRecord); }, []);

  return (
    <div style={{ height: '100vh', display: 'flex' }}>
      <ECGViewer
        ref={ref}
        record={record}
        initialOptions={{ layout: '3x4', timeScale: 25, amplitudeScale: 10 }}
        onOptionsChange={(o) => console.log('layout changed →', o)}
        className="my-custom-theme"
      />
      <button onClick={() => {
        const url = ref.current?.exportPng();
        if (url) downloadDataUrl(url, 'ecg.png');
      }}>Export</button>
    </div>
  );
}
```

### Props

| Prop | Type | Description |
| --- | --- | --- |
| `record` | `EcgRecord \| null` | Parsed ECG data. `null` → empty state. |
| `initialOptions` | `Partial<ViewerOptions>` | Initial layout / time / amp / rhythmLead. |
| `className` | `string` | Extra class on the root (for CSS theming). |
| `onOptionsChange` | `(o: ViewerOptions) => void` | Called every time the user cycles a chip or you call `setOption`. |

`ViewerOptions`:
```ts
{
  layout: '12x1' | '6x2' | '3x4',
  timeScale: 25 | 50,           // mm/s
  amplitudeScale: 5 | 10 | 20,  // mm/mV
  rhythmLead: number            // 0..11, lead shown as full-duration strip
}
```

### Imperative ref API (`ECGViewerHandle`)

| Method | Notes |
| --- | --- |
| `exportPng(): string \| null` | Returns the current view as a `data:image/png;base64,...` URL. |
| `clearCalipers(): void` | Remove all caliper measurements (pushes to history — undoable). |
| `undo(): void` | Undo the most recent caliper change. |
| `redo(): void` | Redo the most recently undone caliper change. |
| `resetZoom(): void` | Reset zoom to 1× and re-center. |
| `toggleFullscreen(): void` | Toggle browser fullscreen on the viewer root. |
| `setOption(key, value): void` | Programmatically change a single `ViewerOptions` entry. |
| `getOptions(): ViewerOptions` | Read the live options snapshot. |
| `refresh(): void` | Re-read CSS theme variables and redraw. Call after live CSS changes. |

### Container sizing

The component fills its parent. Give the parent a deterministic size — usually
`display: flex` with `flex: 1` or an explicit height — and the viewer will
fit-best while preserving the 1 mm = 1 mm aspect ratio.

## Theming with CSS

**Nothing about the visual identity lives in JavaScript.** All colors and the
trace thickness are read from CSS custom properties on the viewer element on
every render.

| Variable | Purpose | Default (red theme) |
| --- | --- | --- |
| `--ecg-bg` | Background fill | `#fff8f8` |
| `--ecg-grid-minor` | 1-mm grid lines | `#f4c4c4` |
| `--ecg-grid-major` | 5-mm grid lines | `#d24a4a` |
| `--ecg-label` | Lead names, column-join bars (¦), chip text | `#1a1a1a` |
| `--ecg-trace` | ECG trace color | `#000000` |
| `--ecg-trace-thickness` | Trace thickness in CSS pixels | `1px` |
| `--ecg-accent` | Calipers, rhythm-strip marker, hover highlight | `#9b1c1c` |
| `--ecg-ui-chip-bg` | Background of clickable chips and caliper labels | `rgba(255,255,255,0.7)` |
| `--ecg-ui-chip-border` | Border of chips and caliper labels | `rgba(0,0,0,0.1)` |

Two preset themes ship in `ECGViewer.css` and are activated by adding a class:

```tsx
<ECGViewer className="ecg-theme-green" /* ... */ />
<ECGViewer className="ecg-theme-bw"    /* ... */ />
```

Custom theming is just a CSS override:

```css
.my-custom-theme {
  --ecg-bg: #0a0a0a;
  --ecg-grid-minor: #1a1a1a;
  --ecg-grid-major: #303030;
  --ecg-label: #d0d0d0;
  --ecg-trace: #4ade80;
  --ecg-trace-thickness: 1.5px;
  --ecg-accent: #fbbf24;
}
```

If you mutate any of these variables at runtime (e.g. for a dark/light toggle),
call `ref.current?.refresh()` to make the renderer re-read them.

## Backend API

The bundled Fastify server parses DICOM on the wire so the frontend never has
to ship `dicom-parser` (saves ~30 KB gzip).

### Endpoints

- `GET /api/health` → `{ ok: true }`
- `GET /api/samples` → `[{ id: string, file: string }, ...]`
- `GET /api/samples/:id` → binary `EcgRecord` (see wire format below)
- `POST /api/parse` (multipart form, field `file`) → binary `EcgRecord`

The records returned by `:id` and `/parse` are truncated server-side to a
configurable display duration (default **10 s**, see `DISPLAY_DURATION_SEC`
in `server/index.ts`).

### Binary wire format

`Content-Type: application/octet-stream`

```
[ uint32 LE: jsonLength (multiple of 4) ]
[ jsonLength bytes: UTF-8 JSON metadata, space-padded ]
[ numChannels × numSamples × 4 bytes: Float32 LE, channel-major ]
```

The JSON header (`EcgRecordMetaWire`):

```ts
{
  numChannels: number,
  numSamples: number,
  samplingFrequency: number,
  durationSec: number,
  patientName?: string,
  acquisitionDate?: string,
  rawLeadOrder?: string[],
  channelLabels: string[]
}
```

The Float32 samples are *millivolts* and arranged contiguously by channel
(channel 0 samples, then channel 1, …) so the client can build a
`Float32Array` view over the response `ArrayBuffer` with **zero copy**.

This decoding lives in `src/api.ts` (`decodeRecord(arrayBuffer)`). If you want
to use the viewer with your own backend, return the same binary format from
wherever — the client doesn't care about HTTP routing or DICOM specifics.

### Using your own backend

The `ECGViewer` component is decoupled from the API. Build an `EcgRecord` any
way you like and pass it as the `record` prop:

```ts
const record: EcgRecord = {
  channels: [
    { label: 'I',  samples: new Float32Array([...]) },
    /* ... 11 more ... */
  ],
  samplingFrequency: 500,
  durationSec: 10,
};
```

The 12 channels must be in standard order: `I, II, III, aVR, aVL, aVF, V1..V6`.
If your source has only the 8 stored leads (`I, II, V1..V6`), use the same
derivation logic as `server/parseDicomEcg.ts:deriveLead`.

## Interactions cheat sheet

| Action | Trigger |
| --- | --- |
| Cycle layout | Click top-left `12 × 1 / 6 × 2 / 3 × 4` chip |
| Cycle time scale | Click bottom-right `25 mm/s` chip |
| Cycle amplitude scale | Click bottom-right `10 mm/mV` chip |
| Set rhythm-strip lead | Click any lead label (in 6 × 2 / 3 × 4) |
| Time crosshair | Move the cursor inside the plot — a dashed vertical guide tracks it across all simultaneously-recorded rows |
| Zoom (centered on cursor) | <kbd>ctrl</kbd> or <kbd>⌘</kbd> + mouse wheel / trackpad pinch |
| Pan (when zoomed) | Two-finger trackpad swipe or middle-mouse drag |
| Reset zoom | "réinitialiser" link in the meta bar |
| Toggle fullscreen | <kbd>F</kbd> (or `ref.current.toggleFullscreen()`) |
| Create caliper | Click-drag in the trace area (mode follows drag direction) |
| Move caliper | Click-drag its value label |
| Delete caliper | Hover the label, press <kbd>D</kbd> / <kbd>Delete</kbd> / <kbd>Backspace</kbd> |
| Undo / redo | <kbd>ctrl/⌘+Z</kbd> · <kbd>ctrl/⌘+⇧+Z</kbd> or <kbd>ctrl/⌘+Y</kbd> |
| Export PNG | Via `ref.current.exportPng()` (the demo app provides a button) |

## Implementation notes

- **WebGL trace rendering** uses TRIANGLE_STRIP, not `gl.LINE_STRIP`. Each
  sample becomes 2 vertices with the perpendicular computed in the vertex
  shader (miter join). This gives reliable pixel-accurate thickness; browser
  `lineWidth()` is capped to 1 on most platforms.
- The canvas backing store is automatically capped to the GPU's
  `MAX_VIEWPORT_DIMS` / `MAX_TEXTURE_SIZE` to prevent the silent clamping
  that otherwise shifts traces at very high zoom.
- The DICOM parser handles 8- and 16-bit signed/unsigned samples and the
  µV → mV unit normalization. Missing limb leads (III / aVR / aVL / aVF) are
  derived from I and II using the standard formulas.

## License
Apache 2.0
