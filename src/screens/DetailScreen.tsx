import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, onSnapshot, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../config/firebase';
import { Movie, Genre, Status, RootStackParamList } from '../types/movie';

type DetailRouteProp = RouteProp<RootStackParamList, 'Detail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Detail'>;

const GENRES: Genre[] = ['Action', 'Comedy', 'Drama', 'Horror'];
const STATUSES: Status[] = ['Plan to Watch', 'Watching', 'Watched'];

export default function DetailScreen() {
  const route = useRoute<DetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { movieId } = route.params;

  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editDirector, setEditDirector] = useState('');
  const [editGenre, setEditGenre] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('');
  const [editRating, setEditRating] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const docRef = doc(db, 'movies', movieId);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const loaded: Movie = {
            id: docSnap.id,
            userId: data.userId,
            title: data.title,
            director: data.director,
            genre: data.genre,
            status: data.status,
            rating: data.rating,
            favorite: !!data.favorite,
            notes: data.notes || '',
            createdAt: data.createdAt,
          };
          setMovie(loaded);
          setEditTitle(loaded.title);
          setEditDirector(loaded.director);
          setEditGenre(loaded.genre);
          setEditStatus(loaded.status);
          setEditRating(loaded.rating !== undefined && loaded.rating !== null ? String(loaded.rating) : '');
          setEditNotes(loaded.notes || '');
        } else {
          setMovie(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching movie details:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [movieId]);

  // Validation matching Add Movie rules exactly
  const validateForm = (
    t: string,
    d: string,
    g: string,
    s: string,
    r: string,
    n: string
  ) => {
    const errs: { [key: string]: string } = {};

    if (!t || t.trim().length === 0) {
      errs.title = 'Title is required';
    } else if (t.length > 100) {
      errs.title = 'Title must be at most 100 characters';
    }

    if (!d || d.trim().length === 0) {
      errs.director = 'Director is required';
    } else if (d.length > 60) {
      errs.director = 'Director must be at most 60 characters';
    }

    if (!g || g === 'Choose genre') {
      errs.genre = 'Please choose a genre';
    }

    if (!s || s === 'Choose status') {
      errs.status = 'Please choose a status';
    }

    if (r.trim() !== '') {
      const num = Number(r);
      if (!Number.isInteger(num) || num < 0 || num > 5) {
        errs.rating = 'Rating must be a whole number from 0 to 5';
      }
    }

    if (n && n.length > 300) {
      errs.notes = 'Notes must be at most 300 characters';
    }

    return errs;
  };

  const handleToggleFavorite = async () => {
    if (!movie) return;
    try {
      const docRef = doc(db, 'movies', movie.id);
      await updateDoc(docRef, { favorite: !movie.favorite });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleSaveEdit = async () => {
    const errors = validateForm(editTitle, editDirector, editGenre, editStatus, editRating, editNotes);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    if (!movie) return;

    setSaving(true);
    try {
      // Check duplicate title + director for this user (case-insensitive, excluding current movie)
      const q = query(
        collection(db, 'movies'),
        where('userId', '==', movie.userId)
      );
      const snap = await getDocs(q);
      const isDuplicate = snap.docs.some((d) => {
        if (d.id === movie.id) return false;
        const data = d.data();
        return (
          data.title.trim().toLowerCase() === editTitle.trim().toLowerCase() &&
          data.director.trim().toLowerCase() === editDirector.trim().toLowerCase()
        );
      });

      if (isDuplicate) {
        setFormErrors({ title: 'A movie with this title and director already exists.' });
        setSaving(false);
        return;
      }

      const docRef = doc(db, 'movies', movie.id);
      const updatePayload: any = {
        title: editTitle.trim(),
        director: editDirector.trim(),
        genre: editGenre as Genre,
        status: editStatus as Status,
        notes: editNotes.trim(),
      };

      if (editRating.trim() !== '') {
        updatePayload.rating = parseInt(editRating.trim(), 10);
      } else {
        updatePayload.rating = null;
      }

      await updateDoc(docRef, updatePayload);
      setIsEditing(false);
    } catch (err: any) {
      Alert.alert('Update Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (movie) {
      setEditTitle(movie.title);
      setEditDirector(movie.director);
      setEditGenre(movie.genre);
      setEditStatus(movie.status);
      setEditRating(movie.rating !== undefined && movie.rating !== null ? String(movie.rating) : '');
      setEditNotes(movie.notes || '');
    }
    setFormErrors({});
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (!movie) return;

    const performDelete = async () => {
      setDeleting(true);
      try {
        const docRef = doc(db, 'movies', movie.id);
        await deleteDoc(docRef);
        navigation.goBack();
      } catch (err: any) {
        Alert.alert('Delete Error', err.message);
        setDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Are you sure you want to delete "${movie.title}"?`)) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Movie',
        `Are you sure you want to delete "${movie.title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: performDelete,
          },
        ]
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </SafeAreaView>
    );
  }

  if (!movie) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.notFoundText}>Movie not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Back to List</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.navBackBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#38BDF8" />
          <Text style={styles.navBackText}>List</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Movie' : 'Movie Details'}</Text>
        <TouchableOpacity onPress={handleToggleFavorite} style={styles.starBtn}>
          <Ionicons
            name={movie.favorite ? 'star' : 'star-outline'}
            size={26}
            color={movie.favorite ? '#F59E0B' : '#64748B'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!isEditing ? (
          /* VIEW MODE */
          <View style={styles.viewCard}>
            <View style={styles.titleRow}>
              <Text style={styles.titleText}>{movie.title}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Director</Text>
              <Text style={styles.detailValue}>{movie.director}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Genre</Text>
              <View style={styles.genreBadge}>
                <Text style={styles.genreBadgeText}>{movie.genre}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{movie.status}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Rating</Text>
              <Text style={styles.detailValue}>
                {movie.rating !== undefined && movie.rating !== null ? `★ ${movie.rating} / 5` : 'Not rated'}
              </Text>
            </View>

            <View style={styles.notesSection}>
              <Text style={styles.detailLabel}>Notes</Text>
              <Text style={styles.notesText}>
                {movie.notes && movie.notes.trim().length > 0 ? movie.notes : 'No notes added.'}
              </Text>
            </View>

            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setIsEditing(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="pencil" size={16} color="#0F172A" style={{ marginRight: 6 }} />
                <Text style={styles.editBtnText}>Edit Movie</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
                disabled={deleting}
                activeOpacity={0.8}
              >
                {deleting ? (
                  <ActivityIndicator color="#EF4444" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* EDIT MODE */
          <View style={styles.editCard}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={[styles.input, formErrors.title ? styles.inputError : null]}
                value={editTitle}
                onChangeText={setEditTitle}
              />
              {formErrors.title ? <Text style={styles.errorText}>{formErrors.title}</Text> : null}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Director *</Text>
              <TextInput
                style={[styles.input, formErrors.director ? styles.inputError : null]}
                value={editDirector}
                onChangeText={setEditDirector}
              />
              {formErrors.director ? <Text style={styles.errorText}>{formErrors.director}</Text> : null}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Genre *</Text>
              <View style={styles.choiceRow}>
                {['Choose genre', ...GENRES].map((g) => {
                  const isSelected = (!editGenre && g === 'Choose genre') || editGenre === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[styles.choicePill, isSelected ? styles.choicePillActive : null]}
                      onPress={() => setEditGenre(g === 'Choose genre' ? '' : g)}
                    >
                      <Text style={[styles.choicePillText, isSelected ? styles.choicePillTextActive : null]}>
                        {g}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {formErrors.genre ? <Text style={styles.errorText}>{formErrors.genre}</Text> : null}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Status *</Text>
              <View style={styles.choiceRow}>
                {['Choose status', ...STATUSES].map((s) => {
                  const isSelected = (!editStatus && s === 'Choose status') || editStatus === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.choicePill, isSelected ? styles.choicePillActive : null]}
                      onPress={() => setEditStatus(s === 'Choose status' ? '' : s)}
                    >
                      <Text style={[styles.choicePillText, isSelected ? styles.choicePillTextActive : null]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {formErrors.status ? <Text style={styles.errorText}>{formErrors.status}</Text> : null}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Rating (0 - 5, optional)</Text>
              <TextInput
                style={[styles.input, formErrors.rating ? styles.inputError : null]}
                value={editRating}
                onChangeText={setEditRating}
                keyboardType="number-pad"
              />
              {formErrors.rating ? <Text style={styles.errorText}>{formErrors.rating}</Text> : null}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Notes (max 300 chars, optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea, formErrors.notes ? styles.inputError : null]}
                value={editNotes}
                onChangeText={setEditNotes}
                multiline
                numberOfLines={3}
              />
              {formErrors.notes ? <Text style={styles.errorText}>{formErrors.notes}</Text> : null}
            </View>

            <View style={styles.editActionButtonsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleCancelEdit}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveEdit}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#0F172A" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  navBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  navBackText: {
    color: '#38BDF8',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  starBtn: {
    padding: 4,
  },
  content: {
    padding: 16,
  },
  viewCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  titleRow: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  titleText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#263345',
  },
  detailLabel: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 15,
    color: '#F1F5F9',
    fontWeight: '600',
  },
  genreBadge: {
    backgroundColor: '#0369A1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  genreBadgeText: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    backgroundColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '700',
  },
  notesSection: {
    paddingTop: 12,
    marginBottom: 20,
  },
  notesText: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 22,
    marginTop: 6,
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  editBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38BDF8',
    paddingVertical: 12,
    borderRadius: 8,
  },
  editBtnText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
  },
  deleteBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
  editCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choicePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  choicePillActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  choicePillText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  choicePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  editActionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#38BDF8',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  notFoundText: {
    color: '#94A3B8',
    fontSize: 16,
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#0F172A',
    fontWeight: '700',
  },
});

