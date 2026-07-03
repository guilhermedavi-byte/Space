const loadAdminDashboard = async ({ session } = {}) => {
  let degraded = false;
  const safe = (promise) =>
    promise.catch(() => {
      degraded = true;
      return [];
    });
  const adminId = String(session?.sub || session?.email || "").trim();
  const [onboarding, lessons, registers, alerts, satisfaction, flexge, teachers, reports, financeStudents, preferences] = await Promise.all([
    safe(fetchOnboardingRows("select=*&order=updated_at.desc.nullslast&limit=1000")),
    safe(listAllLessons({ limit: 1000 })),
    safe(listRegisters({ limit: 1000 })),
    safe(fetchRows(`/${TABLES.alerts}?select=*&order=created_at.desc.nullslast&limit=1000`, { optional: true })),
    safe(fetchRows(`/${TABLES.satisfaction}?select=*&order=created_at.desc.nullslast&limit=1000`, { optional: true })),
    safe(fetchRows(`/${TABLES.flexge}?select=*&order=flexge_last_sync_at.desc.nullslast&limit=1000`, { optional: true })),
    safe(fetchRows(`/${TABLES.teachers}?select=*&order=nome.asc.nullslast&limit=1000`, { optional: true })),
    safe(fetchRows(`/${TABLES.reports}?select=*&order=created_at.desc.nullslast&limit=200`, { optional: true })),
    safe(fetchFinanceStudents({ limit: 1000 })),
    adminId
      ? safe(
          fetchRows(
            `/${TABLES.adminStudentPreferences}?select=*&admin_id=eq.${safeEncode(adminId)}&limit=2000`,
            { optional: true }
          )
        )
      : [],
  ]);
  const students = mergePedagogicalStudents({ onboarding, financeStudents, preferences });

  const today = dateKey(new Date());
  const registeredIds = new Set(registers.map((row) => String(row?.aula_id || "")).filter(Boolean));
  const pendingLessons = lessons.filter((row) => {
    const status = String(row?.status_aula || "").toLowerCase();
    const ended = row?.fim ? Date.parse(row.fim) < Date.now() : row?.inicio ? Date.parse(row.inicio) < Date.now() : false;
    return !registeredIds.has(String(row?.id || "")) && (ended || ["realizada", "pendente_registro"].includes(status));
  });
  const riskStudents = onboarding.filter((row) => {
    const level = String(row?.risco_nivel || "").toLowerCase();
    return ["alto", "critico", "crítico"].includes(level) || Number(row?.risco_score || row?.score_risco || 0) >= 70;
  });
  const scores = satisfaction.map((row) => Number(row?.nota)).filter(Number.isFinite);
  const npsScores = satisfaction.filter((row) => String(row?.tipo || "").toLowerCase() === "nps").map((row) => Number(row?.nota)).filter(Number.isFinite);
  const csatScores = satisfaction.filter((row) => String(row?.tipo || "").toLowerCase() === "csat").map((row) => Number(row?.nota)).filter(Number.isFinite);
  const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

  return {
    degraded,
    warning: degraded ? "Algumas fontes pedagógicas estão temporariamente indisponíveis." : undefined,
    metrics: {
      onboarding_em_andamento: onboarding.filter((row) => !["concluido", "concluído", "finalizado"].includes(String(row?.status_onboarding || "").toLowerCase())).length,
      alunos_sem_professor: onboarding.filter((row) => !row?.professor_id && !row?.professor_nome && !row?.professor_email).length,
      alunos_sem_primeira_aula: onboarding.filter((row) => !row?.primeira_aula_em).length,
      aulas_hoje: lessons.filter((row) => dateKey(row?.inicio) === today).length,
      aulas_pendentes_registro: pendingLessons.length,
      ocorrencias_abertas: alerts.filter((row) => statusOpen(row?.status)).length,
      alunos_em_risco: riskStudents.length,
      nps: average(npsScores),
      csat: average(csatScores.length ? csatScores : scores),
      flexge_criados: onboarding.filter((row) => row?.flexge_user_id || ["criado", "vinculado", "ativo"].includes(String(row?.flexge_status || "").toLowerCase())).length,
      flexge_total: onboarding.length,
      alunos_sincronizados_financeiro: financeStudents.length,
    },
    students,
    financeStudents,
    studentPreferences: preferences,
    onboarding,
    lessons,
    registers,
    pendingLessons,
    alerts,
    satisfaction,
    flexge,
    teachers,
    reports,
    riskStudents,
  };
};

