# Inbox composer

Layout preserved. Toolbar opens attachments, quick replies, a local emoji picker,
and a draft-only AI assistant; microphone uses MediaRecorder (Opus WebM, Opus Ogg,
or MP4 depending on runtime support). Recording is limited to two minutes, pauses
when the page is hidden, stops tracks on cancel/navigation and requires listening
preview/manual Send. No recording is sent on Stop.

## Media architecture

1. Authenticated POST `/api/attendance-inbox/composer`, action `prepare`, reserves
   an immutable upload ID scoped to the actor and conversation.
2. Browser PUTs binary directly to a signed upload URL in **private existing
   `attendance-media`**, under `outbound/<uuid>.<ext>`. No browser-to-Space base64.
3. Action `send` reads the asset server-side and verifies declared size, MIME,
   extension and actual bytes. `file-type` is reused; `cfb` inspects legacy Office
   stream names and rejects macros. HTML/scripts/executables are rejected.
4. Database transaction appends a correctly typed message and claims sending.
5. A canonical private copy is saved using the existing message media cache path.
   Existing authenticated media proxy/voice player serves the outbound file.
6. Backend sends to the existing Evolution API: `sendMedia` for attachments;
   `sendWhatsAppAudio` with `encoding:true` for voice notes (provider converts to
   Ogg Opus/PTT). No changes to Evolution, Baileys, webhook or instance settings.
7. Transport state is recorded. Existing status webhooks continue delivered/read.
   A provider timeout/reset is marked **unknown**, not success and not retried
   automatically. Explicit rejected sends can retry the same upload/message.
   Upload/file/draft remain available after failure.

Limits: images 8 MB, video 24 MB, documents 20 MB, UTF-8 CSV/TXT 2 MB, audio 16 MB.
The existing bucket was verified private with a 24 MB object limit. No bucket or
infrastructure change is required. Pending uploads remain private; no new cleanup
job is installed in this phase.

Audio is sent without captions; any typed draft remains for a separate text
message. Media captions are persisted with image/video/document messages.

## Quick replies and AI

The existing Growth scripts are sales training, not scoped chat snippets. New
`attendance_quick_replies` contains title/body/team/author/active/timestamps.
Admin with Inbox reply access can create/edit/deactivate in the popover. Operators
can use global or current-team replies. The RPC independently enforces team scope.
Insertion never sends a message.

No functioning reusable AI generation endpoint was found (the sales extension
references absent suggest endpoints). The assistant reuses the platform's existing
`OPENAI_API_KEY` and `OPENAI_COPILOT_MODEL` configuration, with a small server-side
Chat Completions adapter. Context is at most 12 recent textual messages, 1,000
characters each; draft rewrites use only the current draft. Email/phone/key patterns
are redacted, `store:false`, and output is always reviewed in the composer.
AI has no sending tool. No new AI credential/provider/infrastructure was created.

## Migration and release

Apply `supabase/migrations/202609230005_attendance_composer.sql` to the existing
main Supabase database. It adds two private tables and one service-role-only RPC.
No browser table grants or public bucket policies are added.

POST endpoint actions: `prepare`, `send`, `replies`, `save_reply`, `assist`.
The platform session, existing `attendance.reply` and Admin Inbox permission apply;
RPC checks conversation/team scope and upload ownership again.

Minimum automated checks:
```
node --test tests/attendance-composer.test.js tests/attendance-inbox-native.test.js tests/attendance-inbox-consistency.test.js tests/attendance-inbox.test.js tests/attendance-media.test.js
```
Real validation target authorized by user: **Matheus Afonso**. Confirm identity in
the existing conversation before sending. Required live checks remain: attachment
and caption received on WhatsApp, microphone preview, recorded PTT received,
delivered/read where available. Do not report live PASS from mocked/unit tests.
