import fs from 'node:fs';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let projectId = process.env.FIREBASE_PROJECT_ID || '';
if (!projectId) {
  try {
    const raw = fs.readFileSync(new URL('../../firebase-applet-config.json', import.meta.url), 'utf8');
    projectId = JSON.parse(raw).projectId || '';
  } catch {
    // Fallback if config file is absent in external deployment
  }
}

if (!getApps().length) {
  initializeApp(projectId ? { projectId } : undefined);
}

export const adminAuth = getAuth();
