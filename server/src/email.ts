// Resend (https://resend.com) üzerinden şifre sıfırlama kodu e-postası
// gönderen küçük yardımcı.
//
// RESEND_API_KEY tanımlı değilse hiçbir ağ isteği atılmaz, isEmailConfigured()
// false döner -- çağıran taraf (routes/auth.ts) bu durumda eski (konsola log +
// devCode) davranışına düşer. Yani bu dosya olmadan da (veya API anahtarı
// girilmeden de) sunucu çalışmaya devam eder, sadece gerçek e-posta gitmez.
const RESEND_API_KEY = (process.env.RESEND_API_KEY || '').trim();

// Resend'de kendi alan adınızı doğrulamadan da test amaçlı e-posta
// gönderebilmeniz için varsayılan olarak Resend'in kendi test adresini
// kullanıyoruz. Kendi alan adınızı Resend > Domains altında doğruladıktan
// sonra RESEND_FROM_EMAIL'i kendi adresinize (örn. "UsPulse <no-reply@uspulse.app>")
// ayarlayabilirsiniz.
const RESEND_FROM_EMAIL = (process.env.RESEND_FROM_EMAIL || 'UsPulse <onboarding@resend.dev>').trim();

export function isEmailConfigured(): boolean {
  return RESEND_API_KEY.length > 0;
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to,
        subject: 'UsPulse şifre sıfırlama kodun',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #34243A;">
            <h2 style="margin-bottom: 4px;">Şifreni sıfırla</h2>
            <p>UsPulse hesabın için şifre sıfırlama kodun:</p>
            <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 16px 0;">${code}</p>
            <p style="color: #666;">Bu kod 15 dakika geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin, hesabında hiçbir şey değişmez.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[email] Resend gönderim hatası (${res.status}): ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] Resend isteği başarısız:', err);
    return false;
  }
}
