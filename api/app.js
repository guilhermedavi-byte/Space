const fs = require("fs");
const path = require("path");

const { getSessionFromRequest } = require("../_lib/session");
const { getDocumentAsAdmin } = require("./_lib/firestore-admin");
const {
  ADMIN_PERMISSION_REGISTRY,
  adminAccessPayloadForUser,
  canAdminAccess,
  firstAllowedAdminRoute,
  permissionForAdminPanel,
} = require("./_lib/admin-permissions");
const { isUserActive } = require("../_lib/user-status");
const { normalizeCommercialRoles, normalizePlatformRole } = require("./_lib/commercial-permissions");

const ROLE_TO_SLUG = {
  student: "aluno",
  teacher: "professor",
  admin: "admin",
  FINANCE: "financeiro",
  growth: "growth",
};

const slugToRole = (slug) => {
  const raw = String(slug || "").trim().toLowerCase();
  if (raw === "aluno") return "student";
  if (raw === "professor") return "teacher";
  if (raw === "admin") return "admin";
  if (raw === "financeiro") return "FINANCE";
  if (raw === "growth") return "growth";
  return "";
};

const roleToBasePath = (role) => {
  if (String(role || "").trim().toLowerCase() === "growth") return "/app/growth/dashboard";
  if (String(role || "").trim() === "FINANCE" || String(role || "").trim().toLowerCase() === "finance") return "/app/financeiro";
  const slug = ROLE_TO_SLUG[String(role || "")] || ROLE_TO_SLUG.student;
  return `/app/${slug}`;
};

const sendRedirect = (res, location) => {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end("");
};

const safeJsonForHtml = (value) => {
  // Prevent `</script>` injection when embedding JSON in HTML.
  return JSON.stringify(value ?? {}).replace(/</g, "\\u003c");
};

const loadTemplate = () => {
  const templatePath = path.join(__dirname, "_templates", "app.html");
  return fs.readFileSync(templatePath, "utf8");
};

const routeStateFromPath = (pathParam, searchParams = new URLSearchParams()) => {
  const segments = String(pathParam || "").split("/").filter(Boolean);
  const slug = segments[0] || "";
  const sub = segments[1] || "";
  if (["admin", "growth"].includes(slug) && sub === "atendimento") {
    if (segments[2] === "conexoes") return { panel: "attendance-connections" };
    return { panel: "attendance-inbox" };
  }
  if (slug === "admin" && sub === "atividades") return { panel: "activities" };
  if (slug === "admin" && (sub === "notificacoes" || sub === "notifications")) return { panel: "notifications" };
  if (slug === "professor" && (sub === "notificacoes" || sub === "notifications")) return { panel: "notifications" };
  if (slug === "professor" && sub === "atividades") return { panel: "activities" };
  if (slug === "admin" && sub === "sdr") return { panel: "admin-sdr" };
  if (slug === "financeiro" && (sub === "notificacoes" || sub === "notifications")) return { panel: "notifications" };
  if (slug === "financeiro") return { panel: "financeiro" };
  if (slug === "admin" && sub === "space-office") return { panel: "space-office" };
  if (slug === "admin" && sub === "status") return { panel: "configuracoes-admin", settingsSection: "status" };
  if (slug === "admin" && sub === "financeiro") {
    const financeMap = { recebiveis: "recebiveis", assinaturas: "assinaturas", clientes: "clientes", recuperacao: "recuperacao", pendencias: "pendencias", fechamento: "fechamento" };
    return { panel: "financeiro", financeTab: financeMap[String(searchParams.get("aba") || "")] || "overview" };
  }
  if (slug === "admin" && sub === "automacoes") return { panel: "automations" };
  if (slug === "admin" && sub === "comercial") {
    if (segments[2] === "crm") return { panel: "native-crm" };
    if (segments[2] === "pre-vendas" && segments[3] === "ligacoes") return { panel: "space-phone" };
    if (segments[2] === "pre-vendas" && segments[3] === "painel-sdr") return { panel: "admin-sdr" };
    if (segments[2] === "pre-vendas" || segments[2] === "atividade-sdr") return { panel: "admin-comercial-atividade-sdr" };
    if (segments[2] === "metas") return { panel: "admin-comercial-metas" };
    if (segments[2] === "usuarios") return { panel: "admin-comercial-usuarios" };
    return { panel: "admin-comercial-visao-geral" };
  }
  if (slug === "growth") {
    if (sub === "comercial") {
      if (segments[2] === "crm") return { panel: "native-crm" };
      if (segments[2] === "pre-vendas" && segments[3] === "ligacoes") return { panel: "space-phone" };
      if (segments[2] === "pre-vendas" && segments[3] === "painel-sdr") return { panel: "admin-sdr" };
      if (["painel-sdr", "scripts-vendas", "objecoes", "training"].includes(segments[2])) return { panel: segments[2] === "painel-sdr" ? "admin-sdr" : "growth" };
      return { panel: "growth-dashboard" };
    }
    if (sub === "crm") return { panel: "native-crm" };
    if (sub === "activities" || sub === "atividades") return { panel: "activities" };
    if (sub === "notificacoes" || sub === "notifications") return { panel: "notifications" };
    if (sub === "sdr" || sub === "scripts-vendas" || sub === "objecoes" || sub === "training") return { panel: "growth" };
    return { panel: "growth-dashboard" };
  }
  if (slug === "admin" && sub === "growth") return { panel: "admin-comercial-visao-geral" };
  if (slug === "admin" && sub === "configuracoes") {
    const settingsSections = new Set(["meu-perfil", "acessos", "tags", "planos", "motivos-cancelamento", "listas", "campos-adicionais", "integracoes", "conexoes", "status", "lixeira"]);
    return { panel: "configuracoes-admin", settingsSection: settingsSections.has(segments[2]) ? segments[2] : "meu-perfil" };
  }
  if (slug === "admin" && sub === "controle-pedagogico") {
    const map = { aulas: "aulas", usuarios: "pessoas", retencao: "retencao", reposicoes: "reposicoes", qualidade: "qualidade", onboarding: "onboarding", relatorios: "relatorios" };
    return { panel: "admin-controle-pedagogico", pedagogicoTab: map[String(searchParams.get("modulo") || "")] || "overview" };
  }
  return { panel: "dashboard" };
};

