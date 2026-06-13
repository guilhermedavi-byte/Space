class VideoProvider {
  constructor(name) {
    this.name = name || "mock";
  }

  async getJoinData({ lesson, role }) {
    return {
      provider: this.name,
      roomId: lesson.video_room_id || lesson.id,
      roomUrl: lesson.video_room_url || "",
      joinUrl: "",
      joinToken: "",
      embedKind: "placeholder",
      message: "Sala de video pronta para integracao com provider.",
      role,
    };
  }
}

class MockVideoProvider extends VideoProvider {
  constructor() {
    super("mock");
  }
}

class JitsiVideoProvider extends VideoProvider {
  constructor() {
    super("jitsi");
  }

  async getJoinData({ lesson, role }) {
    const configuredBaseUrl = String(process.env.JITSI_BASE_URL || "").replace(/\/+$/, "");
    const baseUrl = configuredBaseUrl || "https://meet.jit.si";
    const roomId = String(lesson.video_room_id || lesson.id || "").trim();
    const roomUrl = String(configuredBaseUrl && roomId ? `${baseUrl}/${encodeURIComponent(roomId)}` : lesson.video_room_url || (roomId ? `${baseUrl}/${encodeURIComponent(roomId)}` : "")).trim();
    const joinUrl = roomUrl
      ? `${roomUrl.split("#")[0]}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&config.startWithAudioMuted=false&config.startWithVideoMuted=false`
      : "";
    return {
      provider: this.name,
      roomId,
      roomUrl,
      joinUrl,
      domain: roomUrl ? new URL(roomUrl).host : "",
      externalApiUrl: roomUrl ? `${new URL(roomUrl).origin}/external_api.js` : "",
      joinToken: "",
      embedKind: joinUrl ? "jitsi-external-api" : "placeholder",
      message: roomUrl ? "" : "Sala de video pronta para integracao com provider.",
      role,
    };
  }
}

class DailyVideoProvider extends VideoProvider {
  constructor() {
    super("daily");
  }

  async getJoinData({ lesson, role }) {
    const roomUrl = String(lesson.video_room_url || "").trim();
    return {
      provider: this.name,
      roomId: String(lesson.video_room_id || lesson.id || ""),
      roomUrl,
      joinUrl: roomUrl,
      joinToken: "",
      embedKind: roomUrl ? "iframe" : "placeholder",
      message: roomUrl ? "" : "Daily preparado. Configure DAILY_API_KEY no backend para gerar salas/tokens automaticamente.",
      role,
    };
  }
}

const getVideoProvider = (preferred) => {
  const provider = String(preferred || process.env.LIVE_VIDEO_PROVIDER || "mock").trim().toLowerCase();
  if (provider === "jitsi") return new JitsiVideoProvider();
  if (provider === "daily") return new DailyVideoProvider();
  return new MockVideoProvider();
};

module.exports = {
  VideoProvider,
  DailyVideoProvider,
  JitsiVideoProvider,
  MockVideoProvider,
  getVideoProvider,
};
