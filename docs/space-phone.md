# Space Phone V1

Vertical slice experimental de outbound WebRTC com Telnyx, protegida por `SPACE_PHONE_ENABLED`.

## Fluxo

Space CRM → `window.SpacePhone.call()` → normalização E.164 compartilhada (`libphonenumber-js`, default `SPACE_PHONE_DEFAULT_COUNTRY=US`) → `/api/voice/calls` cria `voice_calls` → `/api/voice/telnyx/token` gera JWT curto via `POST https://api.telnyx.com/v2/telephony_credentials/{id}/token` → `@telnyx/webrtc` (`TelnyxRTC`) conecta → aguarda `telnyx.ready` → `client.newCall({ destinationNumber, callerNumber, remoteElement })` inicia a chamada PSTN.

O pipeline legado de gravação/transcrição/análise continua fora desta fatia e não foi alterado. A reconciliação futura deve usar `telnyx_call_leg_id` / `telnyx_call_session_id` quando disponíveis pelo SDK ou pelo webhook Telnyx.

## Configuração necessária antes de chamada real

- `SPACE_PHONE_ENABLED=true`
- `SPACE_PHONE_DEFAULT_COUNTRY=US` ou outro ISO-2, se necessário
- `TELNYX_API_KEY`
- `TELNYX_DEFAULT_FROM_NUMBER` em E.164 ou `caller_id` por usuário em `voice_phone_identities`
- Uma linha ativa em `voice_phone_identities` por usuário autorizado com `telnyx_credential_id`
- Telnyx Credential Connection/On-demand Credential configurado para WebRTC/PSTN outbound no painel da Telnyx

## Semântica `voice_calls`

- `created`: registro aceito pelo backend antes da conexão Telnyx
- `connecting`: SDK conectando/autenticado e tentativa de chamada iniciada
- `ringing`: Telnyx informou estado de ringing/trying equivalente
- `active`: chamada atendida; preenche `answered_at` e inicia timer de talk time
- `ended`: chamada finalizada; preenche `ended_at` e `duration_seconds`
- `failed`: erro antes ou durante a tentativa; preenche `ended_at`

## Limitações V1

- outbound apenas;
- uma chamada ativa por browser;
- refresh completo não preserva a chamada visualmente;
- webhook Telnyx fica para próxima fase para estados autoritativos e idempotência;
- não cria eventos em `sdrActivityEvents` e não altera `sdr_call_scores`.

### Qualification production flow

- `SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL` is the workflow **Production** webhook URL. No model/provider is selected by Space; Gemini or any other provider belongs to n8n.
- `SPACE_N8N_SHARED_SECRET` protects n8n callbacks and is sent in `x-space-n8n-secret` to the configured webhook. n8n must acknowledge promptly; delivery has a 5-second timeout.
- `CRON_SECRET` protects `/api/space-phone-qualification-process`, scheduled every minute in Production. On call end, the existing qualification row is queued without replacing human data. The worker reads real transcripts from the existing pipeline and claims pending work with a conditional update. A claim can be retried after ten minutes. A failed delivery returns the qualification to draft/pending; human editing and completion remain available.
- Delivery is at-least-once: n8n should deduplicate `event + callId`. A late AI callback cannot reopen a complete qualification. Human fields are never replaced by callbacks.
- The frontend waits for qualification `review_required`, not just the call score. Suggestions can be applied to empty fields and edited. Completion flushes autosave, persists `complete`, then dispatches `qualification.completed`. n8n failure never rolls it back.
- Handoff states: `pending`, `blocked`, `sent`, `failed`. Completion queues `pending`; the certified community node owns writes. `mark_datacrazy_synced` accepts its authenticated success callback without noteId and persists both statuses as `sent`. See the community-node wiring below.

Datacrazy audit: the repository certifies business reads only. The official API notice describes public route migration, but does not establish the comment creation request/response contract or safe append semantics: https://help.datacrazy.io/pt-br/articles/10670832-comunicado-sobre-rotas-internas-datacrazy-mudancas-nas-apis-internas . Do not enable write-back based on an inferred endpoint. Qualification remains usable while this certification is pending.

Release certification requires a new authorized real call, automatic transcript arrival, a scheduled/UI-initiated backend event, n8n execution and `review_required` visible in Space. Unit/DOM tests and previously manually executed n8n calls do not certify that production chain.

### Second dispatch: SDR confirmation

