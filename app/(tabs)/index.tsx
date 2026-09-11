import React, { useCallback, useState } from 'react';
import { Alert, Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActionButton, Badge, Card, HubScreen, KeyValue, Muted, SectionTitle, palette } from '../../components/modelcommons/HubUI';
import { initializeModelCommonsHub } from '../../services/modelcommons/lifecycle';
import { selectHubTextRecord } from '../../services/modelcommons/selection';
import { useChatStore } from '../../store/chatStore';
import { useHubStore } from '../../store/inferenceStore';

export default function HomeScreen() {
  const router = useRouter();
  const { sessions, actions: chatActions } = useChatStore();
  const registry = useHubStore((state) => state.registry);
  const selectedModelId = useHubStore((state) => state.selectedModelId);
  const profileId = useHubStore((state) => state.profileId);
  const context = useHubStore((state) => state.context);
  const initialized = useHubStore((state) => state.initialized);
  const initializationError = useHubStore((state) => state.initializationError);
  const runtimeAvailable = useHubStore((state) => state.runtimeAvailable);
  const runtimeMessage = useHubStore((state) => state.runtimeMessage);
  const experimentalEnabled = useHubStore((state) => state.experimentalEnabled);
  const deviceProfile = useHubStore((state) => state.deviceProfile);
  const [refreshing, setRefreshing] = useState(false);
  const selected = selectHubTextRecord(registry, selectedModelId, {
    runtimeAvailable,
    runtimeId: Platform.OS === 'android' ? 'modelcommons.android.cpu' : 'llama.rn',
    runtimeVersion: deviceProfile?.runtimeVersions[Platform.OS === 'android' ? 'modelcommons.android.cpu' : 'llama.rn'],
    experimentalEnabled,
    deviceProfile,
    profileId,
    context,
  });
  const usable = !!selected;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await initializeModelCommonsHub(); } finally { setRefreshing(false); }
  }, []);

  const newChat = () => {
    if (!usable) {
      Alert.alert('Local model not ready', 'Open Models, accept the separate model license, and download a compatible text model first.');
      return;
    }
    const id = chatActions.createNewSession();
    router.push(`/chat/${id}`);
  };

  return (
    <HubScreen
      title="One local model commons"
      subtitle="Download once. Run locally. Use everywhere. The Hub keeps model artifacts, runtime intent, and client access under your control."
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.accent} />}
    >
      <Card style={styles.hero}>
        <View style={styles.rowBetween}>
          <View style={styles.iconCircle}><Ionicons name="leaf" size={23} color={palette.accent} /></View>
          <Badge tone={usable ? 'success' : initializationError ? 'danger' : 'warning'}>
            {usable ? 'LOCAL READY' : initializationError ? 'INITIALIZATION FAILED' : initialized ? 'SETUP REQUIRED' : 'INITIALIZING'}
          </Badge>
        </View>
        <SectionTitle>{selected?.manifest.displayName ?? 'No ready model selected'}</SectionTitle>
        <Muted>Requests stay offline. ModelCommons never silently falls back to a cloud provider.</Muted>
        <KeyValue label="Selection" value={selectedModelId} />
        <KeyValue label="Profile" value={profileId} />
        <KeyValue label="Runtime" value={runtimeAvailable ? 'llama.rn 0.12.9' : `Unavailable${runtimeMessage ? ` · ${runtimeMessage}` : ''}`} />
        {initializationError ? <Text style={styles.error}>{initializationError}</Text> : null}
        <ActionButton label="New local chat" onPress={newChat} disabled={!usable} />
      </Card>

      <View style={styles.headingRow}>
        <SectionTitle>Memory-only chats</SectionTitle>
        <Badge>{sessions.length}</Badge>
      </View>
      <Muted>Chat text is not persisted in diagnostics or application storage.</Muted>
      {sessions.length === 0 ? (
        <Card><Muted>No conversations in memory. Start a chat after a model is ready.</Muted></Card>
      ) : sessions.map((session) => (
        <TouchableOpacity key={session.id} onPress={() => router.push(`/chat/${session.id}`)}>
          <Card style={styles.session}>
            <View style={styles.sessionText}>
              <Text style={styles.sessionTitle}>{session.title}</Text>
              <Muted>{session.messages.length} messages · {new Date(session.lastUpdated).toLocaleTimeString()}</Muted>
            </View>
            <TouchableOpacity
              accessibilityLabel={`Delete ${session.title}`}
              onPress={() => chatActions.deleteSession(session.id)}
              style={styles.delete}
            ><Ionicons name="trash-outline" size={18} color={palette.danger} /></TouchableOpacity>
          </Card>
        </TouchableOpacity>
      ))}
    </HubScreen>
  );
}

const styles = StyleSheet.create({
  hero: { borderColor: '#BDDCD9' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconCircle: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accentSoft },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  session: { flexDirection: 'row', alignItems: 'center' },
  sessionText: { flex: 1, gap: 4 },
  sessionTitle: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  delete: { padding: 10 },
  error: { color: palette.danger, fontSize: 12, lineHeight: 17 },
});
