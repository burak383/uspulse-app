// Kamera ya da galeriden profil fotoğrafı seçip sunucuya yükleme mantığı --
// eskiden yalnızca Biz.tsx'te (sadece galeri için) vardı; artık hem
// Biz.tsx'in "Profil fotoğrafını değiştir" akışı hem de eşleştikten sonraki
// zorunlu AvatarSecimi.tsx ekranı BURADAN geçiyor ki sıkıştırma/boyut
// ayarları iki yerde ayrı ayrı bakım gerektirmesin.
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { api } from '../api/client';

export type AvatarSource = 'camera' | 'library';

export class AvatarPickError extends Error {}

/**
 * Kullanıcıdan kamera/galeri izni ister, seçilen ya da çekilen fotoğrafı
 * 512x512'ye küçültüp sıkıştırarak base64 data URI'ye çevirir. Kullanıcı
 * seçimi/çekimi iptal ederse (hata değil) null döner. İzin verilmezse ya da
 * işleme başarısız olursa kullanıcıya gösterilebilecek Türkçe bir mesajla
 * AvatarPickError fırlatır.
 */
export async function pickAvatarImage(source: AvatarSource): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new AvatarPickError(
      source === 'camera'
        ? "Fotoğraf çekebilmek için Ayarlar'dan UsPulse'a kamera erişimi vermelisin."
        : "Profil fotoğrafı seçebilmek için Ayarlar'dan UsPulse'a fotoğraf erişimi vermelisin.",
    );
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  };
  const picked =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (picked.canceled || !picked.assets?.[0]) return null;

  // 512x512'ye küçült + sıkıştır: telefon kamerasından gelen orijinal
  // fotoğraf birkaç MB olabilir, avatar için buna hiç gerek yok -- hem
  // yükleme hızlı olsun hem de sunucudaki (SQLite) kayıt küçük kalsın.
  const manipulated = await ImageManipulator.manipulateAsync(
    picked.assets[0].uri,
    [{ resize: { width: 512, height: 512 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!manipulated.base64) {
    throw new AvatarPickError('Fotoğraf işlenemedi.');
  }
  return `data:image/jpeg;base64,${manipulated.base64}`;
}

/** avatar_url'e yazılacak değeri (gerçek fotoğraf data URI'si ya da "preset:...") sunucuya kaydeder. */
export async function uploadAvatarValue(value: string): Promise<void> {
  await api.put('/me/avatar', { image: value });
}

export async function removeAvatar(): Promise<void> {
  await api.delete('/me/avatar');
}
