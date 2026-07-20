const { getSessionFromRequest } = require("./session");
const { supabaseFetch } = require("./supabase-rest");

const COPILOT_TABLES = {
  scripts: "growth_sales_scripts",
  objections: "growth_sales_objections",
  phrases: "growth_winning_phrases",
  feedback: "growth_copilot_feedback",
  insights: "growth_copilot_call_insights",
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

const normalizeRole = (role) => String(role || "").trim().toLowerCase();

const requireGrowthAccess = (session) => {
  const role = normalizeRole(session?.role);
  if (!["admin", "growth", "comercial", "closer", "sales"].includes(role)) {
    const error = new Error("forbidden");
    error.status = 403;
    throw error;
  }
};

const requireGrowthAccessFromRequest = (req) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    const error = new Error("unauthorized");
    error.status = 401;
    throw error;
  }
  requireGrowthAccess(session);
  return session;
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
  if (!["scripts", "objections", "phrases", "feedback", "insights"].includes(key) || !table) {
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
  delete body.closer;
  const { data } = await supabaseFetch(path, { method, body: id ? body : [body] });
  return safeArray(data)[0] || null;
};

module.exports = {
  COPILOT_TABLES,
  DEFAULT_SCRIPT_BLOCKS,
  DEFAULT_OBJECTIONS,
  DEFAULT_PHRASES,
  requireGrowthAccess,
  requireGrowthAccessFromRequest,
  listResource,
  saveResource,
};
