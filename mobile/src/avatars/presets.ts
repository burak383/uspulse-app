// Eşleştikten sonra (ve Biz sekmesinden "Profil fotoğrafını değiştir" ile
// istendiğinde) seçilebilen hazır avatarlar. Kendi fotoğrafını yüklemek
// istemeyen kullanıcılar için "Kadın" ve "Erkek" olmak üzere iki ayrı set
// sunuyoruz -- her biri sadece bir ikon + bir arka plan renginden oluşuyor,
// gerçek bir resim dosyası ya da sunucuya yükleme GEREKMİYOR (bkz.
// components/AvatarView.tsx).
//
// Sunucu tarafında bu seçim, normal fotoğraflarla AYNI users.avatar_url
// sütununda "preset:<kategori>:<ikon-adı>" biçiminde küçük bir metin olarak
// saklanıyor (bkz. server/src/routes/me.ts PRESET_AVATAR_PATTERN) -- yani
// partner tarafında da GET /me üzerinden aynı değer döner, mobil taraf onu
// burada tanımlı listeyle eşleştirip aynı ikon+rengi çizer. Yeni bir preset
// eklemek/kaldırmak sadece bu dosyayı değiştirmek demektir; sunucu tarafı
// zaten format bazlı doğruluyor, listeyle senkron tutulması gerekmiyor.
import type { ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type AvatarCategory = 'kadin' | 'erkek';
export type AvatarIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface AvatarPreset {
  category: AvatarCategory;
  icon: AvatarIconName;
  background: string;
}

// İkon adları @expo/vector-icons/build/vendor/react-native-vector-icons/
// glyphmaps/MaterialCommunityIcons.json karşısında doğrulandı (bkz. bu
// oturumdaki ikon denetimi) -- hepsi geçerli.
const KADIN_PRESETS: AvatarPreset[] = [
  { category: 'kadin', icon: 'face-woman', background: '#E86A92' },
  { category: 'kadin', icon: 'face-woman-outline', background: '#B06AC9' },
  { category: 'kadin', icon: 'human-female', background: '#F4886B' },
  { category: 'kadin', icon: 'flower', background: '#E0A23A' },
  { category: 'kadin', icon: 'emoticon-kiss-outline', background: '#D65C8A' },
  { category: 'kadin', icon: 'cat', background: '#3FA793' },
];

const ERKEK_PRESETS: AvatarPreset[] = [
  { category: 'erkek', icon: 'face-man', background: '#3E7CC9' },
  { category: 'erkek', icon: 'face-man-outline', background: '#2E4E8F' },
  { category: 'erkek', icon: 'human-male', background: '#3E9A5D' },
  { category: 'erkek', icon: 'glasses', background: '#4C6E8F' },
  { category: 'erkek', icon: 'emoticon-cool-outline', background: '#5A5AC9' },
  { category: 'erkek', icon: 'dog', background: '#93673F' },
];

export const AVATAR_PRESETS: Record<AvatarCategory, AvatarPreset[]> = {
  kadin: KADIN_PRESETS,
  erkek: ERKEK_PRESETS,
};

const PRESET_PREFIX = 'preset:';

export function presetAvatarValue(preset: AvatarPreset): string {
  return `${PRESET_PREFIX}${preset.category}:${preset.icon}`;
}

/**
 * "preset:kadin:face-woman" gibi bir avatar_url değerini geri ilgili
 * AvatarPreset kaydına çözer. Gerçek bir fotoğraf (data: URI) ya da null
 * için null döner -- çağıran taraf (bkz. AvatarView) bu durumda normal
 * <Image> render'ına düşer.
 */
export function parsePresetAvatar(avatarUrl: string | null | undefined): AvatarPreset | null {
  if (!avatarUrl || !avatarUrl.startsWith(PRESET_PREFIX)) return null;
  const [, category, icon] = avatarUrl.split(':');
  if (category !== 'kadin' && category !== 'erkek') return null;
  return AVATAR_PRESETS[category].find((p) => p.icon === icon) ?? null;
}
