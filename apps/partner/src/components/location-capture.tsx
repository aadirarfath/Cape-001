import * as Location from 'expo-location';
import { useState } from 'react';
import { Linking } from 'react-native';

import { format, m } from '@/i18n';

import { Button, Muted, Notice } from './ui';

export interface Coordinates {
  lng: number;
  lat: number;
}

/** Google Maps link for a point; opens the Maps app on phones. No API key needed. */
export function mapsUrl({ lat, lng }: Coordinates): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * "I'm at my shop – use my location". Shop owners are rarely good with maps, so instead of a
 * map picker we take the phone's GPS position while they stand in the shop.
 */
export function LocationCapture({
  value,
  onChange,
  saving,
}: {
  value: Coordinates | null;
  onChange: (coordinates: Coordinates) => void | Promise<void>;
  /** The parent is saving the new location. */
  saving?: boolean;
}) {
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function locate() {
    setLocating(true);
    setMessage(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setMessage({ tone: 'error', text: m.location.denied });
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude, accuracy } = position.coords;
      await onChange({ lat: latitude, lng: longitude });
      setMessage({
        tone: 'success',
        text:
          accuracy != null
            ? format(m.location.saved, { metres: Math.round(accuracy) })
            : m.location.savedNoAccuracy,
      });
    } catch {
      setMessage({ tone: 'error', text: m.location.failed });
    } finally {
      setLocating(false);
    }
  }

  return (
    <>
      {value && !message ? <Muted>{m.location.current}</Muted> : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <Button
        label={locating ? m.location.locating : m.location.useCurrent}
        icon="location"
        variant={value ? 'secondary' : 'primary'}
        loading={locating || saving}
        onPress={locate}
      />
      {value ? (
        <Button label={m.location.openMaps} icon="map" variant="ghost" onPress={() => Linking.openURL(mapsUrl(value))} />
      ) : null}
    </>
  );
}
