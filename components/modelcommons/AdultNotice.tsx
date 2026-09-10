import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  acknowledgeAdultNotice,
  loadAdultNoticeRecord,
  type AdultNoticeRecord,
} from '../../services/adultNotice';
import { palette } from './HubUI';

export function AdultNotice({ children }: PropsWithChildren) {
  const dark = useColorScheme() === 'dark';
  const [loaded, setLoaded] = useState(false);
  const [record, setRecord] = useState<AdultNoticeRecord>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void loadAdultNoticeRecord()
      .then((value) => { if (active) setRecord(value); })
      .catch(() => { if (active) setError('The age acknowledgement could not be loaded.'); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  if (!loaded) {
    return (
      <View accessibilityLabel="Loading age notice" style={[styles.loading, dark && styles.darkBackground]}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }
  if (record) return children;

  const confirm = async () => {
    if (saving) return;
    setSaving(true);
    setError(undefined);
    try {
      setRecord(await acknowledgeAdultNotice());
    } catch {
      setError('The acknowledgement could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, dark && styles.darkBackground]}>
      <View style={[styles.card, dark && styles.darkCard]}>
        <Text accessibilityRole="header" style={[styles.title, dark && styles.darkText]}>Adults only</Text>
        <Text style={[styles.notice, dark && styles.darkText]}>ModelCommons is intended only for adults aged 18 and over. Local models have different safety behaviours and may produce inaccurate, offensive, disturbing, sexual, violent, or otherwise inappropriate output.</Text>
        <Text style={[styles.explanation, dark && styles.darkMuted]}>This acknowledgement is a disclosure and access gate. It is not proof of age, and ModelCommons does not ask for your date of birth or identity.</Text>
        {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityHint="Stores an acknowledgement, policy version, and time on this device, then enters the Hub"
          accessibilityLabel="I confirm that I am at least 18"
          accessibilityRole="button"
          accessibilityState={{ busy: saving, disabled: saving }}
          disabled={saving}
          onPress={() => { void confirm(); }}
          style={[styles.button, saving && styles.disabled]}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>I confirm that I am at least 18</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.canvas },
  safe: { flex: 1, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { maxWidth: 620, width: '100%', backgroundColor: palette.card, borderColor: palette.border, borderWidth: 1, borderRadius: 20, padding: 22, gap: 16 },
  title: { color: palette.ink, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  notice: { color: palette.ink, fontSize: 17, lineHeight: 25, fontWeight: '600' },
  explanation: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  error: { color: palette.danger, backgroundColor: palette.dangerSoft, borderRadius: 10, padding: 12, fontSize: 14, lineHeight: 20 },
  button: { minHeight: 52, borderRadius: 12, backgroundColor: palette.accent, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, lineHeight: 22, fontWeight: '800', textAlign: 'center' },
  disabled: { opacity: 0.48 },
  darkBackground: { backgroundColor: '#111B28' },
  darkCard: { backgroundColor: '#182638', borderColor: '#35465A' },
  darkText: { color: '#F3F6F8' },
  darkMuted: { color: '#B8C4D2' },
});
