# Outbound from WhatsApp companion devices

## Root cause and normalization

The Evolution webhook discarded `key.fromMe=true`. The message schema also required an internal author/sender for every outbound message. The new service-only `attendance_ingest_provider_message` handles both directions. The existing Meta ingest RPC is unchanged.

The shared parser unwraps message envelopes, prefers a phone JID when `remoteJidAlt` provides one, preserves opaque LIDs, and uses the existing media envelope/cache. Provider keys, timestamps, PTT, captions and reply IDs remain server-side. Logs contain event names and shape booleans, never payloads or media keys. Official upstream reference: https://github.com/EvolutionAPI/evolution-api/blob/main/src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts

## Exact reconciliation

`channel_id + external_message_id` remains unique. A private `attendance_provider_receipts` journal captures early echoes and statuses. A channel transaction lock serializes ingestion, ID binding and status updates.

If an echo can belong to a still-unconfirmed Space send, the receipt waits without creating a second timeline message. Text/kind only narrow this temporary waiting condition; they never decide identity or deduplicate a message. The send response binds the exact provider ID to the original Space message, preserving author/client request. The same transaction consumes the echo and drains other waiting receipts. Distinct provider IDs always remain distinct messages, even with identical text.

A transport timeout with no confirmed provider ID is deliberately not guessed: a matching receipt remains durable until an authoritative ID is recovered. Inspect `attendance_provider_receipts` entries with `event is not null`, `created_at` and `last_error_code`. After recovering the exact ID, the existing `attendance_set_message_transport` RPC binds it and drains receipts. Do not resend an uncertain message or deduplicate by text. Unrelated content is not blocked. This is a safety hold, not silent loss.

External outbound has null author/sender, `metadata.origin=external_device`, and sent/delivered/read/failed status. No operator is invented. It does not update customer-message windows, unread or read acknowledgements. Provider timestamps determine visible chronology and last activity; sequence remains the incremental/read cursor. Status updates received before the message are retained, and delayed sent updates do not regress delivered/read.

Identity aliases reuse an existing contact. Conflicting established identities are rejected for explicit review; no destructive contact merge occurs.

## Files

- `api/attendance/evolution/webhook.js`: direction, shared normalization, safe logs.
- `api/_lib/attendance-provider-message.js`: JID/LID, envelope and status normalization.
- `api/_lib/attendance-send-text.js`: Space origin and retention of the confirmed provider ID during error handling.
- `api/_lib/attendance-media-envelope.js`: companion alias preservation.
- `api/attendance-inbox.js`, `attendance-inbox.js`: quote context and provider chronology.
- `supabase/migrations/20260925201704_attendance_provider_outbound.sql`: receipt journal, sender constraints, ingestion and reconciliation RPCs.
- `tests/attendance-provider-outbound.test.js`, `tests/attendance-inbox.test.js`: regression and SQL scenarios.

## Verification

Run the focused Node tests, including the SQL scenario with `ATTENDANCE_PGLITE_MODULE` pointing to an installed `@electric-sql/pglite` module. SQL runs in an isolated PostgreSQL engine, without staging or production data. Scenarios cover both arrival orders, duplicate hooks, aliases, new conversation, unread, media, timestamp and early/out-of-order status.

Production smoke requires user-controlled recipient numbers and phone actions. Until those are executed, local test success and a READY deployment do not certify the real device flow.
