import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card, HubScreen, Muted, SectionTitle, palette } from '../../components/modelcommons/HubUI';
import { COMPATIBILITY_MATRIX, SUPPORTED_ENDPOINTS, type CompatibilityStatus } from '../../services/modelcommons/compatibility';

const tone = (status: CompatibilityStatus) => status === 'SUPPORTED' ? 'success' : status === 'UNSUPPORTED' ? 'danger' : 'warning';

export default function CompatibilityScreen() {
  return (
    <HubScreen title="Compatibility" subtitle="Independent, intentionally limited provider API shapes. ModelCommons is not affiliated with OpenAI or Anthropic.">
      <Card>
        <SectionTitle>Injected-fetch routes</SectionTitle>
        {SUPPORTED_ENDPOINTS.map((endpoint) => <Text key={endpoint} style={styles.endpoint}>{endpoint}</Text>)}
        <Muted>https://modelcommons.local is an intercepted origin, not DNS or a public endpoint. Adapters never fall through to network fetch.</Muted>
      </Card>
      {COMPATIBILITY_MATRIX.map((row) => (
        <Card key={row.feature}>
          <SectionTitle>{row.feature}</SectionTitle>
          <View style={styles.grid}>
            {[
              ['Native', row.native],
              ['Responses', row.responses],
              ['Chat', row.chat],
              ['Anthropic', row.anthropic],
            ].map(([label, status]) => (
              <View key={label} style={styles.cell}>
                <Text style={styles.label}>{label}</Text>
                <Badge tone={tone(status as CompatibilityStatus)}>{status}</Badge>
              </View>
            ))}
          </View>
          {row.note ? <Muted>{row.note}</Muted> : null}
        </Card>
      ))}
    </HubScreen>
  );
}

const styles = StyleSheet.create({
  endpoint: { color: palette.ink, fontFamily: 'monospace', fontSize: 12, backgroundColor: '#F1F5F7', borderRadius: 8, padding: 8 },
  grid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  cell: { minWidth: 112, gap: 5 },
  label: { color: palette.muted, fontSize: 11, fontWeight: '700' },
});
