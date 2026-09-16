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
  // editing: true -- Biz.tsx'teki "Profil fotoğrafını değiştir" dokunuşuyla
  // açıldığını AÇIKÇA belirtir (bkz. AvatarSecimi.tsx). Bunu
  // navigation.canGoBack()'ten çıkarsamıyoruz: RootNavigator'ın koşullu ekran
  // listesi geçişlerinde (Match -> AvatarSecimi -> tam liste) navigasyon
  // geçmişinden kalıntılar canGoBack()'in ilk kurulumda bile yanlışlıkla
  // true dönmesine yol açabiliyordu -- bu da "Tamamlandı" tuşunun Biz
  // sekmesine hiç yönlendirmemesine sebep oluyordu (navigate('Biz'), o an
  // henüz ekran listesinde olmayan bir ekrana sessizce başarısız oluyordu).
  AvatarSecimi: { editing?: boolean } | undefined;
  Sohbet: undefined;
  AskDili: undefined;
};

// Konum ve Sürüş, alt sekme çubuğuna eklendi (bkz.
// src/components/BottomTabBar.tsx) -- artık Biz sekmesindeki menü
// satırlarından değil, diğer 4 sekme gibi doğrudan alttaki çubuktan
// açılıyorlar.
export type TabRouteName = 'Yuva' | 'Planlar' | 'Anilar' | 'Biz' | 'PartnerKonum' | 'Surus';
