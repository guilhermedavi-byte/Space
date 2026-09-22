# WhatsApp via QR — Evolution

## Architecture

`attendance-connections.js` → authenticated `/api/attendance-connections` →
server-only Evolution adapter + `attendance_evolution_connection` RPC.

The existing platform session/Firebase capabilities apply. Admin manages all;
Growth requires an enabled membership in an active team. QR and mutations require
supervisor access to every affected channel. The RPC rechecks memberships inside
the transaction and is executable only by service_role. Browser responses are
allowlisted; credentials and provider envelopes never leave the server.

The provider is `evolution_whatsapp`. Existing `connections`, `channels`,
`channel_teams`, and conversation references are reused. Foundation status remains
pending/active/disabled; metadata holds connection_state
(pending/connecting/open/disconnected/failed), phone, qr_available, last_seen,
default_team_id and operational_note. QR images stay ephemeral, never in metadata.
No new Inbox implementation or outbound messaging is included.

Creation reserves a deterministic UUID per user/idempotency_key, inserts channel
and team grant atomically, then provisions `space-<uuid>`. Retrying observes the
same instance before provisioning. Short database leases serialize provider
operations. Ambiguous provider failures remain failures; retry checks existence.
Logical disable preserves the remote session and all history. Explicit disconnect
logs out only the selected instance. No route deletes a remote instance.

`EVOLUTION_INSTANCE_NAME` identifies the existing operational instance. Admin can
link it to a team after verifying it is open, without QR/logout/restart. Repeated
linking returns the same database connection. Logout of this protected instance is
blocked. Existing Meta records and onboarding endpoints remain separate.

The QR modal polls every four seconds without overlapping requests, pauses when
hidden, stops on close/success, and aborts pending requests. Refresh is explicit.
The countdown is a refresh recommendation, not a fabricated provider expiration.
Pairing-code returns an explicit unsupported response; UI does not advertise it
until the deployed provider's capability is verified.

## Production prerequisites

- Apply `supabase/migrations/202609220001_attendance_evolution_onboarding.sql` to
  the **existing main Attendance database**. It adds one RPC, not tables.
- Server variables: `EVOLUTION_API_URL=https://evo.spaceschoolbr.com`,
  `EVOLUTION_INSTANCE_NAME=space-suporte`, secret `EVOLUTION_API_KEY`.
- Preserve existing Attendance environment guards and pinned Supabase target.
- After the RPC and credential are installed, set `EVOLUTION_ONBOARDING_ENABLED=true`
  and deploy Production. Until then the QR option is disabled and the existing
  official Meta creation path remains available.
- Admin: link the existing operational instance using its real active team.
  This operation is read-only toward Evolution.
- Create a new connection with another intended number; scan its QR using the
  authorized phone; confirm the card changes to connected without refresh.
  Do not use `space-suporte` for a destructive smoke test.

## Internal API

- GET collection: scoped list, safe metadata and editable teams.
- POST collection: `{action:'create',provider:'evolution_whatsapp',name,team_id,idempotency_key}`.
- POST collection, Admin only: `{action:'adopt',provider:'evolution_whatsapp',name,team_id}`;
  only the server-configured existing instance can be adopted.
- GET `/:id`: provider snapshot and persisted safe status.
- GET `/:id/qr`: manage-only QR connection request.
- POST `/:id/refresh-qr`, `/:id/reconnect`, `/:id/disconnect`.
- POST `/:id/pairing-code`: 409 unsupported (no invented capability).
- PATCH `/:id`: name, existing authorized default team, operational_note.
- DELETE `/:id`: logical disable only.

Provider API reference: official Evolution source
https://github.com/EvolutionAPI/evolution-api/blob/main/src/api/routes/instance.router.ts

## Verification

`node --test tests/attendance-connections.test.js tests/attendance-evolution.test.js`

Tests cover authorization, shared-channel isolation, allowlisted responses, QR
validation, protected instance, logical disable, fail-closed behavior, idempotent
retry and wizard lifecycle. A real phone scan remains mandatory before claiming
end-to-end Production readiness.
