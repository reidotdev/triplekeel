type Manifest = {
  key?: string;
  host_permissions?: string[];
  optional_host_permissions?: string[];
  content_scripts?: Array<{ matches?: string[] }>;
  externally_connectable?: { matches: string[] };
  [field: string]: unknown;
};

export function cleanBaseUrl(value: string | undefined): string;
export function connectPattern(appUrl: string): string;
export function extensionIdFromKey(key: string): string;
export function buildManifest(base: Manifest, appUrl: string): Manifest;
