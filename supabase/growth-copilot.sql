create extension if not exists pgcrypto;

create table if not exists public.growth_sales_scripts (
  id uuid primary key default gen_random_uuid(),
  title text,
  stage text,
  name text,
  type text,
  content text not null,
  examples text,
  when_to_use text,
  what_to_avoid text,
  avoid text,
  order_index integer default 0,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.growth_sales_scripts add column if not exists title text;
alter table public.growth_sales_scripts add column if not exists stage text;
alter table public.growth_sales_scripts add column if not exists name text;
alter table public.growth_sales_scripts add column if not exists type text;
alter table public.growth_sales_scripts add column if not exists what_to_avoid text;
alter table public.growth_sales_scripts add column if not exists avoid text;
alter table public.growth_sales_scripts add column if not exists order_index integer default 0;
alter table public.growth_sales_scripts add column if not exists active boolean default true;
alter table public.growth_sales_scripts add column if not exists created_at timestamptz default now();
alter table public.growth_sales_scripts add column if not exists updated_at timestamptz default now();

update public.growth_sales_scripts set title = coalesce(title, name), stage = coalesce(stage, type), name = coalesce(name, title), type = coalesce(type, stage), avoid = coalesce(avoid, what_to_avoid), what_to_avoid = coalesce(what_to_avoid, avoid);

create table if not exists public.growth_sales_objections (
  id uuid primary key default gen_random_uuid(),
  objection text not null,
  category text not null,
  recommended_response text not null,
  deepening_question text,
  closing_phrase text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


create table if not exists public.growth_winning_phrases (
  id uuid primary key default gen_random_uuid(),
  phrase text not null,
  context text,
  stage text,
  source text,
  closer_name text,
  usage_count integer default 0,
  positive_feedback_count integer default 0,
  positive_count integer default 0,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.growth_winning_phrases add column if not exists source text;
alter table public.growth_winning_phrases add column if not exists closer_name text;
alter table public.growth_winning_phrases add column if not exists positive_feedback_count integer default 0;
alter table public.growth_winning_phrases add column if not exists positive_count integer default 0;
alter table public.growth_winning_phrases add column if not exists active boolean default true;

create table if not exists public.growth_sales_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price text,
  ideal_for text,
  benefits text,
  recommended_when text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


create table if not exists public.growth_sales_personas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age_range text,
  profile text,
  goals text,
  pains text,
  recommended_plan text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


create table if not exists public.growth_copilot_sessions (
  id uuid primary key default gen_random_uuid(),
  lead_context jsonb default '{}'::jsonb,
  transcript text,
  summary jsonb default '{}'::jsonb,
  closer_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.growth_copilot_suggestions (
  id uuid primary key default gen_random_uuid(),
  lead_name text,
  closer_name text,
  stage text,
  cards jsonb default '[]'::jsonb,
  transcript_tail text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.growth_copilot_feedback (
  id uuid primary key default gen_random_uuid(),
  suggestion jsonb default '{}'::jsonb,
  feedback text not null,
  used_in_call boolean default false,
  saved_to_playbook boolean default false,
  closer_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

delete from public.growth_sales_plans
where name in ('Turma', 'Gold', 'Diamond');

delete from public.growth_sales_personas
where name in (
  'Universitário / Jovem Profissional',
  'Profissional de Carreira',
  'Executivo / Empreendedor',
  'Pais de adolescentes',
  'Brasileiro no Exterior'
);

delete from public.growth_sales_scripts
where title in (
  'Primeiro contato / abertura da call',
  'Qualificação do objetivo',
  'Apresentação personalizada do plano',
  'Posicionamento contra método tradicional',
  'Tecnologia e acompanhamento',
  'Fechamento consultivo',
  'Urgência e condição especial',
  'Onboarding após fechamento'
)
or name in (
  'Primeiro contato / abertura da call',
  'Qualificação do objetivo',
  'Apresentação personalizada do plano',
  'Posicionamento contra método tradicional',
  'Tecnologia e acompanhamento',
  'Fechamento consultivo',
  'Urgência e condição especial',
  'Onboarding após fechamento'
);

delete from public.growth_sales_objections
where objection in (
  'Está caro.',
  'Não tenho tempo.',
  'Já tentei antes e não funcionou.',
  'Prefiro esperar mais um pouco.',
  'Tenho insegurança / medo de não conseguir.'
);

delete from public.growth_winning_phrases
where phrase in (
  'Você não precisa se adaptar à turma. O curso se adapta a você.',
  'Aqui, você fala desde o primeiro dia.',
  'Relatórios de IA mostram sua evolução semanal de forma concreta.',
  'Suporte 24h: você nunca está sozinho.',
  'Acesso vitalício às conversações: fluência não se esquece.',
  'Aqui você paga por resultado, não por anos preso em uma turma sem evolução.',
  'Flexibilidade e reposição ilimitada garantem que sua agenda não seja problema.',
  'Nosso app e relatórios semanais mostram sua evolução com clareza.'
);

insert into public.growth_sales_plans (name, description, price, ideal_for, benefits, recommended_when, active, updated_at)
values
  ('Turma', '4 aulas em grupo por semana, suporte 24h e relatório semanal de desempenho.', 'R$ 490/mês', 'Quem busca bom custo-benefício para iniciar a jornada.', 'Aulas em grupo, suporte 24h e relatório semanal de desempenho.', 'Preço é prioridade, aluno quer entrada mais acessível ou ainda não precisa de acompanhamento máximo.', true, now()),
  ('Gold', '3 mentorias individuais por semana, 1 aula de conversação em grupo por semana, acesso vitalício ao grupo de conversação, acesso ilimitado ao app e suporte 24h.', 'R$ 1.190/mês', 'Profissionais que precisam de resultados rápidos para carreira.', 'Mentorias individuais, conversação em grupo, app ilimitado, suporte 24h e acesso vitalício às conversações.', 'Aluno busca evolução rápida, tem objetivo profissional, precisa de acompanhamento individual e quer equilíbrio entre resultado e investimento.', true, now()),
  ('Diamond', '5 mentorias individuais por semana, 1 aula de conversação em grupo por semana vitalícia, acesso ilimitado ao app, suporte 24h, flexibilidade total de horários e reposição ilimitada.', 'R$ 1.490/mês', 'Executivos e empreendedores que exigem máxima performance e flexibilidade.', 'Alta frequência individual, flexibilidade total, reposição ilimitada, app ilimitado e suporte 24h.', 'Aluno tem urgência, agenda instável, alto valor percebido, precisa de flexibilidade máxima ou quer performance acelerada.', true, now());

insert into public.growth_sales_personas (name, age_range, profile, goals, pains, recommended_plan, active, updated_at)
values
  ('Universitário / Jovem Profissional', '18-28 anos', 'Jovem buscando intercâmbio, estágio, viagens ou empregabilidade.', 'Intercâmbio, estágio, viagens e empregabilidade.', 'Cursos lentos, falta de conversação real e preço.', 'Turma ou Gold', true, now()),
  ('Profissional de Carreira', '28-40 anos', 'Profissional que precisa do inglês para crescer na carreira.', 'Promoção, entrevistas e reuniões internacionais.', 'Falta de tempo e urgência em aprender.', 'Gold', true, now()),
  ('Executivo / Empreendedor', '35-55 anos', 'Pessoa com agenda instável e alto valor de tempo.', 'Negócios globais, viagens de trabalho e performance.', 'Não pode perder tempo e exige flexibilidade total.', 'Diamond', true, now()),
  ('Pais de adolescentes', '35-50 anos', 'Responsáveis buscando inglês para o futuro dos filhos.', 'Garantir fluência futura dos filhos.', 'Desconfiança com métodos tradicionais.', 'Turma', true, now()),
  ('Brasileiro no Exterior', '', 'Brasileiro(a) que reside em país de língua inglesa e precisa do idioma para rotina, trabalho, estudos ou integração.', 'Fluência, confiança, independência, oportunidades profissionais e integração cultural.', 'Dificuldade de comunicação no dia a dia, insegurança profissional, isolamento social, frustração com métodos tradicionais e dificuldade por fuso/rotina.', 'Gold ou Diamond', true, now());

insert into public.growth_sales_scripts (title, stage, name, type, content, examples, when_to_use, what_to_avoid, avoid, order_index, active, updated_at)
values
  ('Primeiro contato / abertura da call', 'abertura', 'Primeiro contato / abertura da call', 'abertura', 'Olá, [Nome do Lead]! Vi que você se interessou em destravar o seu inglês com a Space. Me conta, qual o seu maior desafio com o idioma aí no exterior? É mais para o trabalho, para o dia a dia ou para os estudos? Assim, já consigo te mostrar o caminho mais rápido para você alcançar a sua meta.', 'Use para abrir a call com diagnóstico, sem despejar oferta.', 'Início da conversa ou abertura da call.', 'Falar de preço cedo, despejar informações ou apresentar plano antes de entender o objetivo.', 'Falar de preço cedo, despejar informações ou apresentar plano antes de entender o objetivo.', 1, true, now()),
  ('Qualificação do objetivo', 'diagnostico', 'Qualificação do objetivo', 'diagnostico', 'Qual seu objetivo principal com o inglês? Em quanto tempo você gostaria de atingir esse resultado? Você prefere uma experiência em grupo ou acompanhamento individual?', 'Entender objetivo, prazo, preferência, rotina e urgência antes de recomendar.', 'Antes da apresentação do plano.', 'Recomendar plano sem entender objetivo, urgência e preferência.', 'Recomendar plano sem entender objetivo, urgência e preferência.', 2, true, now()),
  ('Apresentação personalizada do plano', 'apresentacao', 'Apresentação personalizada do plano', 'apresentacao', 'Com base no que você me disse, [Nome], acredito que o plano [Nome do Plano] é o ideal para você. Com ele, você terá [principais benefícios do plano], o que vai te ajudar a [solução para a dor do lead].', 'Conecte o plano recomendado à dor e ao objetivo do lead.', 'Depois de identificar perfil, dor, objetivo e disponibilidade.', 'Apresentar todos os planos de forma genérica sem recomendação clara.', 'Apresentar todos os planos de forma genérica sem recomendação clara.', 3, true, now()),
  ('Posicionamento contra método tradicional', 'valor', 'Posicionamento contra método tradicional', 'valor', 'Diferente dos métodos tradicionais, aqui você não precisa se adaptar a uma turma engessada. O plano se adapta a você, ao seu objetivo, à sua rotina e ao ritmo que você precisa evoluir.', 'Use quando o lead mostrar frustração com outros cursos.', 'Quando o lead mostrar frustração com outros cursos ou medo de não evoluir.', 'Criticar concorrente de forma direta ou prometer resultado impossível.', 'Criticar concorrente de forma direta ou prometer resultado impossível.', 4, true, now()),
  ('Tecnologia e acompanhamento', 'valor', 'Tecnologia e acompanhamento', 'valor', 'A Space une aula ao vivo, prática real, aplicativo exclusivo, relatórios semanais com IA e suporte próximo. Isso permite que você acompanhe sua evolução de forma clara e tenha direção durante todo o processo.', 'Conectar tecnologia com benefício real: clareza, direção e acompanhamento.', 'Quando o lead precisa entender diferenciais ou justificar valor.', 'Ficar técnico demais. Conectar tecnologia com benefício real.', 'Ficar técnico demais. Conectar tecnologia com benefício real.', 5, true, now()),
  ('Fechamento consultivo', 'fechamento', 'Fechamento consultivo', 'fechamento', 'Pelo que conversamos, [Nome], o plano [Nome do Plano] é o que melhor vai te atender. Para te ajudar a dar esse passo importante, consigo uma condição especial para você se matricular hoje. Vamos começar a sua jornada rumo à fluência?', 'Fechar depois de diagnóstico, valor construído e objeções tratadas.', 'Após apresentação, valor construído e objeções tratadas.', 'Fechar sem diagnóstico ou sem plano recomendado.', 'Fechar sem diagnóstico ou sem plano recomendado.', 6, true, now()),
  ('Urgência e condição especial', 'fechamento', 'Urgência e condição especial', 'fechamento', 'Quanto mais você adia, mais tempo continua limitado pelo inglês nas situações que você mesmo me contou. Se faz sentido para você, o melhor momento para começar é agora, aproveitando essa condição.', 'Use quando existe dor clara e indecisão.', 'Quando há dor clara e indecisão.', 'Pressão agressiva ou manipulação.', 'Pressão agressiva ou manipulação.', 7, true, now()),
  ('Onboarding após fechamento', 'pos_venda', 'Onboarding após fechamento', 'pos_venda', 'Perfeito, [Nome]. Agora vamos seguir com sua matrícula, acesso à plataforma, onboarding e próximos passos para você começar sua jornada da forma mais organizada possível.', 'Dar clareza sobre próximos passos.', 'Após fechamento.', 'Deixar aluno sem clareza sobre próximos passos.', 'Deixar aluno sem clareza sobre próximos passos.', 8, true, now());

insert into public.growth_sales_objections (objection, category, recommended_response, deepening_question, closing_phrase, active, updated_at)
values
  ('Está caro.', 'preco', 'Eu entendo sua preocupação com o investimento, [Nome]. Mas pensa no quanto você já perdeu ou pode perder por não ter um inglês fluente. Nossos alunos costumam dizer que o investimento se paga com as novas oportunidades que surgem. Além disso, aqui você tem um método personalizado, acompanhamento próximo e uma estrutura feita para gerar evolução real.', 'Hoje sua preocupação é o valor em si ou o medo de investir e não ter resultado como em experiências anteriores?', 'Se o inglês hoje impacta sua carreira, rotina ou oportunidades, faz sentido tratar isso como investimento, não como gasto.', true, now()),
  ('Não tenho tempo.', 'tempo', 'Essa é a realidade da maioria dos nossos alunos, e é por isso que a metodologia da Space é tão flexível. Com reposição de aulas, acompanhamento e acesso ao aplicativo, você consegue estudar dentro da sua rotina.', 'Hoje o problema é falta total de tempo ou falta de uma estrutura que se encaixe na sua agenda?', 'O plano certo justamente precisa ser montado ao redor da sua rotina, não o contrário.', true, now()),
  ('Já tentei antes e não funcionou.', 'frustracao', 'Isso acontece muito. Mas normalmente o problema não é sua capacidade, e sim o método. Você provavelmente seguiu um modelo único, engessado. Na Space, o plano é 100% feito para você, com foco em prática real, acompanhamento e evolução clara.', 'O que mais te travou nas outras experiências: falta de conversação, falta de acompanhamento ou sentir que não saía do lugar?', 'Então o ponto não é tentar mais do mesmo. É testar um modelo diferente.', true, now()),
  ('Prefiro esperar mais um pouco.', 'indecisao', 'Entendo. Só que cada mês que passa é mais um mês em que o inglês continua limitando sua rotina, carreira ou confiança. Se isso já está te incomodando agora, talvez esperar só prolongue o problema.', 'O que exatamente você sente que precisa acontecer para esse se tornar o momento certo?', 'Se a dor já existe, o melhor caminho é começar com uma estrutura que te ajude a evoluir agora.', true, now()),
  ('Tenho insegurança / medo de não conseguir.', 'inseguranca', 'Isso é muito comum. Por isso o acompanhamento individual ajuda tanto. Você não fica sozinho tentando se virar. O professor e a estrutura da Space acompanham sua evolução, ajustam o ritmo e te ajudam a destravar aos poucos.', 'Sua insegurança é mais com falar em voz alta, errar ou achar que não vai conseguir manter constância?', 'Justamente por isso faz sentido começar com acompanhamento, não sozinho.', true, now());

insert into public.growth_winning_phrases (phrase, context, stage, source, usage_count, positive_feedback_count, positive_count, active, updated_at)
values
  ('Você não precisa se adaptar à turma. O curso se adapta a você.', 'Personalização e comparação com método tradicional.', 'valor', 'playbook_oficial_space', 0, 0, 0, true, now()),
  ('Aqui, você fala desde o primeiro dia.', 'Conversação real.', 'valor', 'playbook_oficial_space', 0, 0, 0, true, now()),
  ('Relatórios de IA mostram sua evolução semanal de forma concreta.', 'Tecnologia e acompanhamento.', 'valor', 'playbook_oficial_space', 0, 0, 0, true, now()),
  ('Suporte 24h: você nunca está sozinho.', 'Acompanhamento e segurança.', 'valor', 'playbook_oficial_space', 0, 0, 0, true, now()),
  ('Acesso vitalício às conversações: fluência não se esquece.', 'Diferencial e retenção.', 'valor', 'playbook_oficial_space', 0, 0, 0, true, now()),
  ('Aqui você paga por resultado, não por anos preso em uma turma sem evolução.', 'Objeção de preço.', 'objecao', 'playbook_oficial_space', 0, 0, 0, true, now()),
  ('Flexibilidade e reposição ilimitada garantem que sua agenda não seja problema.', 'Objeção de tempo.', 'objecao', 'playbook_oficial_space', 0, 0, 0, true, now()),
  ('Nosso app e relatórios semanais mostram sua evolução com clareza.', 'Objeção de insegurança.', 'objecao', 'playbook_oficial_space', 0, 0, 0, true, now());
