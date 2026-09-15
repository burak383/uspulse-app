export interface PublicUser {
  id: string;
  name: string;
  email: string;
  inviteCode: string;
  coupleId: string | null;
  avatarUrl: string | null;
}

export interface Couple {
  id: string;
  reunion_title: string | null;
  reunion_location: string | null;
  reunion_date: string | null;
  created_at: string;
}

/**
 * Çift bazlı abonelik/deneme durumu -- server/src/middleware/subscription.ts
 * (getEntitlement) tarafından hesaplanır. Eşleşmemiş kullanıcılar için null.
 */
export interface Entitlement {
  trialing: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number;
  subscriptionActive: boolean;
  subscriptionExpiresAt: string | null;
  subscriptionProductId: string | null;
  subscriptionPlatform: string | null;
  hasAccess: boolean;
}

export interface MeResponse {
  user: PublicUser;
  partner: PublicUser | null;
  couple: Couple | null;
  /** Kuş uçuşu mesafe (km), yalnızca ikiniz de konum paylaştıysanız dolu gelir. */
  distanceKm: number | null;
  locationSharedByMe: boolean;
  locationSharedByPartner: boolean;
  /** Partnerin canlı enlem/boylamı -- yalnızca ikiniz de konum paylaştıysanız dolu gelir (bkz. PartnerKonum ekranı). */
  partnerLat: number | null;
  partnerLng: number | null;
  /** Partnerin telefon şarj yüzdesi (0-100) -- konum paylaşımıyla aynı karşılıklılık şartına tabi. */
  partnerBatteryLevel: number | null;
  /** Partnerin telefonu şu an şarjda mı -- partnerBatteryLevel dolu geldiğinde anlamlı. */
  partnerBatteryCharging: boolean | null;
  /** Partnerin şu anki konumunda ne zamandır olduğu (SQLite datetime('now') biçiminde, "Z" son eki olmadan UTC) -- konum paylaşımıyla aynı karşılıklılık şartına tabi. bkz. PartnerKonum ekranındaki avatar dokunma açıklaması. */
  partnerStationarySince: string | null;
  /** Sürüş takibini (anlık hız + rota) partnere açtın mı -- bkz. DrivingContext. */
  drivingShareEnabled: boolean;
  entitlement: Entitlement | null;
}

export interface DrivingPoint {
  lat: number;
  lng: number;
}

/**
 * Partnerin GET /driving/partner yanıtı. Geçmiş tutulmaz -- "active: false"
 * hem sürüş bittiğinde hem de hiç paylaşılmadığında dönebilir.
 */
export type DrivingStatusResponse =
  | { active: false }
  | { active: true; startedAt: string; speedKmh: number; points: DrivingPoint[] };

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface ForgotPasswordResponse {
  ok: boolean;
  message: string;
  /** Only present outside production - there's no real email/SMS provider wired up yet. */
  devCode?: string;
}

export interface MoodResponse {
  me: { mood: string; at: string } | null;
  /** Kendi ruh halini partnerinle paylaşıyor musun (Biz sekmesindeki gerçek anahtar). */
  sharedByMe: boolean;
  partner: { name: string; mood?: string; at?: string } | null;
  /** false ise partner paylaşımı kapatmış -- ruh hali metni gösterilmez. */
  partnerSharing: boolean;
  availableMoods: string[];
}

export interface TouchesResponse {
  streakDays: number;
  totalCount: number;
  recent: { id: string; durationMs: number; at: string; senderName: string }[];
}

export interface Memory {
  id: string;
  couple_id: string;
  author_id: string;
  authorName: string;
  type: 'photo' | 'video' | 'audio' | 'drawing' | 'note' | 'capsule';
  title: string;
  note: string | null;
  media_url: string | null;
  unlock_at: string | null;
  created_at: string;
  /**
   * true ise: bu bir zaman kapsülü, açılma tarihi henüz gelmedi ve bu isteği
   * yapan kişi kapsülü oluşturan değil -- note/media_url sunucu tarafında
   * bilerek null olarak dönüyor (bkz. server/src/routes/memories.ts
   * decorateMemory). Kapsülü oluşturan kişi kendi içeriğini her zaman görür.
   */
  locked: boolean;
}

export interface TodayQuestion {
  day: string;
  question: string;
  myAnswer: { text: string; at: string } | null;
  partnerAnswered: boolean;
  partnerAnswer: { text: string; at: string } | null;
  partnerName: string | null;
}

export interface PlanItem {
  id: string;
  couple_id: string;
  category: 'city' | 'movie' | 'place' | 'plan';
  title: string;
  subtitle: string | null;
  added_by: string;
  addedByName: string;
  done: 0 | 1;
  created_at: string;
}

export interface SavingsContribution {
  id: string;
  goal_id: string;
  user_id: string;
  userName: string;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface SavingsGoal {
  id: string;
  couple_id: string;
  title: string;
  target_amount: number;
  note: string | null;
  created_at: string;
  savedAmount: number;
  progress: number;
  contributions: SavingsContribution[];
}

export type NotificationType =
  | 'touch'
  | 'mood'
  | 'memory'
  | 'plan_add'
  | 'plan_done'
  | 'savings_goal'
  | 'savings_contribution'
  | 'savings_withdrawal'
  | 'question_answer'
  | 'reunion_update'
  | 'message'
  | 'milestone'
  | 'love_language';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  readAt: string | null;
  at: string;
  actorName: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  couple_id: string;
  sender_id: string;
  type: 'text' | 'audio';
  text: string | null;
  media_url: string | null;
  duration_ms: number | null;
  created_at: string;
  read_at: string | null;
}

export interface ChatMessagesResponse {
  messages: ChatMessage[];
  /** true ise, ?before ile daha eski mesajlar için bir sonraki sayfa istenebilir. */
  hasMore: boolean;
}

/**
 * "Aşk dili" testi sonucu -- scores, src/quiz/askDili.ts'teki
 * LoveLanguageKey'lere göre anahtarlanmış puan sayısı (her biri 0-10 arası,
 * toplamı 10 -- 10 sorunun her biri tek bir kategoriye 1 puan ekler).
 */
export interface LoveLanguageResult {
  scores: Record<string, number>;
  topLanguage: string;
  at: string;
}

export interface LoveLanguageResponse {
  me: LoveLanguageResult | null;
  partner: LoveLanguageResult | null;
}

/**
 * Partnerin bulunduğu yerin anlık hava durumu -- konum paylaşımıyla aynı
 * karşılıklılık şartına tabi (bkz. server/src/routes/weather.ts). "icon"
 * bir MaterialCommunityIcons ikon adı (gün/gece durumuna göre değişir).
 */
export type WeatherResponse =
  | { shared: false }
  | { shared: true; available: false }
  | {
      shared: true;
      available: true;
      tempC: number;
      description: string;
      icon: string;
      isDay: boolean;
      at: string;
    };
