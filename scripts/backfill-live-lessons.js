#!/usr/bin/env node
/*
  Backfill do espelho Supabase de aulas ao vivo.

  DRY-RUN por padrão:
    node --env-file=.env.local scripts/backfill-live-lessons.js

  Aplicar de verdade, somente depois de aprovação explícita:
    LIVE_LESSONS_BACKFILL_CONFIRM=sim node --env-file=.env.local scripts/backfill-live-lessons.js --apply

  Opções úteis:
    --future-only      espelha somente aulas ainda não encerradas
    --historical-only  espelha somente aulas já encerradas
    --limit=10         limita quantidade de candidatos processados

  Requisitos:
  - GOOGLE_SERVICE_ACCOUNT_JSON ou credencial equivalente para Firestore Admin.
  - SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
  - Rodar somente depois da migration scripts/supabase-live-lessons-schema-fix.sql.
*/

const fs = require("fs");
const path = require("path");

process.env.APP_ENV = process.env.APP_ENV || "production";
process.env.VERCEL_ENV = process.env.VERCEL_ENV || "production";

const DEFAULT_SERVICE_ACCOUNT_PATH = "/Users/spaceonline/Downloads/plataforma-space-firebase-adminsdk-fbsvc-3323596f76.json";
const JITSI_BASE_URL = String(process.env.JITSI_BASE_URL || "https://meet.jit.si").replace(/\/+$/, "");
const TABLE = "n8n_aulas_pedagogicas_space";
const BATCH_SIZE = 50;

const args = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith("--limit=")));
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Math.max(0, Number(limitArg.split("=")[1]) || 0) : 0;
const APPLY = args.has("--apply");
const FUTURE_ONLY = args.has("--future-only");
const HISTORICAL_ONLY = args.has("--historical-only");

if (FUTURE_ONLY && HISTORICAL_ONLY) {
  console.error("Use apenas um: --future-only ou --historical-only.");
  process.exit(1);
}

if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && fs.existsSync(DEFAULT_SERVICE_ACCOUNT_PATH)) {
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = fs.readFileSync(DEFAULT_SERVICE_ACCOUNT_PATH, "utf8");
}

const { listCollectionAsAdmin, commitWritesAsAdmin } = require("../api/_lib/firestore-admin");
const { supabaseFetch } = require("../api/_lib/supabase-rest");
const { FIRESTORE_BASE, encodeFields } = require("../_lib/firestore-rest");

if (APPLY && process.env.LIVE_LESSONS_BACKFILL_CONFIRM !== "sim") {
  console.error("Abortado: para aplicar use LIVE_LESSONS_BACKFILL_CONFIRM=sim.");
  process.exit(1);
}

const asString = (value) => String(value ?? "").trim();

const toFirestoreDocName = (docPath) => {
  const marker = "/v1/";
  const idx = FIRESTORE_BASE.indexOf(marker);
  const base = idx >= 0 ? FIRESTORE_BASE.slice(idx + marker.length) : FIRESTORE_BASE;
  return `${base}/${String(docPath || "").replace(/^\/+/, "")}`;
};

const timestampToIso = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (typeof value._seconds === "number") {
    return new Date(value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1e6)).toISOString();
  }
  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6)).toISOString();
  }
  return "";
};

const pad2 = (value) => String(value).padStart(2, "0");

const isoFromDateKeyAndMinutes = (dateKey, minutes) => {
  const safeDate = asString(dateKey);
  const safeMinutes = Number(minutes);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safeDate) || !Number.isFinite(safeMinutes)) return "";
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  return new Date(`${safeDate}T${pad2(hour)}:${pad2(minute)}:00-03:00`).toISOString();
};

const buildLiveRoomId = (lesson) => {
  const explicit = asString(lesson.liveRoomId || lesson.video_room_id || lesson.roomSlug);
  if (explicit) return explicit;
  const eventId = asString(lesson.id);
  const parts = [
    "space",
    "aula",
    asString(lesson.alunoNome || lesson.studentName).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36),
    asString(lesson.professorNome || lesson.teacherName).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30),
    asString(lesson.dateKey).replace(/-/g, ""),
    asString(lesson.startMin),
    eventId.slice(-8),
  ].filter(Boolean);
  return parts.join("-").slice(0, 180);
};

