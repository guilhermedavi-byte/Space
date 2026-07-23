const normalizeLessonRegisterStatus = (status) => {
  const raw = String(status || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!raw) return "";
  if (raw === "realizada") return "realizada";
  if (raw === "falta" || raw === "falta_aluno") return "falta_aluno";
  if (raw === "cancelada" || raw === "cancelado") return "cancelada";
  if (raw === "remarcada" || raw === "remarcado") return "remarcada";
  return "";
};

const getLessonStatusWeight = (status) => {
  const normalized = normalizeLessonRegisterStatus(status);
  if (normalized === "realizada") return 1;
  if (normalized === "falta_aluno") return 0.5;
  return 0;
};

const getCreditedLessonMinutes = ({ startMin, endMin, status }) => {
  const start = Number(startMin);
  const end = Number(endMin);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return (end - start) * getLessonStatusWeight(status);
};

module.exports = {
  normalizeLessonRegisterStatus,
  getLessonStatusWeight,
  getCreditedLessonMinutes,
};
