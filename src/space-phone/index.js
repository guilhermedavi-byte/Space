import { TelnyxRTC } from '@telnyx/webrtc';
const { createSpacePhone } = require('./core');

(function bootstrapSpacePhone() {
  const boot = window.__SPACE_PHONE_BOOTSTRAP__ || {};
  if (!boot.enabled || window.SpacePhone) return;
  window.SpacePhone = createSpacePhone({ window, document, TelnyxRTC, bootstrap: boot });
  window.SpacePhone?.mount?.();
})();