const lessonToTeacherEvent = (lesson) => {
  if (!lesson || typeof lesson !== "object") return null;
  const id = String(lesson.id || "").trim();
  if (!id) return null;
  const start = lesson.inicio ? new Date(lesson.inicio) : null;
  const end = lesson.fim ? new Date(lesson.fim) : null;
  const startMin = start && !Number.isNaN(start.getTime()) ? start.getHours() * 60 + start.getMinutes() : 0;
  const endMin = end && !Number.isNaN(end.getTime()) ? end.getHours() * 60 + end.getMinutes() : startMin + 30;
  return {
    id,
    type: "lesson",
    title: lesson.aluno_nome || "Aluno",
    alunoId: String(lesson.aluno_id || lesson.aluno_nome || "").trim(),
    alunoNome: lesson.aluno_nome || "",
    professorId: String(lesson.professor_id || "").trim(),
    professorNome: lesson.professor_nome || "",
    dateKey: dateKey(lesson.inicio),
    startMin,
    endMin,
    status: String(lesson.status_aula || "agendada").toLowerCase(),
    liveLessonId: id,
    liveUrl: `/aula/${encodeURIComponent(id)}`,
    payload: lesson,
  };
};

const registerToTeacherLog = (row) => {
  if (!row || typeof row !== "object") return null;
  const id = String(row.id || row.aula_id || "").trim();
  if (!id) return null;
  return {
    id,
    eventId: String(row.aula_id || "").trim(),
    professorId: String(row.professor_id || "").trim(),
    alunoId: String(row.aluno_id || row.aluno_nome || "").trim(),
    statusAula: String(row.status || row.status_aula || "").trim().toLowerCase(),
    criadoEm: row.created_at || null,
    atualizadoEm: row.updated_at || row.created_at || null,
    payload: {
      ...row,
      conteudoTrabalhado: row.conteudo_trabalhado || row.conteudo_aula || "",
      engajamentoNota: row.engajamento || "",
      humorAluno: row.humor || row.humor_aluno || "",
      observacoesInternas: row.observacoes || "",
      riscoEvasao: row.risco_evasao || "",
      avisosCoordenacao: [],
    },
  };
};

const loadTeacherStudents = async ({ session } = {}) => {
  const safe = (promise) => promise.catch(() => []);
  const [onboarding, financeStudents, lessons, registers] = await Promise.all([
    safe(fetchOnboardingRows("select=*&order=updated_at.desc.nullslast&limit=1000")),
    safe(fetchFinanceStudents({ limit: 1000 })),
    safe(listTeacherLessons({ session, limit: 1000, includeHistoryDays: 3650 })),
    safe(listRegisters({ limit: 1000 })),
  ]);

  const assignedKeys = new Set();
  onboarding.filter((row) => teacherMatchesSession(row, session)).forEach((row) => assignedKeys.add(studentIdentityKey(row)));
  financeStudents.filter((row) => teacherMatchesSession(row, session)).forEach((row) => assignedKeys.add(studentIdentityKey(row)));
  lessons.forEach((row) => {
    const key = studentIdentityKey(row);
    if (key && key !== "name:") assignedKeys.add(key);
  });
  registers.filter((row) => teacherMatchesSession(row, session)).forEach((row) => {
    const key = studentIdentityKey(row);
    if (key && key !== "name:") assignedKeys.add(key);
  });

  const lessonStudentRows = lessons.map((row) => ({
    id: row.aluno_id || row.aluno_nome || "",
    aluno_id: row.aluno_id || row.aluno_nome || "",
    aluno_nome: row.aluno_nome || "Aluno",
    professor_id: row.professor_id || "",
    professor_nome: row.professor_nome || "",
    plano: row.plano || "",
    status: "ativo",
  }));
  const registerStudentRows = registers
    .filter((row) => teacherMatchesSession(row, session))
    .map((row) => ({
      id: row.aluno_id || row.aluno_nome || "",
      aluno_id: row.aluno_id || row.aluno_nome || "",
      aluno_nome: row.aluno_nome || "Aluno",
      professor_id: row.professor_id || "",
      professor_nome: row.professor_nome || "",
      status: "ativo",
    }));

  const students = mergePedagogicalStudents({
    onboarding: [...onboarding, ...lessonStudentRows, ...registerStudentRows],
    financeStudents,
    preferences: [],
  }).filter((row) => assignedKeys.has(row.aluno_chave || studentIdentityKey(row)));

  const events = lessons.map(lessonToTeacherEvent).filter(Boolean);
  const logs = registers.filter((row) => teacherMatchesSession(row, session)).map(registerToTeacherLog).filter(Boolean);
  const eventsById = new Map(events.map((event) => [String(event.id), event]));
  const logsByAluno = new Map();
  logs.forEach((log) => {
    const alunoId = String(log.alunoId || "").trim();
    if (!alunoId) return;
    const bucket = logsByAluno.get(alunoId) || [];
    bucket.push(log);
    logsByAluno.set(alunoId, bucket);
  });

  const summaries = students
    .map((student) => {
      const alunoId = String(student.aluno_id || student.id || student.aluno_nome || "").trim();
      const studentLogs = logsByAluno.get(alunoId) || logs.filter((log) => namesMatch(log?.payload?.aluno_nome, student.aluno_nome));
      const studentEvents = events.filter((event) => idsMatch(event.alunoId, alunoId) || namesMatch(event.alunoNome || event.title, student.aluno_nome));
      const lastEvent = studentEvents
        .slice()
        .sort((a, b) => String(b.dateKey || "").localeCompare(String(a.dateKey || "")) || (Number(b.startMin) || 0) - (Number(a.startMin) || 0))[0];
      const lastLog = studentLogs
        .slice()
        .sort((a, b) => Date.parse(b.atualizadoEm || b.criadoEm || "") - Date.parse(a.atualizadoEm || a.criadoEm || ""))[0];
      const lastLessonLabel = lastEvent?.dateKey
        ? `${lastEvent.dateKey.split("-").reverse().join("/")} • ${String(Math.floor((lastEvent.startMin || 0) / 60)).padStart(2, "0")}:${String((lastEvent.startMin || 0) % 60).padStart(2, "0")}`
        : "—";
      return {
        alunoId,
        nome: student.aluno_nome || student.nome || "Aluno",
        email: student.email || "",
        telefone: student.telefone || "",
        plano: student.plano || "",
        accessStatus: student.ativo_acesso === false ? "Inativo" : "Ativo",
        lastLessonLabel,
        totalLogs: studentLogs.length,
        riskLabel: student.risco_nivel || (Number(student.risco_score || student.score_risco || 0) >= 70 ? "Alto" : "Sem dados"),
        statusLabel:
          lastLog?.statusAula === "realizada"
            ? "Realizada"
            : lastLog?.statusAula === "falta"
              ? "Falta"
              : lastLog?.statusAula === "remarcada"
                ? "Remarcada"
                : "Sem dados",
        hasAlert: Number(student.risco_score || student.score_risco || 0) >= 70,
      };
    })
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));

  return { students, summaries, events, logs };
};

