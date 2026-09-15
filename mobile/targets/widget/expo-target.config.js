/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'UsPulseWidget',
  icon: '../../assets/icon.png',
  // Boş bırakılıyor -- @bacons/apple-targets, widget hedefleri için app
  // group'u OTOMATİK olarak app.json'daki ios.entitlements'taki
  // "com.apple.security.application-groups" değeriyle eşleştiriyor (bkz.
  // paketin with-widget.js'indeki appGroupsByDefault davranışı). Elle bir
  // değer yazılırsa bu otomatik eşleştirme ATLANIR -- bilerek boş.
  entitlements: {},
});
