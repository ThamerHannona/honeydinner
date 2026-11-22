// Drop usage-description keys Expo modules inject that this app never needs.
// Keep camera, photo library, microphone, and speech recognition only.
// Listed last in app.json so it runs after camera / image-picker / speech plugins.
// Does not touch the share extension's Info.plist.
const { withInfoPlist } = require('expo/config-plugins');

const KEEP = new Set([
  'NSCameraUsageDescription',
  'NSPhotoLibraryUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSSpeechRecognitionUsageDescription',
]);

function withStripUnusedPermissions(config) {
  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;
    for (const key of Object.keys(plist)) {
      const isUsage = /UsageDescription$/.test(key) || /^NS(Calendars|Reminders|Contacts|Location|Motion|Bluetooth|FaceID|AppleMusic|Health|HomeKit|Siri|Nearby|LocalNetwork|UserTracking|FallDetection)/.test(key);
      if (!isUsage) continue;
      if (KEEP.has(key)) continue;
      delete plist[key];
    }
    return cfg;
  });
}

module.exports = withStripUnusedPermissions;
