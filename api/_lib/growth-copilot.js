const { supabaseFetch } = require("./supabase-rest");

const COPILOT_TABLES = {
  scripts: "growth_sales_scripts",
  objections: "growth_sales_objections",
  phrases: "growth_winning_phrases",
  sessions: "growth_copilot_sessions",
  suggestions: "growth_copilot_suggestions",
  feedback: "growth_copilot_feedback",
};

const DEFAULT_SCRIPT_BLOCKS = [
  {
    id: "seed_abertura",
    name: "Abertura com energia e controle",
    type: "abertura",
    content:
      "Olá, [Nome]! Aqui é o [Closer], da Space Idiomas. Recebi seu contato e queria entender rapidamente seu momento com o inglês.",
    examples: "Hoje ajudamos brasileiros que moram fora e precisam destravar a conversação de forma prática.",
    when_to_use: "Primeiro contato ou início da call.",
    avoid: "Não despejar informações nem parecer vendedor tradicional.",
    active: true,
    order_index: 1,
  },
  {
    id: "seed_diagnostico",
    name: "Identificação imediata",
    type: "diagnóstico",
    content:
      "O que mais ouvimos é: eu entendo um pouco, mas travo para falar; tenho vergonha; estudo, mas não consigo conversar. Isso acontece com você também?",
    examples: "Em quais situações isso aparece mais: trabalho, rotina, confiança ou comunicação do dia a dia?",
    when_to_use: "Depois da abertura, antes de apresentar a solução.",
    avoid: "Não apresentar plano antes de entender a dor.",
    active: true,
    order_index: 2,
  },
  {
    id: "seed_dor",
    name: "Dor, impacto e consequência",
    type: "dor",
    content:
      "O que mais te incomoda hoje no inglês? E isso te limita mais no trabalho, na rotina, na confiança ou na comunicação?",
    examples: "O que fez você decidir buscar ajuda justamente agora?",
    when_to_use: "Quando o lead dá sinais de trava, vergonha ou urgência.",
    avoid: "Não minimizar a dor do lead.",
    active: true,
    order_index: 3,
  },
  {
    id: "seed_futuro",
    name: "Micro sonho",
    type: "urgência",
    content: "Se você realmente destravasse seu inglês nos próximos meses, o que mudaria na sua vida?",
    examples: "O que isso poderia destravar para você profissionalmente ou na sua vida fora?",
    when_to_use: "Após o lead admitir dor ou limitação.",
    avoid: "Não prometer fluência garantida.",
    active: true,
    order_index: 4,
  },
  {
    id: "seed_posicionamento",
    name: "Posicionamento Space",
    type: "apresentação",
    content:
      "Provavelmente o que faltou até hoje não foi capacidade. Foi metodologia, prática real e acompanhamento certo. A Space trabalha com aulas ao vivo, mentorias individuais, método conversacional, prática com IA e flexibilidade de horários.",
    examples: "Nosso objetivo é fazer o aluno usar inglês na vida real o mais rápido possível.",
    when_to_use: "Depois de diagnóstico suficiente.",
    avoid: "Não vender curso genérico nem listar recursos sem conectar à dor.",
    active: true,
    order_index: 5,
  },
  {
    id: "seed_fechamento",
    name: "Fechamento assumido",
    type: "fechamento",
    content: "Tenho disponibilidade hoje no período da noite ou amanhã pela manhã. Qual funciona melhor para você?",
    examples: "Para a reunião funcionar bem, preciso que você esteja com atenção total à apresentação. Tudo bem?",
    when_to_use: "Quando há dor, objetivo e abertura para próximo passo.",
    avoid: "Evitar 'você quer agendar?' como pergunta aberta.",
    active: true,
    order_index: 6,
  },
];

