# Attendance contact avatars

The Inbox uses one canonical `contact.avatar_url`: the authenticated Space avatar proxy. The proxy checks Attendance access before resolving the existing linked Space student/CRM photo, then falls back to the WhatsApp identity cache. It never exposes transport credentials or WhatsApp CDN URLs.

## Cache

`attendance_contact_avatars` is a visual cache keyed by the existing `contact_identity_id`, with a composite FK ensuring the contact matches. It does not create people or change conversation/message records. Service-only RPCs read/update it; direct client access is denied by RLS and revoked grants. The intentionally policy-free table is deny-by-default.

Images are decoded, bounded to 2 MiB/16 MP input, resized to 256px JPEG and stored in private `attendance-avatars/profiles/<identity>.jpg`. Download sources must be HTTPS WhatsApp/Facebook photo CDNs; redirects and arbitrary hosts are rejected. No base64 is stored in Postgres.

Successful and absent photos have a 24-hour TTL. Failures retry after 15 minutes and preserve the previous image. A 90-second claim lease and per-process coalescing prevent duplicate refreshes and permit recovery after interrupted workers. Provider errors are logged using fixed codes only. Ingestion does not wait for avatar enrichment.

## Backfill

Run `node scripts/attendance-avatar-backfill.js` with the existing production server environment (`SPACE_BASE_URL` and Supabase service credential). The script calls the authenticated maintenance endpoint, paginates in batches of five, and processes each identity sequentially. Valid/negative caches are skipped. It never sends WhatsApp messages, changes transport settings, writes env files, or prints credentials.

The operator UI uses the same URL in the list, conversation header, inspector and inbound voice notes. Outbound voice notes use the author supplied by the domain, or Space initials. Image failure falls back to initials.
