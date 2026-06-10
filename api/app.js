const fs = require("fs");
const path = require("path");

const { getSessionFromRequest } = require("../_lib/session");

const ROLE_TO_SLUG = {
  student: "aluno",
  teacher: "professor",
  admin: "admin",
  FINANCE: "financeiro",
};

const slugToRole = (slug) => {
  const raw = String(slug || "").trim().toLowerCase();
  if (raw === "aluno") return "student";
  if (raw === "professor") return "teacher";
  if (raw === "admin") return "admin";
  if (raw === "financeiro") return "FINANCE";
  return "";
};

const roleToBasePath = (role) => {
  if (String(role || "").trim().toLowerCase() === "growth") return "/growth/dashboard";
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
  if (slug === "admin" && sub === "financeiro") return "financeiro";
  return "dashboard";
};

const applyInitialPanel = (html, panelName) => {
  const target = String(panelName || "dashboard").trim() || "dashboard";
  if (target === "dashboard") return html;

  let out = String(html || "");
  out = out.replace(/<section class="platform-panel is-visible" data-panel="dashboard">/, '<section class="platform-panel" data-panel="dashboard" hidden>');
  out = out.replace(new RegExp(`(<section class="platform-panel)(" data-panel="${target}"[^>]*?)\\shidden([^>]*>)`), `$1 is-visible$2$3`);
  return out;
};

const buildAppHtml = ({ sessionJson, roleSlug, templateHtml, initialPanel }) => {
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
  const platformVisible = applyInitialPanel(platformVisibleRaw, initialPanel);

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Space | Plataforma</title>
    <meta name="robots" content="noindex, nofollow" />
    <base href="/" />
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
    html = buildAppHtml({ sessionJson: safeJsonForHtml(user), roleSlug, templateHtml: template, initialPanel: initialPanelFromPath(pathParam) });
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
