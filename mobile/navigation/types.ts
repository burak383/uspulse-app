export type RootStackParamList = {
  Auth: undefined;
  Match: undefined;
  Paywall: undefined;
  Yuva: undefined;
  Planlar: undefined;
  Anilar: undefined;
  Biz: undefined;
  GununSorusu: undefined;
  Surus: undefined;
  PartnerKonum: undefined;
  AvatarSecimi: undefined;
};

// Konum ve Sürüş, alt sekme çubuğuna eklendi (bkz.
// src/components/BottomTabBar.tsx) -- artık Biz sekmesindeki menü
// satırlarından değil, diğer 4 sekme gibi doğrudan alttaki çubuktan
// açılıyorlar.
export type TabRouteName = 'Yuva' | 'Planlar' | 'Anilar' | 'Biz' | 'PartnerKonum' | 'Surus';
