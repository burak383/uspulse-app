// "Aşk dili" (love language) uyum testi -- Günün Sorusu'ndan farklı olarak
// GÜNLÜK değil, TEK SEFERLİK: kullanıcı 10 soruyu bir kez yanıtlar, en baskın
// kategorisi hesaplanır, partner de tamamlayınca ikisininki karşılaştırmalı
// gösterilir (bkz. screens/AskDili.tsx). Sorular ve seçenekler tamamen
// orijinal/kendi yazdığımız içerik -- herhangi bir kitaptan alıntı değil,
// sadece "5 sevgi dili" olarak yaygınlaşmış genel kavramı (onay sözleri,
// nitelikli zaman, hediye, hizmet, fiziksel temas) temel alıyor. Diğer
// preset içeriklerle aynı desende (bkz. src/avatars/presets.ts): anlam
// tamamen istemci tarafında yaşıyor, sunucu yalnızca SEÇİLEN kategori
// puanlarını saklar (bkz. server/src/routes/loveLanguage.ts).
export type LoveLanguageKey = 'words' | 'time' | 'gifts' | 'acts' | 'touch';

export const LOVE_LANGUAGE_KEYS: LoveLanguageKey[] = ['words', 'time', 'gifts', 'acts', 'touch'];

export interface LoveLanguageMeta {
  key: LoveLanguageKey;
  label: string;
  description: string;
  icon: string;
  color: string;
}

export const LOVE_LANGUAGE_META: Record<LoveLanguageKey, LoveLanguageMeta> = {
  words: {
    key: 'words',
    label: 'Onay Sözleri',
    description: 'Sözlü sevgi, takdir ve güzel sözlerle beslenirsin.',
    icon: 'message-star-outline',
    color: '#F4C46B',
  },
  time: {
    key: 'time',
    label: 'Nitelikli Zaman',
    description: 'Bölünmemiş, tam dikkatle geçirilen zaman senin için en değerlisi.',
    icon: 'clock-outline',
    color: '#9CBCE8',
  },
  gifts: {
    key: 'gifts',
    label: 'Hediye Almak',
    description: 'Düşünülerek seçilmiş küçük bir hediye, seni düşündüğünü hissettirir.',
    icon: 'gift-outline',
    color: '#D7A1D1',
  },
  acts: {
    key: 'acts',
    label: 'Hizmet Eylemleri',
    description: 'Senin için sessizce yapılan küçük bir iş, bin sözden değerli.',
    icon: 'hand-heart-outline',
    color: '#9FCCA7',
  },
  touch: {
    key: 'touch',
    label: 'Fiziksel Temas',
    description: 'Bir sarılma, el ele tutuşma; dokunuş senin için en güçlü dil.',
    icon: 'hand-back-right-outline',
    color: '#FF8F82',
  },
};

export interface LoveLanguageOption {
  key: LoveLanguageKey;
  text: string;
}

export interface LoveLanguageQuestion {
  id: string;
  text: string;
  options: LoveLanguageOption[];
}

