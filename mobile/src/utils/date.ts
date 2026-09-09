// Sunucu (server/src/routes/reunion.ts) tarihi kesin olarak YYYY-AA-GG
// (ISO) biçiminde bekliyor ve doğruluyor -- ama Türkçe kullanıcılar tarihi
// doğal olarak GÜN.AY.YIL sırasıyla yazar/okur. Bu yardımcılar, kullanıcının
// GG.AA.YYYY (ya da GG-AA-YYYY, GG/AA/YYYY, hatta boşlukla "20 09 2026")
// girdiği herhangi bir biçimi ISO'ya çevirir (API'ye giderken) ve ISO'yu
// geri GG.AA.YYYY olarak gösterir (kullanıcıya gösterirken) -- böylece
// kullanıcı hiçbir zaman YYYY-AA-GG sırasıyla uğraşmak zorunda kalmaz.

/**
 * Kullanıcının serbest biçimde girdiği bir GÜN-AY-YIL tarihini
 * ("20.09.2026", "20-09-2026", "20/09/2026", "20 09 2026", hatta "20092026")
 * ISO "YYYY-MM-DD" biçimine çevirir. Ayraç olarak nokta, tire, eğik çizgi
 * ve boşluğun herhangi biri (hatta hiçbiri) kabul edilir -- hepsi göz ardı
 * edilip sadece rakamlar okunur. Geçersiz/eksik/anlamsız bir tarihse (ya da
 * girdi boşsa) null döner.
 */
export function parseFlexibleDateToISO(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Ayraç ne olursa olsun (., -, /, boşluk ya da bunların karışımı) sadece
  // rakam gruplarını çıkarıyoruz.
  const parts = trimmed.split(/[.\-/\s]+/).filter(Boolean);
  let dayStr: string;
  let monthStr: string;
  let yearStr: string;

  if (parts.length === 3) {
    [dayStr, monthStr, yearStr] = parts;
  } else if (parts.length === 1 && /^\d{6}$|^\d{8}$/.test(parts[0])) {
    // Ayraçsız "20092026" ya da "200926" gibi bitişik girişler.
    const digits = parts[0];
    dayStr = digits.slice(0, 2);
    monthStr = digits.slice(2, 4);
    yearStr = digits.slice(4);
  } else {
    return null;
  }

  if (!/^\d{1,2}$/.test(dayStr) || !/^\d{1,2}$/.test(monthStr) || !/^\d{2}$|^\d{4}$/.test(yearStr)) {
    return null;
  }

  const day = Number(dayStr);
  const month = Number(monthStr);
  // İki haneli yıl girilirse (örn. "26") 2000'li yıl kabul ediyoruz --
  // bu uygulamanın kullanım amacı göz önüne alındığında 1900'lü bir tarih
  // girme ihtimali yok denecek kadar az.
  const year = yearStr.length === 2 ? 2000 + Number(yearStr) : Number(yearStr);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Ayın gerçekten o kadar gün içerip içermediğini (örn. 31 Şubat) de
  // doğruluyoruz -- Date nesnesi taşan günleri sessizce bir sonraki aya
  // sarardı (ör. 31 Şubat -> 3 Mart), bu da kullanıcının fark etmeden
  // yanlış bir tarih kaydetmesine yol açardı.
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return null;

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * ISO "YYYY-MM-DD" tarihini kullanıcıya göstermek için "GG.AA.YYYY"
 * biçimine çevirir. Geçersiz/boş girişte fallback (varsayılan olarak boş
 * string) döner.
 */
export function isoDateToDisplay(iso: string | null | undefined, fallback = ''): string {
  if (!iso) return fallback;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return fallback;
  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}
