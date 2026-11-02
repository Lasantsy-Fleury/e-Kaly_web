import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidates = [
  path.resolve(__dirname, '../../mobile/app/build/outputs/apk/release/app-release.apk'),
  path.resolve(__dirname, '../../mobile/app/build/outputs/apk/debug/app-debug.apk'),
];

const dest = path.resolve(__dirname, '../public/app-release.apk');

let synced = false;
for (const src of candidates) {
  if (fs.existsSync(src)) {
    try {
      fs.copyFileSync(src, dest);
      const stat = fs.statSync(dest);
      console.log(`[sync-apk] Successfully copied latest mobile release (${stat.size} bytes) to public/app-release.apk`);
      synced = true;
      break;
    } catch (err) {
      console.warn(`[sync-apk] Could not copy ${src}:`, err.message);
    }
  }
}

if (!synced) {
  if (fs.existsSync(dest)) {
    console.log('[sync-apk] Existing public/app-release.apk retained (no new APK found in mobile/* build outputs).');
  } else {
    console.warn('[sync-apk] Warning: No APK found in mobile build outputs or public directory.');
  }
}
