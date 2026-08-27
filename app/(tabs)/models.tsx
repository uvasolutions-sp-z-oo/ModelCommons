import React, { useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import type { ModelManifest, ModelRegistryRecord } from '@modelcommons/protocol';
import { ActionButton, Badge, Card, formatBytes, HubScreen, KeyValue, Muted, SectionTitle, palette } from '../../components/modelcommons/HubUI';
import { MODEL_CATALOG } from '../../services/modelcommons/catalog';
import { modelStore, type ModelDownloadProgress } from '../../services/modelcommons/modelStore';
import { useHubStore } from '../../store/inferenceStore';

type DisplayModel = { manifest: ModelManifest; record?: ModelRegistryRecord };

export default function ModelsScreen() {
  const registry = useHubStore((state) => state.registry);
  const selectedModelId = useHubStore((state) => state.selectedModelId);
  const experimentalEnabled = useHubStore((state) => state.experimentalEnabled);
  const actions = useHubStore((state) => state.actions);
  const [busyId, setBusyId] = useState<string>();
  const [busyKind, setBusyKind] = useState<'license' | 'download' | 'delete'>();
  const [progress, setProgress] = useState<ModelDownloadProgress>();
  const [reviewedLicenses, setReviewedLicenses] = useState<Set<string>>(() => new Set());
  const abort = useRef<AbortController | null>(null);
  const operation = useRef<string | null>(null);
  const models = useMemo<DisplayModel[]>(() => {
    const byId = new Map<string, DisplayModel>();
    for (const manifest of MODEL_CATALOG) byId.set(manifest.id, { manifest });
    for (const record of registry.models) byId.set(record.manifest.id, { manifest: record.manifest, record });
    return [...byId.values()];
  }, [registry]);

  const sync = () => actions.setRegistry(modelStore.registry);
  const begin = (id: string, kind: 'license' | 'download' | 'delete'): boolean => {
    if (operation.current) return false;
    operation.current = id;
    setBusyId(id);
    setBusyKind(kind);
    return true;
  };
  const finish = (id: string) => {
    if (operation.current !== id) return;
    operation.current = null;
    setBusyId(undefined);
    setBusyKind(undefined);
  };
  const accept = (manifest: ModelManifest) => {
    if (Platform.OS === 'web' && !reviewedLicenses.has(manifest.id)) {
      setReviewedLicenses((current) => new Set(current).add(manifest.id));
      void Linking.openURL(manifest.license.url);
      return;
    }
    const perform = async () => {
      if (!begin(manifest.id, 'license')) return;
      try { await modelStore.acceptLicense(manifest.id); sync(); }
      catch (error) { Alert.alert('License acceptance failed', (error as Error).message); }
      finally { finish(manifest.id); }
    };
    if (Platform.OS === 'web') { void perform(); return; }
    Alert.alert(
      'Separate model license',
      `Model weights are not covered by the ModelCommons MIT license. Review ${manifest.license.name ?? manifest.license.id} before accepting.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'View terms', onPress: () => void Linking.openURL(manifest.license.url) },
        { text: 'I accept', onPress: () => void perform() },
      ]
    );
  };

  const download = async (manifest: ModelManifest) => {
    if (manifest.experimental && !experimentalEnabled) {
      Alert.alert('Experimental downloads are disabled', 'Enable Experimental MoE in Settings before downloading this model.');
      return;
    }
    const perform = async () => {
      if (!begin(manifest.id, 'download')) return;
      const controller = new AbortController();
      abort.current = controller;
      setProgress(undefined);
      try {
        await modelStore.download(manifest.id, {
          signal: controller.signal,
          confirmExperimental: manifest.experimental,
          onProgress: setProgress,
        });
        sync();
      } catch (error) {
        Alert.alert('Download did not complete', (error as Error).message);
        sync();
      } finally {
        abort.current = null;
        finish(manifest.id);
        setProgress(undefined);
      }
    };
    if (manifest.experimental && Platform.OS !== 'web') {
      Alert.alert(
        'Large experimental model',
        `${manifest.displayName} is ${formatBytes(manifest.memory?.fileBytes)} and is not a phone-feasibility promise. Continue only on suitable hardware?`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', style: 'destructive', onPress: () => void perform() }]
      );
    } else void perform();
  };

  const remove = (manifest: ModelManifest) => {
    const perform = async () => {
      if (!begin(manifest.id, 'delete')) return;
      try { await modelStore.delete(manifest.id); sync(); }
      catch (error) { Alert.alert('Delete failed', (error as Error).message); }
      finally { finish(manifest.id); }
    };
    Alert.alert('Delete immutable model revision?', 'Active contexts are released before its artifact directory is removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void perform() },
    ]);
  };

  return (
    <HubScreen title="Models" subtitle="Catalog metadata and installed immutable revisions. Downloads are explicit, resumable, and published only after verification.">
      {models.map(({ manifest, record }) => {
        const accepted = modelStore.isLicenseAccepted(manifest);
        const ready = record?.state === 'READY';
        const busy = busyId === manifest.id;
        return (
          <Card key={manifest.id} style={manifest.experimental && styles.experimental}>
            <View style={styles.row}>
              <SectionTitle>{manifest.displayName}</SectionTitle>
              <Badge tone={ready ? 'success' : record?.state === 'FAILED' ? 'danger' : manifest.experimental ? 'warning' : 'neutral'}>
                {record?.state ?? 'NOT_INSTALLED'}
              </Badge>
            </View>
            <Muted>{manifest.id}</Muted>
            <View style={styles.badges}>
              <Badge>{manifest.architecture.type.toUpperCase()}</Badge>
              {manifest.quantization ? <Badge>{manifest.quantization}</Badge> : null}
              {manifest.capabilities.map((capability) => (
                <Badge key={capability}>
                  {capability === 'text' ? capability : `${capability} · catalog metadata only`}
                </Badge>
              ))}
            </View>
            <KeyValue label="Revision" value={manifest.revision.slice(0, 16)} />
            <KeyValue label="Artifact size" value={formatBytes(manifest.memory?.fileBytes)} />
            <KeyValue label="License" value={`${manifest.license.id}${accepted ? ' · accepted' : ' · acceptance required'}`} />
            <KeyValue label="Integrity" value={manifest.files.every((file) => !!file.integrity) ? 'SHA-256 required' : 'No checksum claim'} />
            {progress && busy ? <Text style={styles.progress}>{progress.phase === 'verifying' ? 'Verifying' : 'Downloading'} {progress.fileRole}: {progress.percent ?? '…'}{progress.percent === undefined ? '' : '%'} · {formatBytes(progress.bytesWritten)}</Text> : null}
            {!accepted ? <ActionButton label={Platform.OS === 'web' && reviewedLicenses.has(manifest.id) ? 'I reviewed the terms — accept' : 'Review and accept model license'} onPress={() => accept(manifest)} busy={busy && busyKind === 'license'} disabled={!!busyId && !busy} tone="secondary" /> : null}
            {accepted && !ready ? <ActionButton label={busy && busyKind === 'download' ? 'Working…' : 'Download verified revision'} onPress={() => void download(manifest)} busy={busy && busyKind === 'download'} disabled={!!busyId && !busy} /> : null}
            {busy && busyKind === 'download' ? <ActionButton label={progress?.phase === 'verifying' ? 'Stop after current SHA-256 check' : 'Cancel and keep partial file'} onPress={() => abort.current?.abort()} tone="secondary" /> : null}
            {record && record.state !== 'NOT_INSTALLED' && !ready ? (
              <ActionButton label="Remove failed or partial revision" onPress={() => remove(manifest)} tone="danger" disabled={!!busyId} />
            ) : null}
            {ready ? (
              <View style={styles.actions}>
                <ActionButton label={selectedModelId === manifest.id ? 'Selected' : 'Use this model'} onPress={() => actions.setSelectedModelId(manifest.id)} disabled={selectedModelId === manifest.id || !!busyId} />
                <ActionButton label="Delete revision" onPress={() => remove(manifest)} tone="danger" disabled={!!busyId} />
              </View>
            ) : null}
          </Card>
        );
      })}
    </HubScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  actions: { gap: 8 },
  progress: { color: palette.accent, fontSize: 13, fontWeight: '700' },
  experimental: { borderColor: '#E8C98D', backgroundColor: '#FFFCF5' },
});
