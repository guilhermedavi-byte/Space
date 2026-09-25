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
- Handoff states: `pending`, `blocked`, `sent`, `failed`. Until the Datacrazy write contract is certified, completion records `blocked` with `DATACRAZY_NOTE_WRITE_BLOCKED_API_ENDPOINT`. The UI displays “Qualificação concluída ✓” and “Handoff Datacrazy pendente”. `mark_datacrazy_failed` updates only a pending/failed handoff; `mark_datacrazy_synced` requires completed qualification and a note ID, and does not change qualification status.

Datacrazy audit: the repository certifies business reads only. The official API notice describes public route migration, but does not establish the comment creation request/response contract or safe append semantics: https://help.datacrazy.io/pt-br/articles/10670832-comunicado-sobre-rotas-internas-datacrazy-mudancas-nas-apis-internas . Do not enable write-back based on an inferred endpoint. Qualification remains usable while this certification is pending.

Release certification requires a new authorized real call, automatic transcript arrival, a scheduled/UI-initiated backend event, n8n execution and `review_required` visible in Space. Unit/DOM tests and previously manually executed n8n calls do not certify that production chain.

### Second dispatch: SDR confirmation

`complete_qualification` saves `status=complete` and server timestamp `completed_at`, requires a returned persisted row, then sends `{event: "qualification.completed", callId, occurredAt}` to the same configured webhook as `qualification.ai_requested`. The payload read by n8n exposes `qualification.confirmedBySdr` from completed status **and** the persisted timestamp, plus `qualification.confirmedAt` and `handoffEligible` (also requires `outcome=agendado`). No extra confirmation column/migration is required.

n8n routing contract: the TRUE/AI branch ends after `save_ai_qualification` (`review_required`). The FALSE branch must additionally check `event === qualification.completed`, then fetch current qualification and require `outcome === agendado`, `qualification.status === complete`, and `qualification.confirmedBySdr === true` before preparing/resolving/writing handoff. A non-AI event alone is not authorization. The note and sync APIs independently enforce the persisted gate. Real workflow wiring is external to this repository and must be verified in n8n execution history; backend tests do not certify those nodes. Datacrazy writes remain blocked until their endpoint is certified.

### Dispatch evidence (real SDR click)

Server logs with `component=space-phone-qualification-dispatch` record start/result, `callId`, `event`, `occurredAt`, log timestamp, `dispatchId`, HTTP status and elapsed time. The same UUID is sent to n8n as `x-space-dispatch-id`; inspect the Webhook node's input headers to correlate a real execution. If n8n explicitly returns `x-n8n-execution-id` (numeric ID/UUID) or `x-request-id` (numeric ID/UUID), the result log captures it. Missing IDs remain null; no execution link/ID is inferred. Responses, webhook URL, shared secret and transcript are never logged.

An `accepted` log proves HTTP acceptance only. Certification still requires the actual SDR click, persisted `complete`/`completed_at`, matching execution in n8n, FALSE branch, and individual handoff node results. Do not substitute a manual webhook request. A timeout can also mean n8n accepted work before the response was lost: search by dispatchId before retrying.
