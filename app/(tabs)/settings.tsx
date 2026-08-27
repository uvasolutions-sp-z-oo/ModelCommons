import React, { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { HubProfileId } from '../../store/inferenceStore';
import { ActionButton, Badge, Card, HubScreen, Muted, SectionTitle, palette } from '../../components/modelcommons/HubUI';
import { useChatStore } from '../../store/chatStore';
import { useHubStore } from '../../store/inferenceStore';

const PROFILES: HubProfileId[] = ['safe', 'balanced', 'performance', 'experimental-moe'];

export default function SettingsScreen() {
  const profileId = useHubStore((state) => state.profileId);
  const context = useHubStore((state) => state.context);
  const maxOutput = useHubStore((state) => state.maxOutput);
  const diagnostics = useHubStore((state) => state.diagnosticsEnabled);
  const experimental = useHubStore((state) => state.experimentalEnabled);
  const actions = useHubStore((state) => state.actions);
  const clearChats = useChatStore((state) => state.actions.clearAllSessions);
  const [contextText, setContextText] = useState(String(context));
  const [maxOutputText, setMaxOutputText] = useState(String(maxOutput));

  const saveLimits = () => {
    actions.setContext(Number(contextText));
    actions.setMaxOutput(Number(maxOutputText));
  };
  const setExperimental = (enabled: boolean) => {
    actions.setExperimentalEnabled(enabled);
    if (!enabled && profileId === 'experimental-moe') actions.setProfileId('safe');
  };

  return (
    <HubScreen title="Settings" subtitle="Normal applications express intent. These advanced controls remain Hub policy, not provider-specific knobs.">
      <Card>
        <SectionTitle>Runtime profile</SectionTitle>
        <View style={styles.wrap}>
          {PROFILES.map((profile) => (
            <Text
              key={profile}
              onPress={profile !== 'experimental-moe' || experimental ? () => actions.setProfileId(profile) : undefined}
              style={[
                styles.chip,
                profileId === profile && styles.chipSelected,
                profile === 'experimental-moe' && !experimental && styles.chipDisabled,
              ]}
            >{profile}</Text>
          ))}
        </View>
        <Muted>Safe is the first retry after a memory failure. Experimental MoE is never enabled automatically.</Muted>
      </Card>
      <Card>
        <SectionTitle>Generation limits</SectionTitle>
        <Text style={styles.label}>Context tokens</Text>
        <TextInput keyboardType="number-pad" value={contextText} onChangeText={setContextText} style={styles.input} />
        <Text style={styles.label}>Maximum output tokens</Text>
        <TextInput keyboardType="number-pad" value={maxOutputText} onChangeText={setMaxOutputText} style={styles.input} />
        <ActionButton label="Apply limits" onPress={saveLimits} />
      </Card>
      <Card>
        <View style={styles.row}><SectionTitle>Experimental MoE (static placement)</SectionTitle><Switch value={experimental} onValueChange={setExperimental} trackColor={{ true: palette.accent }} /></View>
        <Badge tone="warning">OPT-IN</Badge>
        <Muted>Enables large sparse-model download confirmation and an experimental static layer-placement profile. An elastic expert cache is not implemented; mmap is not a substitute for physical memory.</Muted>
      </Card>
      <Card>
        <View style={styles.row}><SectionTitle>Sanitized diagnostics</SectionTitle><Switch value={diagnostics} onValueChange={actions.setDiagnosticsEnabled} trackColor={{ true: palette.accent }} /></View>
        <Muted>Diagnostics may include model/runtime/profile/timing/status/device metadata. They exclude prompts, responses, customer objects, medical data, and tool payloads.</Muted>
      </Card>
      <Card>
        <SectionTitle>Privacy</SectionTitle>
        <Muted>Chats are memory-only. There is no hidden cloud fallback and no global fetch patch. Clear the current in-memory conversations at any time.</Muted>
        <ActionButton label="Clear in-memory chats" tone="danger" onPress={() => Alert.alert('Clear chats?', 'This removes the current in-memory conversations.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', style: 'destructive', onPress: clearChats },
        ])} />
      </Card>
    </HubScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#E9EEF2', color: palette.ink, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, fontSize: 13, fontWeight: '700' },
  chipSelected: { backgroundColor: palette.accent, color: '#fff' },
  chipDisabled: { opacity: 0.45 },
  label: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: '#F7F9FA', color: palette.ink, padding: 11, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
