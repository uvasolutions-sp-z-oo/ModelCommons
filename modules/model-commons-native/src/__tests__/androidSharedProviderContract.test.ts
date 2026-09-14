import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Android shared-model provider contract', () => {
  it('ships disabled by default and uses the restricted DocumentsProvider manifest pattern', () => {
    const manifest = read('modules/model-commons-native/android/src/main/AndroidManifest.xml');
    expect(manifest).toContain('android:permission="android.permission.MANAGE_DOCUMENTS"');
    expect(manifest).toContain('android:grantUriPermissions="true"');
    expect(manifest).toContain('android:enabled="false"');
    expect(manifest).toContain('android:exported="false"');
    expect(manifest).toContain('${applicationId}.modelcommons.documents');
    expect(manifest).not.toMatch(/MANAGE_EXTERNAL_STORAGE|QUERY_ALL_PACKAGES|WRITE_EXTERNAL_STORAGE/);
  });

  it('exposes only read opens and rejects path or URI shortcuts', () => {
    const provider = read('modules/model-commons-native/android/src/main/java/expo/modules/modelcommonsnative/provider/ModelCommonsDocumentsProvider.kt');
    const consumer = read('modules/model-commons-native/android/src/main/java/expo/modules/modelcommonsnative/storage/AndroidSharedModelFiles.kt');
    const index = read('modules/model-commons-native/android/src/main/java/expo/modules/modelcommonsnative/storage/AndroidSharedStoreIndex.kt');
    expect(provider).toMatch(/mode != "r"/);
    expect(provider).toContain('OsConstants.O_RDONLY');
    expect(provider).toContain('OsConstants.O_NOFOLLOW');
    expect(provider).toContain('ParcelFileDescriptor.dup');
    expect(provider).not.toMatch(/deleteDocument|renameDocument|createDocument|moveDocument/);
    expect(consumer).toContain('Os.pread');
    expect(consumer).toContain('Os.fstat');
    expect(consumer).toContain('"descriptorVersion" to 2');
    expect(consumer).toContain('"inode" to identity.st_ino.toString()');
    expect(consumer).not.toMatch(/\/proc\/self\/fd|copyTo|FileOutputStream\([^)]*artifact/i);
    expect(consumer).toContain('requireBoundedJsonStructure');
    expect(consumer).toContain('MAX_JSON_DEPTH = 32');
    expect(index).toContain('Os.lstat');
    expect(index).toContain('canonical.path == requested.absolutePath');
    expect(index).toContain('requireBoundedJsonStructure');
  });

  it('keeps provider export and descriptor runtime as separate owner and consumer options', () => {
    const plugin = read('modules/model-commons-native/app.plugin.js');
    const ownerConfig = read('app.config.ts');
    const installHook = read('modules/model-commons-native/scripts/ensure-llama-payload.cjs');
    expect(plugin).toContain('androidSharedDocumentsProvider');
    expect(plugin).toContain('androidDescriptorRuntime');
    expect(plugin).toContain('androidHubServiceExported');
    expect(plugin).toContain('rnllamaBuildFromSource');
    expect(ownerConfig).toContain('androidSharedDocumentsProvider: true');
    expect(ownerConfig).toContain('androidDescriptorRuntime: true');
    expect(installHook).not.toContain("RNLLAMA_BUILD_FROM_SOURCE === '1'");
  });

  it('includes an owner-run distinct-UID evidence harness without destructive app-data commands', () => {
    const harness = read('scripts/inspect-android-shared-files-device.ps1');
    expect(harness).toContain('distinctUids = $true');
    expect(harness).toContain('persistedConsumerGrantObserved');
    expect(harness).not.toMatch(/pm clear|uninstall|rm\s+-/i);
  });
});
