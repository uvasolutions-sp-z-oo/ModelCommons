import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Share, StyleSheet, View } from 'react-native';
import { createClientConfiguration } from '@modelcommons/client';
import {
  listPendingAndroidClients,
  setAndroidClientAuthorization,
  type PendingAndroidClient,
} from '@modelcommons/native';
import type { AuthorizedClient } from '@modelcommons/protocol';
import { ActionButton, Badge, Card, HubScreen, KeyValue, Muted, SectionTitle } from '../../components/modelcommons/HubUI';
import { useHubStore } from '../../store/inferenceStore';

function authorizationId(packageName: string, userId: number, certificate: string): string {
  return `android:${userId}:${encodeURIComponent(packageName)}:${certificate}`;
}

export default function ClientsScreen() {
  const clients = useHubStore((state) => state.authorizedClients);
  const selectedModelId = useHubStore((state) => state.selectedModelId);
  const profileId = useHubStore((state) => state.profileId);
  const context = useHubStore((state) => state.context);
  const maxOutput = useHubStore((state) => state.maxOutput);
  const actions = useHubStore((state) => state.actions);
  const [pending, setPending] = useState<PendingAndroidClient[]>([]);
  const [nativeMessage, setNativeMessage] = useState<string>();
  const [busyId, setBusyId] = useState<string>();

  const recordedIds = useMemo(
    () => new Set(clients.filter((client) => !client.revokedAt).map((client) => client.id)),
    [clients]
  );

  const loadPending = async () => {
    if (Platform.OS !== 'android') {
      setNativeMessage('Android package/certificate approvals are managed on Android. iOS access is granted through App Groups or the folder picker connector.');
      return;
    }
    try {
      setPending(await listPendingAndroidClients());
      setNativeMessage(undefined);
    } catch (error) {
      setNativeMessage(error instanceof Error ? error.message : 'Native authorization state is unavailable in this build.');
    }
  };

  useEffect(() => { void loadPending(); }, []);

  const exportConfig = async () => {
    const config = createClientConfiguration({
      id: 'replace.with.client.package',
      displayName: 'ModelCommons client',
      capabilities: ['text'],
      preferredModelId: selectedModelId,
      profile: profileId,
      context,
      maxOutput,
      fallback: 'unavailable',
      transports: ['hub-service', 'shared-file', 'local-runtime', 'system'],
    });
    await Share.share({ message: JSON.stringify(config, null, 2), title: 'ModelCommons client configuration' });
  };

  const approve = async (request: PendingAndroidClient, certificate: string) => {
    const id = authorizationId(request.packageName, request.userId, certificate);
    setBusyId(id);
    try {
      await setAndroidClientAuthorization({
        packageName: request.packageName,
        userId: request.userId,
        certificateSha256: certificate,
        approved: true,
        scopes: ['metadata', 'inference'],
      });
      const client: AuthorizedClient = {
        id,
        displayName: request.packageName,
        platformPackageIds: [request.packageName],
        requestedCapabilities: [],
        authorizedAt: Date.now(),
        platformAuthorization: {
          platform: 'android',
          userId: request.userId,
          certificateSha256: certificate,
          scopes: ['metadata', 'inference'],
        },
      };
      actions.authorizeClient(client);
    } catch (error) {
      Alert.alert('Authorization failed', error instanceof Error ? error.message : 'The native authorization could not be persisted.');
    } finally {
      setBusyId(undefined);
    }
  };

  const revoke = async (client: AuthorizedClient) => {
    setBusyId(client.id);
    try {
      if (client.platformAuthorization?.platform === 'android') {
        await setAndroidClientAuthorization({
          packageName: client.platformPackageIds[0],
          userId: client.platformAuthorization.userId,
          certificateSha256: client.platformAuthorization.certificateSha256,
          approved: false,
          scopes: client.platformAuthorization.scopes,
        });
      }
      actions.revokeClient(client.id);
    } catch (error) {
      Alert.alert('Revocation failed', error instanceof Error ? error.message : 'The native authorization could not be revoked.');
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <HubScreen title="Clients" subtitle="Application identity, package certificates, model intent, and revocable access. Client configs contain no secrets.">
      <Card>
        <SectionTitle>Integration config</SectionTitle>
        <Muted>Export a provider-neutral text-only starting point. Replace the placeholder package ID and approve it in the Hub; aliases are empty by default. Add tools only after the selected backend reports them.</Muted>
        <KeyValue label="Selected model" value={selectedModelId} />
        <KeyValue label="Profile" value={profileId} />
        <ActionButton label="Share client config" onPress={() => void exportConfig()} />
      </Card>

      <View style={styles.row}><SectionTitle>Pending Android requests</SectionTitle><Badge>{pending.length}</Badge></View>
      {nativeMessage ? <Card><Muted>{nativeMessage}</Muted></Card> : null}
      {pending.flatMap((request) => request.certificateSha256.map((certificate) => {
        const id = authorizationId(request.packageName, request.userId, certificate);
        const recorded = recordedIds.has(id);
        return (
          <Card key={id}>
            <View style={styles.row}><SectionTitle>{request.packageName}</SectionTitle><Badge tone={recorded ? 'success' : 'warning'}>{recorded ? 'RECORDED' : 'PENDING'}</Badge></View>
            <KeyValue label="Android user" value={String(request.userId)} />
            <KeyValue label="Certificate SHA-256" value={certificate} />
            <KeyValue label="Requested capabilities" value="Not declared by Binder v1" />
            {!recorded ? <ActionButton label="Approve metadata + inference" onPress={() => void approve(request, certificate)} busy={busyId === id} /> : null}
          </Card>
        );
      }))}
      <ActionButton label="Refresh native requests" onPress={() => void loadPending()} tone="secondary" />

      <View style={styles.row}><SectionTitle>Recorded approvals</SectionTitle><Badge>{clients.filter((client) => !client.revokedAt).length}</Badge></View>
      <Muted>This list is a UI audit copy, not the authorization authority. The Android service revalidates the calling UID, installed package, certificate, user, and scope on every Binder call and fails closed if native state differs.</Muted>
      {clients.length === 0 ? (
        <Card>
          <Muted>No external client approval is recorded. Android Binder authorization fails closed until the user approves an installed package/certificate scope. iOS folder access requires an explicit picker or configured App Group.</Muted>
        </Card>
      ) : clients.map((client) => (
        <Card key={client.id}>
          <View style={styles.row}><SectionTitle>{client.displayName}</SectionTitle><Badge tone={client.revokedAt ? 'danger' : 'success'}>{client.revokedAt ? 'REVOKED' : 'RECORDED'}</Badge></View>
          <KeyValue label="Client ID" value={client.id} />
          <KeyValue label="Recorded package(s)" value={client.platformPackageIds.join(', ')} />
          <KeyValue label="Capabilities" value={client.requestedCapabilities.join(', ') || 'Not declared'} />
          {client.platformAuthorization?.platform === 'android' ? <KeyValue label="Scopes" value={client.platformAuthorization.scopes.join(', ')} /> : null}
          {!client.revokedAt ? <ActionButton label="Revoke authorization" onPress={() => void revoke(client)} tone="danger" busy={busyId === client.id} /> : null}
        </Card>
      ))}
    </HubScreen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 } });
