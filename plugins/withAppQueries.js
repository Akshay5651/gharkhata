const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Android 11+ hides other installed apps unless you declare which ones you
 * care about. Without this, Linking.canOpenURL('whatsapp://...') and
 * ('upi://...') both silently return false — the payslip share degrades to
 * the system share sheet, and the "Pay via UPI" button looks like no UPI
 * app is installed even when one is. `android.queries` in app.json is NOT a
 * supported key — it is dropped without warning — so the entries have to be
 * written here.
 */
module.exports = function withAppQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    manifest.queries = manifest.queries ?? [];
    if (manifest.queries.length === 0) manifest.queries.push({});

    const query = manifest.queries[0];
    query.package = query.package ?? [];
    query.intent = query.intent ?? [];

    // com.whatsapp is consumer WhatsApp; w4b is WhatsApp Business, which a
    // lot of households actually have installed instead.
    for (const name of ['com.whatsapp', 'com.whatsapp.w4b']) {
      const exists = query.package.some(
        (entry) => entry.$?.['android:name'] === name,
      );
      if (!exists) query.package.push({ $: { 'android:name': name } });
    }

    // A scheme query, not a package one: any UPI app (GPay, PhonePe, Paytm,
    // ...) registers for upi://, so this is what lets Android show the full
    // chooser rather than us having to name every app individually.
    const hasUpiIntent = query.intent.some((entry) =>
      entry.data?.some((d) => d.$?.['android:scheme'] === 'upi'),
    );
    if (!hasUpiIntent) {
      query.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': 'upi' } }],
      });
    }

    return cfg;
  });
};
