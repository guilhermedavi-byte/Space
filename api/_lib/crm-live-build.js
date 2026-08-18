function getCrmLiveBuildId() {
  return String(
    process.env.CRM_LIVE_BUILD_ID
      || process.env.VERCEL_DEPLOYMENT_ID
      || process.env.VERCEL_GIT_COMMIT_SHA
      || process.env.VERCEL_URL
      || 'dev-local'
  ).trim() || 'dev-local';
}

module.exports = {
  getCrmLiveBuildId,
};
