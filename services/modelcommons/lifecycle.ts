import type { DeviceProfile } from '@modelcommons/protocol';
import { modelStore } from './modelStore';
import { collectDeviceProfile } from './deviceProfile';
import { diagnosticLogger } from '../logger';
import { useHubStore } from '../../store/inferenceStore';
import { getHubRuntimeAvailability, initializeHubRuntime } from './hubRuntime';

function withRuntimeVersion(
  device: DeviceProfile,
  runtime: Awaited<ReturnType<typeof getHubRuntimeAvailability>>
): DeviceProfile {
  return {
    ...device,
    runtimeVersions: runtime.available
      ? { ...device.runtimeVersions, [runtime.runtimeId]: runtime.runtimeVersion }
      : device.runtimeVersions,
  };
}

/** Recollects volatile device data without erasing a confirmed runtime probe. */
export async function refreshHubDeviceProfile(): Promise<DeviceProfile> {
  const device = await collectDeviceProfile();
  await initializeHubRuntime();
  const runtime = await getHubRuntimeAvailability();
  const effective = withRuntimeVersion(device, runtime);
  const { actions } = useHubStore.getState();
  actions.setDeviceProfile(effective);
  actions.setRuntimeAvailability(runtime.available, runtime.message ?? runtime.reason);
  return effective;
}

export async function initializeModelCommonsHub(): Promise<void> {
  const { actions } = useHubStore.getState();
  try {
    const [registry, device] = await Promise.all([
      modelStore.initialize(),
      collectDeviceProfile(),
    ]);
    actions.setRegistry(registry);
    actions.setDeviceProfile(device);
    await initializeHubRuntime();
    const runtime = await getHubRuntimeAvailability();
    actions.setDeviceProfile(withRuntimeVersion(device, runtime));
    actions.setRuntimeAvailability(runtime.available, runtime.message ?? runtime.reason);
    actions.setInitialized();
    diagnosticLogger.info('hub.initialized', { platform: device.platform, status: 'ready' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ModelCommons initialization failed.';
    actions.setInitialized(message);
    diagnosticLogger.error('hub.initialization_failed', { failureCategory: 'INITIALIZATION' });
  }
}

export async function refreshRegistry(): Promise<void> {
  const registry = await modelStore.initialize();
  useHubStore.getState().actions.setRegistry(registry);
}
