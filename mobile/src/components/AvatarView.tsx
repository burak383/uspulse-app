// Bir kullanıcının avatarını (gerçek fotoğraf, hazır preset ya da hiçbiri)
// tutarlı biçimde çizen tek yer. Biz.tsx (kendi/partner avatarı) ve
// AvatarSecimi.tsx (seçim ekranındaki büyük önizleme) BURADAN geçmeli --
// aksi halde preset render mantığı iki yerde ayrı ayrı tutulur ve biri
// güncellenip diğeri unutulabilir.
//
// NOT: Bu bileşen sadece dairesel içeriği çizer (fotoğraf/ikon), dışarıdaki
// kenarlık/arka plan çerçevesini (bkz. Biz.tsx styles.avatar) çağıran taraf
// kendi sağlıyor -- böylece var olan ekranların dış görünümü değişmiyor.
import React from 'react';
import { Image, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { AvatarIconName, parsePresetAvatar } from '../avatars/presets';

export function AvatarView({
  avatarUrl,
  size,
  fallbackIcon = 'account',
  fallbackColor = colors.mutedForeground,
}: {
  avatarUrl?: string | null;
  size: number;
  fallbackIcon?: AvatarIconName;
  fallbackColor?: string;
}) {
  const preset = parsePresetAvatar(avatarUrl);
  const iconSize = Math.round(size * 0.42);

  if (preset) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: preset.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialCommunityIcons name={preset.icon} size={iconSize} color="#FFFFFF" />
      </View>
    );
  }

  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }

  return <MaterialCommunityIcons name={fallbackIcon} size={iconSize} color={fallbackColor} />;
}
