const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const normalizeRoom = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);

const clampText = (value, fallback, max = 120) => {
  const text = String(value || "").trim();
  return (text || fallback).slice(0, max);
};

const buildJitsiUrl = (room) => {
  const baseUrl = String(process.env.JITSI_BASE_URL || "https://meet.jit.si").replace(/\/+$/, "");
  const params = [
    "config.prejoinPageEnabled=false",
    "config.disableDeepLinking=true",
    "config.startWithAudioMuted=false",
    "config.startWithVideoMuted=false",
    "config.enableWelcomePage=false",
    "interfaceConfig.SHOW_JITSI_WATERMARK=false",
    "interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false",
    "interfaceConfig.DEFAULT_LOGO_URL=",
  ].join("&");
  return `${baseUrl}/${encodeURIComponent(room)}#${params}`;
};

const buildHtml = ({ room, title }) => {
  const jitsiUrl = buildJitsiUrl(room);
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Space | ${escapeHtml(title)}</title>
    <meta name="robots" content="noindex, nofollow" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
    <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
    <style>
      :root{color-scheme:dark;--bg:#070b13;--panel:#101723;--line:rgba(255,255,255,.12);--text:#f8fafc;--muted:#aeb7c6;--brand:#ff4742}
      *{box-sizing:border-box}
      body{margin:0;min-height:100vh;background:radial-gradient(circle at 12% 6%,rgba(255,71,66,.20),transparent 32%),radial-gradient(circle at 92% 0%,rgba(53,94,174,.22),transparent 35%),var(--bg);color:var(--text);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .shell{min-height:100vh;display:grid;grid-template-rows:auto 1fr;padding:18px;gap:14px}
      .top{display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid var(--line);border-radius:22px;background:linear-gradient(145deg,rgba(20,28,42,.90),rgba(9,13,22,.96));padding:14px 16px;box-shadow:0 24px 70px rgba(0,0,0,.28)}
      .brand{display:flex;align-items:center;gap:12px;min-width:0}
      .brand img{width:44px;height:44px;object-fit:contain;border-radius:12px}
      .brand small{display:block;margin-bottom:2px;color:#5f95c8;font-size:11px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}
      .brand strong{display:block;max-width:70vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:20px;line-height:1.1}
      .actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
      .btn{border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(255,255,255,.08);color:#fff;padding:11px 15px;font-weight:900;text-decoration:none;cursor:pointer}
      .btn.primary{border-color:var(--brand);background:var(--brand);box-shadow:0 16px 34px rgba(255,71,66,.22)}
      .room{position:relative;min-height:0;border:1px solid var(--line);border-radius:24px;overflow:hidden;background:#05070d;box-shadow:0 24px 80px rgba(0,0,0,.36)}
      iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000}
      .notice{position:absolute;left:18px;bottom:18px;z-index:2;max-width:min(520px,calc(100% - 36px));border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(7,11,19,.82);backdrop-filter:blur(14px);padding:12px 14px;color:var(--muted);font-size:13px;line-height:1.45}
      .notice b{color:#fff}
      @media(max-width:760px){.shell{padding:10px}.top{align-items:flex-start;display:grid;border-radius:18px}.brand img{width:38px;height:38px}.brand strong{font-size:17px;max-width:calc(100vw - 92px)}.actions{justify-content:flex-start}.room{min-height:76vh;border-radius:18px}}
    </style>
  </head>
  <body>
    <main class="shell">
      <header class="top">
        <div class="brand">
          <img src="/assets/space-symbol.png" alt="Space" />
          <div>
            <small>Sala ao vivo Space</small>
            <strong>${escapeHtml(title)}</strong>
          </div>
        </div>
        <nav class="actions" aria-label="Ações da sala">
          <a class="btn" href="/app">Voltar para plataforma</a>
          <a class="btn primary" href="${escapeHtml(jitsiUrl)}" target="_blank" rel="noopener">Abrir em nova aba</a>
        </nav>
      </header>
      <section class="room" aria-label="${escapeHtml(title)}">
        <iframe
          title="${escapeHtml(title)}"
          src="${escapeHtml(jitsiUrl)}"
          allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
          allowfullscreen
        ></iframe>
        <div class="notice"><b>Space ao vivo:</b> se o navegador pedir permissão, libere câmera e microfone para entrar na aula.</div>
      </section>
    </main>
  </body>
</html>`;
};

module.exports = async (req, res) => {
  if (!["GET", "HEAD"].includes(req.method || "GET")) {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end("Method Not Allowed");
    return;
  }

  const host = req.headers.host || "localhost";
  const url = new URL(req.url || "/api/sala", `https://${host}`);
  const room = normalizeRoom(url.searchParams.get("room"));
  const title = clampText(url.searchParams.get("title"), "Aula ao vivo Space");

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (!room) {
    res.statusCode = 404;
    res.end(buildHtml({ room: "space-sala-nao-encontrada", title: "Sala não encontrada" }));
    return;
  }

  res.statusCode = 200;
  res.end(buildHtml({ room, title }));
};
