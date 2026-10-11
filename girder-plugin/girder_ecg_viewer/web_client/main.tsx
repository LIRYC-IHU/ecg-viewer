/**
 * Girder 5 web-client entry point: adds an ECG section to the item page
 * whenever the item holds a DICOM ECG file.
 *
 * Girder loads this bundle after its own client, so everything Girder-side is
 * reached through the `girder` global; React and the viewer are bundled in.
 */

import { createRoot } from 'react-dom/client';
import { EcgPanel, type EcgFile } from './EcgPanel';
import { sniffEcg } from './girderApi';
import { isCandidate, type FileLike } from './sniff';
import './panel.css';

/** Cap on files sniffed per item, so a huge item can't fan out requests. */
const MAX_SNIFFED_FILES = 20;

const ItemView = girder.views.body.ItemView;
const { wrap } = girder.utilities.PluginUtils;

function detachPanel(view: GirderItemView): void {
  view._ecgPanel?.destroy();
  view._ecgPanel = undefined;
}

async function findEcgFiles(files: (FileLike & { _id: string })[]): Promise<EcgFile[]> {
  const candidates = files.filter(isCandidate).slice(0, MAX_SNIFFED_FILES);
  const sniffed = await Promise.all(
    candidates.map((f) =>
      sniffEcg(f._id).then(
        (sopClass) => (sopClass ? { id: f._id, name: f.name, sopClass } : null),
        // A file we can't read is simply not shown as an ECG.
        () => null,
      ),
    ),
  );
  return sniffed.filter((f): f is EcgFile => f !== null);
}

/**
 * (Re)build the ECG section from the item's current file list. Runs after
 * every render and whenever the file list changes (upload, delete).
 */
async function refreshPanel(view: GirderItemView, render: object): Promise<void> {
  const collection = view.fileListWidget?.collection;
  if (!collection) return;
  const files = collection.models.map((m) => m.toJSON());
  const ecgFiles = await findEcgFiles(files);

  // The view re-rendered (or moved on) while we were sniffing.
  if (view._ecgRender !== render) return;

  detachPanel(view);
  if (!ecgFiles.length) return;

  const host = document.createElement('div');
  host.className = 'g-ecg-viewer-panel';
  view.$('.g-item-info').before(host);
  const root = createRoot(host);
  root.render(<EcgPanel files={ecgFiles} />);
  view._ecgPanel = {
    destroy() {
      root.unmount();
      host.remove();
    },
  };
}

wrap(ItemView, 'render', function (this: GirderItemView, render) {
  detachPanel(this);
  const token = {};
  this._ecgRender = token;

  // ItemView renders asynchronously (it first fetches the access level) and
  // signals completion once its file list has loaded.
  this.once('g:rendered', () => {
    const collection = this.fileListWidget?.collection;
    collection?.on('g:changed', () => void refreshPanel(this, token));
    void refreshPanel(this, token);
  });

  return render.call(this);
});

wrap(ItemView, 'destroy', function (this: GirderItemView, destroy) {
  this._ecgRender = undefined;
  detachPanel(this);
  return destroy.call(this);
});
