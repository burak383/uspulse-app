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

export interface MeResponse {
  user: PublicUser;
  partner: PublicUser | null;
  couple: Couple | null;
  /** Kuş uçuşu mesafe (km), yalnızca ikiniz de konum paylaştıysanız dolu gelir. */
  distanceKm: number | null;
  locationSharedByMe: boolean;
  locationSharedByPartner: boolean;
}

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
  partner: { name: string; mood?: string; at?: string } | null;
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
  | 'question_answer'
  | 'reunion_update';

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
