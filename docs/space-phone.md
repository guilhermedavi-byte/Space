# Space Phone V1

Vertical slice experimental de outbound WebRTC com Telnyx, protegida por `SPACE_PHONE_ENABLED`.

## Fluxo

Space CRM → `window.SpacePhone.call()` → `/api/voice/calls` cria `voice_calls` → `/api/voice/telnyx/token` gera JWT curto via `POST https://api.telnyx.com/v2/telephony_credentials/{id}/token` → `@telnyx/webrtc` (`TelnyxRTC`) inicia a chamada PSTN.

O pipeline legado de gravação/transcrição/análise continua fora desta fatia e não foi alterado. A reconciliação futura deve usar `telnyx_call_leg_id` / `telnyx_call_session_id` quando disponíveis pelo SDK ou pelo webhook Telnyx.

## Configuração necessária antes de chamada real

- `SPACE_PHONE_ENABLED=true`
- `TELNYX_API_KEY`
- `TELNYX_DEFAULT_FROM_NUMBER` ou `caller_id` por usuário em `voice_phone_identities`
- Uma linha ativa em `voice_phone_identities` por usuário autorizado com `telnyx_credential_id`
- Telnyx Credential Connection/On-demand Credential configurado para WebRTC/PSTN outbound no painel da Telnyx

## Limitações V1

- outbound apenas;
- uma chamada ativa por browser;
- refresh completo não preserva a chamada visualmente;
- webhook Telnyx fica para próxima fase para estados autoritativos e idempotência;
- não cria eventos em `sdrActivityEvents` e não altera `sdr_call_scores`.
