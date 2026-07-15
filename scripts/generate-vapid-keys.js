#!/usr/bin/env node
/**
 * Generate a VAPID key pair for Web Push notifications.
 *
 * Web Push powers browser notifications on desktop (Chrome/Edge/Firefox/Safari
 * 16+) and installed PWAs (including iOS 16.4+ once "Added to Home Screen"). The
 * server signs every push with a VAPID key pair, read from VAPID_PUBLIC_KEY /
 * VAPID_PRIVATE_KEY (see server/services/notificationService.js). When those are
 * unset, /api/push/vapid-public-key answers 503 and the in-app "Enable" button
 * for Browser Push cannot subscribe — every other channel still works.
 *
 * Run this once per deployment, paste the output into your server .env, and
 * restart the API:
 *
 *   npm run vapid:keys
 *
 * Keep the private key secret and STABLE. Rotating it invalidates every existing
 * browser subscription, so users would have to re-enable push.
 */
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

process.stdout.write(`
# ── Web Push (VAPID) keys — paste into your server .env, then restart ──────────
# Generated ${new Date().toISOString()}. Treat the private key like a password.
VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}
VAPID_SUBJECT=mailto:you@example.com
`);
