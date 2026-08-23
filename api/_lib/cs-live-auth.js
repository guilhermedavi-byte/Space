const { isSecureRequest } = require("./session");
const { createLiveTvAccess } = require("./live-tv-access");

const CS_LIVE_COOKIE_NAME = "space_cs_live";
const CS_LIVE_ACCESS_COLLECTION = "csLiveAccessTokens";
const CS_LIVE_COOKIE_SCOPE = "cs-live:read";
const CS_LIVE_COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

const csLiveAccess = createLiveTvAccess({
  collection: CS_LIVE_ACCESS_COLLECTION,
  cookieName: CS_LIVE_COOKIE_NAME,
  cookieScope: CS_LIVE_COOKIE_SCOPE,
  cookieMaxAgeSeconds: CS_LIVE_COOKIE_MAX_AGE_SECONDS,
  defaultLabel: "CS Live TV",
});

module.exports = {
  ...csLiveAccess,
  isSecureRequest,
  CS_LIVE_COOKIE_NAME,
  CS_LIVE_ACCESS_COLLECTION,
  CS_LIVE_COOKIE_SCOPE,
  CS_LIVE_COOKIE_MAX_AGE_SECONDS,
};
