/** Session-wide keystroke ring for Sentinel diagnostic snapshots (last N events). */

export type KeystrokeRingEvent = {
  key: string;
  timestamp?: string;
  flightTime?: number;
  dwellTime?: number;
  isBackspace?: boolean;
  isSystemEvent?: boolean;
  wordsPasted?: number;
};

const MAX_EVENTS = 200;
const events: KeystrokeRingEvent[] = [];

export function pushKeystrokeEvent(entry: KeystrokeRingEvent): void {
  events.push(entry);
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
}

export function getLastKeystrokes(count = 10): KeystrokeRingEvent[] {
  const n = Math.max(0, Math.min(count, events.length));
  return events.slice(-n);
}

export function clearKeystrokeRing(): void {
  events.length = 0;
}
