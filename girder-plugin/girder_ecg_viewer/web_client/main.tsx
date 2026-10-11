/**
 * Girder 5 web-client entry point: adds an ECG section to the item page
 * whenever the item holds an ECG file — DICOM, or any vendor format the
 * server can convert with ecg-bridge.
 *
 * Girder loads this bundle after its own client, so everything Girder-side is
 * reached through the `girder` global; React and the viewer are bundled in.
 */

import { createRoot } from 'react-dom/client';
import { EcgPanel } from './EcgPanel';
import { listItemEcgFiles, type EcgFile } from './girderApi';
import './panel.css';

const ItemView = girder.views.body.ItemView;
const { wrap } = girder.utilities.PluginUtils;

function detachPanel(view: GirderItemView): void {
  view._ecgPanel?.destroy();
  view._ecgPanel = undefined;
}

/**
 * (Re)build the ECG section from the item's current file list. Runs after
 * every render and whenever the file list changes (upload, delete).
 */
async function refreshPanel(view: GirderItemView, render: object): Promise<void> {
  let ecgFiles: EcgFile[];
  try {
    ecgFiles = await listItemEcgFiles(view.model.id);
  } catch {
    // No ECG section rather than a broken one (e.g. plugin API unreachable).
    ecgFiles = [];
  }

  // The view re-rendered (or moved on) while we were asking.
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
