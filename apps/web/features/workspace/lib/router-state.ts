export type AppId =
  | "home"
  | "studio"
  | "flow"
  | "agents"
  | "skills"
  | "knowledge"
  | "mcp";

const APP_IDS: AppId[] = [
  "home",
  "studio",
  "flow",
  "agents",
  "skills",
  "knowledge",
  "mcp",
];

export const isAppId = (value: string | null): value is AppId =>
  Boolean(value && APP_IDS.includes(value as AppId));

export const readQueryParam = (key: string) => {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get(key);
};

export const replaceRouteQuery = (patch: Record<string, string | null>) => {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);

  Object.entries(patch).forEach(([key, value]) => {
    if (value == null || value === "") {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  });

  window.history.replaceState(
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
};
