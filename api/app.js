const fs = require("fs");
const path = require("path");

const { getSessionFromRequest } = require("../_lib/session");

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
  if (String(role || "").trim().toLowerCase() === "growth") return "/app/growth/sdr";
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

const initialPanelFromPath = (pathParam) => {
  const segments = String(pathParam || "").split("/").filter(Boolean);
  const slug = segments[0] || "";
  const sub = segments[1] || "";
  if (slug === "financeiro") return "financeiro";
  if (slug === "admin" && sub === "space-office") return "space-office";
  if (slug === "admin" && sub === "status") return "status-plataforma";
  if (slug === "admin" && sub === "guia") return "guia-colaboradores";
  if (slug === "admin" && sub === "financeiro") return "financeiro";
  if (slug === "admin" && sub === "comercial") return "admin-comercial-usuarios";
  if (slug === "growth" || (slug === "admin" && sub === "growth")) return "growth";
  return "dashboard";
};

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

const buildAppHtml = ({ sessionJson, role, roleSlug, templateHtml, initialPanel }) => {
  const raw = String(templateHtml || "");
  const platformStart = raw.indexOf('<div class="platform-shell"');
  const modalStart = raw.indexOf('<div class="modal-overlay"');
  const scriptStart = raw.lastIndexOf('<script src="script.js"></script>');

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
  </head>
  <body data-view="interno" data-page="app" data-app-role="${String(roleSlug || "")}" data-initial-panel="${String(initialPanel || "dashboard")}">
    <div class="page-glow page-glow-left" aria-hidden="true"></div>
    <div class="page-glow page-glow-right" aria-hidden="true"></div>
    <script>
      window.__SPACE_SESSION__ = ${sessionJson};
    </script>
    ${platformVisible}
    ${modalHtml}
    <script src="script.js"></script>
    <script src="pedagogico-n8n-ui.js"></script>
    <script src="space-office.js"></script>
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
  };

  const userBasePath = roleToBasePath(user.role);

  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/app", `https://${host}`);
  const pathParam = String(url.searchParams.get("path") || "").replace(/^\/+/, "").replace(/\/+$/, "");

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

  let html;
  try {
    const template = loadTemplate();
    const roleSlug = ROLE_TO_SLUG[String(user.role || "")] || ROLE_TO_SLUG.student;
    html = buildAppHtml({ sessionJson: safeJsonForHtml(user), role: user.role, roleSlug, templateHtml: template, initialPanel: initialPanelFromPath(pathParam) });
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
