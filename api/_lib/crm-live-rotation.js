const { buildScreenKeys, createLiveTvLoopController } = require("./live-tv-rotation");

function createCrmLiveLoopController(options = {}) {
  return createLiveTvLoopController({
    buildKeys: buildScreenKeys,
    ...options,
  });
}

module.exports = {
  buildScreenKeys,
  createCrmLiveLoopController,
};
