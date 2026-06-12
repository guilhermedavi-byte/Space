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
    const baseUrl = String(process.env.JITSI_BASE_URL || "https://meet.jit.si").replace(/\/+$/, "");
    const roomId = String(lesson.video_room_id || lesson.id || "").trim();
    const roomUrl = String(lesson.video_room_url || (roomId ? `${baseUrl}/${encodeURIComponent(roomId)}` : "")).trim();
    return {
      provider: this.name,
      roomId,
      roomUrl,
      joinUrl: roomUrl,
      joinToken: "",
      embedKind: roomUrl ? "iframe" : "placeholder",
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
