import { useEffect, useRef, useState } from 'react';
import { ECGViewer, type ECGViewerHandle } from '../../../src/components/ECGViewer';
import type { EcgRecord } from '../../../shared/ecgTypes';
import {
  EXPORT_LABELS, downloadUrl, exportUrl, loadEcg, type EcgFile,
} from './girderApi';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; record: EcgRecord }
  | { status: 'error'; message: string };

function pngName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return `${dot > 0 ? fileName.slice(0, dot) : fileName}.png`;
}

function saveDataUrl(url: string, name: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** The ECG section shown on a Girder item page. */
export function EcgPanel({ files }: { files: EcgFile[] }) {
  const [selectedId, setSelectedId] = useState(files[0]._id);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const viewerRef = useRef<ECGViewerHandle>(null);

  const selected = files.find((f) => f._id === selectedId) ?? files[0];

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    loadEcg(selected._id, ctrl.signal).then(
      (record) => setState({ status: 'ready', record }),
      (err: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      },
    );
    return () => ctrl.abort();
  }, [selected._id]);

  const ready = state.status === 'ready';

  return (
    <>
      <div className="g-ecg-viewer-header">
        <span className="g-ecg-viewer-title">
          <i className="icon-heart" />
          {' ECG'}
        </span>
        {files.length > 1 ? (
          <select
            className="g-ecg-viewer-file-select form-control input-sm"
            value={selected._id}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {files.map((f) => (
              <option key={f._id} value={f._id}>{f.name}</option>
            ))}
          </select>
        ) : (
          <span className="g-ecg-viewer-file-name">{selected.name}</span>
        )}
        <span
          className="g-ecg-viewer-format label label-default"
          title={selected.converted ? 'Converted to DICOM on the server with ecg-bridge' : undefined}
        >
          {selected.formatLabel}
        </span>
        <div className="g-ecg-viewer-actions btn-group btn-group-sm">
          <button
            type="button"
            className="btn btn-default g-ecg-export"
            title="Export the current view as PNG"
            disabled={!ready}
            onClick={() => {
              const url = viewerRef.current?.exportPng();
              if (url) saveDataUrl(url, pngName(selected.name));
            }}
          >
            <i className="icon-picture" /> PNG
          </button>
          <button
            type="button"
            className="btn btn-default g-ecg-clear-calipers"
            title="Remove all calipers"
            disabled={!ready}
            onClick={() => viewerRef.current?.clearCalipers()}
          >
            <i className="icon-eraser" />
          </button>
          <button
            type="button"
            className="btn btn-default g-ecg-fullscreen"
            title="Fullscreen (F)"
            disabled={!ready}
            onClick={() => viewerRef.current?.toggleFullscreen()}
          >
            <i className="icon-resize-full" />
          </button>
          <div className="btn-group btn-group-sm">
            <button
              type="button"
              className="btn btn-default dropdown-toggle g-ecg-download"
              data-toggle="dropdown"
              title="Download"
            >
              <i className="icon-download" /> <i className="icon-down-dir" />
            </button>
            <ul className="dropdown-menu dropdown-menu-right g-ecg-download-menu" role="menu">
              <li role="presentation">
                <a role="menuitem" href={downloadUrl(selected._id)}>
                  Original file ({selected.formatLabel})
                </a>
              </li>
              {selected.exports
                // The original already is in its own format.
                .filter((format) => format !== selected.format)
                .map((format) => (
                  <li role="presentation" key={format}>
                    <a role="menuitem" href={exportUrl(selected._id, format)}>
                      {EXPORT_LABELS[format]}
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="g-ecg-viewer-body">
        {state.status === 'loading' && (
          <div className="g-ecg-viewer-status">
            <i className="icon-spin3 animate-spin" /> Loading ECG…
          </div>
        )}
        {state.status === 'error' && (
          <div className="g-ecg-viewer-status g-ecg-viewer-error">
            <i className="icon-attention" /> Could not display this ECG: {state.message}
          </div>
        )}
        {ready && <ECGViewer key={selected._id} ref={viewerRef} record={state.record} />}
      </div>
    </>
  );
}
