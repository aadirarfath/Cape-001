import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  type TextInputProps,
  type TextProps,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { m } from '@/i18n';
import { font, fonts, grain, radius, space, touchHeight, useColors, useIsDark } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// Texture ----------------------------------------------------------------------------------------

/** Film grain over the whole parent. Purely decorative; never intercepts touches. */
export function Grain({ tone, opacity = 1 }: { tone?: 'onLight' | 'onDark'; opacity?: number }) {
  const isDark = useIsDark();
  const onDark = tone ? tone === 'onDark' : isDark;
  return (
    <View
      style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      <Image
        source={onDark ? grain.light : grain.dark}
        resizeMode="repeat"
        style={{ width: '100%', height: '100%', opacity }}
      />
    </View>
  );
}

/** The CAPE-001 wordmark in the wide display face. */
export function Wordmark({ size = 34, color, subtitle }: { size?: number; color?: string; subtitle?: string }) {
  const colors = useColors();
  const tint = color ?? colors.text;
  return (
    <View accessibilityRole="header" accessibilityLabel={subtitle ? `${m.app.name} ${subtitle}` : m.app.name}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ fontFamily: fonts.displayBold, fontSize: size, letterSpacing: -size * 0.03, color: tint }}>
        CAPE-001
      </Text>
      {subtitle ? (
        <Text style={[styles.eyebrow, { color: tint, opacity: 0.7, marginTop: space.xs }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

// Layout -----------------------------------------------------------------------------------------

/** A scrolling page with comfortable padding, pull-to-refresh and keyboard handling. */
export function Screen({
  children,
  refreshing,
  onRefresh,
  footer,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Pinned below the scroll area, e.g. the main Save button. */
  footer?: ReactNode;
}) {
  const colors = useColors();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Grain />
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.text} colors={[colors.text]} />
          ) : undefined
        }>
        {children}
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { borderTopColor: colors.ink, backgroundColor: colors.background }]}>{footer}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function Section({ title, children, style }: { title?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return (
    <View style={[styles.section, style]}>
      {title ? (
        <Text accessibilityRole="header" style={[styles.eyebrow, styles.sectionTitle, { color: colors.text, borderTopColor: colors.ink }]}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  const cardStyle = [styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style];
  if (!onPress) return <View style={cardStyle}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [cardStyle, pressed && { borderColor: colors.ink, transform: [{ scale: 0.99 }] }]}>
      {children}
    </Pressable>
  );
}

// Text -------------------------------------------------------------------------------------------

export function Title({ style, ...props }: TextProps) {
  const colors = useColors();
  return <Text accessibilityRole="header" style={[styles.title, { color: colors.text }, style]} {...props} />;
}

/** The serif family for a requested weight (custom fonts ignore fontWeight on Android). */
function serifStyle(style: StyleProp<TextStyle>): TextStyle {
  const weight = Number(StyleSheet.flatten(style)?.fontWeight ?? 400);
  return { fontFamily: weight >= 600 ? fonts.serifSemiBold : weight >= 500 ? fonts.serifMedium : fonts.serif, fontWeight: 'normal' };
}

export function Body({ style, ...props }: TextProps) {
  const colors = useColors();
  return <Text style={[styles.body, { color: colors.text }, style, serifStyle(style)]} {...props} />;
}

export function Muted({ style, ...props }: TextProps) {
  const colors = useColors();
  return <Text style={[styles.muted, { color: colors.muted }, style, serifStyle(style)]} {...props} />;
}

/** Small, wide, uppercase: field labels and eyebrows. */
export function Label({ style, ...props }: TextProps) {
  const colors = useColors();
  return <Text style={[styles.eyebrow, { color: colors.text }, style]} {...props} />;
}

// Buttons ----------------------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const palette = {
    primary: { bg: colors.primary, fg: colors.primaryText, border: colors.primary },
    secondary: { bg: 'transparent', fg: colors.text, border: colors.ink },
    danger: { bg: colors.danger, fg: colors.dangerText, border: colors.danger },
    ghost: { bg: 'transparent', fg: colors.text, border: 'transparent' },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border },
        inactive && { opacity: 0.45 },
        pressed && { opacity: 0.8, transform: [{ scale: 0.985 }] },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : icon ? (
        <Ionicons name={icon} size={22} color={palette.fg} />
      ) : null}
      <Text style={[styles.buttonText, { color: palette.fg }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A big tappable row with an icon, title, subtitle and a chevron. */
export function MenuItem({
  icon,
  title,
  subtitle,
  onPress,
  right,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
}) {
  const colors = useColors();
  return (
    <Card onPress={onPress} style={styles.menuItem}>
      {icon ? (
        <View style={[styles.menuIcon, { borderColor: colors.ink }]}>
          <Ionicons name={icon} size={22} color={colors.text} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Body style={{ fontWeight: '600' }}>{title}</Body>
        {subtitle ? <Muted>{subtitle}</Muted> : null}
      </View>
      {right}
      {onPress ? <Ionicons name="arrow-forward" size={20} color={colors.text} /> : null}
    </Card>
  );
}

// Inputs -----------------------------------------------------------------------------------------

export function TextField({
  label,
  hint,
  error,
  prefix,
  style,
  multiline,
  ...props
}: TextInputProps & { label: string; hint?: string; error?: string | null; prefix?: string }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <View
        style={[
          styles.inputBox,
          { borderColor: error ? colors.danger : colors.ink, backgroundColor: colors.card },
          multiline && { minHeight: 100, alignItems: 'flex-start', borderRadius: radius.lg, paddingVertical: space.sm },
        ]}>
        {prefix ? (
          <Text style={[styles.prefix, { color: colors.text, borderRightColor: colors.border }]}>{prefix}</Text>
        ) : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          multiline={multiline}
          style={[styles.input, { color: colors.text }, multiline && { textAlignVertical: 'top' }, style]}
          {...props}
        />
      </View>
      {error ? (
        <Text style={[styles.small, { color: colors.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Muted style={styles.small}>{hint}</Muted>
      ) : null}
    </View>
  );
}

/** A label and a big switch on one row, with an optional explanation below. */
export function SwitchRow({
  label,
  hint,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      style={[styles.switchRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Body style={{ fontWeight: '600' }}>{label}</Body>
        {hint ? <Muted style={styles.small}>{hint}</Muted> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.ink, false: colors.border }}
        thumbColor={Platform.OS === 'android' ? colors.card : undefined}
        ios_backgroundColor={colors.border}
      />
    </Pressable>
  );
}

/** A full-width row with a large checkbox. */
export function CheckRow({
  label,
  subtitle,
  checked,
  onToggle,
}: {
  label: string;
  subtitle?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.switchRow,
        { borderColor: checked ? colors.ink : colors.border, backgroundColor: colors.card },
        pressed && { opacity: 0.7 },
      ]}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={30} color={checked ? colors.primary : colors.muted} />
      <View style={{ flex: 1 }}>
        <Body>{label}</Body>
        {subtitle ? <Muted style={styles.small}>{subtitle}</Muted> : null}
      </View>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : 'transparent',
          borderColor: selected ? colors.primary : colors.ink,
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Text style={[styles.chipText, { color: selected ? colors.primaryText : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

// Feedback ---------------------------------------------------------------------------------------

type Tone = 'info' | 'success' | 'warning' | 'error';

export function Notice({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  const colors = useColors();
  // Black and white: tones differ by fill and outline; only errors use colour.
  const palette = {
    info: { bg: colors.card, border: colors.ink, fg: colors.text, icon: 'information-circle-outline' as const },
    success: { bg: colors.primary, border: colors.primary, fg: colors.primaryText, icon: 'checkmark-circle' as const },
    warning: { bg: colors.secondary, border: colors.secondary, fg: colors.text, icon: 'time-outline' as const },
    error: { bg: colors.errorBg, border: colors.danger, fg: colors.danger, icon: 'alert-circle' as const },
  }[tone];
  return (
    <View
      style={[styles.notice, { backgroundColor: palette.bg, borderColor: palette.border }]}
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}>
      <Ionicons name={palette.icon} size={22} color={palette.fg} />
      <Body style={{ flex: 1, color: tone === 'error' ? colors.text : palette.fg }}>{children}</Body>
    </View>
  );
}

export function LoadingView() {
  const colors = useColors();
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.text} />
      <Muted>{m.common.loading}</Muted>
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { borderColor: colors.ink }]}>
        <Ionicons name={icon} size={32} color={colors.text} />
      </View>
      <Body style={{ textAlign: 'center', fontWeight: '600' }}>{title}</Body>
      {body ? <Muted style={{ textAlign: 'center' }}>{body}</Muted> : null}
    </View>
  );
}

/** A modal question with a big confirm button. Extra content (e.g. a reason field) goes in children. */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel = m.common.cancel,
  destructive,
  loading,
  error,
  onConfirm,
  onCancel,
  children,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.dialog, { backgroundColor: colors.card, borderColor: colors.ink }]}>
          <Title style={{ fontSize: font.large }}>{title}</Title>
          {body ? <Body>{body}</Body> : null}
          {children}
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button
            label={confirmLabel}
            variant={destructive ? 'danger' : 'primary'}
            loading={loading}
            onPress={onConfirm}
          />
          <Button label={cancelLabel} variant="secondary" disabled={loading} onPress={onCancel} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  footer: { padding: space.lg, borderTopWidth: StyleSheet.hairlineWidth, gap: space.sm },
  section: { gap: space.md },
  sectionTitle: { marginTop: space.md, paddingTop: space.md, borderTopWidth: 1 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  title: { fontSize: font.title, fontFamily: fonts.displayBold, letterSpacing: -0.6, lineHeight: 34 },
  body: { fontSize: font.body, lineHeight: 26, fontFamily: fonts.serif },
  muted: { fontSize: font.body, lineHeight: 24, fontFamily: fonts.serif },
  small: { fontSize: font.small, lineHeight: 21 },
  eyebrow: { fontSize: 13, fontFamily: fonts.display, letterSpacing: 1.2, textTransform: 'uppercase' },
  button: {
    minHeight: touchHeight,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonText: { fontSize: 16, fontFamily: fonts.display, letterSpacing: 0.2, textAlign: 'center', flexShrink: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: space.lg, minHeight: 76 },
  menuIcon: { width: 44, height: 44, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  field: { gap: space.sm },
  inputBox: {
    minHeight: touchHeight,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: { flex: 1, fontSize: font.large, paddingVertical: space.md, fontFamily: fonts.serif },
  prefix: {
    fontSize: font.body,
    fontFamily: fonts.display,
    paddingRight: space.md,
    marginRight: space.md,
    borderRightWidth: 1,
  },
  switchRow: {
    minHeight: touchHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  chip: {
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  chipText: { fontSize: 15, fontFamily: fonts.display, letterSpacing: 0.2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  notice: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  emptyIcon: { width: 72, height: 72, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space.lg },
  dialog: { borderRadius: radius.lg, borderWidth: 1, padding: space.xl, gap: space.md },
});
