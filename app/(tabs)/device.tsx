import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { resolveRuntimeProfile } from '@modelcommons/device-profile';
import { getNativeAvailability, hasNativeMethod, type NativeAvailability } from '@modelcommons/native';
import { Badge, Card, formatBytes, HubScreen, KeyValue, Muted, SectionTitle, palette } from '../../components/modelcommons/HubUI';
import { MODEL_CATALOG } from '../../services/modelcommons/catalog';
import { refreshHubDeviceProfile } from '../../services/modelcommons/lifecycle';
import { useHubStore } from '../../store/inferenceStore';

export default function DeviceScreen() {
  const device = useHubStore((state) => state.deviceProfile);
  const registry = useHubStore((state) => state.registry);
  const selectedId = useHubStore((state) => state.selectedModelId);
  const profileId = useHubStore((state) => state.profileId);
  const context = useHubStore((state) => state.context);
  const [refreshing, setRefreshing] = useState(false);
  const [nativeDiagnostic, setNativeDiagnostic] = useState<{
    availability?: NativeAvailability;
    privateModelOperation: boolean;
    sha256File: boolean;
    atomicReplaceFile: boolean;
    error?: string;
  }>({
    privateModelOperation: false,
    sha256File: false,
    atomicReplaceFile: false,
  });
  const selectedRecord = useMemo(() => {
    return registry.models.find((entry) => entry.manifest.id === selectedId)
      ?? registry.models.find((entry) => entry.state === 'READY');
  }, [registry, selectedId]);
  const model = selectedRecord?.manifest ?? MODEL_CATALOG[0];
  const resolution = device ? resolveRuntimeProfile({
    device,
    model,
    requestedProfile: profileId,
    requestedContext: context,
    artifactInstalled: selectedRecord?.state === 'READY',
  }) : undefined;

  const refreshNativeDiagnostic = useCallback(async () => {
    const methods = {
      privateModelOperation: hasNativeMethod('privateModelOperation'),
      sha256File: hasNativeMethod('sha256File'),
      atomicReplaceFile: hasNativeMethod('atomicReplaceFile'),
    };

    try {
      const availability = await getNativeAvailability();
      setNativeDiagnostic({ availability, ...methods });
    } catch (error) {
      setNativeDiagnostic({
        ...methods,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        refreshHubDeviceProfile(),
        refreshNativeDiagnostic(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshNativeDiagnostic]);
  useEffect(() => { if (!device) void refresh(); }, [device, refresh]);
  useEffect(() => { void refreshNativeDiagnostic(); }, [refreshNativeDiagnostic]);

  return (
    <HubScreen title="Device" subtitle="Risk-aware runtime intent. Total RAM and currently available memory remain separate signals."
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.accent} />}>
      <Card>
        <View style={styles.row}><SectionTitle>Capability snapshot</SectionTitle><Badge>{device?.platform.toUpperCase() ?? 'COLLECTING'}</Badge></View>
        <KeyValue label="OS" value={`${device?.platform ?? 'unknown'} ${device?.osVersion ?? ''}`} />
        <KeyValue label="Physical memory" value={formatBytes(device?.physicalMemoryBytes)} />
        <KeyValue label="Available memory" value={formatBytes(device?.availableMemoryBytes)} />
        <KeyValue label="Free disk" value={formatBytes(device?.freeDiskBytes)} />
        <KeyValue label="Accelerators reported" value={device?.accelerators.map((item) => item.name ?? item.id).join(', ') || 'CPU baseline only'} />
        <Muted>Unknown available memory stays unknown; it is never replaced with total physical RAM.</Muted>
      </Card>
      <Card>
        <View style={styles.row}>
          <SectionTitle>Native bridge diagnostics</SectionTitle>
          <Badge tone={nativeDiagnostic.availability?.available ? 'success' : 'danger'}>
            {nativeDiagnostic.availability?.available ? 'AVAILABLE' : 'UNAVAILABLE'}
          </Badge>
        </View>
        <KeyValue label="Platform" value={nativeDiagnostic.availability?.platform ?? 'unknown'} />
        <KeyValue label="privateModelOperation" value={nativeDiagnostic.privateModelOperation ? 'YES' : 'NO'} />
        <KeyValue label="sha256File" value={nativeDiagnostic.sha256File ? 'YES' : 'NO'} />
        <KeyValue label="atomicReplaceFile" value={nativeDiagnostic.atomicReplaceFile ? 'YES' : 'NO'} />
        {nativeDiagnostic.error ? <Muted>{nativeDiagnostic.error}</Muted> : null}
      </Card>
      {resolution ? (
        <Card>
          <View style={styles.row}>
            <SectionTitle>{resolution.profile.displayName}</SectionTitle>
            <Badge tone={resolution.compatibility === 'SUPPORTED' ? 'success' : resolution.compatibility === 'UNSUPPORTED' || resolution.compatibility === 'NOT_RECOMMENDED' ? 'danger' : 'warning'}>{resolution.compatibility}</Badge>
          </View>
          <Muted>{model.displayName}</Muted>
          <KeyValue label="Context" value={String(resolution.profile.llama.nCtx)} />
          <KeyValue label="Batch / micro-batch" value={`${resolution.profile.llama.nBatch} / ${resolution.profile.llama.nUbatch}`} />
          <KeyValue label="GPU layers requested" value={String(resolution.profile.llama.nGpuLayers)} />
          <KeyValue label="CPU MoE layers" value={resolution.profile.llama.nCpuMoe === undefined ? 'Not applicable' : String(resolution.profile.llama.nCpuMoe)} />
          <KeyValue label="Memory mapping" value={resolution.profile.llama.useMmap ? 'Requested' : 'Off'} />
          {resolution.reasons.map((reason) => <Text key={reason} style={styles.reason}>• {reason}</Text>)}
        </Card>
      ) : null}
      <Card>
        <SectionTitle>Benchmarks</SectionTitle>
        <Muted>No benchmark has been recorded. Benchmarks store configuration, speed, timing, and failure category only—never prompts or generated text.</Muted>
      </Card>
    </HubScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  reason: { color: palette.muted, fontSize: 13, lineHeight: 19 },
});
