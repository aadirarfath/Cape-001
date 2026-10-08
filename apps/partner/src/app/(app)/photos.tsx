import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, ConfirmDialog, EmptyState, LoadingView, Muted, Notice, Screen } from '@/components/ui';
import { errorMessage, format, m } from '@/i18n';
import { compressToWebp, deleteShopPhoto, PhotoTooLargeError, pickPhoto, uploadShopPhoto } from '@/lib/photos';
import { useShop } from '@/lib/session';
import { shopPhotoUrl, supabase } from '@/lib/supabase';
import { unwrap, useLoad } from '@/lib/use-load';
import { radius, space } from '@/theme';

const t = m.photos;

type Step = 'preparing' | 'uploading' | null;

export default function PhotosScreen() {
  const shop = useShop();
  const photos = useLoad(async () => {
    return unwrap(
      await supabase
        .from('shop_photos')
        .select('id, storage_path, sort_order')
        .eq('shop_id', shop.id)
        .order('sort_order')
        .order('created_at'),
    );
  }, [shop.id]);

  const [step, setStep] = useState<Step>(null);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<{ id: string; storage_path: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (photos.loading && !photos.data) return <LoadingView />;

  async function add() {
    setError(null);
    try {
      const asset = await pickPhoto();
      if (!asset) return;
      setStep('preparing');
      const file = await compressToWebp(asset);
      setStep('uploading');
      const nextOrder = Math.max(0, ...(photos.data ?? []).map((p) => p.sort_order + 1));
      await uploadShopPhoto(shop.id, file, nextOrder);
      await photos.reload();
    } catch (e) {
      setError(e instanceof PhotoTooLargeError ? t.tooLarge : t.failed);
      console.warn('Adding a photo failed', e);
    } finally {
      setStep(null);
    }
  }

  async function remove() {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteShopPhoto(toDelete);
      setToDelete(null);
      await photos.reload();
    } catch (e) {
      setDeleteError(errorMessage(e as { message?: string }));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Screen
      onRefresh={photos.refresh}
      refreshing={photos.refreshing}
      footer={
        <Button
          label={step === 'preparing' ? t.preparing : step === 'uploading' ? t.uploading : t.add}
          icon="image"
          loading={step !== null}
          onPress={add}
        />
      }>
      <Muted>{t.subtitle}</Muted>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {photos.error ? <Notice tone="error">{errorMessage(photos.error as { message?: string })}</Notice> : null}
      {photos.data?.length === 0 ? <EmptyState icon="images-outline" title={t.empty} /> : null}
      {photos.data?.map((photo) => (
        <Card key={photo.id} style={{ padding: 0, overflow: 'hidden' }}>
          <Image
            source={{ uri: shopPhotoUrl(photo.storage_path) }}
            style={styles.photo}
            contentFit="cover"
            accessibilityLabel={format(t.photoAlt, { shop: shop.name })}
          />
          <View style={{ padding: space.sm }}>
            <Button label={m.common.delete} icon="trash" variant="ghost" onPress={() => setToDelete(photo)} />
          </View>
        </Card>
      ))}

      <ConfirmDialog
        visible={toDelete !== null}
        title={t.deleteTitle}
        confirmLabel={t.deleteConfirm}
        destructive
        loading={deleting}
        error={deleteError}
        onConfirm={remove}
        onCancel={() => {
          setToDelete(null);
          setDeleteError(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
});
