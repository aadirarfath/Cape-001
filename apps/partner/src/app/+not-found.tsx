import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Grain, Title } from '@/components/ui';
import { m } from '@/i18n';
import { radius, space, useColors } from '@/theme';

export default function NotFoundScreen() {
  const colors = useColors();

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Grain />
        <Title style={styles.title}>{m.common.cancel}</Title>
        <Body style={{ color: colors.muted }}>This screen does not exist.</Body>
        <Link href="/" style={[styles.link, { borderColor: colors.border }]}>
          <Body style={{ fontWeight: '600' }}>Go to home screen</Body>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    gap: space.md,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    marginTop: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
