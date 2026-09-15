// Çiftler arası doğrudan mesajlaşma (metin + sesli not). Alt sekme
// çubuğunda YER ALMIYOR (bkz. navigation/types.ts) -- Günün Sorusu ile aynı
// desende, Yuva ekranındaki sohbet ikonundan (bkz. Yuva.tsx headerActions)
// tek dokunuşla açılan ayrı bir stack ekranı. WebSocket/gerçek zamanlı bir
// altyapı yok -- diğer canlı ekranlarla (PartnerKonum, Surus) aynı basit
// polling deseni kullanılıyor, sadece sohbetin doğası gereği daha sık
// (POLL_MS) tazeleniyor.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { theme } from '../theme';
import { useAuth } from '../src/context/AuthContext';
import { api, apiUpload, appendMediaFile } from '../src/api/client';
import { ChatMessage, ChatMessagesResponse } from '../src/api/types';
import { RootStackParamList } from '../navigation/types';
import { AvatarView } from '../src/components/AvatarView';
import { parseSqliteTimestamp } from '../src/utils/date';

const colors = theme.colors;
const fonts = theme.fonts;

// Sürüş/Konum ekranlarındaki POLL_MS (5sn) ile aynı fikir, ama sohbet daha
// sık geri dönüş beklendiği için biraz daha sık.
const POLL_MS = 4000;
const MAX_TEXT_LENGTH = 2000;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const Icon = ({
  name,
  size = 20,
  color = colors.foreground,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) => <MaterialCommunityIcons name={name} size={size} color={color} />;

function formatMessageTime(value: string): string {
  const date = parseSqliteTimestamp(value);
  if (!date) return '';
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

// Polling ile gelen en güncel pencereyi mevcut listeyle birleştirir --
// yalnızca henüz görülmemiş (id'si listede olmayan) mesajları ekler, daha
// önce "Daha eski mesajları göster" ile yüklenmiş sayfaları BOZMAZ.
function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return prev;
  const existingIds = new Set(prev.map((m) => m.id));
  const fresh = incoming.filter((m) => !existingIds.has(m.id));
  if (fresh.length === 0) return prev;
  return [...prev, ...fresh].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// Sesli mesajın oynatıcısı -- her balonun kendi useAudioPlayer örneği olması
// gerekir (bkz. AnLar.tsx'teki AudioMemoryRow ile aynı gerekçe: hook'lar
// liste içinde koşullu/döngüsel çağrılamaz).
function AudioMessageBubble({ uri, mine }: { uri: string; mine: boolean }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const durationLabel = status.duration ? `${Math.round(status.duration)}sn` : '';
  return (
    <View style={styles.audioRow}>
      <Pressable
        accessibilityLabel={status.playing ? 'Duraklat' : 'Oynat'}
        style={[styles.audioPlayButton, mine ? styles.audioPlayButtonMine : styles.audioPlayButtonTheirs]}
        onPress={() => (status.playing ? player.pause() : player.play())}
      >
        <Icon name={status.playing ? 'pause' : 'play'} size={16} color={mine ? colors.primaryForeground : colors.foreground} />
      </Pressable>
      <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
        Sesli mesaj{durationLabel ? ` · ${durationLabel}` : ''}
      </Text>
    </View>
  );
}

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Sohbet'>;

export default function ChatScreen({ navigation }: { navigation: NavProp }) {
  const { user, partner } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // expo-audio hook'ları koşulsuz, bileşenin en üst seviyesinde çağrılmalı
  // (bkz. AnLar.tsx'teki aynı not) -- kayıt yapılmıyorken de var olur.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    }).catch(() => {});
  }, []);

  const markRead = useCallback(() => {
    api.put('/messages/read').catch(() => {
      // best-effort -- okunmadı rozeti bir sonraki senkronizasyonda düzelir.
    });
  }, []);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const res = await api.get<ChatMessagesResponse>('/messages');
        setMessages((prev) => (opts?.silent ? mergeMessages(prev, res.messages) : res.messages));
        setHasMore(res.hasMore);
        markRead();
      } catch (e) {
        if (!opts?.silent) {
          Alert.alert('Mesajlar yüklenemedi', e instanceof Error ? e.message : 'Lütfen tekrar dene.');
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [markRead],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load();
      const interval = setInterval(() => {
        if (!cancelled) load({ silent: true });
      }, POLL_MS);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }, [load]),
  );

  const loadOlder = async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[0];
      const res = await api.get<ChatMessagesResponse>(`/messages?before=${encodeURIComponent(oldest.id)}`);
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const older = res.messages.filter((m) => !existingIds.has(m.id));
        return [...older, ...prev];
      });
      setHasMore(res.hasMore);
    } catch {
      // sessizce geç -- kullanıcı "Daha eski mesajları göster"a tekrar dokunabilir.
    } finally {
      setLoadingOlder(false);
    }
  };

  const scrollToEnd = () => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  const sendText = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    if (trimmed.length > MAX_TEXT_LENGTH) {
      Alert.alert('Mesaj çok uzun', `En fazla ${MAX_TEXT_LENGTH} karakter yazabilirsin.`);
      return;
    }
    setSending(true);
    setText('');
    try {
      const row = await api.post<ChatMessage>('/messages', { text: trimmed });
      setMessages((prev) => mergeMessages(prev, [row]));
      scrollToEnd();
    } catch (e) {
      setText(trimmed);
      Alert.alert('Gönderilemedi', e instanceof Error ? e.message : 'Lütfen tekrar dene.');
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Mikrofon izni gerekli',
        'Sesli mesaj gönderebilmek için Ayarlar\'dan UsPulse\'a mikrofon erişimi vermelisin.',
      );
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stopAndSendRecording = async () => {
    const durationMs = recorderState.durationMillis;
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) return;
    setUploadingAudio(true);
    try {
      const form = new FormData();
      if (durationMs) form.append('durationMs', String(Math.round(durationMs)));
      await appendMediaFile(form, 'media', { uri, mimeType: 'audio/mp4', fileName: 'sesli-mesaj.m4a' });
      const row = await apiUpload<ChatMessage>('/messages/audio', form);
      setMessages((prev) => mergeMessages(prev, [row]));
      scrollToEnd();
    } catch (e) {
      Alert.alert('Gönderilemedi', e instanceof Error ? e.message : 'Sesli mesaj gönderilemedi, lütfen tekrar dene.');
    } finally {
      setUploadingAudio(false);
    }
  };

  const cancelRecording = () => {
    recorder.stop().catch(() => {});
  };

  const partnerName = partner?.name ?? 'Partnerin';

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const mine = item.sender_id === user?.id;
    return (
      <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowTheirs]}>
        {!mine && (
          <AvatarView
            avatarUrl={partner?.avatarUrl}
            size={28}
            fallbackIcon="account"
            fallbackColor={colors.mutedForeground}
          />
        )}
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          {item.type === 'audio' && item.media_url ? (
            <AudioMessageBubble uri={item.media_url} mine={mine} />
          ) : (
            <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
              {item.text}
            </Text>
          )}
          <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
            {formatMessageTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Geri dön" style={styles.circleButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <AvatarView
          avatarUrl={partner?.avatarUrl}
          size={34}
          fallbackIcon="account"
          fallbackColor={colors.mutedForeground}
        />
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{partnerName}</Text>
          <Text style={styles.headerSubtitle}>Sohbet</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flexOne}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={scrollToEnd}
            ListHeaderComponent={
              hasMore ? (
                <Pressable style={styles.loadOlderButton} onPress={loadOlder} disabled={loadingOlder}>
                  {loadingOlder ? (
                    <ActivityIndicator color={colors.mutedForeground} size="small" />
                  ) : (
                    <Text style={styles.loadOlderText}>Daha eski mesajları göster</Text>
                  )}
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.centered}>
                <Icon name="chat-outline" size={32} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>Henüz mesaj yok. İlk mesajı sen gönder!</Text>
              </View>
            }
          />

          <View style={styles.inputBar}>
            {recorderState.isRecording ? (
              <>
                <Pressable accessibilityLabel="Kaydı iptal et" style={styles.cancelRecordButton} onPress={cancelRecording}>
                  <Icon name="close-circle" size={22} color={colors.mutedForeground} />
                </Pressable>
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>
                    Kaydediliyor · {Math.round(recorderState.durationMillis / 1000)}sn
                  </Text>
                </View>
                <Pressable accessibilityLabel="Kaydı gönder" style={styles.sendButton} onPress={stopAndSendRecording}>
                  <Icon name="send" size={18} color={colors.primaryForeground} />
                </Pressable>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.textInput}
                  placeholder="Bir mesaj yaz..."
                  placeholderTextColor={colors.mutedForeground}
                  value={text}
                  onChangeText={setText}
                  multiline
                  maxLength={MAX_TEXT_LENGTH}
                />
                {text.trim() ? (
                  <Pressable
                    accessibilityLabel="Gönder"
                    style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                    onPress={sendText}
                    disabled={sending}
                  >
                    {sending ? (
                      <ActivityIndicator color={colors.primaryForeground} size="small" />
                    ) : (
                      <Icon name="send" size={18} color={colors.primaryForeground} />
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityLabel="Sesli mesaj kaydet"
                    style={[styles.sendButton, uploadingAudio && styles.sendButtonDisabled]}
                    onPress={startRecording}
                    disabled={uploadingAudio}
                  >
                    {uploadingAudio ? (
                      <ActivityIndicator color={colors.primaryForeground} size="small" />
                    ) : (
                      <Icon name="microphone" size={18} color={colors.primaryForeground} />
                    )}
                  </Pressable>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flexOne: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  headerCopy: { flex: 1 },
  headerTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.foreground },
  headerSubtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.mutedForeground, marginTop: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 19,
  },
  listContent: { paddingHorizontal: 16, paddingVertical: 14, gap: 10, flexGrow: 1 },
  loadOlderButton: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.card,
    marginBottom: 10,
  },
  loadOlderText: { fontFamily: fonts.body, fontSize: 12, color: colors.mutedForeground },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '85%',
  },
  messageRowMine: { alignSelf: 'flex-end' },
  messageRowTheirs: { alignSelf: 'flex-start' },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 3,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 20 },
  bubbleTextMine: { color: colors.primaryForeground },
  bubbleTextTheirs: { color: colors.cardForeground },
  bubbleTime: { fontFamily: fonts.body, fontSize: 10 },
  bubbleTimeMine: { color: `${colors.primaryForeground}99` },
  bubbleTimeTheirs: { color: colors.mutedForeground },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  audioPlayButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPlayButtonMine: { backgroundColor: `${colors.primaryForeground}33` },
  audioPlayButtonTheirs: { backgroundColor: colors.muted },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  textInput: {
    flex: 1,
    maxHeight: 110,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.input,
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 14.5,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  sendButtonDisabled: { opacity: 0.6 },
  cancelRecordButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.destructive,
  },
  recordingText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.foreground },
});
