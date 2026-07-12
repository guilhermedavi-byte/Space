const { supabaseFetch } = require("./supabase-rest");

const RECORDINGS_TABLE = "n8n_gravacoes_aula_space";

const safeEncode = (value) => encodeURIComponent(String(value || ""));

const buildStudentFolderName = (lesson) => {
  const raw = String(lesson?.aluno_nome || lesson?.aluno_id || "Aluno sem nome").trim();
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeRecording = (row) => {
  if (!row || typeof row !== "object") return null;
  const id = row.id == null ? "" : String(row.id);
  if (!id) return null;
  return {
    id,
    aula_id: row.aula_id == null ? "" : String(row.aula_id),
    aluno_id: row.aluno_id == null ? "" : String(row.aluno_id),
    aluno_nome: row.aluno_nome == null ? "" : String(row.aluno_nome),
    professor_id: row.professor_id == null ? "" : String(row.professor_id),
    professor_nome: row.professor_nome == null ? "" : String(row.professor_nome),
    status: row.status == null ? "" : String(row.status),
    storage_provider: row.storage_provider == null ? "" : String(row.storage_provider),
    pasta_drive_nome: row.pasta_drive_nome == null ? "" : String(row.pasta_drive_nome),
    drive_folder_id: row.drive_folder_id == null ? "" : String(row.drive_folder_id),
    drive_file_id: row.drive_file_id == null ? "" : String(row.drive_file_id),
    recording_url: row.recording_url == null ? "" : String(row.recording_url),
    transcript_url: row.transcript_url == null ? "" : String(row.transcript_url),
    transcricao_texto: row.transcricao_texto == null ? "" : String(row.transcricao_texto),
    started_at: row.started_at || null,
    stopped_at: row.stopped_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
};

const listRecordingsForLesson = async (lessonId) => {
  const { data } = await supabaseFetch(
    `/${RECORDINGS_TABLE}?select=*&aula_id=eq.${safeEncode(lessonId)}&order=created_at.desc&limit=20`
  );
  return (Array.isArray(data) ? data : []).map(normalizeRecording).filter(Boolean);
};

const getLatestRecordingForLesson = async (lessonId) => {
  const rows = await listRecordingsForLesson(lessonId);
  return rows[0] || null;
};

const createRecording = async ({ lesson, session, status = "recording" }) => {
  const now = new Date().toISOString();
  const folderName = buildStudentFolderName(lesson);
  const body = {
    aula_id: lesson.id,
    firestore_doc_id: lesson.firestore_doc_id || lesson.aluno_id || null,
    aluno_id: lesson.aluno_id || null,
    aluno_nome: lesson.aluno_nome || null,
    professor_id: lesson.professor_id || null,
    professor_nome: lesson.professor_nome || null,
    status,
    video_provider: lesson.video_provider || null,
    video_room_id: lesson.video_room_id || null,
    storage_provider: "GOOGLE_DRIVE",
    pasta_drive_nome: folderName,
    solicitado_por: String(session?.name || session?.email || session?.sub || "professor"),
    started_at: now,
    created_at: now,
    updated_at: now,
  };
  const { data } = await supabaseFetch(`/${RECORDINGS_TABLE}`, { method: "POST", body });
  return normalizeRecording(Array.isArray(data) ? data[0] : data) || body;
};

const updateRecording = async (recordingId, patch) => {
  const body = { ...patch, updated_at: new Date().toISOString() };
  const { data } = await supabaseFetch(`/${RECORDINGS_TABLE}?id=eq.${safeEncode(recordingId)}`, {
    method: "PATCH",
    body,
  });
  return normalizeRecording(Array.isArray(data) ? data[0] : data) || body;
};

const stopLatestRecording = async (lessonId) => {
  const latest = await getLatestRecordingForLesson(lessonId);
  if (!latest) return null;
  if (["stopped", "processed", "failed"].includes(String(latest.status || "").toLowerCase())) return latest;
  return updateRecording(latest.id, { status: "stopped", stopped_at: new Date().toISOString() });
};

module.exports = {
  RECORDINGS_TABLE,
  buildStudentFolderName,
  createRecording,
  getLatestRecordingForLesson,
  listRecordingsForLesson,
  stopLatestRecording,
  updateRecording,
};
