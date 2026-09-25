-- Append-only decisions and at-most-once claims. An uncertain remote result is
-- deliberately not retried automatically; an operator must reconcile it first.
CREATE TABLE public.commercial_action_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id text, meeting_id text NOT NULL, business_id text,
 action_type text NOT NULL, decision jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.commercial_action_claims (
 action_key text PRIMARY KEY, decision_id uuid NOT NULL REFERENCES public.commercial_action_decisions(id),
 business_id text NOT NULL, status text NOT NULL CHECK (status IN ('processing','sent','blocked','uncertain')),
 final_stage text, result_code text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX commercial_action_one_inflight_business ON public.commercial_action_claims(business_id)
WHERE status IN ('processing','uncertain');
ALTER TABLE public.commercial_action_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_action_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commercial_action_decisions, public.commercial_action_claims FROM anon, authenticated;
GRANT SELECT, INSERT ON public.commercial_action_decisions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.commercial_action_claims TO service_role;

CREATE FUNCTION public.claim_commercial_action(p_key text, p_event text, p_meeting text, p_business text, p_action text, p_decision jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE audit_id uuid; claimed text;
BEGIN
 INSERT INTO public.commercial_action_decisions(event_id,meeting_id,business_id,action_type,decision)
 VALUES(p_event,p_meeting,p_business,p_action,p_decision) RETURNING id INTO audit_id;
 IF (p_decision->>'action_allowed')::boolean IS DISTINCT FROM true THEN
   RETURN jsonb_build_object('claimed',false,'decision_id',audit_id,'reason','policy_blocked');
 END IF;
 INSERT INTO public.commercial_action_claims(action_key,decision_id,business_id,status)
 VALUES(p_key,audit_id,p_business,'processing') ON CONFLICT DO NOTHING RETURNING action_key INTO claimed;
 RETURN jsonb_build_object('claimed',claimed IS NOT NULL,'decision_id',audit_id,'reason',CASE WHEN claimed IS NULL THEN 'duplicate_or_inflight' ELSE 'claimed' END);
END $$;
REVOKE ALL ON FUNCTION public.claim_commercial_action(text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_commercial_action(text,text,text,text,text,jsonb) TO service_role;

CREATE FUNCTION public.commercial_student_evidence(p_person text, p_emails text[], p_phones text[], p_room text, p_start timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH candidates AS (
  SELECT 'onboarding' source, to_jsonb(t) row FROM public.n8n_onboarding_alunos_space t
  UNION ALL SELECT 'student_mirror',to_jsonb(t) FROM public.n8n_datacrazy_alunos_space t
  UNION ALL SELECT 'finance_student',to_jsonb(t) FROM public.n8n_alunos_financeiro_space t
  UNION ALL SELECT 'pedagogical',to_jsonb(t) FROM public.n8n_aulas_pedagogicas_space t
 ), matches AS (
 SELECT source, row->>'id' id FROM candidates
 WHERE (p_person <> '' AND p_person IN (row->>'id_externo',row->>'aluno_id',row->>'lead_id'))
 OR (lower(coalesce(row->>'email',row->>'aluno_email','')) <> '' AND lower(coalesce(row->>'email',row->>'aluno_email','')) = ANY(p_emails))
 OR (regexp_replace(coalesce(row->>'telefone_normalizado',row->>'telefone',row->>'aluno_telefone',''),'\D','','g') <> ''
 AND regexp_replace(coalesce(row->>'telefone_normalizado',row->>'telefone',row->>'aluno_telefone',''),'\D','','g') = ANY(p_phones))
 ), lesson AS (
 SELECT id FROM public.n8n_aulas_pedagogicas_space
 WHERE p_room <> '' AND google_meet_url = p_room AND inicio = p_start
 )
 SELECT jsonb_build_object('student_found', EXISTS(SELECT 1 FROM matches),
 'student_id',(SELECT id FROM matches LIMIT 1),'lesson_found',EXISTS(SELECT 1 FROM lesson),
 'sources',coalesce((SELECT jsonb_agg(DISTINCT source) FROM matches),'[]'::jsonb),'student_lookup_complete',true);
$$;
REVOKE ALL ON FUNCTION public.commercial_student_evidence(text,text[],text[],text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commercial_student_evidence(text,text[],text[],text,timestamptz) TO service_role;
