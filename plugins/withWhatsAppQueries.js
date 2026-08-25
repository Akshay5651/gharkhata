const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Android 11+ hides other installed apps unless you declare which ones you
 * care about. Without this, Linking.canOpenURL('whatsapp://...') always
 * returns false and the payslip share silently degrades to the system share
 * sheet. `android.queries` in app.json is NOT a supported key — it is dropped
 * without warning — so the entries have to be written here.
 */
module.exports = function withWhatsAppQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    manifest.queries = manifest.queries ?? [];
    if (manifest.queries.length === 0) manifest.queries.push({});

    const query = manifest.queries[0];
    query.package = query.package ?? [];

    // com.whatsapp is consumer WhatsApp; w4b is WhatsApp Business, which a
    // lot of households actually have installed instead.
    for (const name of ['com.whatsapp', 'com.whatsapp.w4b']) {
      const exists = query.package.some(
        (entry) => entry.$?.['android:name'] === name,
      );
      if (!exists) query.package.push({ $: { 'android:name': name } });
    }

    return cfg;
  });
};