export const LOVE_LANGUAGE_QUESTIONS: LoveLanguageQuestion[] = [
  {
    id: 'q1',
    text: 'Zor bir günün sonunda seni en çok ne rahatlatır?',
    options: [
      { key: 'words', text: 'Partnerimin bana ne kadar değerli olduğumu söylemesi' },
      { key: 'time', text: 'Telefonlarımızı bırakıp sadece birlikte oturmamız' },
      { key: 'gifts', text: 'Beni düşündüğünü gösteren küçük bir sürpriz' },
      { key: 'acts', text: 'Yemeği hazırlamış ya da bir işimi halletmiş olması' },
      { key: 'touch', text: 'Sessizce sarılıp beni tutması' },
    ],
  },
  {
    id: 'q2',
    text: 'Partnerin seni gerçekten "gördüğünü" ne zaman hissedersin?',
    options: [
      { key: 'words', text: 'Bir şeyi ne kadar iyi yaptığımı fark edip söylediğinde' },
      { key: 'time', text: 'Konuşurken telefonuna hiç bakmadığında' },
      { key: 'gifts', text: 'Geçen ay ağzımdan kaçırdığım bir şeyi hatırlayıp getirdiğinde' },
      { key: 'acts', text: 'Yorgun olduğumu görüp bir işimi üstlendiğinde' },
      { key: 'touch', text: 'Yanımdan geçerken elimi sıktığında' },
    ],
  },
  {
    id: 'q3',
    text: 'Bir tartışmadan sonra barışmanın en anlamlı yolu sence hangisi?',
    options: [
      { key: 'words', text: 'Açık ve içten bir özür cümlesi duymak' },
      { key: 'time', text: 'Oturup, dikkat dağılmadan konuşmak' },
      { key: 'gifts', text: 'Küçük, "barışalım" anlamına gelen bir jest' },
      { key: 'acts', text: 'Sormadan benim için bir şey yapması' },
      { key: 'touch', text: 'Bir kucaklaşma ile gerginliğin dağılması' },
    ],
  },
  {
    id: 'q4',
    text: 'Hayalindeki sıradan bir Cumartesi nasıl geçer?',
    options: [
      { key: 'words', text: 'Birbirimize gün içinde küçük iltifatlar ederek' },
      { key: 'time', text: 'Planlı hiçbir şey yapmadan, sadece birlikte' },
      { key: 'gifts', text: 'Küçük bir sürprizle başlayan bir gün' },
      { key: 'acts', text: 'Birlikte ev işlerini bitirip rahatlayarak' },
      { key: 'touch', text: 'Kanepede sarılarak film izleyerek' },
    ],
  },
  {
    id: 'q5',
    text: 'Partnerine ne zaman en yakın hissedersin?',
    options: [
      { key: 'words', text: 'Bana ne kadar özel olduğumu anlattığında' },
      { key: 'time', text: 'Uzun bir sohbete daldığımızda' },
      { key: 'gifts', text: 'Bana bir şey getirdiğinde' },
      { key: 'acts', text: 'Benim için fazladan çaba harcadığını gördüğümde' },
      { key: 'touch', text: 'Elini tutup yürüdüğümüzde' },
    ],
  },
  {
    id: 'q6',
    text: 'Uzaktayken (iş seyahati, farklı şehir vb.) seni en çok ne özletir?',
    options: [
      { key: 'words', text: 'Sesini duymak, güzel şeyler söylemesi' },
      { key: 'time', text: 'Birlikte geçirdiğimiz sıradan anlar' },
      { key: 'gifts', text: 'Geri döndüğünde getirdiği küçük bir şey' },
      { key: 'acts', text: 'Benim için yaptığı küçük şeyler' },
      { key: 'touch', text: 'Sarılmak, dokunmak' },
    ],
  },
  {
    id: 'q7',
    text: 'Bir başarını kutlarken senin için en anlamlısı hangisi?',
    options: [
      { key: 'words', text: 'Benimle gurur duyduğunu söylemesi' },
      { key: 'time', text: 'O akşamı sadece bana ayırması' },
      { key: 'gifts', text: 'Küçük bir kutlama hediyesi' },
      { key: 'acts', text: 'O gün benim yerime bir şeyler halletmesi' },
      { key: 'touch', text: 'Beni sımsıkı kucaklaması' },
    ],
  },
  {
    id: 'q8',
    text: 'Partnerin seni üzdüğünde en çok neyi özlersin?',
    options: [
      { key: 'words', text: 'Nazik, sevgi dolu sözlerini' },
      { key: 'time', text: 'Birlikte geçirdiğimiz vakti' },
      { key: 'gifts', text: 'Beni düşündüğünü gösteren jestlerini' },
      { key: 'acts', text: 'Benim için sessizce yaptığı şeyleri' },
      { key: 'touch', text: 'Dokunuşunu, yakınlığını' },
    ],
  },
  {
    id: 'q9',
    text: 'Bir hediye/jest seçerken sence en önemlisi nedir?',
    options: [
      { key: 'words', text: 'Yanına içten bir not eklemek' },
      { key: 'time', text: 'Hediye değil, birlikte geçirilecek bir zaman planlamak' },
      { key: 'gifts', text: 'Düşünülerek, özenle seçilmiş olması' },
      { key: 'acts', text: 'Onun işini kolaylaştıracak, pratik bir şey olması' },
      { key: 'touch', text: 'Birlikte sarılarak açılacak bir an yaratması' },
    ],
  },
  {
    id: 'q10',
    text: 'İlişkinizde en çok neye değer veriyorsun?',
    options: [
      { key: 'words', text: 'Birbirimize nasıl konuştuğumuza' },
      { key: 'time', text: 'Birbirimize ayırdığımız zamana' },
      { key: 'gifts', text: 'Birbirimizi düşündüğümüzü gösteren küçük jestlere' },
      { key: 'acts', text: 'Birbirimiz için yaptığımız şeylere' },
      { key: 'touch', text: 'Fiziksel yakınlığımıza' },
    ],
  },
];
