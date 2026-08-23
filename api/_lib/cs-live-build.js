function getCsLiveBuildId() {
  return String(
    process.env.CS_LIVE_BUILD_ID
      || process.env.VERCEL_DEPLOYMENT_ID
      || process.env.VERCEL_GIT_COMMIT_SHA
      || process.env.VERCEL_URL
      || "dev-local"
  ).trim() || "dev-local";
}

module.exports = {
  getCsLiveBuildId,
};