`complete_qualification` saves `status=complete` and server timestamp `completed_at`, requires a returned persisted row, then sends `{event: "qualification.completed", callId, occurredAt}` to the same configured webhook as `qualification.ai_requested`. The payload read by n8n exposes `qualification.confirmedBySdr` from completed status **and** the persisted timestamp, plus `qualification.confirmedAt` and `handoffEligible` (also requires `outcome=agendado`). No extra confirmation column/migration is required.

n8n routing contract: the TRUE/AI branch ends after `save_ai_qualification` (`review_required`). The FALSE branch must additionally check `event === qualification.completed`, then fetch current qualification and require `outcome === agendado`, `qualification.status === complete`, and `qualification.confirmedBySdr === true` before preparing/resolving/writing handoff. A non-AI event alone is not authorization. The note and sync APIs independently enforce the persisted gate. Real workflow wiring is external to this repository and must be verified in n8n execution history; backend tests do not certify those nodes. Direct Space writes are retired; the certified community node must be wired as described below.

### Dispatch evidence (real SDR click)

Server logs with `component=space-phone-qualification-dispatch` record start/result, `callId`, `event`, `occurredAt`, log timestamp, `dispatchId`, HTTP status and elapsed time. The same UUID is sent to n8n as `x-space-dispatch-id`; inspect the Webhook node's input headers to correlate a real execution. If n8n explicitly returns `x-n8n-execution-id` (numeric ID/UUID) or `x-request-id` (numeric ID/UUID), the result log captures it. Missing IDs remain null; no execution link/ID is inferred. Responses, webhook URL, shared secret and transcript are never logged.

An `accepted` log proves HTTP acceptance only. Certification still requires the actual SDR click, persisted `complete`/`completed_at`, matching execution in n8n, FALSE branch, and individual handoff node results. Do not substitute a manual webhook request. A timeout can also mean n8n accepted work before the response was lost: search by dispatchId before retrying.


### Certified community node: automatic handoff wiring

User-certified operation: `@growsalesai/n8n-nodes-datacrazy` → Datacrazy CRM → Anotações do Lead → Adicionar Anotação. The credential and a manual write are certified by the user; automatic workflow execution still requires live verification.

For a single-call webhook execution:

1. TRUE / AI branch ends at `save_ai_qualification`; no link to note creation.
2. FALSE branch checks `event === qualification.completed`, retrieves current qualification, and requires Agendado + Completo + Confirmado. Stop when `datacrazy.alreadySent === true`.
3. Resolver Lead Datacrazy → Validar Match Único → Match válido: require `matched === true` and nonempty `leadId`. Resolver uses the call's explicit lead ID, otherwise full normalized phone equality in the lead state table. Suffix-only, deal-only and generic external IDs cannot authorize a write. Multiple distinct lead IDs, truncated search or database errors fail closed.
4. Add HTTP Request **Reservar handoff**: authenticated POST `/api/integrations/n8n/space-phone-qualification`, body `{ "action": "claim_datacrazy_handoff", "callId": "<original webhook callId>" }`. Only `shouldWrite === true` proceeds. The server revalidates the gate and match and uses a conditional row update to permit one writer. Use this response's `leadId` and `note` in the community node, never a manually selected lead.
5. Bypass/delete **Criar Nota Datacrazy via Space**. Its endpoint is retired (410), cannot write a note or reset a reservation. The community node gets **Lead ID** from `$('Reservar handoff').first().json.leadId` and **content** from `$('Reservar handoff').first().json.note`. The latter is the persisted `qualification.finalSummary`, or the formatted final qualification if empty.
6. Community node settings: **Always Output Data = true** (success may be empty), **Retry On Fail = false**, and errors must not continue into the success callback. Route node errors to `mark_datacrazy_failed`, never to synced.
7. Only after successful community execution: authenticated POST to the qualification endpoint with `{ "action": "mark_datacrazy_synced", "callId": "<Reservar handoff.callId>", "sync": { "leadId": "<Reservar handoff.leadId>" } }`. No noteId is required. An optional genuine noteId may be supplied. Success persists `status=sent`, `datacrazy_sync_status=sent`, the resolved lead and server timestamp.
8. Retry the **callback only** if note creation succeeded but marking sent failed. Whole-workflow retries stop at the reservation/sent guard. An in-progress or uncertain write is not automatically retried: first reconcile the Datacrazy note/execution history. Without provider-side idempotency, blindly replaying a successful/ambiguous external node can duplicate notes.

These instructions are a configuration contract, not evidence that the external workflow has already been edited. Real certification must capture the SDR click, dispatchId, n8n execution, dynamic lead, successful community node, and sent callback. Do not replay the manually tested lead as an end-to-end test.
