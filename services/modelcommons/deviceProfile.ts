import * as FileSystem from 'expo-file-system/legacy';
import { NativeModules, Platform } from 'react-native';
import { PROTOCOL_VERSION, type DeviceProfile } from '@modelcommons/protocol';

interface NativeDeviceSnapshot {
  physicalMemoryBytes?: number;
  availableMemoryBytes?: number;
  accelerators?: DeviceProfile['accelerators'];
  osVersion?: string;
}

async function nativeSnapshot(): Promise<NativeDeviceSnapshot> {
  const native = NativeModules.ModelCommonsNative as
    | { getDeviceProfile?: () => Promise<NativeDeviceSnapshot>; getDeviceInfo?: () => Promise<NativeDeviceSnapshot> }
    | undefined;
  if (native?.getDeviceProfile) {
    try { return await native.getDeviceProfile(); } catch { return {}; }
  }
  if (native?.getDeviceInfo) {
    try { return await native.getDeviceInfo(); } catch { return {}; }
  }
  const constants = NativeModules.PlatformConstants?.getConstants?.() as
    | { TotalMemory?: number; totalMemory?: number }
    | undefined;
  return { physicalMemoryBytes: constants?.TotalMemory ?? constants?.totalMemory };
}

function protocolPlatform(): DeviceProfile['platform'] {
  switch (Platform.OS) {
    case 'android': return 'android';
    case 'ios': return 'ios';
    case 'web': return 'web';
    case 'windows': return 'windows';
    case 'macos': return 'macos';
    default: return 'unknown';
  }
}

export async function collectDeviceProfile(): Promise<DeviceProfile> {
  const native = await nativeSnapshot();
  let freeDiskBytes: number | undefined;
  if (typeof FileSystem.getFreeDiskStorageAsync === 'function') {
    try { freeDiskBytes = await FileSystem.getFreeDiskStorageAsync(); } catch { /* unknown */ }
  }
  return {
    schema: 'modelcommons.device-profile',
    schemaVersion: 1,
    protocolVersion: PROTOCOL_VERSION,
    platform: protocolPlatform(),
    osVersion: native.osVersion ?? String(Platform.Version),
    physicalMemoryBytes: native.physicalMemoryBytes,
    availableMemoryBytes: native.availableMemoryBytes,
    freeDiskBytes,
    accelerators: native.accelerators?.length
      ? native.accelerators
      : [{ id: 'cpu', kind: 'cpu', name: 'CPU (baseline)' }],
    // Runtime versions are attached by lifecycle code only after the adapter
    // confirms availability; package presence alone is not an availability claim.
    runtimeVersions: {},
    collectedAt: Date.now(),
  };
}
