import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Message } from '../types';
import { palette } from './modelcommons/HubUI';

export default function MessageItem({ message }: { message: Message }) {
  const user = message.role === 'user';
  const system = message.role === 'system';
  return (
    <View style={[styles.row, user ? styles.userRow : styles.assistantRow]}>
      <View style={[styles.bubble, user ? styles.userBubble : system ? styles.systemBubble : styles.assistantBubble]}>
        <Text style={[styles.label, user && styles.userText]}>{system ? 'LOCAL STATUS' : user ? 'YOU' : 'LOCAL MODEL'}</Text>
        <Text selectable style={[styles.content, user && styles.userContent]}>{message.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 5, flexDirection: 'row' },
  userRow: { justifyContent: 'flex-end' },
  assistantRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '88%', minWidth: 96, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 },
  userBubble: { backgroundColor: palette.accent, borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: '#EDF2F5', borderBottomLeftRadius: 4 },
  systemBubble: { backgroundColor: palette.warningSoft, borderColor: '#F0D29A', borderWidth: 1 },
  label: { color: palette.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
  userText: { color: '#DDF7F4' },
  content: { color: palette.ink, fontSize: 15, lineHeight: 21 },
  userContent: { color: '#fff' },
});
