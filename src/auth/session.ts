// Demo sign-in: username and password checked against SHA-256 hashes in users.json.
// The browser does the check, so this is a demo of the flow, not authentication.
import { DEMO_USERS, type DemoUser } from "../data/seed";

export type Session = {
  username: string;
  role: DemoUser["role"];
  displayName: string;
  institutionId: string | null;
  studentRef?: string;
};

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
}

export async function checkPassword(username: string, password: string): Promise<DemoUser | null> {
  const user = DEMO_USERS.find(u => u.username === username.trim().toLowerCase());
  if (!user) return null;
  const hash = await sha256Hex(password);
  return hash === user.passwordSha256 ? user : null;
}

export function toSession(u: DemoUser): Session {
  return {
    username: u.username,
    role: u.role,
    displayName: u.displayName,
    institutionId: u.institutionId,
    studentRef: u.studentRef,
  };
}

const KEY = "sentinel.session.v1";

// sessionStorage: a reload keeps the user signed in; closing the tab signs out
export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null) {
  if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
  else sessionStorage.removeItem(KEY);
}
