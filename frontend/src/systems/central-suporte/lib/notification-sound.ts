// Notification sound utility using Web Audio API + custom uploaded sounds
import { supabase } from "@suporte/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

let audioContext: AudioContext | null = null;
let audioUnlocked = false;

// Cache for active sounds
interface SoundCache {
  ticket_opened: string | null;
  ticket_closed: string | null;
  comment_received: string | null;
  assignees: Record<string, string>; // assignee_id -> file_path
}
let cachedSounds: SoundCache | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

// Sound enabled flags (loaded from system_settings)
interface SoundEnabledCache {
  sound_ticket_opened: boolean;
  sound_ticket_closed: boolean;
  sound_comment_received: boolean;
  sound_assignee: boolean;
}
let cachedEnabled: SoundEnabledCache | null = null;
let enabledCacheTimestamp = 0;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Unlock audio context on first user interaction (required by browsers)
function unlockAudio() {
  if (audioUnlocked) return;
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    ctx.resume().then(() => {
      audioUnlocked = true;
    });
  } else {
    audioUnlocked = true;
  }
}

// Listen for any user interaction to unlock audio
if (typeof window !== "undefined") {
  const events = ["click", "touchstart", "keydown"];
  const handler = () => {
    unlockAudio();
    events.forEach((e) => document.removeEventListener(e, handler));
  };
  events.forEach((e) => document.addEventListener(e, handler, { once: false }));
}

function playTone(ctx: AudioContext, freq: number, startTime: number, duration: number, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.03);
  gain.gain.setValueAtTime(volume, startTime + duration * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playDefaultChime() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") ctx.resume();

  const now = ctx.currentTime;
  const vol = 0.25;

  playTone(ctx, 659.25, now, 0.18, vol);
  playTone(ctx, 783.99, now + 0.2, 0.18, vol);
  playTone(ctx, 1046.50, now + 0.4, 0.3, vol);

  playTone(ctx, 659.25, now + 0.85, 0.18, vol * 0.7);
  playTone(ctx, 783.99, now + 1.05, 0.18, vol * 0.7);
  playTone(ctx, 1046.50, now + 1.25, 0.35, vol * 0.7);
}

async function getActiveSounds(): Promise<SoundCache> {
  const now = Date.now();
  if (cachedSounds && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedSounds;
  }

  try {
    const { data } = await supabase
      .from("notification_sounds")
      .select("sound_type, file_path, is_active, assignee_id")
      .eq("is_active", true);

    const result: SoundCache = {
      ticket_opened: null,
      ticket_closed: null,
      comment_received: null,
      assignees: {},
    };

    data?.forEach((s: any) => {
      if (s.sound_type === "ticket_opened") result.ticket_opened = s.file_path;
      else if (s.sound_type === "ticket_closed") result.ticket_closed = s.file_path;
      else if (s.sound_type === "comment_received") result.comment_received = s.file_path;
      else if (s.sound_type === "assignee" && s.assignee_id) {
        result.assignees[s.assignee_id] = s.file_path;
      }
    });

    cachedSounds = result;
    cacheTimestamp = now;
    return result;
  } catch {
    return { ticket_opened: null, ticket_closed: null, comment_received: null, assignees: {} };
  }
}

function playAudioFile(filePath: string) {
  const url = `${SUPABASE_URL}/storage/v1/object/public/notification-sounds/${filePath}`;
  const audio = new Audio(url);
  audio.volume = 0.5;
  audio.play().catch(() => {
    console.warn("Could not play custom notification sound, falling back to default");
    playDefaultChime();
  });
}

async function getSoundEnabledFlags(): Promise<SoundEnabledCache> {
  const now = Date.now();
  if (cachedEnabled && (now - enabledCacheTimestamp) < CACHE_TTL) {
    return cachedEnabled;
  }
  try {
    const { data } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["sound_ticket_opened", "sound_ticket_closed", "sound_comment_received", "sound_assignee"]);
    const map: Record<string, string> = {};
    data?.forEach((s: any) => { map[s.key] = s.value; });
    cachedEnabled = {
      sound_ticket_opened: map.sound_ticket_opened !== "false",
      sound_ticket_closed: map.sound_ticket_closed !== "false",
      sound_comment_received: map.sound_comment_received !== "false",
      sound_assignee: map.sound_assignee !== "false",
    };
    enabledCacheTimestamp = now;
    return cachedEnabled;
  } catch {
    return { sound_ticket_opened: true, sound_ticket_closed: true, sound_comment_received: true, sound_assignee: true };
  }
}

export async function playNotificationSound(
  type: "ticket_opened" | "ticket_closed" | "comment_received" = "ticket_opened",
  assigneeId?: string | null
) {
  try {
    const enabled = await getSoundEnabledFlags();
    const sounds = await getActiveSounds();

    // If assignee-specific sound exists AND is enabled, play it (takes priority)
    if (assigneeId && sounds.assignees[assigneeId] && enabled.sound_assignee) {
      playAudioFile(sounds.assignees[assigneeId]);
      return;
    }

    // Check if this type is enabled
    const typeKey = type === "ticket_opened" ? "sound_ticket_opened" : type === "ticket_closed" ? "sound_ticket_closed" : "sound_comment_received";
    if (!enabled[typeKey]) return;

    // Otherwise fall back to event-type sound
    const customPath = sounds[type];
    if (customPath) {
      playAudioFile(customPath);
    } else {
      playDefaultChime();
    }
  } catch {
    playDefaultChime();
  }
}

// Play assignee-specific sound only (for ticket assignment events)
export async function playAssigneeSound(assigneeId: string) {
  try {
    const enabled = await getSoundEnabledFlags();
    if (!enabled.sound_assignee) return false;
    const sounds = await getActiveSounds();
    if (sounds.assignees[assigneeId]) {
      playAudioFile(sounds.assignees[assigneeId]);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Clear cache when sounds are updated
export function clearSoundCache() {
  cachedSounds = null;
  cacheTimestamp = 0;
  cachedEnabled = null;
  enabledCacheTimestamp = 0;
}