const buildMirrorPayload = (lesson) => {
  const startIso = asString(lesson.inicio || lesson.startIso) || isoFromDateKeyAndMinutes(lesson.dateKey, lesson.startMin);
  const endIso = asString(lesson.fim || lesson.endIso) || isoFromDateKeyAndMinutes(lesson.dateKey, lesson.endMin);
  const roomId = buildLiveRoomId(lesson);
  const now = new Date().toISOString();
  return {
    firestore_doc_id: asString(lesson.alunoFirestoreDocId || lesson.studentFirestoreDocId || lesson.alunoId) || null,
    aluno_id: asString(lesson.alunoId) || null,
    aluno_nome: asString(lesson.alunoNome) || null,
    aluno_email: asString(lesson.alunoEmail) || null,
    aluno_telefone: asString(lesson.alunoTelefone) || null,
    professor_id: asString(lesson.professorId) || null,
    professor_nome: asString(lesson.professorNome) || null,
    titulo: asString(lesson.title || lesson.titulo) || (lesson.alunoNome ? `Aula ao vivo - ${lesson.alunoNome}` : "Aula ao vivo Space"),
    status_aula: asString(lesson.statusAula || lesson.status_aula || lesson.status) || "agendada",
    inicio: startIso || null,
    fim: endIso || null,
    timezone: asString(lesson.timezone) || "America/Sao_Paulo",
    video_provider: asString(lesson.videoProvider || lesson.video_provider) || "jitsi",
    video_room_id: roomId || null,
    video_room_url: roomId ? `${JITSI_BASE_URL}/${encodeURIComponent(roomId)}` : null,
    video_status: asString(lesson.videoStatus || lesson.video_status) || "ready",
    origem: asString(lesson.origem) || "plataforma_backfill",
    plano: asString(lesson.plano || lesson.plan) || null,
    data_aula: asString(lesson.dateKey) || null,
    observacoes: asString(lesson.observacoes || lesson.notes) || null,
    briefing_pedagogico: asString(lesson.briefingPedagogico || lesson.briefing_pedagogico || lesson.observacoes || lesson.notes) || null,
    created_at: timestampToIso(lesson.createdAt || lesson.criadoEm) || now,
    updated_at: now,
  };
};

const classifyLesson = (lesson, nowMs) => {
  const payload = buildMirrorPayload(lesson);
  const startMs = Date.parse(payload.inicio || "");
  const endMs = Date.parse(payload.fim || "") || startMs;
  const problems = [];
  if (!asString(lesson.id)) problems.push("missing_firestore_aula_id");
  if (!payload.aluno_id) problems.push("missing_aluno_id");
  if (!payload.aluno_nome) problems.push("missing_aluno_nome");
  if (!payload.professor_id) problems.push("missing_professor_id");
  if (!payload.professor_nome) problems.push("missing_professor_nome");
  if (!payload.inicio || !Number.isFinite(startMs)) problems.push("missing_or_invalid_inicio");
  if (!payload.fim || !Number.isFinite(endMs)) problems.push("missing_or_invalid_fim");
  if (!payload.video_room_id || !payload.video_room_url) problems.push("missing_video_room");
  return {
    id: asString(lesson.id),
    payload,
    isFuture: Number.isFinite(endMs) ? endMs >= nowMs : false,
    problems,
  };
};

const insertMirror = async (entry) => {
  const { data } = await supabaseFetch(`/${TABLE}`, {
    method: "POST",
    body: entry.payload,
  });
  const row = Array.isArray(data) ? data[0] : data;
  const liveLessonId = asString(row?.id);
  if (!liveLessonId) return { liveLessonId: "" };
  const patch = {
    liveLessonId,
    liveUrl: `/aula/${liveLessonId}`,
    liveBackfilledAt: new Date(),
  };
  const encoded = encodeFields(patch);
  await commitWritesAsAdmin({ writes: [
    {
      update: {
        name: toFirestoreDocName(`aulas/${entry.id}`),
        fields: encoded.fields,
      },
      updateMask: { fieldPaths: Object.keys(patch) },
    },
  ] }).then((response) => {
    if (!response?.ok) {
      const error = new Error("firestore_live_lesson_id_update_failed");
      error.status = response?.status || 0;
      error.details = response?.data || response?.text || null;
      throw error;
    }
  });
  return { liveLessonId };
};

