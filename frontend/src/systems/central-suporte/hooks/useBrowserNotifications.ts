import { supabase } from "@suporte/integrations/supabase/client";

let cachedBrowserNotifEnabled: boolean | null = null;
let cachedBrowserNotifTimestamp = 0;
const CACHE_TTL = 60_000;

async function isBrowserNotificationEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cachedBrowserNotifEnabled !== null && (now - cachedBrowserNotifTimestamp) < CACHE_TTL) {
    return cachedBrowserNotifEnabled;
  }
  try {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "browser_notifications")
      .maybeSingle();
    cachedBrowserNotifEnabled = data?.value !== "false";
    cachedBrowserNotifTimestamp = now;
    return cachedBrowserNotifEnabled;
  } catch {
    return true;
  }
}

export function requestBrowserNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

export async function showBrowserNotification(title: string, body?: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const enabled = await isBrowserNotificationEnabled();
  if (!enabled) return;
  
  try {
    new Notification(title, {
      body: body || undefined,
      icon: "/favicon.ico",
    });
  } catch (e) {
    console.warn("Could not show browser notification:", e);
  }
}

export function clearBrowserNotifCache() {
  cachedBrowserNotifEnabled = null;
  cachedBrowserNotifTimestamp = 0;
}