const studentFilter = ({ alunoId, alunoNome }) => {
  if (alunoNome) return `aluno_nome=ilike.*${safeEncode(alunoNome)}*`;
  return `aluno_id=eq.${safeEncode(alunoId)}`;
};

const loadStudentCard = async ({ alunoId, alunoNome }) => {
  const filter = studentFilter({ alunoId, alunoNome });
  let degraded = false;
  const safe = (promise) =>
    promise.catch(() => {
      degraded = true;
      return [];
    });
  const [onboarding, lessons, registers, alerts, satisfaction, flexge, reports, financeStudents] = await Promise.all([
    safe(fetchOnboardingRows(`select=*&${filter}&order=updated_at.desc.nullslast&limit=10`)),
    safe(fetchRows(`/${TABLES.lessons}?select=*&${filter}&order=inicio.desc.nullslast&limit=100`, { optional: true })),
    safe(fetchRows(`/${TABLES.registers}?select=*&${filter}&order=created_at.desc.nullslast&limit=100`, { optional: true })),
    safe(fetchRows(`/${TABLES.alerts}?select=*&${filter}&order=created_at.desc.nullslast&limit=100`, { optional: true })),
    safe(fetchRows(`/${TABLES.satisfaction}?select=*&${filter}&order=created_at.desc.nullslast&limit=100`, { optional: true })),
    safe(fetchRows(`/${TABLES.flexge}?select=*&${filter}&order=flexge_last_sync_at.desc.nullslast&limit=10`, { optional: true })),
    safe(fetchRows(`/${TABLES.reports}?select=*&${filter}&order=created_at.desc.nullslast&limit=100`, { optional: true })),
    safe(
      fetchRowsWithFallback(
        [
          `/${TABLES.financeStudents}?select=*&${filter}&order=updated_at.desc.nullslast&limit=10`,
          `/${TABLES.financeStudents}?select=*&${filter}&order=created_at.desc.nullslast&limit=10`,
          `/${TABLES.financeStudents}?select=*&${filter}&limit=10`,
        ],
        { optional: true }
      )
    ),
  ]);
  const finance = financeStudents[0] || {};
  const base = { ...finance, ...(onboarding[0] || {}) };
  const evolution = flexge[0] || {};
  return {
    degraded,
    warning: degraded ? "Alguns dados da ficha estão temporariamente indisponíveis." : undefined,
    ...base,
    ...Object.fromEntries(Object.entries(evolution).filter(([, value]) => value != null && value !== "")),
    aluno_id: alunoId || base.aluno_id || evolution.aluno_id || "",
    aluno_nome: alunoNome || base.aluno_nome || "",
    onboarding: onboarding[0] || null,
    financeiro: financeStudents[0] || null,
    aulas: lessons,
    registros: registers,
    faltas: registers.filter((row) => String(row?.status || "").toLowerCase() === "falta"),
    remarcacoes: registers.filter((row) => String(row?.status || "").toLowerCase() === "remarcada"),
    ocorrencias: alerts,
    avaliacoes: satisfaction,
    flexge_evolucao: evolution || null,
    relatorios: reports,
  };
};

