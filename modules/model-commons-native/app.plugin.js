const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withEntitlementsPlist,
  withGradleProperties,
  withInfoPlist,
} = require('@expo/config-plugins');
const pkg = require('./package.json');

const SERVICE_NAME = 'expo.modules.modelcommonsnative.service.ModelCommonsService';
const PROVIDER_NAME = 'expo.modules.modelcommonsnative.provider.ModelCommonsDocumentsProvider';
const ANDROID_PACKAGE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;

function withIos(config, options) {
  const groups = Array.isArray(options.iosAppGroups)
    ? [...new Set(options.iosAppGroups.filter((value) => typeof value === 'string' && value.startsWith('group.')))]
    : [];
  if (groups.length) {
    config = withEntitlementsPlist(config, (result) => {
      const existing = result.modResults['com.apple.security.application-groups'] || [];
      result.modResults['com.apple.security.application-groups'] = [...new Set([...existing, ...groups])];
      return result;
    });
  }
  config = withInfoPlist(config, (result) => {
    result.modResults.ModelCommonsAppGroups = groups;
    if (options.iosOwnerAppGroup) {
      if (!groups.includes(options.iosOwnerAppGroup)) throw new Error('Owner App Group must be explicitly configured in iosAppGroups.');
      result.modResults.ModelCommonsOwnerAppGroup = options.iosOwnerAppGroup;
    } else delete result.modResults.ModelCommonsOwnerAppGroup;
    return result;
  });
  if (options.iosExposeDocumentsInFiles === true) {
    config = withInfoPlist(config, (result) => {
      result.modResults.LSSupportsOpeningDocumentsInPlace = true;
      result.modResults.UIFileSharingEnabled = true;
      return result;
    });
  }
  return config;
}

function withAndroid(config, options) {
  return withAndroidManifest(config, (result) => {
    const manifest = result.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(result.modResults);
    application.service = application.service || [];
    let service = application.service.find((item) => item.$ && item.$['android:name'] === SERVICE_NAME);
    if (!service) {
      service = { $: { 'android:name': SERVICE_NAME } };
      application.service.push(service);
    }
    const serviceEnabled = options.androidHubService === true;
    const serviceExported = serviceEnabled && options.androidHubServiceExported === true;
    service.$['android:enabled'] = serviceEnabled ? 'true' : 'false';
    service.$['android:exported'] = serviceExported ? 'true' : 'false';
    service.$['android:stopWithTask'] = 'false';
    service.$['tools:replace'] = 'android:enabled,android:exported';
    service['intent-filter'] = [
      {
        action: [{ $: { 'android:name': 'org.modelcommons.action.BIND' } }],
      },
    ];

    application.provider = application.provider || [];
    let provider = application.provider.find((item) => item.$ && item.$['android:name'] === PROVIDER_NAME);
    if (!provider) {
      provider = { $: { 'android:name': PROVIDER_NAME } };
      application.provider.push(provider);
    }
    const providerEnabled = options.androidSharedDocumentsProvider === true;
    provider.$['android:authorities'] = '${applicationId}.modelcommons.documents';
    provider.$['android:enabled'] = providerEnabled ? 'true' : 'false';
    provider.$['android:exported'] = providerEnabled ? 'true' : 'false';
    provider.$['android:grantUriPermissions'] = 'true';
    provider.$['android:permission'] = 'android.permission.MANAGE_DOCUMENTS';
    provider.$['tools:replace'] = 'android:authorities,android:enabled,android:exported,android:grantUriPermissions,android:permission';
    provider['intent-filter'] = [{
      action: [{ $: { 'android:name': 'android.content.action.DOCUMENTS_PROVIDER' } }],
    }];

    const queryPackages = Array.isArray(options.androidHubPackages)
      ? [...new Set(options.androidHubPackages.filter(
        (value) => typeof value === 'string' && ANDROID_PACKAGE.test(value)
      ))]
      : [];
    if (queryPackages.length) {
      manifest.queries = manifest.queries || [];
      const queries = manifest.queries[0] || {};
      queries.package = queries.package || [];
      const existing = new Set(queries.package.map((item) => item.$ && item.$['android:name']));
      for (const packageName of queryPackages) {
        if (!existing.has(packageName)) queries.package.push({ $: { 'android:name': packageName } });
      }
      if (!manifest.queries.length) manifest.queries.push(queries);
      else manifest.queries[0] = queries;
    }
    return result;
  });
}

function withModelCommonsNative(config, options = {}) {
  config = withIos(config, options);
  config = withAndroid(config, options);
  if (options.androidDescriptorRuntime === true) {
    config = withGradleProperties(config, (result) => {
      const properties = result.modResults;
      const existing = properties.find((item) => item.type === 'property' && item.key === 'rnllamaBuildFromSource');
      if (existing) existing.value = 'true';
      else properties.push({ type: 'property', key: 'rnllamaBuildFromSource', value: 'true' });
      return result;
    });
  }
  return config;
}

module.exports = createRunOncePlugin(withModelCommonsNative, pkg.name, pkg.version);
