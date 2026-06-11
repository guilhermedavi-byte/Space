const crypto = require("crypto");
const { getSessionFromRequest } = require("./session");
const { supabaseFetch } = require("./supabase-rest");

const COPILOT_TABLES = {
  scripts: "growth_sales_scripts",
  objections: "growth_sales_objections",
  phrases: "growth_winning_phrases",
  plans: "growth_sales_plans",
  personas: "growth_sales_personas",
  sessions: "growth_copilot_sessions",
  suggestions: "growth_copilot_suggestions",
  feedback: "growth_copilot_feedback",
};

const DEFAULT_SCRIPT_BLOCKS = [
  {
    id: "seed_abertura",
    name: "Primeiro contato / abertura da call",
    type: "abertura",
    content:
      "Olá, [Nome do Lead]! Vi que você se interessou em destravar o seu inglês com a Space. Me conta, qual o seu maior desafio com o idioma aí no exterior? É mais para o trabalho, para o dia a dia ou para os estudos? Assim, já consigo te mostrar o caminho mais rápido para você alcançar a sua meta.",
    examples: "Use para abrir a call com diagnóstico, sem despejar oferta.",
    when_to_use: "Primeiro contato ou início da call.",
    avoid: "Falar de preço cedo, despejar informações ou apresentar plano antes de entender o objetivo.",
    active: true,
    order_index: 1,
  },
  {
    id: "seed_diagnostico",
    name: "Qualificação do objetivo",
    type: "diagnostico",
    content: "Qual seu objetivo principal com o inglês? Em quanto tempo você gostaria de atingir esse resultado? Você prefere uma experiência em grupo ou acompanhamento individual?",
    examples: "Entender objetivo, prazo, preferência, rotina e urgência antes de recomendar.",
    when_to_use: "Antes da apresentação do plano.",
    avoid: "Recomendar plano sem entender objetivo, urgência e preferência.",
    active: true,
    order_index: 2,
  },
  {
    id: "seed_apresentacao",
    name: "Apresentação personalizada do plano",
    type: "apresentacao",
    content: "Com base no que você me disse, [Nome], acredito que o plano [Nome do Plano] é o ideal para você. Com ele, você terá [principais benefícios do plano], o que vai te ajudar a [solução para a dor do lead].",
    examples: "Conecte o plano recomendado à dor e ao objetivo do lead.",
    when_to_use: "Depois de identificar perfil, dor, objetivo e disponibilidade.",
    avoid: "Apresentar todos os planos de forma genérica sem recomendação clara.",
    active: true,
    order_index: 3,
  },
  {
    id: "seed_metodo_tradicional",
    name: "Posicionamento contra método tradicional",
    type: "valor",
    content: "Diferente dos métodos tradicionais, aqui você não precisa se adaptar a uma turma engessada. O plano se adapta a você, ao seu objetivo, à sua rotina e ao ritmo que você precisa evoluir.",
    examples: "Use quando o lead mostrar frustração com outros cursos.",
    when_to_use: "Quando o lead mostrar frustração com outros cursos ou medo de não evoluir.",
    avoid: "Criticar concorrente de forma direta ou prometer resultado impossível.",
    active: true,
    order_index: 4,
  },
  {
    id: "seed_tecnologia",
    name: "Tecnologia e acompanhamento",
    type: "valor",
    content: "A Space une aula ao vivo, prática real, aplicativo exclusivo, relatórios semanais com IA e suporte próximo. Isso permite que você acompanhe sua evolução de forma clara e tenha direção durante todo o processo.",
    examples: "Conectar tecnologia com benefício real: clareza, direção e acompanhamento.",
    when_to_use: "Quando o lead precisa entender diferenciais ou justificar valor.",
    avoid: "Ficar técnico demais.",
    active: true,
    order_index: 5,
  },
  {
    id: "seed_fechamento",
    name: "Fechamento consultivo",
    type: "fechamento",
    content: "Pelo que conversamos, [Nome], o plano [Nome do Plano] é o que melhor vai te atender. Para te ajudar a dar esse passo importante, consigo uma condição especial para você se matricular hoje. Vamos começar a sua jornada rumo à fluência?",
    examples: "Fechar depois de diagnóstico, valor construído e objeções tratadas.",
    when_to_use: "Após apresentação, valor construído e objeções tratadas.",
    avoid: "Fechar sem diagnóstico ou sem plano recomendado.",
    active: true,
    order_index: 6,
  },
  {
    id: "seed_urgencia",
    name: "Urgência e condição especial",
    type: "fechamento",
    content: "Quanto mais você adia, mais tempo continua limitado pelo inglês nas situações que você mesmo me contou. Se faz sentido para você, o melhor momento para começar é agora, aproveitando essa condição.",
    examples: "Use quando existe dor clara e indecisão.",
    when_to_use: "Quando há dor clara e indecisão.",
    avoid: "Pressão agressiva ou manipulação.",
    active: true,
    order_index: 7,
  },
  {
    id: "seed_pos_venda",
    name: "Onboarding após fechamento",
    type: "pos_venda",
    content: "Perfeito, [Nome]. Agora vamos seguir com sua matrícula, acesso à plataforma, onboarding e próximos passos para você começar sua jornada da forma mais organizada possível.",
    examples: "Dar clareza sobre próximos passos.",
    when_to_use: "Após fechamento.",
    avoid: "Deixar aluno sem clareza sobre próximos passos.",
    active: true,
    order_index: 8,
  },
];