const initialPanelFromPath = (pathParam, searchParams) => routeStateFromPath(pathParam, searchParams).panel || "dashboard";

const applyInitialPanel = (html, panelName) => {
  const target = String(panelName || "dashboard").trim() || "dashboard";
  let out = String(html || "");
  if (target !== "dashboard") {
    out = out.replace(/<section class="platform-panel is-visible" data-panel="dashboard">/, '<section class="platform-panel" data-panel="dashboard" hidden>');
    out = out.replace(new RegExp(`(<section class="platform-panel)(" data-panel="${target}"[^>]*?)\\shidden([^>]*>)`), `$1 is-visible$2$3`);
  }
  if (target === "financeiro") {
    out = out.replace(/<header class="platform-header">/, '<header class="platform-header" hidden>');
  }
  return out;
};

const applyInitialRole = (html, role) => {
  const normalized = String(role || "").trim();
  let out = String(html || "");

  if (normalized !== "student") {
    out = out.replace(/<div class="student-v5" data-dashboard-student>/, '<div class="student-v5" data-dashboard-student hidden>');
    out = out.replace(/<header class="platform-header">/, '<header class="platform-header" hidden>');
  }
  if (normalized === "admin" || normalized === "FINANCE") {
    out = out.replace(/<div class="admin-dashboard-v2" data-dashboard-admin hidden>/, '<div class="admin-dashboard-v2" data-dashboard-admin>');
  }
  if (normalized === "teacher") {
    out = out.replace(/<div class="teacher-v4" data-dashboard-teacher hidden>/, '<div class="teacher-v4" data-dashboard-teacher>');
  }
  return out;
};

