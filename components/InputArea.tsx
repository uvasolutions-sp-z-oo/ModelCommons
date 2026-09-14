import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from './modelcommons/HubUI';

export function InputArea({
  onSend,
  onCancel,
  loading = false,
  disabled = false,
  placeholder = 'Message the selected local model',
}: {
  onSend: (text: string) => void;
  onCancel?: () => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const submit = () => {
    const value = text.trim();
    if (!value || loading || disabled) return;
    setText('');
    onSend(value);
  };

  return (
    <View style={styles.container}>
      <TextInput
        accessibilityLabel="Local chat message"
        placeholder={placeholder}
        placeholderTextColor="#8090A2"
        multiline
        maxLength={16_000}
        value={text}
        onChangeText={setText}
        style={styles.input}
        editable={!loading && !disabled}
      />
      {loading ? (
        <TouchableOpacity accessibilityLabel="Cancel generation" onPress={onCancel} style={styles.cancel}>
          <Ionicons name="stop" size={19} color="#fff" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity accessibilityLabel="Send" onPress={submit} disabled={!text.trim() || disabled} style={[styles.send, (!text.trim() || disabled) && styles.disabled]}>
          <Ionicons name="arrow-up" size={21} color="#fff" />
        </TouchableOpacity>
      )}
      {loading ? <ActivityIndicator size="small" color={palette.accent} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: '#fff' },
  input: { flex: 1, maxHeight: 140, minHeight: 44, backgroundColor: '#F0F4F6', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, color: palette.ink, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  cancel: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.danger, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
