# SDR meetings producer — release blocked

Production inspected: Supabase project mlpojyvwyqcrelagtgkw. Found 148 meetings, all scheduled, rather than an empty table. The 499 records in n8n_agendamentos_space contain BOOKING_CREATED events, not certified attendance results.

## Implemented

Canonical Cal.com readback feeds a service-role-only, security-invoker RPC. It creates scheduled appointments only with SDR, attendee phone and assigned host context; reuses explicit booking UID or a safe unique existing link; preserves completed/no-show decisions across replays; propagates provider cancellation/rescheduling. Google eventUid comes from the official booking references endpoint, never an invented identifier. Legacy reminder delivery is disabled on newly created meetings to avoid duplicate Cal.com reminders.

The protected action engine prefers explicit Cal.com UID, then Google event ID, then exact Meet occurrence. Existing student, CRM, attendance evidence and idempotency safeguards remain unchanged. Other conversion formulas are unchanged.

## Production findings that block activation

Reloading VEXACOMV7SPACE01 in authenticated n8n showed Published and four direct PATCH operations against sdr_meetings (attended/no_show/post-call no_show/completed). The backend protection alone does not protect these writers. This is observed published editor configuration; no workflow execution was triggered.

No certified live participant evidence adapter was found. Existing policy requires complete participant-event evidence matched to the meeting, lead and closer. Cal.com acceptance, transcript text, speaker labels and left_alone cannot substitute for this evidence.

The RPC migration was applied after one transient migration-history timeout. Transactional producer fixtures passed and were rolled back. No real meeting outcome was fabricated. Backend activation, push and deploy are withheld to avoid feeding new appointments into unprotected workflow writers.

## Remaining release sequence

1. Publish/certify the existing protected workflow transformation so every status/commercial writer uses the action engine.
2. Certify the actual participant evidence feed (or an explicitly designed authenticated human outcome flow); do not weaken the policy.
3. Publish this backend change and use only the authorized QA attendee to create a real booking.
4. Verify UID linkage and the actual attended/no-show event through the official flow and dashboard.

Tests certify implementation contracts, not real attendance. No real completed/no-show or booking-to-completed-dashboard certification is claimed.
