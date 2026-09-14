import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import Constants from 'expo-constants';
import type { ModelCommonsMessage } from '@modelcommons/protocol';
import { InputArea } from '../../components/InputArea';
import MessageItem from '../../components/MessageItem';
import { Badge, palette } from '../../components/modelcommons/HubUI';
import { ReportOutputModal } from '../../components/modelcommons/ReportOutputModal';
import { streamHubChat } from '../../services/modelcommons/inference';
import { selectHubTextRecord } from '../../services/modelcommons/selection';
import { useChatStore } from '../../store/chatStore';
import { useHubStore } from '../../store/inferenceStore';
import type { Message } from '../../types';

export default function ChatScreen() {
  const headerHeight = useHeaderHeight();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessions = useChatStore((state) => state.sessions);
  const chatActions = useChatStore((state) => state.actions);
  const selectedModelId = useHubStore((state) => state.selectedModelId);
  const profileId = useHubStore((state) => state.profileId);
  const maxOutput = useHubStore((state) => state.maxOutput);
  const context = useHubStore((state) => state.context);
  const registry = useHubStore((state) => state.registry);
  const runtimeAvailable = useHubStore((state) => state.runtimeAvailable);
  const experimentalEnabled = useHubStore((state) => state.experimentalEnabled);
  const deviceProfile = useHubStore((state) => state.deviceProfile);
  const session = sessions.find((candidate) => candidate.id === id);
  const resolvedModel = selectHubTextRecord(registry, selectedModelId, {
    runtimeAvailable,
    runtimeId: Platform.OS === 'android' ? 'modelcommons.android.cpu' : 'llama.rn',
    runtimeVersion: deviceProfile?.runtimeVersions[Platform.OS === 'android' ? 'modelcommons.android.cpu' : 'llama.rn'],
    experimentalEnabled,
    deviceProfile,
    profileId,
    context,
  });
  const resolvedModelId = resolvedModel?.manifest.id;
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [reportedMessage, setReportedMessage] = useState<Message>();
  const abort = useRef<AbortController | null>(null);
  const list = useRef<FlatList<Message>>(null);

  useEffect(() => () => abort.current?.abort(), []);
  const displayed = useMemo(() => {
    if (!session) return [];
    return streaming
      ? [...session.messages, { id: 'streaming', role: 'assistant' as const, content: streaming, timestamp: Date.now() }]
      : session.messages;
  }, [session, streaming]);

  if (!session) {
    return <View style={styles.center}><ActivityIndicator color={palette.accent} /></View>;
  }

  const send = async (text: string) => {
    if (loading) return;
    if (!resolvedModelId) {
      Alert.alert(
        'Select an installed model',
        'The current selection is not ready for this Android runtime. Open Models, finish a download, and select a READY model.'
      );
      return;
    }
    const pending: Message = { id: 'pending', role: 'user', content: text, timestamp: Date.now() };
    const history: ModelCommonsMessage[] = [...session.messages, pending]
      .filter((message) => message.role !== 'system')
      .map((message) => ({ role: message.role as 'user' | 'assistant', content: [{ type: 'text', text: message.content }] }));
    chatActions.addMessage(session.id, 'user', text);
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    setStreaming('');
    try {
      const result = await streamHubChat({
        messages: history,
        modelId: resolvedModelId,
        profile: profileId,
        context,
        maxOutputTokens: maxOutput,
        signal: controller.signal,
        onText: setStreaming,
      });
      if (result.text.trim()) {
        const runtimeVersion = deviceProfile?.runtimeVersions[result.runtimeId];
        if (!runtimeVersion) throw new Error('The active runtime version could not be resolved.');
        chatActions.addMessage(session.id, 'assistant', result.text, {
          modelId: result.modelId,
          modelRevision: result.modelRevision,
          runtimeVersion,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Local inference failed.';
      if (!controller.signal.aborted) {
        Alert.alert('Local inference unavailable', message);
        chatActions.addMessage(session.id, 'system', message);
      }
    } finally {
      abort.current = null;
      setStreaming('');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : headerHeight}
    >
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
        <Stack.Screen options={{ title: session.title }} />
        <View style={styles.status}>
          <Badge tone={resolvedModelId ? 'success' : 'warning'}>{resolvedModelId ? 'OFFLINE' : 'NOT READY'}</Badge>
          <Text numberOfLines={1} style={styles.model}>
            {resolvedModelId ? `${resolvedModelId} · ${profileId}` : 'Select a READY model in Models'}
          </Text>
        </View>
        <FlatList
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          ref={list}
          data={displayed}
          keyExtractor={(message) => message.id}
          renderItem={({ item }) => (
            <MessageItem
              message={item}
              onReportOutput={
                (Platform.OS === 'android' || Platform.OS === 'ios')
                && item.role === 'assistant'
                && !!item.executionContext
                  ? setReportedMessage
                  : undefined
              }
            />
          )}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>Local, generic chat</Text><Text style={styles.emptyText}>Prompts and responses remain in memory and are excluded from diagnostics.</Text></View>}
        />
        <InputArea
          onSend={(text) => void send(text)}
          onCancel={() => abort.current?.abort()}
          loading={loading}
          disabled={!resolvedModelId}
          placeholder={resolvedModelId ? 'Message the selected local model' : 'Select an installed model first'}
        />
        {reportedMessage?.executionContext ? (
          <ReportOutputModal
            visible
            responseText={reportedMessage.content}
            context={{
              ...reportedMessage.executionContext,
              appVersion: Constants.expoConfig?.version ?? 'unknown',
              platform: Platform.OS as 'android' | 'ios',
              locale: (Intl.DateTimeFormat().resolvedOptions().locale || 'en').slice(0, 32),
            }}
            onClose={() => setReportedMessage(undefined)}
          />
        ) : null}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.border },
  model: { flex: 1, color: palette.muted, fontSize: 11 },
  messages: { flexGrow: 1, paddingVertical: 8 },
  empty: { flex: 1, minHeight: Platform.OS === 'android' ? 0 : 300, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyTitle: { color: palette.ink, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyText: { color: palette.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
