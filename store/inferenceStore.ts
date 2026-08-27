import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  MODEL_CAPABILITIES,
  type AuthorizedClient,
  type DeviceProfile,
  type ModelRegistry,
} from '@modelcommons/protocol';
import { configureDiagnosticLogging } from '../services/logger';
import { createEmptyRegistry } from '../services/modelcommons/registry';

export type HubProfileId = 'safe' | 'balanced' | 'performance' | 'experimental-moe';
type RuntimeFailureRecord = NonNullable<DeviceProfile['previousFailures']>[number];
const HUB_PROFILES = new Set<HubProfileId>(['safe', 'balanced', 'performance', 'experimental-moe']);

function plainRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function boundedString(value: unknown, maximum = 512): string | undefined {
  return typeof value === 'string' && value.trim() && value.length <= maximum && !/[\u0000-\u001f]/.test(value)
    ? value
    : undefined;
}

function positiveTimestamp(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

function sanitizeRuntimeFailure(value: unknown): RuntimeFailureRecord | undefined {
  const candidate = plainRecord(value);
  if (!candidate) return undefined;
  const modelId = boundedString(candidate.modelId);
  const profileId = boundedString(candidate.profileId, 128);
  const category = boundedString(candidate.category, 64);
  const occurredAt = positiveTimestamp(candidate.occurredAt);
  if (!modelId || !profileId || !category || !occurredAt || !/^[A-Za-z0-9_-]+$/.test(category)) return undefined;
  return { modelId, profileId, category, occurredAt };
}

function sanitizeAuthorizedClient(value: unknown): AuthorizedClient | undefined {
  const candidate = plainRecord(value);
  if (!candidate) return undefined;
  const id = boundedString(candidate.id, 1024);
  const displayName = boundedString(candidate.displayName, 256);
  const authorizedAt = positiveTimestamp(candidate.authorizedAt);
  const revokedAt = candidate.revokedAt === undefined ? undefined : positiveTimestamp(candidate.revokedAt);
  if (!id || !displayName || !authorizedAt || (candidate.revokedAt !== undefined && !revokedAt)) return undefined;
  if (!Array.isArray(candidate.platformPackageIds) || candidate.platformPackageIds.length > 16) return undefined;
  const platformPackageIds = candidate.platformPackageIds.map((item) => boundedString(item, 256));
  if (!platformPackageIds.length || platformPackageIds.some((item) => !item)) return undefined;
  if (!Array.isArray(candidate.requestedCapabilities)) return undefined;
  const requestedCapabilities = candidate.requestedCapabilities.filter(
    (item): item is (typeof MODEL_CAPABILITIES)[number] => MODEL_CAPABILITIES.includes(item as (typeof MODEL_CAPABILITIES)[number])
  );
  if (requestedCapabilities.length !== candidate.requestedCapabilities.length) return undefined;

  let platformAuthorization: AuthorizedClient['platformAuthorization'];
  if (candidate.platformAuthorization !== undefined) {
    const authorization = plainRecord(candidate.platformAuthorization);
    if (!authorization) return undefined;
    if (authorization.platform === 'android') {
      const certificateSha256 = typeof authorization.certificateSha256 === 'string'
        ? authorization.certificateSha256.toLowerCase().replace(/:/g, '')
        : '';
      if (
        !Number.isSafeInteger(authorization.userId)
        || Number(authorization.userId) < 0
        || !/^[a-f0-9]{64}$/.test(certificateSha256)
        || !Array.isArray(authorization.scopes)
      ) return undefined;
      const scopes = [...new Set(authorization.scopes.filter(
        (scope): scope is 'metadata' | 'inference' => scope === 'metadata' || scope === 'inference'
      ))];
      if (!scopes.length || scopes.length !== authorization.scopes.length) return undefined;
      platformAuthorization = {
        platform: 'android',
        userId: Number(authorization.userId),
        certificateSha256,
        scopes,
      };
    } else if (authorization.platform === 'ios') {
      const connectionId = boundedString(authorization.connectionId, 1024);
      if (!connectionId || (authorization.kind !== 'security-scoped' && authorization.kind !== 'app-group')) return undefined;
      platformAuthorization = { platform: 'ios', connectionId, kind: authorization.kind };
    } else return undefined;
  }
  return {
    id,
    displayName,
    platformPackageIds: platformPackageIds as string[],
    requestedCapabilities: [...new Set(requestedCapabilities)],
    authorizedAt,
    ...(revokedAt ? { revokedAt } : {}),
    ...(platformAuthorization ? { platformAuthorization } : {}),
  };
}

function sanitizePersistedState(value: unknown): Partial<HubState> {
  const candidate = plainRecord(value);
  if (!candidate) return {};
  const selectedModelId = boundedString(candidate.selectedModelId);
  const experimentalEnabled = typeof candidate.experimentalEnabled === 'boolean'
    ? candidate.experimentalEnabled
    : undefined;
  const parsedProfileId = HUB_PROFILES.has(candidate.profileId as HubProfileId)
    ? candidate.profileId as HubProfileId
    : undefined;
  const profileId = parsedProfileId === 'experimental-moe' && experimentalEnabled !== true
    ? 'safe'
    : parsedProfileId;
  const context = Number.isFinite(candidate.context)
    ? Math.min(131_072, Math.max(256, Math.round(Number(candidate.context))))
    : undefined;
  const maxOutput = Number.isFinite(candidate.maxOutput)
    ? Math.min(32_768, Math.max(1, Math.round(Number(candidate.maxOutput))))
    : undefined;
  const runtimeFailures = Array.isArray(candidate.runtimeFailures)
    ? candidate.runtimeFailures.map(sanitizeRuntimeFailure).filter((item): item is RuntimeFailureRecord => !!item).slice(-20)
    : [];
  const authorizedClients = Array.isArray(candidate.authorizedClients)
    ? candidate.authorizedClients.map(sanitizeAuthorizedClient).filter((item): item is AuthorizedClient => !!item).slice(-100)
    : [];
  return {
    ...(selectedModelId ? { selectedModelId } : {}),
    ...(profileId ? { profileId } : {}),
    ...(context !== undefined ? { context } : {}),
    ...(maxOutput !== undefined ? { maxOutput } : {}),
    ...(typeof candidate.diagnosticsEnabled === 'boolean' ? { diagnosticsEnabled: candidate.diagnosticsEnabled } : {}),
    ...(experimentalEnabled !== undefined ? { experimentalEnabled } : {}),
    authorizedClients,
    runtimeFailures,
  };
}

interface HubState {
  selectedModelId: string;
  profileId: HubProfileId;
  context: number;
  maxOutput: number;
  diagnosticsEnabled: boolean;
  experimentalEnabled: boolean;
  registry: ModelRegistry;
  deviceProfile?: DeviceProfile;
  runtimeFailures: RuntimeFailureRecord[];
  authorizedClients: AuthorizedClient[];
  initialized: boolean;
  initializationError?: string;
  runtimeAvailable: boolean;
  runtimeMessage?: string;
  actions: {
    setSelectedModelId: (id: string) => void;
    setProfileId: (id: HubProfileId) => void;
    setContext: (context: number) => void;
    setMaxOutput: (maxOutput: number) => void;
    setDiagnosticsEnabled: (enabled: boolean) => void;
    setExperimentalEnabled: (enabled: boolean) => void;
    setRegistry: (registry: ModelRegistry) => void;
    setDeviceProfile: (profile: DeviceProfile) => void;
    recordRuntimeFailure: (failure: RuntimeFailureRecord) => void;
    clearRuntimeFailure: (modelId: string, profileId: string) => void;
    setInitialized: (error?: string) => void;
    setRuntimeAvailability: (available: boolean, message?: string) => void;
    authorizeClient: (client: AuthorizedClient) => void;
    revokeClient: (id: string) => void;
  };
}

export const useHubStore = create<HubState>()(
  persist(
    (set) => ({
      selectedModelId: 'modelcommons:auto',
      profileId: 'balanced',
      context: 2048,
      maxOutput: 512,
      diagnosticsEnabled: false,
      experimentalEnabled: false,
      registry: createEmptyRegistry(),
      authorizedClients: [],
      runtimeFailures: [],
      initialized: false,
      runtimeAvailable: false,
      actions: {
        setSelectedModelId: (value) => set((state) => ({
          selectedModelId: boundedString(value) ?? state.selectedModelId,
        })),
        setProfileId: (value) => set((state) => ({
          profileId: HUB_PROFILES.has(value) && (value !== 'experimental-moe' || state.experimentalEnabled)
            ? value
            : state.profileId,
        })),
        setContext: (context) => set((state) => ({
          context: Number.isFinite(context)
            ? Math.min(131_072, Math.max(256, Math.round(context)))
            : state.context,
        })),
        setMaxOutput: (maxOutput) => set((state) => ({
          maxOutput: Number.isFinite(maxOutput)
            ? Math.min(32_768, Math.max(1, Math.round(maxOutput)))
            : state.maxOutput,
        })),
        setDiagnosticsEnabled: (diagnosticsEnabled) => {
          configureDiagnosticLogging(diagnosticsEnabled);
          set({ diagnosticsEnabled });
        },
        setExperimentalEnabled: (experimentalEnabled) => set((state) => ({
          experimentalEnabled,
          ...(!experimentalEnabled && state.profileId === 'experimental-moe' ? { profileId: 'safe' as const } : {}),
        })),
        setRegistry: (registry) => set({ registry }),
        setDeviceProfile: (profile) => set((state) => ({
          deviceProfile: {
            ...profile,
            ...(state.runtimeFailures.length ? { previousFailures: state.runtimeFailures } : {}),
          },
        })),
        recordRuntimeFailure: (value) => set((state) => {
          const failure = sanitizeRuntimeFailure(value);
          if (!failure) return state;
          const runtimeFailures = [...state.runtimeFailures, failure].slice(-20);
          return {
            runtimeFailures,
            ...(state.deviceProfile
              ? { deviceProfile: { ...state.deviceProfile, previousFailures: runtimeFailures } }
              : {}),
          };
        }),
        clearRuntimeFailure: (modelId, profileId) => set((state) => {
          const runtimeFailures = state.runtimeFailures.filter(
            (failure) => failure.modelId !== modelId || failure.profileId !== profileId
          );
          return {
            runtimeFailures,
            ...(state.deviceProfile
              ? {
                  deviceProfile: {
                    ...state.deviceProfile,
                    ...(runtimeFailures.length ? { previousFailures: runtimeFailures } : { previousFailures: undefined }),
                  },
                }
              : {}),
          };
        }),
        setInitialized: (initializationError) => set({ initialized: true, initializationError }),
        setRuntimeAvailability: (runtimeAvailable, runtimeMessage) => set({ runtimeAvailable, runtimeMessage }),
        authorizeClient: (value) => set((state) => {
          const client = sanitizeAuthorizedClient(value);
          if (!client) return state;
          return {
            authorizedClients: [
              ...state.authorizedClients.filter((candidate) => candidate.id !== client.id),
              client,
            ].slice(-100),
          };
        }),
        revokeClient: (id) => set((state) => ({
          authorizedClients: state.authorizedClients.map((client) =>
            client.id === id && !client.revokedAt ? { ...client, revokedAt: Date.now() } : client
          ),
        })),
      },
    }),
    {
      name: 'modelcommons-hub-settings-v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        selectedModelId: state.selectedModelId,
        profileId: state.profileId,
        context: state.context,
        maxOutput: state.maxOutput,
        diagnosticsEnabled: state.diagnosticsEnabled,
        experimentalEnabled: state.experimentalEnabled,
        authorizedClients: state.authorizedClients,
        runtimeFailures: state.runtimeFailures,
      }),
      merge: (persisted, current) => {
        const safe = sanitizePersistedState(persisted);
        const runtimeFailures = safe.runtimeFailures ?? [];
        return {
          ...current,
          ...safe,
          registry: current.registry,
          deviceProfile: current.deviceProfile
            ? {
                ...current.deviceProfile,
                ...(runtimeFailures.length ? { previousFailures: runtimeFailures } : { previousFailures: undefined }),
              }
            : undefined,
          initialized: false,
          initializationError: undefined,
          runtimeAvailable: false,
          runtimeMessage: undefined,
          actions: current.actions,
        };
      },
      onRehydrateStorage: () => (state) => {
        configureDiagnosticLogging(state?.diagnosticsEnabled ?? false);
      },
    }
  )
);