const main = async () => {
  const nowMs = Date.now();
  const lessons = await listCollectionAsAdmin("aulas", { pageSize: 20000 });
  const classified = lessons
    .map((lesson) => classifyLesson(lesson, nowMs))
    .filter((entry) => entry.id)
    .filter((entry) => !asString(lessons.find((lesson) => asString(lesson.id) === entry.id)?.liveLessonId));

  const scoped = classified.filter((entry) => {
    if (FUTURE_ONLY) return entry.isFuture;
    if (HISTORICAL_ONLY) return !entry.isFuture;
    return true;
  });
  const candidates = limit ? scoped.slice(0, limit) : scoped;
  const future = candidates.filter((entry) => entry.isFuture);
  const historical = candidates.filter((entry) => !entry.isFuture);
  const problematic = candidates.filter((entry) => entry.problems.length);
  const problemCounts = problematic.reduce((acc, entry) => {
    entry.problems.forEach((problem) => {
      acc[problem] = (acc[problem] || 0) + 1;
    });
    return acc;
  }, {});

  const report = {
    mode: APPLY ? "apply" : "dry-run",
    scope: FUTURE_ONLY ? "future-only" : HISTORICAL_ONLY ? "historical-only" : "all",
    firestoreAulasTotal: lessons.length,
    candidatesTotal: candidates.length,
    future: future.length,
    historical: historical.length,
    problematic: problematic.length,
    problemCounts,
    samples: {
      future: future.slice(0, 5).map((entry) => ({
        aulaId: entry.id,
        alunoId: entry.payload.aluno_id,
        alunoNome: entry.payload.aluno_nome,
        professorId: entry.payload.professor_id,
        professorNome: entry.payload.professor_nome,
        inicio: entry.payload.inicio,
        fim: entry.payload.fim,
        video_room_url: entry.payload.video_room_url ? "[present]" : "",
        problems: entry.problems,
      })),
      historical: historical.slice(0, 5).map((entry) => ({
        aulaId: entry.id,
        alunoId: entry.payload.aluno_id,
        alunoNome: entry.payload.aluno_nome,
        professorId: entry.payload.professor_id,
        professorNome: entry.payload.professor_nome,
        inicio: entry.payload.inicio,
        fim: entry.payload.fim,
        video_room_url: entry.payload.video_room_url ? "[present]" : "",
        problems: entry.problems,
      })),
      problematic: problematic.slice(0, 10).map((entry) => ({
        aulaId: entry.id,
        alunoId: entry.payload.aluno_id,
        alunoNome: entry.payload.aluno_nome,
        professorId: entry.payload.professor_id,
        professorNome: entry.payload.professor_nome,
        inicio: entry.payload.inicio,
        fim: entry.payload.fim,
        problems: entry.problems,
      })),
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (!APPLY) return;

  let ok = 0;
  let failed = 0;
  for (let index = 0; index < candidates.length; index += BATCH_SIZE) {
    const batch = candidates.slice(index, index + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(insertMirror));
    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value.liveLessonId) ok += 1;
      else failed += 1;
    });
    console.log(`[backfill-live-lessons] processed=${Math.min(index + BATCH_SIZE, candidates.length)}/${candidates.length} ok=${ok} failed=${failed}`);
  }
  console.log(JSON.stringify({ mode: "apply", ok, failed, total: candidates.length }, null, 2));
};

main().catch((error) => {
  console.error("[backfill-live-lessons] failed", {
    message: error?.message || String(error),
    code: error?.code || "",
    status: error?.status || 0,
    details: error?.details || "",
    hint: error?.hint || "",
  });
  process.exit(1);
});