const DEFAULT_OBJECTIONS = [
  {
    id: "seed_preco",
    objection: "Quanto custa?",
    category: "preço",
    recommended_response:
      "Ótima pergunta. Como nossos programas são personalizados, o investimento depende do objetivo, frequência, nível atual e velocidade de evolução desejada. Por isso fazemos primeiro uma avaliação rápida.",
    deepening_question: "Qual resultado você quer alcançar e em quanto tempo isso precisa acontecer?",
    closing_phrase: "Na reunião conseguimos indicar o melhor caminho para o seu momento.",
    active: true,
  },
  {
    id: "seed_tempo",
    objection: "Estou sem tempo",
    category: "tempo",
    recommended_response:
      "Perfeito. Inclusive atendemos muitas pessoas com rotina corrida. Por isso as aulas são individuais e flexíveis.",
    deepening_question: "Hoje sua maior dificuldade é agenda, energia ou constância?",
    closing_phrase: "A avaliação serve justamente para encontrar um formato que caiba na sua rotina.",
    active: true,
  },
  {
    id: "seed_pensar",
    objection: "Vou pensar",
    category: "preciso pensar",
    recommended_response: "Claro. Mas me responde com sinceridade: o que você sente que ainda precisa entender para decidir?",
    deepening_question: "É mais sobre método, investimento, tempo ou medo de não conseguir manter?",
    closing_phrase: "Vamos esclarecer isso agora para você decidir com segurança.",
    active: true,
  },
  {
    id: "seed_tentei",
    objection: "Já tentei outros cursos",
    category: "já tentei antes",
    recommended_response:
      "Isso é muito comum por aqui. A maioria dos nossos alunos chegou frustrada com cursos tradicionais. O diferencial da Space é prática real e acompanhamento próximo.",
    deepening_question: "O que faltou nos cursos anteriores para você realmente destravar?",
    closing_phrase: "Se o problema foi falta de conversação e acompanhamento, faz sentido avaliarmos um caminho diferente.",
    active: true,
  },
];

const DEFAULT_PHRASES = [
  {
    id: "seed_frase_final",
    phrase: "Seu inglês não vai mudar sozinho. Mas uma conversa de 20 minutos pode mudar completamente a velocidade da sua evolução.",
    context: "Fechamento emocional",
    stage: "fechamento",
    closer: "Space",
    usage_count: 0,
    positive_count: 0,
  },
];

const normalizeRole = (role) => String(role || "").trim().toLowerCase();

const requireGrowthAccess = (session) => {
  const role = normalizeRole(session?.role);
  if (role !== "admin" && role !== "growth") {
    const error = new Error("forbidden");
    error.status = 403;
    throw error;
  }
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const listResource = async (resource) => {
  const key = String(resource || "").trim();
  const table = COPILOT_TABLES[key];
  if (!table) {
    const error = new Error("invalid_resource");
    error.status = 400;
    throw error;
  }
  try {
    const order = key === "scripts" ? "order_index.asc" : "created_at.desc";
    const { data } = await supabaseFetch(`/${table}?select=*&order=${encodeURIComponent(order)}&limit=200`);
    return { rows: safeArray(data), fallback: false };
  } catch (error) {
    if (key === "scripts") return { rows: DEFAULT_SCRIPT_BLOCKS, fallback: true, error: error.message };
    if (key === "objections") return { rows: DEFAULT_OBJECTIONS, fallback: true, error: error.message };
    if (key === "phrases") return { rows: DEFAULT_PHRASES, fallback: true, error: error.message };
    return { rows: [], fallback: true, error: error.message };
  }
};

const saveResource = async (resource, payload = {}) => {
  const key = String(resource || "").trim();
  const table = COPILOT_TABLES[key];
  if (!["scripts", "objections", "phrases", "feedback", "suggestions", "sessions"].includes(key) || !table) {
    const error = new Error("invalid_resource");
    error.status = 400;
    throw error;
  }
  const id = String(payload.id || "").trim();
  const method = id ? "PATCH" : "POST";
  const path = id ? `/${table}?id=eq.${encodeURIComponent(id)}` : `/${table}`;
  const body = { ...payload, updated_at: new Date().toISOString() };
  if (!id) body.created_at = body.created_at || new Date().toISOString();
  delete body.id;
  const { data } = await supabaseFetch(path, { method, body: id ? body : [body] });
  return safeArray(data)[0] || null;
};

const buildCopilotSystemPrompt = () => `
Você é o copiloto de venda consultiva da Space Idiomas para closers.
Fale sempre PARA O CLOSER, nunca diretamente com o lead.
Gere sugestões curtas, naturais, práticas e prontas para o closer falar.
Siga o playbook oficial da Space e as objeções cadastradas.
Não invente dados, não prometa fluência garantida e não force fechamento sem diagnóstico.
Priorize dor, urgência, orçamento, consequência e próximo passo.
Se detectar objeção, use a resposta cadastrada mais próxima.
Se o closer pulou etapa, gere um alerta.
Retorne SOMENTE JSON válido.
`;

const callOpenAiJson = async ({ messages, fallback }) => {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return fallback;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_COPILOT_MODEL || "gpt-4o-mini",
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error?.message || "openai_failed");
    error.status = res.status;
    throw error;
  }
  const content = data?.choices?.[0]?.message?.content || "";
  try {
    return JSON.parse(content);
  } catch {
    return fallback;
  }
};

