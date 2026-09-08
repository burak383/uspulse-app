import { Alert, Platform } from 'react-native';

// react-native-web'in Alert.alert() implementasyonu BİLEREK boş bırakılmış
// (bkz. node_modules/react-native-web/src/exports/Alert/index.js --
// `static alert() {}`) -- yani web'de normal `Alert.alert(title, message,
// [{onPress: ...}, ...])` çağrıları HİÇBİR ŞEY yapmıyor: ne bir diyalog
// gösteriliyor ne de butonların onPress'i hiç çalışıyor. Uygulamadaki
// "Silinsin mi?" gibi önce onay isteyip SONRA asıl işlemi yapan her akış
// (anı/plan/birikim silme, hesabı silme, konum/sürüş paylaşımını aç-kapat)
// bu yüzden web modunda tamamen tepkisiz kalıyordu: kullanıcı "Sil"e
// basıyor gibi görünse de aslında hiçbir diyalog çıkmadığı için o butona
// tıklanamıyor, dolayısıyla asıl silme/değiştirme kodu hiç tetiklenmiyordu.
//
// Bu yardımcı, native tarafta gerçek (2 butonlu) Alert.alert'i kullanırken,
// webde window.confirm()'e düşüyor -- böylece "onaylarsan devam et" akışı
// her iki platformda da gerçekten çalışıyor. Native'in görünümünü/UX'ini
// değiştirmiyor, sadece web'deki no-op'u telafi ediyor.
export function confirmAsync(
  title: string,
  message: string,
  confirmLabel = 'Sil',
  cancelLabel = 'Vazgeç',
): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') return Promise.resolve(false);
    // window.confirm tek bir OK/Cancel çifti sunuyor; buton etiketlerini
    // ayrı ayrı göstermenin native karşılığı yok, bu yüzden ikisini de
    // mesaja gömüyoruz ki kullanıcı ne olacağını bilsin.
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

// Aynı no-op sorunu tek butonlu BİLGİLENDİRME alert'lerini de (ör.
// "Kaydedilemedi", "Yüklenemedi") web'de sessizce yutuyor -- bir işlem
// başarısız olduğunda kullanıcı native'de bir hata görürken, web'de
// hiçbir şey görmüyor ("kaydete basınca hiçbir şey olmuyor" hissi tam da
// bu yüzden bazen aslında "hata oluyor ama gösterilmiyor" oluyor). Bunu
// önemli/hata niteliğindeki bilgilendirmelerde kullan.
export function alertInfo(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
    return;
  }
  Alert.alert(title, message);
}
