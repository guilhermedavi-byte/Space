const { sendJson } = require("../_lib/http");
const { assertEnvironmentIsolation, getPublicRuntimeConfig } = require("../_lib/runtime-env");

const safeJsonForScript = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  try {
    assertEnvironmentIsolation();
    const config = getPublicRuntimeConfig();
    const payload = safeJsonForScript(config);
    const js = `(function(){var cfg=${payload};window.__SPACE_RUNTIME_CONFIG__=cfg;window.__SPACE_GET_FIREBASE_CONFIG__=function(){if(!cfg||!cfg.firebase||!cfg.firebase.projectId){throw new Error("missing_runtime_firebase_config");}return cfg.firebase;};var apply=function(){var env=(cfg&&cfg.environment)||{};var label=String(env.appEnv||"local");document.documentElement.dataset.appEnv=label;var applyBody=function(){if(document.body){document.body.dataset.appEnv=label;}if(env.showBanner&&document.body&&!document.querySelector("[data-space-env-banner]")){var banner=document.createElement("div");banner.className="space-env-banner";banner.setAttribute("data-space-env-banner","");banner.innerHTML='<strong>'+String(env.bannerLabel||"AMBIENTE DE TESTE")+'</strong><span>'+String(env.bannerDetail||"Use apenas dados sintéticos.")+'</span>';document.body.classList.add("has-space-env-banner");document.body.prepend(banner);}if(env.titlePrefix&&document.title&&!document.title.startsWith(env.titlePrefix)){document.title=env.titlePrefix+document.title;}};if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",applyBody,{once:true});}else{applyBody();}};apply();})();`;
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(js);
  } catch (error) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      `(function(){window.__SPACE_RUNTIME_CONFIG__={environment:{appEnv:"invalid",showBanner:true,bannerLabel:"CONFIGURAÇÃO INVÁLIDA",bannerDetail:${safeJsonForScript(
        error?.code || error?.message || "environment_isolation_failed"
      )}}};})();`
    );
  }
};
