export type ColumnVisibilityState = Record<string, boolean>;

interface ColumnVisibilityConfig {
  version: number;
  configId: string;
  visibility: ColumnVisibilityState;
  lastUpdated: number;
}

interface ColumnVisibilityPreferences {
  [resourceName: string]: ColumnVisibilityConfig;
}

export interface IStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = "neutree_column_visibility";
const CURRENT_VERSION = 1;
const MAX_AGE_DAYS = 90;

const CONFIG_VERSIONS: Record<string, number> = {
  role_assignments: 1,
  endpoints: 1,
  workspaces: 1,
  user_profiles: 1,
  roles: 1,
  clusters: 1,
  model_registries: 1,
  image_registries: 1,
  engines: 1,
  model_catalogs: 1,
  api_keys: 1,
};

export class LocalStorageAdapter implements IStorage {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error("LocalStorage getItem error:", error);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error("LocalStorage setItem error:", error);
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error("LocalStorage removeItem error:", error);
    }
  }
}

export class ColumnVisibilityManager {
  private storage: IStorage;
  private storageKey: string;
  private configVersions: Record<string, number>;

  constructor(
    storage: IStorage,
    storageKey: string = STORAGE_KEY,
    configVersions: Record<string, number> = CONFIG_VERSIONS,
  ) {
    this.storage = storage;
    this.storageKey = storageKey;
    this.configVersions = configVersions;
  }

  private getConfigId(resourceName: string): string {
    const version = this.configVersions[resourceName] || 1;
    return `${resourceName}_v${version}`;
  }

  private getAllPreferences(): ColumnVisibilityPreferences {
    try {
      const stored = this.storage.getItem(this.storageKey);
      if (!stored) return {};
      return JSON.parse(stored) as ColumnVisibilityPreferences;
    } catch (error) {
      console.error("Failed to parse column visibility preferences:", error);
      return {};
    }
  }

  private saveAllPreferences(preferences: ColumnVisibilityPreferences): void {
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(preferences));
    } catch (error) {
      console.error("Failed to save column visibility preferences:", error);
    }
  }

  cleanup(): void {
    const all = this.getAllPreferences();
    const now = Date.now();
    const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    let needsSave = false;

    for (const [resourceName, config] of Object.entries(all)) {
      if (config.lastUpdated && now - config.lastUpdated > maxAge) {
        delete all[resourceName];
        needsSave = true;
        continue;
      }

      const currentConfigId = this.getConfigId(resourceName);
      if (config.configId && config.configId !== currentConfigId) {
        delete all[resourceName];
        needsSave = true;
      }
    }

    if (needsSave) {
      this.saveAllPreferences(all);
    }
  }

  get(resourceName: string): ColumnVisibilityState | undefined {
    const all = this.getAllPreferences();
    const config = all[resourceName];

    if (!config) return undefined;

    const currentConfigId = this.getConfigId(resourceName);
    if (config.configId !== currentConfigId) {
      return undefined;
    }

    return config.visibility;
  }

  set(
    resourceName: string,
    visibility: ColumnVisibilityState,
    validColumnIds?: string[],
  ): void {
    const all = this.getAllPreferences();

    let cleanedVisibility = visibility;
    if (validColumnIds && validColumnIds.length > 0) {
      cleanedVisibility = Object.keys(visibility)
        .filter((key) => validColumnIds.includes(key))
        .reduce((acc, key) => {
          acc[key] = visibility[key];
          return acc;
        }, {} as ColumnVisibilityState);
    }

    all[resourceName] = {
      version: CURRENT_VERSION,
      configId: this.getConfigId(resourceName),
      visibility: cleanedVisibility,
      lastUpdated: Date.now(),
    };

    this.saveAllPreferences(all);

    if (Math.random() < 0.01) {
      this.cleanup();
    }
  }

  clear(resourceName: string): void {
    const all = this.getAllPreferences();
    delete all[resourceName];
    this.saveAllPreferences(all);
  }

  clearAll(): void {
    this.storage.removeItem(this.storageKey);
  }
}

const defaultColumnVisibilityManager = new ColumnVisibilityManager(
  new LocalStorageAdapter(),
);

export function getColumnVisibility(
  resourceName: string,
): ColumnVisibilityState | undefined {
  return defaultColumnVisibilityManager.get(resourceName);
}

export function setColumnVisibility(
  resourceName: string,
  visibility: ColumnVisibilityState,
  validColumnIds?: string[],
): void {
  defaultColumnVisibilityManager.set(resourceName, visibility, validColumnIds);
}
