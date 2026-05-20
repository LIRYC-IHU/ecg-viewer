import { useCallback, useEffect, useRef, useState } from 'react';
import { ECGViewer, type ECGViewerHandle } from './components/ECGViewer';
import { listSamples, loadSample, uploadDicom, type SampleInfo } from './api';
import type { EcgRecord } from './types';
import './App.css';

export default function App() {
  const [record, setRecord] = useState<EcgRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<SampleInfo[]>([]);
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const viewerRef = useRef<ECGViewerHandle>(null);

  useEffect(() => {
    listSamples()
      .then(setSamples)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const handleLoadSample = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setActiveSample(id);
    try {
      const rec = await loadSample(id);
      setRecord(rec);
      document.title = `ECG Viewer — ${id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setActiveSample(null);
    setLoading(true);
    setError(null);
    try {
      const rec = await uploadDicom(file);
      setRecord(rec);
      document.title = `ECG Viewer — ${file.name}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (samples.length && !record && !activeSample) {
      handleLoadSample(samples[0].id);
    }
  }, [samples, record, activeSample, handleLoadSample]);

  const handleExport = useCallback(() => {
    const url = viewerRef.current?.exportPng();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecg-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    a.click();
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>ECG Viewer</h1>
        <div className="app-loader">
          <span>Exemples :</span>
          {samples.map((s) => (
            <button
              key={s.id}
              onClick={() => handleLoadSample(s.id)}
              className={`sample-btn${activeSample === s.id ? ' active' : ''}`}
            >
              {s.id}
            </button>
          ))}
          <label className="file-input">
            <input
              type="file"
              accept=".dcm,application/dicom"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <span>Charger un .dcm…</span>
          </label>
          <button onClick={handleExport} disabled={!record} className="app-btn">
            Exporter PNG
          </button>
        </div>
      </header>

      {loading && <div className="app-status">Chargement…</div>}
      {error && <div className="app-error">{error}</div>}

      <main className="app-main">
        <ECGViewer ref={viewerRef} record={record} />
      </main>

      <footer className="app-footer">
        <span>
          <kbd>ctrl/⌘+molette</kbd> zoom · <kbd>swipe trackpad</kbd> ou{' '}
          <kbd>clic-milieu</kbd> pan · <em>drag</em> dans le tracé pour mesurer ·{' '}
          <kbd>D</kbd> supprime la mesure survolée · <kbd>ctrl/⌘+Z</kbd> /{' '}
          <kbd>ctrl/⌘+⇧+Z</kbd> undo/redo · <kbd>F</kbd> plein écran
        </span>
      </footer>
    </div>
  );
}
