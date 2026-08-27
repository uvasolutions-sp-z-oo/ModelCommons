import type { PropsWithChildren, ReactNode } from 'react';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export const palette = {
  ink: '#132238',
  muted: '#617188',
  canvas: '#F3F6F8',
  card: '#FFFFFF',
  border: '#DCE5EA',
  accent: '#136F70',
  accentSoft: '#DDF1EF',
  warning: '#9A5A00',
  warningSoft: '#FFF1D8',
  danger: '#A43838',
  dangerSoft: '#FBE4E4',
  success: '#29734B',
};

export function HubScreen({
  title,
  subtitle,
  children,
  refreshControl,
}: PropsWithChildren<{ title: string; subtitle?: string; refreshControl?: ReactNode }>) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={refreshControl as never}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>MODELCOMMONS</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Muted({ children }: PropsWithChildren) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Badge({
  children,
  tone = 'neutral',
}: PropsWithChildren<{ tone?: 'neutral' | 'success' | 'warning' | 'danger' }>) {
  return (
    <View style={[styles.badge, tone === 'success' && styles.badgeSuccess, tone === 'warning' && styles.badgeWarning, tone === 'danger' && styles.badgeDanger]}>
      <Text style={[styles.badgeText, tone === 'success' && styles.textSuccess, tone === 'warning' && styles.textWarning, tone === 'danger' && styles.textDanger]}>{children}</Text>
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  disabled,
  busy,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={[
        styles.button,
        tone === 'secondary' && styles.buttonSecondary,
        tone === 'danger' && styles.buttonDanger,
        (disabled || busy) && styles.buttonDisabled,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={tone === 'secondary' ? palette.ink : '#fff'} /> : null}
      <Text style={[styles.buttonText, tone === 'secondary' && styles.buttonSecondaryText]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.keyValue}>
      <Text style={styles.key}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return 'Unknown';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(unit === 0 ? 0 : value >= 10 ? 1 : 2)} ${units[unit]}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas, paddingTop: Platform.OS === 'android' ? 18 : 0 },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 48, gap: 14 },
  header: { marginBottom: 2 },
  eyebrow: { color: palette.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: palette.ink, fontSize: 30, lineHeight: 36, fontWeight: '800', marginTop: 4 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: 6, maxWidth: 620 },
  card: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    ...(Platform.OS === 'web' ? { boxShadow: '0 3px 12px rgba(23, 43, 55, 0.07)' } : { elevation: 1 }),
  },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: '700' },
  muted: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: '#E9EEF2' },
  badgeSuccess: { backgroundColor: palette.accentSoft },
  badgeWarning: { backgroundColor: palette.warningSoft },
  badgeDanger: { backgroundColor: palette.dangerSoft },
  badgeText: { color: palette.ink, fontSize: 11, fontWeight: '800' },
  textSuccess: { color: palette.success },
  textWarning: { color: palette.warning },
  textDanger: { color: palette.danger },
  button: { minHeight: 44, paddingHorizontal: 15, borderRadius: 12, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonSecondary: { backgroundColor: '#EDF2F5', borderWidth: 1, borderColor: palette.border },
  buttonDanger: { backgroundColor: palette.danger },
  buttonDisabled: { opacity: 0.48 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  buttonSecondaryText: { color: palette.ink },
  keyValue: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingVertical: 3 },
  key: { color: palette.muted, fontSize: 13, flex: 1 },
  value: { color: palette.ink, fontSize: 13, fontWeight: '600', flex: 2, textAlign: 'right' },
});
