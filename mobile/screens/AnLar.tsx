import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors, fonts } from '../theme';
import { useAuth } from '../src/context/AuthContext';
import { api, apiUpload } from '../src/api/client';
import { Memory } from '../src/api/types';
import { RootStackParamList, TabRouteName } from '../navigation/types';

const alpha = (color: string, opacity: number) => {
  const value = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${value}`;
};

type IconProps = {
  name: React.ComponentProps<typeof Feather>['name'];
  size?: number;
  color?: string;
};

function Icon({ name, size = 20, color = colors.foreground }: IconProps) {
  return <Feather name={name} size={size} color={color} />;
}

function RoundIcon({
  name,
  size = 20,
  color = colors.foreground,
  background = colors.muted,
  style,
}: IconProps & { background?: string; style?: object }) {
  return (
    <View style={[styles.roundIcon, { backgroundColor: background }, style]}>
      <Icon name={name} size={size} color={color} />
    </View>
  );
}

function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: IconProps['name'];
  value: string;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <Icon name={icon} size={19} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ItemActions({
  onEdit,
  onDelete,
  tint = colors.mutedForeground,
}: {
  onEdit: () => void;
  onDelete: () => void;
  tint?: string;
}) {
  return (
    <View style={styles.itemActions}>
      <Pressable accessibilityLabel="Düzenle" style={styles.itemActionButton} onPress={onEdit}>
        <MaterialCommunityIcons name="pencil-outline" size={14} color={tint} />
      </Pressable>
      <Pressable accessibilityLabel="Sil" style={styles.itemActionButton} onPress={onDelete}>
        <MaterialCommunityIcons name="trash-can-outline" size={14} color={colors.destructive} />
      </Pressable>
    </View>
  );
}

function confirmDelete(itemLabel: string, onConfirm: () => void) {
  Alert.alert('Silinsin mi?', `"${itemLabel}" kalıcı olarak silinecek.`, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: onConfirm },
  ]);
}

function Capsule({
  title,
  date,
  onEdit,
  onDelete,
}: {
  title: string;
  date: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.capsule}>
      <View style={styles.calendarIcon}>
        <Icon name="calendar" size={31} color={colors.accent} />
      </View>
      <View style={styles.capsuleCopy}>
        <View style={styles.lockLabel}>
          <Icon name="lock" size={14} color={colors.accent} />
          <Text style={styles.lockText}>MÜHÜRLÜ</Text>
        </View>
        <Text style={styles.capsuleTitle}>{title}</Text>
        <Text style={styles.mutedSmall}>{date} · İçeriği gizli</Text>
      </View>
      <ItemActions onEdit={onEdit} onDelete={onDelete} tint={colors.accent} />
    </View>
  );
}

// Bir anının oynatıcısını (ses) barındırır -- her satırın kendi useAudioPlayer
// örneği olması gerektiği için ayrı bir bileşen (hook'lar liste içinde
// koşullu/döngüsel çağrılamaz).
function AudioMemoryRow({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const durationLabel = status.duration ? `${Math.round(status.duration)}sn` : '';
  return (
    <View style={styles.audioRow}>
      <Pressable
        accessibilityLabel={status.playing ? 'Duraklat' : 'Oynat'}
        style={styles.audioPlayButton}
        onPress={() => (status.playing ? player.pause() : player.play())}
      >
        <Icon
          name={status.playing ? 'pause' : 'play'}
          size={16}
          color={colors.primaryForeground}
        />
      </Pressable>
      <Text style={styles.mutedSmall}>Ses notu{durationLabel ? ` · ${durationLabel}` : ''}</Text>
    </View>
  );
}

// Aynı sebeple: her video anısı kendi useVideoPlayer örneğine sahip olmalı.
function VideoMemoryPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      style={styles.mediaPreviewVideo}
      player={player}
      contentFit="cover"
      nativeControls
      allowsFullscreen
    />
  );
}

const TYPE_LABEL: Record<Memory['type'], string> = {
  photo: 'Fotoğraf',
  video: 'Video',
  audio: 'Ses notu',
  drawing: 'Çizim',
  note: 'Not',
  capsule: 'Kapsül',
};

const ICON_BY_TYPE: Record<Memory['type'], IconProps['name']> = {
  photo: 'image',
  video: 'video',
  audio: 'mic',
  drawing: 'edit-3',
  note: 'edit-3',
  capsule: 'lock',
};

type CreateKind = 'note' | 'photo' | 'video' | 'audio' | 'capsule';

const KIND_OPTIONS: { value: CreateKind; label: string; icon: IconProps['name'] }[] = [
  { value: 'note', label: 'Not', icon: 'edit-3' },
  { value: 'photo', label: 'Fotoğraf', icon: 'image' },
  { value: 'video', label: 'Video', icon: 'video' },
  { value: 'audio', label: 'Ses notu', icon: 'mic' },
  { value: 'capsule', label: 'Kapsül', icon: 'lock' },
];

type PickedMedia = { uri: string; mimeType: string; fileName: string };

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function MemoriesScreen({ navigation }: { navigation: NavProp }) {
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState<CreateKind>('note');
  const [unlockAt, setUnlockAt] = useState('');
  const [pickedMedia, setPickedMedia] = useState<PickedMedia | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Ses notu kaydı: expo-audio hook'ları bileşenin en üst seviyesinde,
  // koşulsuz çağrılmalı (React hook kuralı) -- modal kapalıyken de var olur,
  // sadece kullanılmaz.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const previewPlayer = useAudioPlayer(recordedUri ?? undefined);
  const previewStatus = useAudioPlayerStatus(previewPlayer);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Memory[]>('/memories');
      setMemories(res);
    } catch {
      // best-effort refresh
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const goTab = (route: TabRouteName) => navigation.navigate(route);

  const capsules = useMemo(() => memories.filter((m) => m.type === 'capsule'), [memories]);
  const regular = useMemo(() => memories.filter((m) => m.type !== 'capsule'), [memories]);

  const monthCount = useMemo(() => {
    const now = new Date();
    return memories.filter((m) => {
      const d = new Date(m.created_at.replace(' ', 'T'));
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [memories]);

  const countFor = (type: Memory['type']) => memories.filter((m) => m.type === type).length;

  const monthLabel = new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  const stopRecordingIfActive = () => {
    if (recorderState.isRecording) {
      recorder.stop().catch(() => {});
    }
  };

  const openAddModal = () => {
    setEditingMemory(null);
    setTitle('');
    setNote('');
    setKind('note');
    setUnlockAt('');
    setPickedMedia(null);
    setRecordedUri(null);
    setModalOpen(true);
  };

  const openEditModal = (memory: Memory) => {
    setEditingMemory(memory);
    setTitle(memory.title);
    setNote(memory.note ?? '');
    setKind(memory.type === 'capsule' ? 'capsule' : 'note');
    setUnlockAt(memory.unlock_at ?? '');
    setPickedMedia(null);
    setRecordedUri(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    stopRecordingIfActive();
    setModalOpen(false);
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Fotoğraf izni gerekli',
        'Fotoğraf seçebilmek için Ayarlar\'dan UsPulse\'a fotoğraf erişimi vermelisin.',
      );
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (picked.canceled || !picked.assets?.[0]) return;
    // Anı fotoğrafları avatardan farklı olarak kare olmak zorunda değil, ama
    // yine de makul bir genişliğe küçültüp sıkıştırıyoruz -- hem yükleme hızlı
    // olsun hem de 8MB'lık sunucu sınırını rahatça karşılasın.
    const manipulated = await ImageManipulator.manipulateAsync(
      picked.assets[0].uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    );
    setPickedMedia({ uri: manipulated.uri, mimeType: 'image/jpeg', fileName: 'foto.jpg' });
  };

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Galeri izni gerekli',
        'Video seçebilmek için Ayarlar\'dan UsPulse\'a fotoğraf/video erişimi vermelisin.',
      );
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.7 });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
      Alert.alert('Video çok büyük', 'En fazla 50MB büyüklüğünde bir video seçebilirsin.');
      return;
    }
    setPickedMedia({ uri: asset.uri, mimeType: asset.mimeType || 'video/mp4', fileName: 'video.mp4' });
  };

  const selectKind = (next: CreateKind) => {
    stopRecordingIfActive();
    setKind(next);
    setPickedMedia(null);
    setRecordedUri(null);
    if (next === 'photo') pickPhoto();
    else if (next === 'video') pickVideo();
  };

  const startRecording = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Mikrofon izni gerekli',
        'Ses notu kaydedebilmek için Ayarlar\'dan UsPulse\'a mikrofon erişimi vermelisin.',
      );
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    setRecordedUri(null);
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stopRecording = async () => {
    await recorder.stop();
    if (recorder.uri) setRecordedUri(recorder.uri);
  };

  const canSubmit =
    Boolean(title.trim()) &&
    !submitting &&
    !(!editingMemory && kind === 'photo' && !pickedMedia) &&
    !(!editingMemory && kind === 'video' && !pickedMedia) &&
    !(!editingMemory && kind === 'audio' && !recordedUri);

  const submitMemory = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (editingMemory) {
        // Kilitli bir kapsülü (henüz açılma tarihi gelmemiş, bizim
        // eklemediğimiz) düzenlerken sunucu zaten note'u hiç göndermedi --
        // bu yüzden burada boş kalan not alanını PATCH'e dahil ETMİYORUZ,
        // yoksa "görünmeyen" gerçek içeriği sessizce boşla değiştirmiş
        // oluruz. bkz. server/src/routes/memories.ts isCapsuleLockedFor.
        const isLockedCapsule = editingMemory.type === 'capsule' && editingMemory.locked;
        await api.patch(`/memories/${editingMemory.id}`, {
          title: title.trim(),
          note: isLockedCapsule ? undefined : note.trim() || null,
          unlockAt: editingMemory.type === 'capsule' ? unlockAt.trim() || null : undefined,
        });
      } else if (kind === 'photo' || kind === 'video' || kind === 'audio') {
        const media: PickedMedia | null =
          kind === 'audio'
            ? recordedUri
              ? { uri: recordedUri, mimeType: 'audio/m4a', fileName: 'ses-notu.m4a' }
              : null
            : pickedMedia;
        if (!media) {
          setSubmitting(false);
          return;
        }
        const form = new FormData();
        form.append('type', kind);
        form.append('title', title.trim());
        if (note.trim()) form.append('note', note.trim());
        form.append('media', {
          uri: media.uri,
          name: media.fileName,
          type: media.mimeType,
        } as unknown as Blob);
        await apiUpload('/memories', form);
      } else {
        await api.post('/memories', {
          type: kind,
          title: title.trim(),
          note: note.trim() || undefined,
          unlockAt: kind === 'capsule' ? unlockAt.trim() || undefined : undefined,
        });
      }
      setModalOpen(false);
      load();
    } catch (e) {
      Alert.alert('Kaydedilemedi', e instanceof Error ? e.message : 'Lütfen tekrar dene.');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteMemory = (memory: Memory) => {
    confirmDelete(memory.title, async () => {
      await api.delete(`/memories/${memory.id}`);
      load();
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.card, colors.background, colors.background]}
          style={styles.header}
        >
          <View style={styles.headerGlowPrimary} />
          <View style={styles.headerGlowAccent} />

          <View style={styles.headerTop}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrowPrimary}>İKİNİZİN ARŞİVİ</Text>
              <Text style={styles.pageTitle}>Anılar</Text>
              <Text style={styles.headerDescription}>
                Birlikte biriktirdiğiniz küçük anlar, hep yakın kalsın.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Anı oluştur"
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={openAddModal}
            >
              <Icon name="plus" size={25} color={colors.primaryForeground} />
            </Pressable>
          </View>

          <View style={styles.monthCard}>
            <View style={styles.monthDetails}>
              <RoundIcon
                name="star"
                size={19}
                color={colors.accent}
                background={alpha(colors.accent, 0.15)}
              />
              <View>
                <Text style={styles.monthTitle}>{monthLabel}</Text>
                <Text style={styles.mutedSmall}>Bu ay birlikte {monthCount} anı</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.main}>
          {regular.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <View style={styles.headingCopy}>
                  <Text style={styles.eyebrow}>TÜM ANILAR</Text>
                  <Text style={styles.sectionTitle}>{regular.length} anı</Text>
                </View>
              </View>

              <View style={{ gap: 12 }}>
                {regular.map((memory) => (
                  <View key={memory.id} style={styles.memoryCard}>
                    <View style={styles.memoryBody}>
                      <View style={styles.noteRow}>
                        <RoundIcon
                          name={ICON_BY_TYPE[memory.type]}
                          size={19}
                          color={colors.accent}
                          background={alpha(colors.accent, 0.15)}
                        />
                        <View style={styles.flex}>
                          <Text style={styles.eyebrow}>
                            {new Date(memory.created_at.replace(' ', 'T'))
                              .toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
                              .toUpperCase()}{' '}
                            · {TYPE_LABEL[memory.type]}
                          </Text>
                          <Text style={styles.memoryTitleText}>{memory.title}</Text>
                          {memory.note ? <Text style={styles.noteText}>"{memory.note}"</Text> : null}
                          <Text style={styles.mutedSmall}>
                            {memory.authorName}'in notu ·{' '}
                            {new Date(memory.created_at.replace(' ', 'T')).toLocaleDateString('tr-TR')}
                          </Text>
                        </View>
                        <ItemActions
                          onEdit={() => openEditModal(memory)}
                          onDelete={() => deleteMemory(memory)}
                        />
                      </View>

                      {memory.type === 'photo' && memory.media_url ? (
                        <Image source={{ uri: memory.media_url }} style={styles.mediaPreviewImage} />
                      ) : null}
                      {memory.type === 'video' && memory.media_url ? (
                        <VideoMemoryPlayer uri={memory.media_url} />
                      ) : null}
                      {memory.type === 'audio' && memory.media_url ? (
                        <AudioMemoryRow uri={memory.media_url} />
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Henüz bir anı yok</Text>
              <Text style={styles.mutedSmall}>İlk anınızı bırakmak için sağ üstteki + işaretine dokunun.</Text>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.eyebrow}>GELECEĞE SAKLANDI</Text>
                <Text style={styles.sectionTitle}>Kilitli Kapsüller</Text>
              </View>
              <RoundIcon
                name="lock"
                size={16}
                color={colors.accent}
                background={alpha(colors.accent, 0.15)}
              />
            </View>

            {capsules.length > 0 ? (
              <View style={styles.capsules}>
                {capsules.map((capsule) => (
                  <Capsule
                    key={capsule.id}
                    title={capsule.title}
                    date={
                      capsule.unlock_at
                        ? new Date(capsule.unlock_at).toLocaleDateString('tr-TR')
                        : 'Tarih belirtilmedi'
                    }
                    onEdit={() => openEditModal(capsule)}
                    onDelete={() => deleteMemory(capsule)}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.mutedSmall}>Henüz bir kapsül oluşturmadınız.</Text>
            )}
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statsHeader}>
              <View>
                <Text style={styles.eyebrowPrimary}>BU AYIN YAKINLIKLARI</Text>
                <Text style={styles.sectionTitle}>{memories.length} küçük iz</Text>
              </View>
              <RoundIcon
                name="heart"
                size={19}
                color={colors.primary}
                background={alpha(colors.primary, 0.15)}
              />
            </View>
            <View style={styles.statsGrid}>
              <StatCard icon="image" value={String(countFor('photo'))} label="Fotoğraf" color={colors.primary} />
              <StatCard icon="video" value={String(countFor('video'))} label="Video" color={colors.accent} />
              <StatCard icon="mic" value={String(countFor('audio'))} label="Ses notu" color={colors.success} />
            </View>
          </View>

          <Pressable style={styles.newMemoryCard} onPress={openAddModal}>
            <RoundIcon
              name="plus"
              size={25}
              color={colors.primaryForeground}
              background={colors.primary}
              style={styles.largeAddIcon}
            />
            <View style={styles.flex}>
              <Text style={styles.eyebrowPrimary}>BUGÜN SAKLA</Text>
              <Text style={styles.newMemoryTitle}>Yeni bir anı bırakın</Text>
              <Text style={styles.mutedSmall}>
                Bir fotoğraf, video, ses notu ya da yazı - {user?.name ?? 'sen'}'den bir iz.
              </Text>
            </View>
            <Icon name="chevron-right" size={21} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.tabBar}>
        <Tab icon="home" label="Yuva" onPress={() => goTab('Yuva')} />
        <Tab icon="calendar" label="Planlar" onPress={() => goTab('Planlar')} />
        <Tab icon="image" label="Anılar" active onPress={() => goTab('Anilar')} />
        <Tab icon="users" label="Biz" onPress={() => goTab('Biz')} />
      </View>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalCard}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalTitle}>{editingMemory ? 'Anıyı düzenle' : 'Yeni anı'}</Text>

            {!editingMemory && (
              <View style={styles.kindRow}>
                {KIND_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[styles.kindChip, kind === opt.value && styles.kindChipActive]}
                    onPress={() => selectKind(opt.value)}
                  >
                    <Icon
                      name={opt.icon}
                      size={13}
                      color={kind === opt.value ? colors.primaryForeground : colors.mutedForeground}
                    />
                    <Text
                      style={[styles.kindChipText, kind === opt.value && styles.kindChipTextActive]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {!editingMemory && (kind === 'photo' || kind === 'video') && (
              <Pressable
                style={styles.mediaPickButton}
                onPress={kind === 'photo' ? pickPhoto : pickVideo}
              >
                {pickedMedia ? (
                  kind === 'photo' ? (
                    <Image source={{ uri: pickedMedia.uri }} style={styles.mediaPickPreviewImage} />
                  ) : (
                    <View style={styles.mediaPickPreviewVideo}>
                      <Icon name="video" size={22} color={colors.primary} />
                      <Text style={styles.mutedSmall}>Video seçildi · değiştirmek için dokun</Text>
                    </View>
                  )
                ) : (
                  <>
                    <Icon name={kind === 'photo' ? 'image' : 'video'} size={22} color={colors.primary} />
                    <Text style={styles.mediaPickText}>
                      {kind === 'photo' ? 'Fotoğraf seç' : 'Video seç'}
                    </Text>
                  </>
                )}
              </Pressable>
            )}

            {!editingMemory && kind === 'audio' && (
              <View style={styles.audioRecordBox}>
                {!recordedUri ? (
                  <Pressable
                    style={[styles.recordButton, recorderState.isRecording && styles.recordButtonActive]}
                    onPress={recorderState.isRecording ? stopRecording : startRecording}
                  >
                    <Icon
                      name={recorderState.isRecording ? 'square' : 'mic'}
                      size={18}
                      color={colors.primaryForeground}
                    />
                    <Text style={styles.recordButtonText}>
                      {recorderState.isRecording
                        ? `Durdur · ${Math.round(recorderState.durationMillis / 1000)}sn`
                        : 'Kaydı başlat'}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.audioPreviewRow}>
                    <Pressable
                      style={styles.audioPlayButton}
                      onPress={() => (previewStatus.playing ? previewPlayer.pause() : previewPlayer.play())}
                    >
                      <Icon
                        name={previewStatus.playing ? 'pause' : 'play'}
                        size={16}
                        color={colors.primaryForeground}
                      />
                    </Pressable>
                    <Text style={styles.mutedSmall}>
                      Kaydedildi{previewStatus.duration ? ` · ${Math.round(previewStatus.duration)}sn` : ''}
                    </Text>
                    <Pressable onPress={() => setRecordedUri(null)}>
                      <Text style={styles.reRecordText}>Yeniden kaydet</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Başlık (örn. Pazar kahvaltısı)"
              placeholderTextColor={colors.mutedForeground}
              style={styles.modalInput}
              autoFocus={!editingMemory}
            />
            {editingMemory?.type === 'capsule' && editingMemory.locked ? (
              <View style={styles.lockedNoteBox}>
                <Icon name="lock" size={14} color={colors.accent} />
                <Text style={styles.mutedSmall}>
                  İçerik, açılma tarihine kadar gizli -- yalnızca ekleyen kişi görebilir.
                </Text>
              </View>
            ) : (
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Bir not bırak (opsiyonel)"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.modalInput, styles.modalTextArea]}
                multiline
              />
            )}

            {(kind === 'capsule' || editingMemory?.type === 'capsule') && (
              <TextInput
                value={unlockAt}
                onChangeText={setUnlockAt}
                placeholder="Açılma tarihi (YYYY-AA-GG)"
                placeholderTextColor={colors.mutedForeground}
                style={styles.modalInput}
              />
            )}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={closeModal}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, !canSubmit && styles.modalConfirmDisabled]}
                onPress={submitMemory}
                disabled={!canSubmit}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.modalConfirmText}>Kaydet</Text>
                )}
              </Pressable>
            </View>

            {editingMemory && (
              <Pressable
                style={styles.modalDelete}
                onPress={() => {
                  closeModal();
                  deleteMemory(editingMemory);
                }}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.destructive} />
                <Text style={styles.modalDeleteText}>Anıyı sil</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Tab({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: IconProps['name'];
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={[styles.tab, active && styles.activeTab]} onPress={onPress}>
      <Icon name={icon} size={21} color={active ? colors.primary : colors.mutedForeground} />
      <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 128,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  headerGlowPrimary: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -65,
    top: 24,
    backgroundColor: alpha(colors.primary, 0.1),
  },
  headerGlowAccent: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    left: -75,
    top: 125,
    backgroundColor: alpha(colors.accent, 0.1),
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    paddingRight: 18,
  },
  eyebrow: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  eyebrowPrimary: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  pageTitle: {
    marginTop: 7,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 34,
    lineHeight: 38,
  },
  headerDescription: {
    marginTop: 12,
    maxWidth: 255,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCard: {
    marginTop: 27,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.8),
    backgroundColor: alpha(colors.card, 0.78),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roundIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  mutedSmall: {
    marginTop: 4,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  main: {
    paddingHorizontal: 20,
    gap: 25,
  },
  section: {
    gap: 12,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headingCopy: {
    flex: 1,
    paddingRight: 8,
  },
  sectionTitle: {
    marginTop: 4,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 25,
    lineHeight: 30,
  },
  memoryCard: {
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  memoryBody: {
    padding: 16,
    gap: 12,
  },
  memoryTitleText: {
    marginTop: 4,
    color: colors.cardForeground,
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 21,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  noteText: {
    marginTop: 4,
    color: colors.cardForeground,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  capsules: {
    gap: 12,
  },
  capsule: {
    minHeight: 112,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  calendarIcon: {
    width: 64,
    height: 64,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(colors.accent, 0.1),
  },
  capsuleCopy: {
    flex: 1,
  },
  lockLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockText: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  capsuleTitle: {
    marginTop: 4,
    color: colors.cardForeground,
    fontFamily: fonts.heading,
    fontSize: 18,
    lineHeight: 22,
  },
  statsCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statsGrid: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 15,
    backgroundColor: alpha(colors.muted, 0.7),
  },
  statValue: {
    marginTop: 12,
    color: colors.cardForeground,
    fontFamily: fonts.heading,
    fontSize: 25,
  },
  statLabel: {
    marginTop: 4,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  newMemoryCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.3),
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  largeAddIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  newMemoryTitle: {
    marginTop: 4,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 21,
  },
  tabBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.7),
    backgroundColor: alpha(colors.background, 0.94),
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tab: {
    minWidth: 68,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 24,
    alignItems: 'center',
    gap: 4,
  },
  activeTab: {
    backgroundColor: alpha(colors.primary, 0.15),
  },
  tabLabel: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '600',
  },
  activeTabLabel: {
    color: colors.primary,
    fontWeight: '800',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 6,
  },
  itemActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(colors.muted, 0.7),
  },
  mediaPreviewImage: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    backgroundColor: colors.muted,
  },
  mediaPreviewVideo: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    backgroundColor: colors.muted,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  audioPlayButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  modalScroll: {
    width: '100%',
    maxHeight: '86%',
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 360, alignSelf: 'center', padding: 20, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 12 },
  modalTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 19 },
  modalInput: { minHeight: 46, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground, fontFamily: fonts.body, fontSize: 14 },
  modalTextArea: { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: { flex: 1, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  modalCancelText: { color: colors.secondaryForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  modalConfirm: { flex: 1, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  modalConfirmDisabled: { opacity: 0.5 },
  modalConfirmText: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  modalDelete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, paddingVertical: 8 },
  modalDeleteText: { color: colors.destructive, fontFamily: fonts.body, fontSize: 13, fontWeight: '700' },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.muted,
  },
  kindChipActive: {
    backgroundColor: colors.primary,
  },
  kindChipText: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
  },
  kindChipTextActive: {
    color: colors.primaryForeground,
  },
  mediaPickButton: {
    minHeight: 90,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  mediaPickText: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
  },
  mediaPickPreviewImage: {
    width: '100%',
    height: 160,
  },
  mediaPickPreviewVideo: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 20,
  },
  audioRecordBox: {
    alignItems: 'flex-start',
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: colors.primary,
  },
  recordButtonActive: {
    backgroundColor: colors.destructive,
  },
  recordButtonText: {
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '800',
  },
  audioPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lockedNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: alpha(colors.accent, 0.1),
  },
  reRecordText: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
  },
});
