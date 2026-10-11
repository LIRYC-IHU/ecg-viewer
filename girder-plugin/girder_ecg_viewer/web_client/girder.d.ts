/**
 * The slice of the Girder 5 web client this plugin touches. Girder exposes its
 * client as the `girder` global and loads plugin bundles after it, so nothing
 * here is imported — only typed.
 */

interface GirderBackboneModel {
  id: string;
  get(key: string): any;
  toJSON(): any;
}

interface GirderBackboneCollection {
  models: GirderBackboneModel[];
  on(event: string, cb: (...args: any[]) => void, ctx?: unknown): void;
  off(event: string, cb?: (...args: any[]) => void, ctx?: unknown): void;
}

interface GirderItemView {
  model: GirderBackboneModel;
  $el: JQueryLike;
  $(selector: string): JQueryLike;
  fileListWidget?: { collection: GirderBackboneCollection };
  once(event: string, cb: (...args: any[]) => void, ctx?: unknown): void;
  /** Set by this plugin: the mounted ECG section, if any. */
  _ecgPanel?: { destroy(): void };
  /** Set by this plugin: identifies the render an async refresh belongs to. */
  _ecgRender?: object;
}

interface JQueryLike {
  length: number;
  before(content: Element | string): JQueryLike;
  after(content: Element | string): JQueryLike;
  [index: number]: HTMLElement;
}

declare const girder: {
  views: { body: { ItemView: any } };
  utilities: {
    PluginUtils: {
      wrap(target: any, method: string, fn: (this: any, orig: (...a: any[]) => any, ...args: any[]) => any): void;
    };
  };
  rest: { getApiRoot(): string };
  auth: { getCurrentToken(): string | null };
};
