import React, { useCallback, useState } from 'react';
import {
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts } from '../theme';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api/client';
import { PlanItem, SavingsGoal } from '../src/api/types';
import { RootStackParamList, TabRouteName } from '../navigation/types';

const kasImage =
  'https://fwtngjyirchhhysukjxi.supabase.co/storage/v1/object/public/project-images/d8f99d97-2440-4f3a-addf-6eb2753287e6/cc97ef26-ea3b-42b7-89fc-3c5dbbec74d9.png';

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

const PillButton = ({
  children,
  icon,
  color = colors.primary,
  textColor = colors.primaryForeground,
  style,
  onPress,
  disabled,
}: {
  children: React.ReactNode;
  icon?: IconName;
  color?: string;
  textColor?: string;
  style?: object;
  onPress?: () => void;
  disabled?: boolean;
}) => (
  <Pressable
    style={[styles.pillButton, { backgroundColor: color }, disabled && { opacity: 0.5 }, style]}
    onPress={onPress}
    disabled={disabled}
  >
    <Text style={[styles.pillButtonText, { color: textColor }]}>{children}</Text>
    {icon && <Icon name={icon} size={15} color={textColor} />}
  </Pressable>
);

const AddButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable accessibilityLabel={label} style={styles.addButton} onPress={onPress}>
    <Icon name="plus" size={17} color={colors.secondaryForeground} />
  </Pressable>
);

// Small edit/delete pair used on every editable item across this screen.
const ItemActions = ({
  onEdit,
  onDelete,
  tint = colors.mutedForeground,
}: {
  onEdit: () => void;
  onDelete: () => void;
  tint?: string;
}) => (
  <View style={styles.itemActions}>
    <Pressable accessibilityLabel="Düzenle" style={styles.itemActionButton} onPress={onEdit}>
      <Icon name="pencil-outline" size={14} color={tint} />
    </Pressable>
    <Pressable accessibilityLabel="Sil" style={styles.itemActionButton} onPress={onDelete}>
      <Icon name="trash-can-outline" size={14} color={colors.destructive} />
    </Pressable>
  </View>
);

const WishlistCard = ({
  icon,
  iconColor,
  title,
  subtitle,
  action,
  onEdit,
  onDelete,
}: {
  icon: IconName;
  iconColor: string;
  title: string;
  subtitle: string;
  action: string;
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <View style={styles.wishItem}>
    <View style={styles.wishTopRow}>
      <View style={[styles.wishIcon, { backgroundColor: iconColor, opacity: 0.95 }]}>
        <Icon name={icon} size={17} color={iconColor} />
      </View>
      <ItemActions onEdit={onEdit} onDelete={onDelete} />
    </View>
    <Text style={styles.wishTitle}>{title}</Text>
    <Text style={styles.tinyMuted}>{subtitle}</Text>
    <Text style={styles.wishAction}>{action}</Text>
  </View>
);

type PlanCategory = PlanItem['category'];
type NavProp = NativeStackNavigationProp<RootStackParamList>;

function confirmDelete(itemLabel: string, onConfirm: () => void) {
  Alert.alert('Silinsin mi?', `"${itemLabel}" kalıcı olarak silinecek.`, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: onConfirm },
  ]);
}

function reunionCountdown(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const days = Math.ceil((target.getTime() - Date.now()) / 86400000);
  return days;
}