const DEFAULT_OBJECTIONS = [
  {
    id: "seed_preco",
    objection: "Está caro.",
    category: "preco",
    recommended_response:
      "Eu entendo sua preocupação com o investimento, [Nome]. Mas pensa no quanto você já perdeu ou pode perder por não ter um inglês fluente. Nossos alunos costumam dizer que o investimento se paga com as novas oportunidades que surgem. Além disso, aqui você tem um método personalizado, acompanhamento próximo e uma estrutura feita para gerar evolução real.",
    deepening_question: "Hoje sua preocupação é o valor em si ou o medo de investir e não ter resultado como em experiências anteriores?",
    closing_phrase: "Se o inglês hoje impacta sua carreira, rotina ou oportunidades, faz sentido tratar isso como investimento, não como gasto.",
    active: true,
  },
  {
    id: "seed_tempo",
    objection: "Estou sem tempo",
    category: "tempo",
    recommended_response:
      "Essa é a realidade da maioria dos nossos alunos, e é por isso que a metodologia da Space é tão flexível. Com reposição de aulas, acompanhamento e acesso ao aplicativo, você consegue estudar dentro da sua rotina.",
    deepening_question: "Hoje o problema é falta total de tempo ou falta de uma estrutura que se encaixe na sua agenda?",
    closing_phrase: "O plano certo justamente precisa ser montado ao redor da sua rotina, não o contrário.",
    active: true,
  },
  {
    id: "seed_tentei",
    objection: "Já tentei antes e não funcionou.",
    category: "frustracao",
    recommended_response:
      "Isso acontece muito. Mas normalmente o problema não é sua capacidade, e sim o método. Você provavelmente seguiu um modelo único, engessado. Na Space, o plano é 100% feito para você, com foco em prática real, acompanhamento e evolução clara.",
    deepening_question: "O que mais te travou nas outras experiências: falta de conversação, falta de acompanhamento ou sentir que não saía do lugar?",
    closing_phrase: "Então o ponto não é tentar mais do mesmo. É testar um modelo diferente.",
    active: true,
  },
  {
    id: "seed_esperar",
    objection: "Prefiro esperar mais um pouco.",
    category: "indecisao",
    recommended_response:
      "Entendo. Só que cada mês que passa é mais um mês em que o inglês continua limitando sua rotina, carreira ou confiança. Se isso já está te incomodando agora, talvez esperar só prolongue o problema.",
    deepening_question: "O que exatamente você sente que precisa acontecer para esse se tornar o momento certo?",
    closing_phrase: "Se a dor já existe, o melhor caminho é começar com uma estrutura que te ajude a evoluir agora.",
    active: true,
  },
  {
    id: "seed_inseguranca",
    objection: "Tenho insegurança / medo de não conseguir.",
    category: "inseguranca",
    recommended_response:
      "Isso é muito comum. Por isso o acompanhamento individual ajuda tanto. Você não fica sozinho tentando se virar. O professor e a estrutura da Space acompanham sua evolução, ajustam o ritmo e te ajudam a destravar aos poucos.",
    deepening_question: "Sua insegurança é mais com falar em voz alta, errar ou achar que não vai conseguir manter constância?",
    closing_phrase: "Justamente por isso faz sentido começar com acompanhamento, não sozinho.",
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

const DEFAULT_PLANS = [
  {
    id: "seed_turma",
    name: "Turma",
    description: "4 aulas em grupo por semana, suporte 24h e relatório semanal de desempenho.",
    price: "R$ 490/mês",
    ideal_for: "Quem busca bom custo-benefício para iniciar a jornada.",
    benefits: "Aulas em grupo, suporte 24h e relatório semanal de desempenho.",
    recommended_when: "Preço é prioridade, aluno quer entrada mais acessível ou ainda não precisa de acompanhamento máximo.",
    active: true,
  },
  {
    id: "seed_gold",
    name: "Gold",
    description: "3 mentorias individuais por semana, 1 aula de conversação em grupo por semana, acesso vitalício ao grupo de conversação, acesso ilimitado ao app e suporte 24h.",
    price: "R$ 1.190/mês",
    ideal_for: "Profissionais que precisam de resultados rápidos para carreira.",
    benefits: "Mentorias individuais, conversação em grupo, app ilimitado, suporte 24h e acesso vitalício às conversações.",
    recommended_when: "Aluno busca evolução rápida, tem objetivo profissional, precisa de acompanhamento individual e quer equilíbrio entre resultado e investimento.",
    active: true,
  },
  {
    id: "seed_diamond",
    name: "Diamond",
    description: "5 mentorias individuais por semana, 1 aula de conversação em grupo por semana vitalícia, acesso ilimitado ao app, suporte 24h, flexibilidade total de horários e reposição ilimitada.",
    price: "R$ 1.490/mês",
    ideal_for: "Executivos e empreendedores que exigem máxima performance e flexibilidade.",
    benefits: "Alta frequência individual, flexibilidade total, reposição ilimitada, app ilimitado e suporte 24h.",
    recommended_when: "Aluno tem urgência, agenda instável, alto valor percebido, precisa de flexibilidade máxima ou quer performance acelerada.",
    active: true,
  },
];

const DEFAULT_PERSONAS = [
  {
    id: "seed_universitario",
    name: "Universitário / Jovem Profissional",
    age_range: "18-28 anos",
    profile: "Jovem buscando intercâmbio, estágio, viagens ou empregabilidade.",
    goals: "Intercâmbio, estágio, viagens e empregabilidade.",
    pains: "Cursos lentos, falta de conversação real e preço.",
    recommended_plan: "Turma ou Gold",
    active: true,
  },
  {
    id: "seed_profissional",
    name: "Profissional de Carreira",
    age_range: "28-40 anos",
    profile: "Profissional que precisa do inglês para crescer na carreira.",
    goals: "Promoção, entrevistas e reuniões internacionais.",
    pains: "Falta de tempo e urgência em aprender.",
    recommended_plan: "Gold",
    active: true,
  },
  {
    id: "seed_executivo",
    name: "Executivo / Empreendedor",
    age_range: "35-55 anos",
    profile: "Pessoa com agenda instável e alto valor de tempo.",
    goals: "Negócios globais, viagens de trabalho e performance.",
    pains: "Não pode perder tempo e exige flexibilidade total.",
    recommended_plan: "Diamond",
    active: true,
  },
  {
    id: "seed_pais",
    name: "Pais de adolescentes",
    age_range: "35-50 anos",
    profile: "Responsáveis buscando inglês para o futuro dos filhos.",
    goals: "Garantir fluência futura dos filhos.",
    pains: "Desconfiança com métodos tradicionais.",
    recommended_plan: "Turma",
    active: true,
  },
  {
    id: "seed_exterior",
    name: "Brasileiro no Exterior",
    age_range: "",
    profile: "Brasileiro(a) que reside em país de língua inglesa e precisa do idioma para rotina, trabalho, estudos ou integração.",
    goals: "Fluência, confiança, independência, oportunidades profissionais e integração cultural.",
    pains: "Dificuldade de comunicação no dia a dia, insegurança profissional, isolamento social, frustração com métodos tradicionais e dificuldade por fuso/rotina.",
    recommended_plan: "Gold ou Diamond",
    active: true,
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

const verifyCopilotToken = (token) => {
  const raw = String(token || "").trim();
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const secret = String(process.env.SPACE_AUTH_SECRET || "space_dev_secret_change_me_please");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (Buffer.byteLength(sig) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);
  if (payload.scope !== "growth_sales_copilot" || Number(payload.exp || 0) < now) return null;
  requireGrowthAccess(payload);
  return payload;
};

const requireGrowthAccessFromRequest = (req) => {
  const session = getSessionFromRequest(req);
  if (session) {
    requireGrowthAccess(session);
    return session;
  }
  const token = req?.headers?.["x-copilot-token"];
  const payload = verifyCopilotToken(Array.isArray(token) ? token[0] : token);
  if (!payload) {
    const error = new Error("unauthorized");
    error.status = 401;
    throw error;
  }
  return payload;
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const recommendPlan = ({ transcript = "", leadContext = {} } = {}) => {
  const text = `${Object.values(leadContext || {}).join(" ")} ${transcript}`.toLowerCase();
  if (/executiv|empreendedor|ceo|diretor|urgent|urgência|urgencia|imediat|agenda instável|agenda instavel|flexibilidade máxima|flexibilidade maxima|reposição ilimitada|reposicao ilimitada/.test(text)) {
    return {
      name: "Diamond",
      reason: "perfil com urgência, agenda instável ou necessidade de flexibilidade máxima",
    };
  }
  if (/preço|preco|barat|custo|valor|orçamento baixo|orcamento baixo|mais acessível|mais acessivel/.test(text)) {
    return {
      name: "Turma",
      reason: "preço aparece como prioridade ou o lead precisa de uma entrada mais acessível",
    };
  }
  if (/carreira|promoção|promocao|entrevista|reunião internacional|reuniao internacional|trabalho|profissional|rápid|rapid|insegur|medo|acompanhamento/.test(text)) {
    return {
      name: "Gold",
      reason: "objetivo profissional, evolução rápida ou necessidade de acompanhamento próximo",
    };
  }
  if (/filh|adolescente|pais/.test(text)) {
    return {
      name: "Turma",
      reason: "pais de adolescentes costumam entrar melhor pelo plano Turma, com possibilidade de upsell",
    };
  }
  return {
    name: "Gold",
    reason: "melhor equilíbrio padrão entre acompanhamento individual, resultado e investimento",
  };
};

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
    if (key === "plans") return { rows: DEFAULT_PLANS, fallback: true, error: error.message };
    if (key === "personas") return { rows: DEFAULT_PERSONAS, fallback: true, error: error.message };
    return { rows: [], fallback: true, error: error.message };
  }
};

const saveResource = async (resource, payload = {}) => {
  const key = String(resource || "").trim();
  const table = COPILOT_TABLES[key];
  if (!["scripts", "objections", "phrases", "plans", "personas", "feedback", "suggestions", "sessions"].includes(key) || !table) {
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
Este é um Copilot para CLOSER/VENDEDOR, não SDR.
Fale sempre PARA O CLOSER, nunca diretamente com o lead.
Gere sugestões curtas, naturais, práticas e prontas para o closer falar.
Siga o playbook oficial da Space, os planos oficiais e as objeções cadastradas.
Sempre parta do diagnóstico antes de sugerir fechamento.
Recomende Turma, Gold ou Diamond com base no perfil.
Se preço for prioridade, tenda a Turma.
Se objetivo for carreira ou evolução rápida, tenda a Gold.
Se urgência, executivo, empreendedor ou flexibilidade máxima aparecerem, tenda a Diamond.
Se insegurança for grande, priorize Gold ou Diamond por acompanhamento mais próximo.
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
  const plan = recommendPlan({ transcript });
  cards.push({
    type: "recomendacao_plano",
    title: `Plano provável: ${plan.name}`,
    content: `Se o diagnóstico confirmar, direcione para o ${plan.name}: ${plan.reason}. Não apresente como definitivo antes de validar objetivo, rotina e orçamento.`,
    priority: "média",
  });
  return { stage, cards };
};

const suggestWithAi = async ({ leadContext = {}, transcript = "", playbookBlocks = [], objections = [], winnerPhrases = [], plans = [], personas = [] } = {}) => {
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
          plans: (safeArray(plans).length ? safeArray(plans) : DEFAULT_PLANS).slice(0, 10),
          personas: (safeArray(personas).length ? safeArray(personas) : DEFAULT_PERSONAS).slice(0, 10),
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
  DEFAULT_PLANS,
  DEFAULT_PERSONAS,
  requireGrowthAccess,
  requireGrowthAccessFromRequest,
  recommendPlan,
  listResource,
  saveResource,
  suggestWithAi,
  summaryWithAi,
};
