/**
 * Library entry point — what consumers get when they
 * `import { ... } from 'ecg-viewer'`.
 *
 * The companion CSS (`./components/ECGViewer.css`) is imported transitively
 * by `ECGViewer.tsx`, so bundlers pick it up automatically.
 */

// Component
export { ECGViewer } from './components/ECGViewer';
export type { ECGViewerHandle, ECGViewerProps } from './components/ECGViewer';

// Types consumers need to drive the component
export type {
  EcgRecord,
  EcgChannel,
  ViewerOptions,
  Caliper,
  Layout,
  TimeScale,
  AmplitudeScale,
} from './types';
export {
  STANDARD_LEADS_12,
  LAYOUTS,
  TIME_SCALES,
  AMP_SCALES,
} from './types';

// Wire format — the truly reusable I/O primitive. Consumers with their own
// backend can call `decodeRecord` on any `ArrayBuffer` matching the format.
export { decodeRecord, encodeRecord, truncateRecord } from '../shared/wireFormat';
export type { EcgRecordMetaWire } from '../shared/ecgTypes';

// Optional fetch wrappers — only useful if you also use the bundled backend.
// You can configure the base URL via `configureApi`.
export {
  listSamples,
  loadSample,
  uploadDicom,
  configureApi,
  type SampleInfo,
} from './api';
