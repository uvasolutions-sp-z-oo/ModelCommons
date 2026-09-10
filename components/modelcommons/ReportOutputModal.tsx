import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MAX_REPORT_NOTE_CHARACTERS,
  MAX_REPORT_RESPONSE_CHARACTERS,
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  buildReportPayload,
  countCharacters,
  limitCharacters,
  nextReportAttempt,
  type ReportAttemptState,
  type ReportCategory,
  type ReportOutputContext,
} from '../../services/reporting/contract';
import {
  ReportTransportError,
  configuredReportUrl,
  createReportId,
  submitReportOutput,
} from '../../services/reporting/reportOutput';
import { palette } from './HubUI';

const PRIVACY_URL = 'https://uva.solutions/index.php?option=com_content&view=article&id=80&catid=8&lang=en&Itemid=128';

export interface ReportOutputModalProps {
  visible: boolean;
  responseText: string;
  context: ReportOutputContext;
  onClose: () => void;
}

export function ReportOutputModal({ visible, responseText, context, onClose }: ReportOutputModalProps) {
  const dark = useColorScheme() === 'dark';
  const [category, setCategory] = useState<ReportCategory | undefined>();
  const [note, setNote] = useState('');
  const [attempt, setAttempt] = useState<ReportAttemptState>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [receipt, setReceipt] = useState<string>();
  const submittingRef = useRef(false);
  const responseLength = countCharacters(responseText);
  const previewText = useMemo(
    () => limitCharacters(responseText, MAX_REPORT_RESPONSE_CHARACTERS),
    [responseText]
  );
  const truncated = responseLength > MAX_REPORT_RESPONSE_CHARACTERS;
  const reportingAvailable = !!configuredReportUrl();

  useEffect(() => {
    if (!visible) return;
    setCategory(undefined);
    setNote('');
    setAttempt(undefined);
    submittingRef.current = false;
    setSubmitting(false);
    setError(undefined);
    setReceipt(undefined);
  }, [responseText, visible]);

  const send = async () => {
    if (!category || submittingRef.current) return;
    const draft = { responseText, category, note, context };
    const currentAttempt = nextReportAttempt(draft, attempt, createReportId);
    setAttempt(currentAttempt);
    submittingRef.current = true;
    setSubmitting(true);
    setError(undefined);
    try {
      const payload = buildReportPayload(draft, currentAttempt.reportId, currentAttempt.clientCreatedAt);
      const result = await submitReportOutput(payload);
      setReceipt(result.reportId);
    } catch (cause) {
      setError(cause instanceof ReportTransportError
        ? cause.message
        : 'The report could not be sent. Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const colors = dark
    ? { background: '#111B28', card: '#182638', text: '#F3F6F8', muted: '#B8C4D2', border: '#35465A', input: '#0F1926' }
    : { background: palette.canvas, card: palette.card, text: palette.ink, muted: palette.muted, border: palette.border, input: '#FFFFFF' };

  return (
    <Modal
      animationType="slide"
      onRequestClose={() => { if (!submitting) onClose(); }}
      presentationStyle="pageSheet"
      transparent={false}
      visible={visible}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Report output</Text>
          {receipt ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text accessibilityRole="header" style={[styles.successTitle, { color: colors.text }]}>Report sent</Text>
              <Text selectable style={[styles.body, { color: colors.muted }]}>The configured report receiver accepted report reference:</Text>
              <Text selectable style={[styles.reference, { color: colors.text }]}>{receipt}</Text>
              <Pressable
                accessibilityLabel="Close report confirmation"
                accessibilityRole="button"
                onPress={onClose}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Close</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={[styles.body, { color: colors.muted }]}>The selected model response shown below will be sent voluntarily to the configured report receiver. No prompt or other conversation message is included.</Text>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Selected response</Text>
                {truncated ? (
                  <Text accessibilityLiveRegion="polite" style={[styles.warning, { color: dark ? '#F4BD69' : palette.warning }]}>This response has {responseLength.toLocaleString()} characters. The submitted copy is visibly limited to the first {MAX_REPORT_RESPONSE_CHARACTERS.toLocaleString()} characters.</Text>
                ) : null}
                <ScrollView nestedScrollEnabled style={[styles.preview, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <Text selectable style={[styles.previewText, { color: colors.text }]}>{previewText}</Text>
                </ScrollView>
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Why are you reporting this output?</Text>
                <Text style={[styles.required, { color: colors.muted }]}>Required</Text>
                {REPORT_CATEGORIES.map((value) => {
                  const selected = category === value;
                  return (
                    <Pressable
                      accessibilityLabel={REPORT_CATEGORY_LABELS[value]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: submitting }}
                      disabled={submitting}
                      key={value}
                      onPress={() => { setCategory(value); setError(undefined); }}
                      style={({ pressed }) => [
                        styles.category,
                        { borderColor: selected ? palette.accent : colors.border },
                        selected && { backgroundColor: dark ? '#1D464A' : palette.accentSoft },
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={[styles.radio, { borderColor: selected ? palette.accent : colors.muted }]}>
                        {selected ? <View style={styles.radioDot} /> : null}
                      </View>
                      <Text style={[styles.categoryText, { color: colors.text }]}>{REPORT_CATEGORY_LABELS[value]}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Optional note</Text>
                <Text style={[styles.warning, { color: dark ? '#F4BD69' : palette.warning }]}>Do not add names, contact information, customer data, medical information, passwords, access tokens, or other sensitive information.</Text>
                <TextInput
                  accessibilityLabel="Optional report note"
                  accessibilityHint={`Plain text, maximum ${MAX_REPORT_NOTE_CHARACTERS.toLocaleString()} characters`}
                  multiline
                  maxLength={MAX_REPORT_NOTE_CHARACTERS}
                  editable={!submitting}
                  onChangeText={(value) => { setNote(value); setError(undefined); }}
                  placeholder="Add context for the reviewer"
                  placeholderTextColor={colors.muted}
                  style={[styles.note, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                  textAlignVertical="top"
                  value={note}
                />
                <Text style={[styles.counter, { color: colors.muted }]}>{countCharacters(note).toLocaleString()} / {MAX_REPORT_NOTE_CHARACTERS.toLocaleString()}</Text>
                <Pressable
                  accessibilityHint="Opens the published ModelCommons Privacy Policy"
                  accessibilityLabel="ModelCommons Privacy Policy"
                  accessibilityRole="link"
                  onPress={() => { void Linking.openURL(PRIVACY_URL); }}
                  style={styles.linkTarget}
                >
                  <Text style={[styles.link, { color: dark ? '#7BD3D0' : palette.accent }]}>ModelCommons Privacy Policy</Text>
                </Pressable>
              </View>

              {!reportingAvailable ? <Text accessibilityLiveRegion="polite" style={[styles.unavailable, { color: colors.muted, backgroundColor: colors.card, borderColor: colors.border }]}>Diagnostic reporting is not configured in this build.</Text> : null}
              {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}>
                <Pressable
                  accessibilityHint="Closes without sending the selected response"
                  accessibilityLabel="Cancel report"
                  accessibilityRole="button"
                  disabled={submitting}
                  onPress={onClose}
                  style={[styles.secondaryButton, { borderColor: colors.border }, submitting && styles.disabled]}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityHint="Sends this selected response and report details to the configured report receiver"
                  accessibilityLabel="Send report"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !category || submitting || !reportingAvailable, busy: submitting }}
                  disabled={!category || submitting || !reportingAvailable}
                  onPress={() => { void send(); }}
                  style={[styles.primaryButton, (!category || submitting || !reportingAvailable) && styles.disabled]}
                >
                  {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Send report</Text>}
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 48, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  body: { fontSize: 15, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: 16, padding: 15, gap: 10 },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  required: { fontSize: 12, fontWeight: '700' },
  preview: { borderWidth: 1, borderRadius: 10, padding: 12, maxHeight: 260 },
  previewText: { fontSize: 14, lineHeight: 20 },
  warning: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  category: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  categoryText: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  radio: { width: 22, height: 22, borderWidth: 2, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.accent },
  pressed: { opacity: 0.72 },
  note: { minHeight: 120, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, lineHeight: 21 },
  counter: { fontSize: 12, textAlign: 'right' },
  linkTarget: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  link: { fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  unavailable: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, lineHeight: 20 },
  error: { color: palette.danger, backgroundColor: palette.dangerSoft, borderRadius: 10, padding: 12, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: Platform.OS === 'web' ? 'row' : 'column-reverse', gap: 10 },
  primaryButton: { minHeight: 48, borderRadius: 12, paddingHorizontal: 18, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', flex: 1 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryButton: { minHeight: 48, borderRadius: 12, paddingHorizontal: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flex: 1 },
  secondaryButtonText: { fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  successTitle: { fontSize: 22, fontWeight: '800' },
  reference: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
});
