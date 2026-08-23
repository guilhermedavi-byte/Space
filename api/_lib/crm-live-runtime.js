const { createLiveTvBuildReloadCoordinator } = require("./live-tv-runtime");

function createCrmLiveBuildReloadCoordinator(options = {}) {
  return createLiveTvBuildReloadCoordinator({
    storageTargetKey: 'crmLive:lastReloadTargetBuildId',
    storageTimeKey: 'crmLive:lastReloadAtMs',
    ...options,
  });
}

module.exports = {
  createCrmLiveBuildReloadCoordinator,
};
