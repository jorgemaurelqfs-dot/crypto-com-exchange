import { createClient } from "@/lib/supabase/client";

export type RuntimePlatformSettings = Record<
  string,
  unknown
>;

export async function getRuntimePlatformSettings(): Promise<RuntimePlatformSettings> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc(
    "get_runtime_platform_settings",
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!data || typeof data !== "object") {
    return {};
  }

  return data as RuntimePlatformSettings;
}

export function getSettingBoolean(
  settings: RuntimePlatformSettings,
  key: string,
  fallback = false,
): boolean {
  const value = settings[key];

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return fallback;
}

export function getSettingNumber(
  settings: RuntimePlatformSettings,
  key: string,
  fallback = 0,
): number {
  const value = settings[key];

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

export function getSettingString(
  settings: RuntimePlatformSettings,
  key: string,
  fallback = "",
): string {
  const value = settings[key];

  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}