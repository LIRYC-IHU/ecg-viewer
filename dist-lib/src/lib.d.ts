/**
 * Library entry point — what consumers get when they
 * `import { ... } from 'ecg-viewer'`.
 *
 * The companion CSS (`./components/ECGViewer.css`) is imported transitively
 * by `ECGViewer.tsx`, so bundlers pick it up automatically.
 */
export { ECGViewer } from './components/ECGViewer';
export type { ECGViewerHandle, ECGViewerProps } from './components/ECGViewer';
export type { EcgRecord, EcgChannel, ViewerOptions, Caliper, Layout, TimeScale, AmplitudeScale, } from './types';
export { STANDARD_LEADS_12, LAYOUTS, TIME_SCALES, AMP_SCALES, } from './types';
export { decodeRecord, encodeRecord, truncateRecord } from '../shared/wireFormat';
export type { EcgRecordMetaWire } from '../shared/ecgTypes';
export { listSamples, loadSample, uploadDicom, configureApi, type SampleInfo, } from './api';