const buildAppHtml = ({ sessionJson, registryJson, role, roleSlug, templateHtml, initialPanel }) => {
  const raw = String(templateHtml || "");
  const platformStart = raw.indexOf('<div class="platform-shell"');
  const modalStart = raw.indexOf('<div class="modal-overlay"');
  const scriptStart = raw.lastIndexOf('<script src="script.js?v=7"></script>');

  if (platformStart < 0 || modalStart < 0 || scriptStart < 0 || modalStart <= platformStart) {
    throw new Error("template_missing_sections");
  }

  const platformHtml = raw.slice(platformStart, modalStart);
  const modalHtml = raw.slice(modalStart, scriptStart);

  // Ensure the platform shell is visible (this template comes from the old SPA which used `hidden`).
  const platformVisibleRaw = platformHtml.replace(
    /<div class="platform-shell"([^>]*)\shidden>/,
    '<div class="platform-shell"$1>'
  );
  const platformRoleReady = applyInitialRole(platformVisibleRaw, role);
  const platformVisible = applyInitialPanel(platformRoleReady, initialPanel);

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Space | Plataforma</title>
    <meta name="robots" content="noindex, nofollow" />
    <base href="/" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
    <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
    <script src="/api/runtime-config.js"></script>
    <link rel="stylesheet" href="styles.css" />
    <link rel="stylesheet" href="finance-v1.css?v=8" />
    <link rel="stylesheet" href="dashboard-system.css?v=1" />
  </head>
  <body data-view="interno" data-page="app" data-app-role="${String(roleSlug || "")}" data-initial-panel="${String(initialPanel || "dashboard")}">
    <div class="page-glow page-glow-left" aria-hidden="true"></div>
    <div class="page-glow page-glow-right" aria-hidden="true"></div>
    <script>
      window.__SPACE_SESSION__ = ${sessionJson};
      window.__SPACE_ADMIN_PERMISSION_REGISTRY__ = ${registryJson};
      window.__SPACE_PHONE_BOOTSTRAP__ = {
        enabled: ${process.env.SPACE_PHONE_ENABLED === "true" ? "true" : "false"},
        tokenEndpoint: "/api/voice/telnyx/token",
        callEndpoint: "/api/voice/calls",
        defaultCountry: ${JSON.stringify(process.env.SPACE_PHONE_DEFAULT_COUNTRY || "US")}
      };
    </script>
    ${platformVisible}
    ${modalHtml}
    <script src="/assets/space-data-cache.js"></script>
    <script src="/assets/student-lifecycle.js"></script>
    <script src="/assets/lifecycle-metrics.js"></script>
    <script src="/assets/retention-intelligence.js"></script>
    <script src="finance-customer-link.js?v=1"></script>
    <script src="finance-v1.js?v=31"></script>
    <script src="script.js?v=7"></script>
    <script src="/assets/space-phone.bundle.js?v=3"></script>
    <script src="space-phone.js?v=12"></script>
    <script src="admin-sdr.js?v=7"></script>
    <script src="pedagogico-n8n-ui.js"></script>
    <script src="space-office.js"></script>
    <script src="attendance-connections.js"></script>
    <script src="attendance-inbox.js"></script>
  </body>
</html>`;
};

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendRedirect(res, "/");
    return;
  }

  const user = {
    id: String(session.sub || ""),
    role: String(session.role || ""),
    name: String(session.name || ""),
    email: String(session.email || ""),
    isSuperAdmin: session.isSuperAdmin === true,
    adminPermissions: Array.isArray(session.adminPermissions) ? session.adminPermissions : [],
    adminPermissionsVersion: Number(session.adminPermissionsVersion || 0) || 0,
  };

  const userBasePath = roleToBasePath(user.role);

  if (String(user.role || "") === "growth") {
    try {
      const row = await getDocumentAsAdmin(`users/${encodeURIComponent(user.id)}`);
      if (!row || !isUserActive(row) || normalizePlatformRole(row?.tipo || row?.role || row?.type) !== "growth") {
        res.statusCode = 403;
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("Acesso Growth indisponível.");
        return;
      }
      user.commercialRoles = normalizeCommercialRoles(row.commercialRoles);
    } catch (error) {
      sendRedirect(res, userBasePath);
      return;
    }
  }

  if (user.role === 'student' && require('./_lib/retention-flags').isRetentionV2Enabled()) {
    try {
      const service = require('./_lib/student-lifecycle');
      const value = await service.getForStudent(user.id);
      if (!service.isActiveOn(value,new Date())) throw Object.assign(new Error('student_service_ended'),{status:403});
      user.lifecycle = {subscriptions:value.subscriptions};
    } catch (error) {
      res.statusCode = error.status || 503;
      res.setHeader('Cache-Control','no-store');
      res.setHeader('Content-Type','text/plain; charset=utf-8');
      res.end(error.status === 403 ? 'Período de acesso encerrado.' : 'Não foi possível validar seu período de acesso.');
      return;
    }
  }

  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/app", `https://${host}`);
  const pathParam = String(url.searchParams.get("path") || "").replace(/^\/+/, "").replace(/\/+$/, "");
  if (/^admin\/guia(?:\/|$)/i.test(pathParam)) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end("Módulo não encontrado.");
    return;
  }

  const requestedSlug = pathParam.split("/")[0] || "";
  const requestedRole = slugToRole(requestedSlug);

  // `/app` or unknown role -> redirect to the correct dashboard.
  if (!requestedRole) {
    sendRedirect(res, userBasePath);
    return;
  }

  const isAdminFinanceRoute = requestedRole === "FINANCE" && String(user.role || "") === "admin";

  // Role mismatch -> redirect to the correct dashboard. Admin is allowed to open the finance route.
  if (requestedRole !== String(user.role || "") && !isAdminFinanceRoute) {
    sendRedirect(res, userBasePath);
    return;
  }

  if (String(user.role || "") === "admin") {
    try {
      const row = await getDocumentAsAdmin(`users/${encodeURIComponent(user.id)}`);
      if (!isUserActive(row)) {
        res.statusCode = 403;
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("Usuário desativado.");
        return;
      }
      Object.assign(user, adminAccessPayloadForUser(row));
      const routeState = routeStateFromPath(pathParam, url.searchParams);
      const permission = permissionForAdminPanel(routeState.panel, routeState);
      if (permission && !canAdminAccess(row, permission)) {
        sendRedirect(res, firstAllowedAdminRoute(row));
        return;
      }
    } catch (error) {
      sendRedirect(res, userBasePath);
      return;
    }
  }

  let html;
  try {
    const template = loadTemplate();
    const roleSlug = ROLE_TO_SLUG[String(user.role || "")] || ROLE_TO_SLUG.student;
    html = buildAppHtml({
      sessionJson: safeJsonForHtml(user),
      registryJson: safeJsonForHtml(ADMIN_PERMISSION_REGISTRY),
      role: user.role,
      roleSlug,
      templateHtml: template,
      initialPanel: initialPanelFromPath(pathParam, url.searchParams),
    });
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end("Erro ao carregar a plataforma.");
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(html);
};
