chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    spaceApiBaseUrl: "https://space-three-sand.vercel.app",
  });
});
