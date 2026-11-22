import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function resolveFirebaseProjectId(): string {
  const fromEnv =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID;
  if (fromEnv?.trim()) return fromEnv.trim();

  const candidatePaths: string[] = [path.resolve(process.cwd(), 'firebase-applet-config.json')];
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      candidatePaths.push(
        new URL('../../firebase-applet-config.json', import.meta.url).pathname
      );
    }
  } catch {
    // Ignore URL resolution if compiled in CJS context
  }

  for (const cfgPath of candidatePaths) {
    try {
      if (fs.existsSync(cfgPath)) {
        const raw = fs.readFileSync(cfgPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed?.projectId) return String(parsed.projectId);
      }
    } catch {
      // Try next candidate
    }
  }

  return 'robust-hold-twh4c';
}

const projectId = resolveFirebaseProjectId();

if (!getApps().length) {
  initializeApp(projectId ? { projectId } : undefined);
}

export const adminAuth = getAuth();