export default function PlansScreen({ navigation }: { navigation: NavProp }) {
  const { couple, refresh } = useAuth();
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [savings, setSavings] = useState<SavingsGoal[]>([]);

  // Add/edit modal for plan items (city/movie/place/checklist). editingItem
  // null = creating a new item in addCategory; set = editing that item.
  const [addCategory, setAddCategory] = useState<PlanCategory | null>(null);
  const [editingItem, setEditingItem] = useState<PlanItem | null>(null);
  const [addTitle, setAddTitle] = useState('');
  const [addSubtitle, setAddSubtitle] = useState('');

  const [contributeGoal, setContributeGoal] = useState<SavingsGoal | null>(null);
  const [contributeAmount, setContributeAmount] = useState('100');

  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalNote, setGoalNote] = useState('');

  const [reunionModalOpen, setReunionModalOpen] = useState(false);
  const [reunionTitle, setReunionTitle] = useState('');
  const [reunionLocation, setReunionLocation] = useState('');
  const [reunionDate, setReunionDate] = useState('');

  const load = useCallback(async () => {
    try {
      const [planRes, savingsRes] = await Promise.all([
        api.get<PlanItem[]>('/plans'),
        api.get<SavingsGoal[]>('/savings'),
      ]);
      setPlans(planRes);
      setSavings(savingsRes);
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

  const cities = plans.filter((p) => p.category === 'city');
  const movies = plans.filter((p) => p.category === 'movie');
  const places = plans.filter((p) => p.category === 'place');
  const checklist = plans.filter((p) => p.category === 'plan');
  const doneCount = checklist.filter((p) => p.done).length;
  const checklistProgress = checklist.length > 0 ? doneCount / checklist.length : 0;
  const mainGoal = savings[0];
  const countdownDays = reunionCountdown(couple?.reunion_date);

  const toggleChecklist = async (item: PlanItem) => {
    await api.patch<PlanItem>(`/plans/${item.id}`, { done: !item.done });
    load();
  };

  const advanceMeeting = async () => {
    const next = checklist.find((p) => !p.done);
    if (!next) return;
    await toggleChecklist(next);
  };

  const openAdd = (category: PlanCategory) => {
    setEditingItem(null);
    setAddCategory(category);
    setAddTitle('');
    setAddSubtitle('');
  };

  const openEditItem = (item: PlanItem) => {
    setEditingItem(item);
    setAddCategory(item.category);
    setAddTitle(item.title);
    setAddSubtitle(item.subtitle ?? '');
  };

  const closeItemModal = () => {
    setAddCategory(null);
    setEditingItem(null);
  };

  const submitAdd = async () => {
    if (!addCategory || !addTitle.trim()) return;
    if (editingItem) {
      await api.patch(`/plans/${editingItem.id}`, {
        title: addTitle.trim(),
        subtitle: addSubtitle.trim() || null,
      });
    } else {
      await api.post('/plans', {
        category: addCategory,
        title: addTitle.trim(),
        subtitle: addSubtitle.trim() || undefined,
      });
    }
    closeItemModal();
    load();
  };

  const deleteItem = (item: PlanItem) => {
    confirmDelete(item.title, async () => {
      await api.delete(`/plans/${item.id}`);
      if (editingItem?.id === item.id) closeItemModal();
      load();
    });
  };

  const openContribute = (goal: SavingsGoal) => {
    setContributeGoal(goal);
    setContributeAmount('100');
  };

  const submitContribute = async () => {
    const amount = Number(contributeAmount);
    if (!contributeGoal || !amount || amount <= 0) return;
    await api.post(`/savings/${contributeGoal.id}/contribute`, { amount });
    setContributeGoal(null);
    load();
  };

  const deleteContribution = (goal: SavingsGoal, contributionId: string, label: string) => {
    confirmDelete(label, async () => {
      await api.delete(`/savings/${goal.id}/contribute/${contributionId}`);
      load();
    });
  };

  const openEditGoal = (goal: SavingsGoal) => {
    setEditGoal(goal);
    setGoalTitle(goal.title);
    setGoalTarget(String(goal.target_amount));
    setGoalNote(goal.note ?? '');
  };

  const submitEditGoal = async () => {
    if (!editGoal || !goalTitle.trim() || !Number(goalTarget)) return;
    await api.patch(`/savings/${editGoal.id}`, {
      title: goalTitle.trim(),
      targetAmount: Number(goalTarget),
      note: goalNote.trim() || null,
    });
    setEditGoal(null);
    load();
  };

  const deleteGoal = (goal: SavingsGoal) => {
    confirmDelete(goal.title, async () => {
      await api.delete(`/savings/${goal.id}`);
      setEditGoal(null);
      load();
    });
  };

  const openReunionEdit = () => {
    setReunionTitle(couple?.reunion_title ?? '');
    setReunionLocation(couple?.reunion_location ?? '');
    setReunionDate(couple?.reunion_date ?? '');
    setReunionModalOpen(true);
  };

  const submitReunion = async () => {
    await api.put('/reunion', {
      title: reunionTitle.trim() || null,
      location: reunionLocation.trim() || null,
      date: reunionDate.trim() || null,
    });
    setReunionModalOpen(false);
    refresh();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <LinearGradient
          colors={[colors.card, colors.background, colors.background]}
          style={styles.header}
        >
          <View style={styles.headerGlowPrimary} />
          <View style={styles.headerGlowAccent} />

          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrowPrimary}>BİRLİKTE KURDUĞUNUZ HAYAT</Text>
              <Text style={styles.pageTitle}>Planlar</Text>
              <Text style={styles.subtitle}>
                Uzaklığı küçük buluşmalara, dilekleri ortak anılara dönüştürün.
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.main}>
          <LinearGradient
            colors={[colors.primary, colors.card, colors.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.meetingCard}
          >
            <View style={styles.meetingGlow} />
            <View style={styles.meetingContent}>
              <View style={styles.cardTopRow}>
                <Text style={styles.statusBadge}>SIRADAKİ BULUŞMA</Text>
                <Pressable accessibilityLabel="Buluşmayı düzenle" onPress={openReunionEdit} hitSlop={8}>
                  <Icon name="pencil-outline" size={20} color={colors.primary} />
                </Pressable>
              </View>

              <Text style={styles.mutedText}>
                {couple?.reunion_date ?? 'Tarih belirlenmedi'}
                {couple?.reunion_location ? ` · ${couple.reunion_location}` : ''}
              </Text>
              <Text style={styles.sectionTitle}>{couple?.reunion_title ?? 'Buluşma planı'}</Text>

              {countdownDays !== null && (
                <View style={styles.daysRow}>
                  <Text style={styles.daysNumber}>{Math.max(countdownDays, 0)}</Text>
                  <Text style={styles.daysLabel}>gün kaldı</Text>
                </View>
              )}

              <View style={styles.checklist}>
                <View style={styles.checklistHeader}>
                  <Text style={styles.boldText}>Ortak kontrol listesi</Text>
                  <Text style={styles.primarySmall}>
                    {doneCount} / {checklist.length || 0} tamamlandı
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${checklistProgress * 100}%` }]} />
                </View>

                {checklist.map((item) => (
                  <View key={item.id} style={styles.taskRow}>
                    <Pressable
                      onPress={() => toggleChecklist(item)}
                      style={item.done ? styles.checkedCircle : styles.emptyCircle}
                      accessibilityLabel="Tamamlandı işaretle"
                    >
                      {Boolean(item.done) && <Icon name="check" size={13} color={colors.success} />}
                    </Pressable>
                    <Text style={item.done ? styles.completedTask : styles.taskText}>{item.title}</Text>
                    <ItemActions
                      tint={colors.primaryForeground}
                      onEdit={() => openEditItem(item)}
                      onDelete={() => deleteItem(item)}
                    />
                  </View>
                ))}
                {checklist.length === 0 && (
                  <Text style={[styles.tinyMuted, { marginTop: 8 }]}>Henüz bir kontrol listesi yok.</Text>
                )}
              </View>

              <PillButton icon="arrow-right" style={styles.advanceButton} onPress={advanceMeeting}>
                Buluşmayı ilerlet
              </PillButton>
            </View>
          </LinearGradient>

          <View>
            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.eyebrowAccent}>BİR GÜN MUTLAKA</Text>
                <Text style={styles.heading}>Dilek listeniz</Text>
              </View>
            </View>

            <View style={styles.wishlistStack}>
              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>Şehirler</Text>
                  <AddButton label="Şehre ekle" onPress={() => openAdd('city')} />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {cities.map((city) => (
                    <WishlistCard
                      key={city.id}
                      icon="map-outline"
                      iconColor={colors.primary}
                      title={city.title}
                      subtitle={city.subtitle ?? city.addedByName}
                      action="Planlayalım mı?"
                      onEdit={() => openEditItem(city)}
                      onDelete={() => deleteItem(city)}
                    />
                  ))}
                  {cities.length === 0 && (
                    <Text style={[styles.tinyMuted, { padding: 4 }]}>Henüz şehir eklenmedi.</Text>
                  )}
                </ScrollView>
              </View>

              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>Filmler</Text>
                  <AddButton label="Film ekle" onPress={() => openAdd('movie')} />
                </View>
                {movies.map((movie) => (
                  <View key={movie.id} style={styles.movieRow}>
                    <View style={styles.movieIcon}>
                      <Icon name="movie-open-outline" size={22} color={colors.accent} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.boldText}>{movie.title}</Text>
                      <Text style={styles.tinyMuted}>{movie.subtitle ?? movie.addedByName}</Text>
                    </View>
                    <ItemActions onEdit={() => openEditItem(movie)} onDelete={() => deleteItem(movie)} />
                  </View>
                ))}
                {movies.length === 0 && <Text style={styles.tinyMuted}>Henüz film eklenmedi.</Text>}
              </View>

              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>Mekanlar</Text>
                  <AddButton label="Mekan ekle" onPress={() => openAdd('place')} />
                </View>
                <View style={styles.placeGrid}>
                  {places.map((place) => (
                    <View key={place.id} style={styles.placeCard}>
                      <View style={styles.wishTopRow}>
                        <Text style={styles.starMark}>✦</Text>
                        <ItemActions onEdit={() => openEditItem(place)} onDelete={() => deleteItem(place)} />
                      </View>
                      <Text style={styles.placeTitle}>{place.title}</Text>
                      <Text style={styles.tinyMuted}>{place.subtitle ?? place.addedByName}</Text>
                    </View>
                  ))}
                  {places.length === 0 && <Text style={styles.tinyMuted}>Henüz mekan eklenmedi.</Text>}
                </View>
              </View>
            </View>
          </View>

          {savings.map((goal) => (
            <View key={goal.id} style={styles.savingsCard}>
              <View style={styles.savingsBody}>
                <View style={styles.savingsHeader}>
                  <View style={styles.flex}>
                    <View style={styles.savingsLabelRow}>
                      <Icon name="cash-multiple" size={19} color={colors.accent} />
                      <Text style={styles.eyebrowAccent}>ORTAK BİRİKİM</Text>
                    </View>
                    <Text style={styles.heading}>{goal.title}</Text>
                    {goal.note && <Text style={styles.smallMuted}>{goal.note}</Text>}
                  </View>
                  <ItemActions onEdit={() => openEditGoal(goal)} onDelete={() => deleteGoal(goal)} />
                </View>

                <View style={styles.savingsAmountRow}>
                  <View>
                    <Text style={styles.savingsAmount}>{goal.savedAmount.toLocaleString('tr-TR')} TL</Text>
                    <Text style={styles.smallMuted}>{goal.target_amount.toLocaleString('tr-TR')} TL hedefin</Text>
                  </View>
                  <Text style={styles.successText}>%{Math.round(goal.progress * 100)}</Text>
                </View>

                <View style={styles.savingsTrack}>
                  <View style={[styles.savingsProgress, { width: `${goal.progress * 100}%` }]} />
                </View>

                {goal.contributions.length > 0 && (
                  <View style={styles.contributionList}>
                    {goal.contributions.slice(0, 4).map((c) => (
                      <View key={c.id} style={styles.contributionItem}>
                        <Text style={styles.smallMuted}>
                          {c.userName}, {c.amount.toLocaleString('tr-TR')} TL
                        </Text>
                        <Pressable
                          accessibilityLabel="Katkıyı sil"
                          onPress={() => deleteContribution(goal, c.id, `${c.userName} - ${c.amount} TL`)}
                          hitSlop={8}
                        >
                          <Icon name="close" size={14} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.contributionRow}>
                  <Text style={styles.smallMuted}>
                    {goal.contributions.length === 0 ? 'Henüz katkı yok' : ' '}
                  </Text>
                  <PillButton
                    color={colors.accent}
                    textColor={colors.accentForeground}
                    onPress={() => openContribute(goal)}
                  >
                    Para Ekle
                  </PillButton>
                </View>
              </View>
              <Image source={{ uri: kasImage }} style={styles.savingsImage} />
            </View>
          ))}

          <Pressable style={styles.addGoalCard} onPress={() => openEditGoal({ id: '', title: '', target_amount: 0, note: null } as SavingsGoal)}>
            <Icon name="plus-circle-outline" size={20} color={colors.accent} />
            <Text style={styles.addGoalText}>Yeni bir birikim hedefi ekle</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Pressable
        accessibilityLabel="Yeni istek veya plan ekle"
        style={styles.floatingButton}
        onPress={() => openAdd('plan')}
      >
        <Icon name="plus" size={27} color={colors.primaryForeground} />
      </Pressable>

      <View style={styles.tabBar}>
        <Tab icon="home-outline" label="Yuva" onPress={() => goTab('Yuva')} />
        <Tab icon="calendar-blank-outline" label="Planlar" active onPress={() => goTab('Planlar')} />
        <Tab icon="image-multiple-outline" label="Anılar" onPress={() => goTab('Anilar')} />
        <Tab icon="account-group-outline" label="Biz" onPress={() => goTab('Biz')} />
      </View>

      <Modal visible={addCategory !== null} transparent animationType="fade" onRequestClose={closeItemModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingItem
                ? 'Düzenle'
                : addCategory === 'city'
                  ? 'Şehir ekle'
                  : addCategory === 'movie'
                    ? 'Film ekle'
                    : addCategory === 'place'
                      ? 'Mekan ekle'
                      : 'Kontrol listesine ekle'}
            </Text>
            <TextInput
              value={addTitle}
              onChangeText={setAddTitle}
              placeholder="Başlık"
              placeholderTextColor={colors.mutedForeground}
              style={styles.modalInput}
              autoFocus
            />
            <TextInput
              value={addSubtitle}
              onChangeText={setAddSubtitle}
              placeholder="Not (opsiyonel)"
              placeholderTextColor={colors.mutedForeground}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={closeItemModal}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={submitAdd} disabled={!addTitle.trim()}>
                <Text style={styles.modalConfirmText}>{editingItem ? 'Kaydet' : 'Ekle'}</Text>
              </Pressable>
            </View>
            {editingItem && (
              <Pressable style={styles.modalDelete} onPress={() => deleteItem(editingItem)}>
                <Icon name="trash-can-outline" size={14} color={colors.destructive} />
                <Text style={styles.modalDeleteText}>Sil</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={contributeGoal !== null} transparent animationType="fade" onRequestClose={() => setContributeGoal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{contributeGoal?.title} için katkı</Text>
            <TextInput
              value={contributeAmount}
              onChangeText={setContributeAmount}
              placeholder="Tutar (TL)"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              style={styles.modalInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setContributeGoal(null)}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={submitContribute}>
                <Text style={styles.modalConfirmText}>Ekle</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editGoal !== null} transparent animationType="fade" onRequestClose={() => setEditGoal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editGoal?.id ? 'Birikim hedefini düzenle' : 'Yeni birikim hedefi'}</Text>
            <TextInput
              value={goalTitle}
              onChangeText={setGoalTitle}
              placeholder="Başlık (örn. Kaş Kaçamağı)"
              placeholderTextColor={colors.mutedForeground}
              style={styles.modalInput}
              autoFocus
            />
            <TextInput
              value={goalTarget}
              onChangeText={setGoalTarget}
              placeholder="Hedef tutar (TL)"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              style={styles.modalInput}
            />
            <TextInput
              value={goalNote}
              onChangeText={setGoalNote}
              placeholder="Not (opsiyonel)"
              placeholderTextColor={colors.mutedForeground}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setEditGoal(null)}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirm}
                disabled={!goalTitle.trim() || !Number(goalTarget)}
                onPress={async () => {
                  if (editGoal?.id) {
                    await submitEditGoal();
                  } else {
                    await api.post('/savings', {
                      title: goalTitle.trim(),
                      targetAmount: Number(goalTarget),
                      note: goalNote.trim() || undefined,
                    });
                    setEditGoal(null);
                    load();
                  }
                }}
              >
                <Text style={styles.modalConfirmText}>Kaydet</Text>
              </Pressable>
            </View>
            {editGoal?.id && (
              <Pressable style={styles.modalDelete} onPress={() => deleteGoal(editGoal)}>
                <Icon name="trash-can-outline" size={14} color={colors.destructive} />
                <Text style={styles.modalDeleteText}>Hedefi sil</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={reunionModalOpen} transparent animationType="fade" onRequestClose={() => setReunionModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Buluşmayı düzenle</Text>
            <TextInput
              value={reunionTitle}
              onChangeText={setReunionTitle}
              placeholder="Başlık (örn. İstanbul Buluşması)"
              placeholderTextColor={colors.mutedForeground}
              style={styles.modalInput}
              autoFocus
            />
            <TextInput
              value={reunionLocation}
              onChangeText={setReunionLocation}
              placeholder="Yer (örn. İstanbul)"
              placeholderTextColor={colors.mutedForeground}
              style={styles.modalInput}
            />
            <TextInput
              value={reunionDate}
              onChangeText={setReunionDate}
              placeholder="Tarih (YYYY-AA-GG)"
              placeholderTextColor={colors.mutedForeground}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setReunionModalOpen(false)}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={submitReunion}>
                <Text style={styles.modalConfirmText}>Kaydet</Text>
              </Pressable>
            </View>
          </View>
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
  icon: IconName;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={[styles.tab, active && styles.activeTab]} onPress={onPress}>
      <Icon name={icon} size={21} color={active ? colors.primary : colors.mutedForeground} />
      <Text style={[styles.tabLabel, { color: active ? colors.primary : colors.mutedForeground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 145 },
  header: { paddingHorizontal: 20, paddingTop: 25, paddingBottom: 20, overflow: 'hidden' },
  headerGlowPrimary: {
    position: 'absolute',
    right: -80,
    top: 20,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: colors.primary,
    opacity: 0.08,
  },
  headerGlowAccent: {
    position: 'absolute',
    left: -95,
    top: 115,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.accent,
    opacity: 0.07,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headerCopy: { flex: 1, paddingRight: 16 },
  eyebrowPrimary: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  eyebrowAccent: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  pageTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 32, marginTop: 7 },
  subtitle: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
    maxWidth: 280,
  },
  main: { paddingHorizontal: 20, gap: 24 },
  meetingCard: { borderRadius: 20, borderWidth: 1, borderColor: colors.primary, overflow: 'hidden' },
  meetingGlow: {
    position: 'absolute',
    right: -45,
    top: -45,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.primary,
    opacity: 0.13,
  },
  meetingContent: { padding: 20 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { color: colors.primaryForeground, backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, fontFamily: fonts.body, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 27, marginTop: 3 },
  mutedText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 13, marginTop: 20 },
  daysRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 6 },
  daysNumber: { color: colors.primary, fontFamily: fonts.heading, fontSize: 34, lineHeight: 38 },
  daysLabel: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '700', paddingBottom: 4 },
  flex: { flex: 1 },
  boldText: { color: colors.foreground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  smallMuted: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, marginTop: 3 },
  checklist: { marginTop: 19 },
  checklistHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  primarySmall: { color: colors.primary, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  progressTrack: { height: 6, borderRadius: 4, backgroundColor: colors.background, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11 },
  checkedCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  emptyCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  completedTask: { color: colors.mutedForeground, textDecorationLine: 'line-through', fontFamily: fonts.body, fontSize: 12, flex: 1 },
  taskText: { color: colors.foreground, fontFamily: fonts.body, fontSize: 12, flex: 1 },
  pillButton: { minHeight: 42, borderRadius: 24, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pillButtonText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '900' },
  advanceButton: { marginTop: 19 },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  heading: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 25, marginTop: 4 },
  wishlistStack: { gap: 12 },
  panel: { padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  panelTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 19 },
  addButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  wishItem: { width: 142, padding: 12, borderRadius: 15, backgroundColor: colors.muted, marginRight: 10 },
  wishTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wishIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  wishTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 19, marginTop: 12 },
  tinyMuted: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 10, marginTop: 3 },
  wishAction: { color: colors.primary, fontFamily: fonts.body, fontSize: 11, fontWeight: '800', marginTop: 12 },
  movieRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 15, backgroundColor: colors.muted },
  movieIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  placeGrid: { flexDirection: 'row', gap: 10 },
  placeCard: { flex: 1, padding: 12, borderRadius: 15, backgroundColor: colors.muted },
  starMark: { color: colors.primary, fontSize: 22 },
  placeTitle: { color: colors.foreground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800', marginTop: 6 },
  itemActions: { flexDirection: 'row', gap: 4 },
  itemActionButton: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.18)' },
  savingsCard: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden' },
  savingsBody: { padding: 20 },
  savingsHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  savingsLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  savingsAmountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 19 },
  savingsAmount: { color: colors.accent, fontFamily: fonts.heading, fontSize: 28 },
  successText: { color: colors.success, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  savingsTrack: { height: 8, borderRadius: 5, backgroundColor: colors.muted, marginTop: 10, overflow: 'hidden' },
  savingsProgress: { height: '100%', backgroundColor: colors.accent },
  contributionList: { marginTop: 14, gap: 6 },
  contributionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contributionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 19 },
  savingsImage: { width: '100%', height: 112 },
  addGoalCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.accent, backgroundColor: 'transparent' },
  addGoalText: { color: colors.accent, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  floatingButton: { position: 'absolute', right: 20, bottom: 91, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  tabBar: { position: 'absolute', left: 20, right: 20, bottom: 20, height: 68, borderRadius: 36, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tab: { minWidth: 68, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 25, alignItems: 'center', gap: 3 },
  activeTab: { backgroundColor: colors.primary },
  tabLabel: { fontFamily: fonts.body, fontSize: 10, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 360, padding: 20, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 12 },
  modalTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 19 },
  modalInput: { minHeight: 46, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground, fontFamily: fonts.body, fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: { flex: 1, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  modalCancelText: { color: colors.secondaryForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  modalConfirm: { flex: 1, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  modalConfirmText: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  modalDelete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  modalDeleteText: { color: colors.destructive, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
});
