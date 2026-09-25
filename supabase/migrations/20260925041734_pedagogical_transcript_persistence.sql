-- One audit per Vexa meeting. Existing rows are retained and enriched on retry.
CREATE UNIQUE INDEX IF NOT EXISTS pedagogical_audit_meeting_unique
ON public.n8n_relatorios_pedagogicos_space ((payload->>'meeting_id'))
WHERE tipo_relatorio = 'auditoria_aula_ia' AND payload->>'meeting_id' IS NOT NULL;

CREATE OR REPLACE FUNCTION public.upsert_pedagogical_audit(p_report jsonb)
RETURNS SETOF public.n8n_relatorios_pedagogicos_space
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE incoming public.n8n_relatorios_pedagogicos_space;
BEGIN
  IF p_report->>'tipo_relatorio' <> 'auditoria_aula_ia'
     OR coalesce(p_report#>>'{payload,meeting_id}', '') = '' THEN
    RAISE EXCEPTION 'invalid_pedagogical_audit';
  END IF;
  incoming := jsonb_populate_record(NULL::public.n8n_relatorios_pedagogicos_space, p_report);
  RETURN QUERY
  INSERT INTO public.n8n_relatorios_pedagogicos_space AS existing
    (tipo_relatorio, periodo_inicio, periodo_fim, resumo, metricas, status, canal, payload,
     aluno_id, aluno_nome, onboarding_id, created_at, updated_at)
  VALUES ('auditoria_aula_ia', incoming.periodo_inicio, incoming.periodo_fim, incoming.resumo,
    incoming.metricas, incoming.status, incoming.canal, incoming.payload,
    incoming.aluno_id, incoming.aluno_nome, incoming.onboarding_id, now(), now())
  ON CONFLICT ((payload->>'meeting_id'))
    WHERE tipo_relatorio = 'auditoria_aula_ia' AND payload->>'meeting_id' IS NOT NULL
  DO UPDATE SET
    payload = coalesce(existing.payload, '{}'::jsonb) || EXCLUDED.payload ||
      CASE WHEN coalesce(EXCLUDED.payload->>'transcript', '') = '' AND coalesce(existing.payload->>'transcript', '') <> ''
        THEN jsonb_build_object('transcript', existing.payload->'transcript', 'segments', existing.payload->'segments')
        ELSE '{}'::jsonb END,
    aluno_id = EXCLUDED.aluno_id, aluno_nome = EXCLUDED.aluno_nome,
    onboarding_id = EXCLUDED.onboarding_id, status = EXCLUDED.status,
    resumo = EXCLUDED.resumo, metricas = EXCLUDED.metricas,
    periodo_inicio = EXCLUDED.periodo_inicio, periodo_fim = EXCLUDED.periodo_fim,
    updated_at = now()
  RETURNING existing.*;
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_pedagogical_audit(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_pedagogical_audit(jsonb) TO service_role;
