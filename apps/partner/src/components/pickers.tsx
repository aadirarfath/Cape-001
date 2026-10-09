import { APP_TIME_ZONE, formatLocalDate, formatWallClockTime, localDateOf } from '@cape001/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { m } from '@/i18n';
import { font, radius, space, touchHeight, useColors } from '@/theme';

import { Body, Button, Label } from './ui';

// Big buttons that open the phone's own date / time picker. Dates are calendar dates in India
// Standard Time ("YYYY-MM-DD"); times are wall-clock "HH:MM" (24-hour) — the formats the
// database and @cape001/core use.

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function timeToDate(time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date;
}

function PickerButton({
  label,
  text,
  icon,
  onPress,
}: {
  label?: string;
  text: string;
  icon: 'calendar' | 'time';
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: space.sm, flex: 1 }}>
      {label ? <Label>{label}</Label> : null}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${text}` : text}
        style={({ pressed }) => [
          styles.button,
          { borderColor: colors.border, backgroundColor: colors.card },
          pressed && { opacity: 0.7 },
        ]}>
        <Ionicons name={icon} size={22} color={colors.muted} />
        <Body style={{ fontSize: font.large }}>{text}</Body>
      </Pressable>
    </View>
  );
}

/** iOS has no picker dialog: show the inline picker in a sheet. Android uses the native dialog. */
function IosPickerSheet({
  visible,
  value,
  mode,
  onDone,
  onCancel,
}: {
  visible: boolean;
  value: Date;
  mode: 'date' | 'time';
  onDone: (date: Date) => void;
  onCancel: () => void;
}) {
  const colors = useColors();
  const [draft, setDraft] = useState(value);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel} onShow={() => setDraft(value)}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <DateTimePicker
            value={draft}
            mode={mode}
            display="spinner"
            // Dates in India Standard Time, whatever the phone's time zone; times are wall-clock.
            timeZoneName={mode === 'date' ? APP_TIME_ZONE : undefined}
            onValueChange={(_event, date) => setDraft(date)}
          />
          <Button label={m.common.save} onPress={() => onDone(draft)} />
          <Button label={m.common.cancel} variant="secondary" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

export function DateButton({
  label,
  value,
  onChange,
  minimumDate,
}: {
  label?: string;
  value: string;
  onChange: (localDate: string) => void;
  minimumDate?: string;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const current = new Date(`${value}T12:00:00+05:30`);
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        // Dates in India Standard Time, whatever the phone's time zone.
        timeZoneName: APP_TIME_ZONE,
        minimumDate: minimumDate ? new Date(`${minimumDate}T00:00:00+05:30`) : undefined,
        onValueChange: (_event, date) => onChange(localDateOf(date)),
      });
    } else {
      setIosOpen(true);
    }
  };
  return (
    <>
      <PickerButton
        label={label}
        icon="calendar"
        text={formatLocalDate(value, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        onPress={open}
      />
      {Platform.OS === 'ios' ? (
        <IosPickerSheet
          visible={iosOpen}
          value={current}
          mode="date"
          onCancel={() => setIosOpen(false)}
          onDone={(date) => {
            setIosOpen(false);
            onChange(localDateOf(date));
          }}
        />
      ) : null}
    </>
  );
}

export function TimeButton({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (time: string) => void;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const toTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: timeToDate(value),
        mode: 'time',
        is24Hour: false,
        onValueChange: (_event, date) => onChange(toTime(date)),
      });
    } else {
      setIosOpen(true);
    }
  };
  return (
    <>
      <PickerButton label={label} icon="time" text={formatWallClockTime(value)} onPress={open} />
      {Platform.OS === 'ios' ? (
        <IosPickerSheet
          visible={iosOpen}
          value={timeToDate(value)}
          mode="time"
          onCancel={() => setIosOpen(false)}
          onDone={(date) => {
            setIosOpen(false);
            onChange(toTime(date));
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: touchHeight,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { padding: space.lg, gap: space.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
});
