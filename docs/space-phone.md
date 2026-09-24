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
