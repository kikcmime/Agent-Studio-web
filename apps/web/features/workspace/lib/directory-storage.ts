const DIRECTORY_STORAGE_KEY = "agent-studio:directories";
const ASSET_DIRECTORY_STORAGE_KEY = "agent-studio:asset-directories";
const HOME_CONSOLE_CONFIG_STORAGE_KEY = "agent-studio:home-console-config";

export type HomeConsoleConfig = {
  welcomeMessage?: string;
  starterPrompts?: string[];
};

export function readStoredDirectories() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(DIRECTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
      : [];
  } catch {
    return [];
  }
}

export function writeStoredDirectories(value: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DIRECTORY_STORAGE_KEY, JSON.stringify(value));
}

export function readAssetDirectoryMap() {
  if (typeof window === "undefined") {
    return {} as Record<string, string>;
  }

  try {
    const raw = window.localStorage.getItem(ASSET_DIRECTORY_STORAGE_KEY);
    if (!raw) {
      return {} as Record<string, string>;
    }
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {} as Record<string, string>;
  }
}

export function writeAssetDirectoryMap(value: Record<string, string>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    ASSET_DIRECTORY_STORAGE_KEY,
    JSON.stringify(value),
  );
}

export function readHomeConsoleConfigMap() {
  if (typeof window === "undefined") {
    return {} as Record<string, HomeConsoleConfig>;
  }

  try {
    const raw = window.localStorage.getItem(HOME_CONSOLE_CONFIG_STORAGE_KEY);
    if (!raw) {
      return {} as Record<string, HomeConsoleConfig>;
    }
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, HomeConsoleConfig>)
      : {};
  } catch {
    return {} as Record<string, HomeConsoleConfig>;
  }
}

export function writeHomeConsoleConfigMap(value: Record<string, HomeConsoleConfig>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    HOME_CONSOLE_CONFIG_STORAGE_KEY,
    JSON.stringify(value),
  );
  window.dispatchEvent(new Event("agent-studio:home-console-config-changed"));
}