const heuristicSuggest = ({ transcript = "", objections = [] } = {}) => {
  const text = String(transcript || "").toLowerCase();
  const hasPrice = /preço|valor|custa|invest/.test(text);
  const hasTime = /tempo|corrid|agenda|ocupad/.test(text);
  const hasTried = /já tentei|outro curso|não consegui|frustr/.test(text);
  const objection = safeArray(objections).find((o) => {
    const cat = String(o.category || "").toLowerCase();
    return (hasPrice && cat.includes("preço")) || (hasTime && cat.includes("tempo")) || (hasTried && cat.includes("tentei"));
  });
  const stage = hasPrice || hasTime || hasTried ? "objeção" : text.length > 300 ? "diagnóstico" : "abertura";
  const cards = objection
    ? [
        {
          type: "resposta_objecao",
          title: `Objeção detectada: ${objection.category || "objeção"}`,
          content: objection.recommended_response,
          priority: "alta",
        },
        {
          type: "pergunta_diagnostico",
          title: "Aprofunde antes de responder tudo",
          content: objection.deepening_question,
          priority: "média",
        },
      ]
    : [
        {
          type: "pergunta_diagnostico",
          title: "Aprofunde a dor",
          content: "Entendi. E hoje, em qual situação o inglês mais te trava na prática?",
          priority: "alta",
        },
        {
          type: "aprofundar_dor",
          title: "Conecte dor com impacto",
          content: "E isso te limita mais no trabalho, na rotina, na confiança ou na comunicação do dia a dia?",
          priority: "média",
        },
      ];
  return { stage, cards };
};

const suggestWithAi = async ({ leadContext = {}, transcript = "", playbookBlocks = [], objections = [], winnerPhrases = [] } = {}) => {
  const fallback = heuristicSuggest({ transcript, objections: safeArray(objections).length ? objections : DEFAULT_OBJECTIONS });
  return callOpenAiJson({
    fallback,
    messages: [
      { role: "system", content: buildCopilotSystemPrompt() },
      {
        role: "user",
        content: JSON.stringify({
          task: "Gerar cards de sugestão para o closer agora.",
          expected_output: {
            stage: "uma etapa entre abertura, conexão, diagnóstico, dor, urgência, orçamento, apresentação da solução, objeção, fechamento, follow-up, pós-call",
            cards: [{ type: "tipo_do_card", title: "curto", content: "fala pronta para o closer", priority: "baixa|média|alta" }],
          },
          leadContext,
          transcript: String(transcript || "").slice(-6000),
          playbookBlocks: safeArray(playbookBlocks).slice(0, 30),
          objections: safeArray(objections).slice(0, 30),
          winnerPhrases: safeArray(winnerPhrases).slice(0, 20),
        }),
      },
    ],
  });
};

const summaryWithAi = async ({ leadContext = {}, transcript = "" } = {}) => {
  const fallback = {
    summary: "Resumo indisponível sem IA configurada. Revise a transcrição manualmente.",
    pain: "",
    urgency: "",
    budget: "",
    objections: [],
    recommendedPlan: "",
    nextStep: "",
    crmNotes: String(transcript || "").slice(0, 1200),
  };
  return callOpenAiJson({
    fallback,
    messages: [
      { role: "system", content: `${buildCopilotSystemPrompt()}\nResuma a call para uso interno no CRM.` },
      {
        role: "user",
        content: JSON.stringify({
          task: "Gerar resumo pós-call para o closer.",
          expected_output: {
            summary: "string",
            pain: "string",
            urgency: "string",
            budget: "string",
            objections: ["string"],
            recommendedPlan: "string",
            nextStep: "string",
            crmNotes: "string",
          },
          leadContext,
          transcript: String(transcript || "").slice(-10000),
        }),
      },
    ],
  });
};

module.exports = {
  COPILOT_TABLES,
  DEFAULT_SCRIPT_BLOCKS,
  DEFAULT_OBJECTIONS,
  DEFAULT_PHRASES,
  requireGrowthAccess,
  listResource,
  saveResource,
  suggestWithAi,
  summaryWithAi,
};
