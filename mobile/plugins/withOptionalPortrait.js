// Play Console, app.json'daki "orientation": "portrait" ayarı yüzünden
// manifeste otomatik olarak android.hardware.screen.portrait özelliğini
// ZORUNLU olarak ekliyor; bu da portre ekranı olmayan cihazlarda (bazı
// tablet/masaüstü/Android XR cihazlar) uygulamanın yüklenememesine yol açıyor.
// Uygulama yine dikey modda çalışır -- bu plugin sadece özelliği "zorunlu
// değil" (android:required="false") olarak işaretler.
const { withAndroidManifest } = require('expo/config-plugins');

const FEATURE_NAME = 'android.hardware.screen.portrait';

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const features = manifest['uses-feature'] ?? [];
    const existing = features.find((f) => f.$ && f.$['android:name'] === FEATURE_NAME);
    if (existing) {
      existing.$['android:required'] = 'false';
    } else {
      features.push({ $: { 'android:name': FEATURE_NAME, 'android:required': 'false' } });
    }
    manifest['uses-feature'] = features;
    return cfg;
  });
};
