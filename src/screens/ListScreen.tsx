import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Switch,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  getDoc 
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Movie, Genre, Status, RootStackParamList } from '../types/movie';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'List'>;

const GENRES: Genre[] = ['Action', 'Comedy', 'Drama', 'Horror'];
const STATUSES: Status[] = ['Plan to Watch', 'Watching', 'Watched'];

export default function ListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, loading: authLoading, logout } = useAuth();

  // Movie list state
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loadingMovies, setLoadingMovies] = useState(true);

  // Add Movie Form state
  const [title, setTitle] = useState('');
  const [director, setDirector] = useState('');
  const [genre, setGenre] = useState<string>(''); // empty initially
  const [status, setStatus] = useState<string>(''); // empty initially
  const [rating, setRating] = useState('');
  const [notes, setNotes] = useState('');
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [hasSubmittedForm, setHasSubmittedForm] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filters state
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Protect screen: If not logged in and not loading auth, navigate to Home
  useEffect(() => {
    if (!authLoading && !user) {
      navigation.replace('Home');
    }
  }, [user, authLoading, navigation]);

  // Real-time Firestore sync for current user's movies
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'movies'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: Movie[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          loaded.push({
            id: d.id,
            userId: data.userId,
            title: data.title,
            director: data.director,
            genre: data.genre,
            status: data.status,
            rating: data.rating,
            favorite: !!data.favorite,
            notes: data.notes || '',
            createdAt: data.createdAt,
          });
        });
        setMovies(loaded);
        setLoadingMovies(false);
      },
      (error) => {
        console.error('Error listening to movies:', error);
        setLoadingMovies(false);
      }
    );

    return unsubscribe;
  }, [user]);

  // Logout handler
  const handleLogout = async () => {
    try {
      await logout();
      navigation.replace('Home');
    } catch (err: any) {
      Alert.alert('Logout Error', err.message);
    }
  };

  // Form Validation
  const validateForm = (
    t: string,
    d: string,
    g: string,
    s: string,
    r: string,
    n: string
  ) => {
    const errs: { [key: string]: string } = {};

    // Title validation
    if (!t || t.trim().length === 0) {
      errs.title = 'Title is required';
    } else if (t.length > 100) {
      errs.title = 'Title must be at most 100 characters';
    }

    // Director validation
    if (!d || d.trim().length === 0) {
      errs.director = 'Director is required';
    } else if (d.length > 60) {
      errs.director = 'Director must be at most 60 characters';
    }

    // Genre validation
    if (!g || g === 'Choose genre') {
      errs.genre = 'Please choose a genre';
    }

    // Status validation
    if (!s || s === 'Choose status') {
      errs.status = 'Please choose a status';
    }

    // Rating validation (only if filled in)
    if (r.trim() !== '') {
      const num = Number(r);
      if (!Number.isInteger(num) || num < 0 || num > 5) {
        errs.rating = 'Rating must be a whole number from 0 to 5';
      }
    }

    // Notes validation
    if (n && n.length > 300) {
      errs.notes = 'Notes must be at most 300 characters';
    }

    return errs;
  };

  // Live validation helpers
  const handleFieldChange = (field: string, val: string) => {
    if (field === 'title') setTitle(val);
    if (field === 'director') setDirector(val);
    if (field === 'genre') setGenre(val);
    if (field === 'status') setStatus(val);
    if (field === 'rating') setRating(val);
    if (field === 'notes') setNotes(val);

    if (hasSubmittedForm) {
      const updated = {
        title: field === 'title' ? val : title,
        director: field === 'director' ? val : director,
        genre: field === 'genre' ? val : genre,
        status: field === 'status' ? val : status,
        rating: field === 'rating' ? val : rating,
        notes: field === 'notes' ? val : notes,
      };
      const errs = validateForm(
        updated.title,
        updated.director,
        updated.genre,
        updated.status,
        updated.rating,
        updated.notes
      );
      setFormErrors((prev) => ({ ...prev, [field]: errs[field] }));
    }
  };

  // Helper to make deterministic docId for user + title + director
  const getMovieDocId = (uid: string, t: string, d: string) => {
    const cleanT = t.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const cleanD = d.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `${uid}_${cleanT}_${cleanD}`;
  };

  // Submit Add Movie
  const handleAddMovie = async () => {
    setHasSubmittedForm(true);
    setFormSuccess(null);
    setFormError(null);

    const validationErrors = validateForm(title, director, genre, status, rating, notes);
    setFormErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    if (!user) return;

    // Check duplicate title + director (case-insensitive)
    const normalizedTitle = title.trim().toLowerCase();
    const normalizedDirector = director.trim().toLowerCase();
    const isDuplicate = movies.some(
      (m) =>
        m.title.trim().toLowerCase() === normalizedTitle &&
        m.director.trim().toLowerCase() === normalizedDirector
    );

    if (isDuplicate) {
      setFormError('A movie with this title and director already exists.');
      return;
    }

    setSubmitting(true);
    try {
      const docId = getMovieDocId(user.uid, title, director);

      // Verify in Firestore if document already exists
      const docRef = doc(db, 'movies', docId);
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        setFormError('A movie with this title and director already exists.');
        setSubmitting(false);
        return;
      }

      const moviePayload: any = {
        userId: user.uid,
        title: title.trim(),
        director: director.trim(),
        genre: genre as Genre,
        status: status as Status,
        favorite: false,
        createdAt: serverTimestamp(),
      };

      if (rating.trim() !== '') {
        moviePayload.rating = parseInt(rating.trim(), 10);
      }
      if (notes.trim() !== '') {
        moviePayload.notes = notes.trim();
      }

      await setDoc(docRef, moviePayload);

      // Success: clear form and show success message
      setTitle('');
      setDirector('');
      setGenre('');
      setStatus('');
      setRating('');
      setNotes('');
      setHasSubmittedForm(false);
      setFormErrors({});
      setFormSuccess('Movie added');
    } catch (err: any) {
      setFormError(err.message || 'Error saving movie to Firestore.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async (item: Movie) => {
    try {
      const docRef = doc(db, 'movies', item.id);
      await updateDoc(docRef, {
        favorite: !item.favorite,
      });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  // Reset all 4 filters
  const handleClearFilters = () => {
    setSelectedGenre('All');
    setSelectedStatus('All');
    setFavoritesOnly(false);
    setSearchQuery('');
  };

  // Filtered & Sorted Movies
  const filteredMovies = useMemo(() => {
    const trimmedSearch = searchQuery.trim().toLowerCase();

    const filtered = movies.filter((m) => {
      // Genre filter
      if (selectedGenre !== 'All' && m.genre !== selectedGenre) return false;
      // Status filter
      if (selectedStatus !== 'All' && m.status !== selectedStatus) return false;
      // Favorites only switch
      if (favoritesOnly && !m.favorite) return false;
      // Search box: title OR director contains search query
      if (trimmedSearch.length > 0) {
        const titleMatch = m.title.toLowerCase().includes(trimmedSearch);
        const directorMatch = m.director.toLowerCase().includes(trimmedSearch);
        if (!titleMatch && !directorMatch) return false;
      }
      return true;
    });

    // Sort alphabetically by title (case-insensitive); equal titles ordered by director
    filtered.sort((a, b) => {
      const titleCompare = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      if (titleCompare !== 0) return titleCompare;
      return a.director.localeCompare(b.director, undefined, { sensitivity: 'base' });
    });

    return filtered;
  }, [movies, selectedGenre, selectedStatus, favoritesOnly, searchQuery]);

  // Summary breakdown calculation
  const summaryBreakdown = useMemo(() => {
    const counts: { [key in Status]: number } = {
      'Plan to Watch': 0,
      'Watching': 0,
      'Watched': 0,
    };

    filteredMovies.forEach((m) => {
      if (counts[m.status] !== undefined) {
        counts[m.status]++;
      }
    });

    const statusOrder: { [key in Status]: number } = {
      'Plan to Watch': 1,
      'Watching': 2,
      'Watched': 3,
    };

    const rows = (Object.keys(counts) as Status[])
      .filter((s) => counts[s] > 0)
      .map((s) => ({ status: s, count: counts[s] }));

    // Sort: highest count first; if counts equal: Plan to Watch, then Watching, then Watched
    rows.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return statusOrder[a.status] - statusOrder[b.status];
    });

    return rows;
  }, [filteredMovies]);

  const favoriteCount = useMemo(() => {
    return filteredMovies.filter((m) => m.favorite).length;
  }, [filteredMovies]);

  if (authLoading || (!user && !movies.length)) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="list-screen" style={styles.safeArea}>
      {/* Header */}
      <View style={styles.topHeader}>
        <View style={styles.userSection}>
          <Text style={styles.userLabel}>Signed in as:</Text>
          <Text style={styles.userEmail} numberOfLines={1}>{user?.email}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 4 }} />
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* ADD MOVIE FORM */}
        <View testID="movie-form" style={styles.card}>
          <Text style={styles.sectionTitle}>Add a Movie</Text>

          {formSuccess ? (
            <View style={styles.successBanner}>
              <Text testID="movie-success" style={styles.successBannerText}>{formSuccess}</Text>
            </View>
          ) : null}

          {formError ? (
            <View style={styles.errorBanner}>
              <Text testID="error-movie" style={styles.errorBannerText}>{formError}</Text>
            </View>
          ) : null}

          {/* Title input */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={[styles.input, formErrors.title ? styles.inputError : null]}
              placeholder="e.g. Inception"
              placeholderTextColor="#64748B"
              value={title}
              onChangeText={(v) => handleFieldChange('title', v)}
            />
            {formErrors.title ? <Text style={styles.errorText}>{formErrors.title}</Text> : null}
          </View>

          {/* Director input */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Director *</Text>
            <TextInput
              style={[styles.input, formErrors.director ? styles.inputError : null]}
              placeholder="e.g. Christopher Nolan"
              placeholderTextColor="#64748B"
              value={director}
              onChangeText={(v) => handleFieldChange('director', v)}
            />
            {formErrors.director ? <Text style={styles.errorText}>{formErrors.director}</Text> : null}
          </View>

          {/* Genre selector */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Genre *</Text>
            <View style={styles.choiceRow}>
              {['Choose genre', 'Action', 'Comedy', 'Drama', 'Horror'].map((g) => {
                const isSelected = (!genre && g === 'Choose genre') || genre === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[styles.choicePill, isSelected ? styles.choicePillActive : null]}
                    onPress={() => handleFieldChange('genre', g === 'Choose genre' ? '' : g)}
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

          {/* Status selector */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Status *</Text>
            <View style={styles.choiceRow}>
              {['Choose status', 'Plan to Watch', 'Watching', 'Watched'].map((s) => {
                const isSelected = (!status && s === 'Choose status') || status === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.choicePill, isSelected ? styles.choicePillActive : null]}
                    onPress={() => handleFieldChange('status', s === 'Choose status' ? '' : s)}
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

          {/* Rating (optional) */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Rating (0 - 5, optional)</Text>
            <TextInput
              style={[styles.input, formErrors.rating ? styles.inputError : null]}
              placeholder="0 to 5"
              placeholderTextColor="#64748B"
              value={rating}
              onChangeText={(v) => handleFieldChange('rating', v)}
              keyboardType="number-pad"
            />
            {formErrors.rating ? <Text style={styles.errorText}>{formErrors.rating}</Text> : null}
          </View>

          {/* Notes (optional) */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Notes (optional, max 300 chars)</Text>
            <TextInput
              style={[styles.input, styles.textArea, formErrors.notes ? styles.inputError : null]}
              placeholder="Short review or notes"
              placeholderTextColor="#64748B"
              value={notes}
              onChangeText={(v) => handleFieldChange('notes', v)}
              multiline
              numberOfLines={3}
            />
            {formErrors.notes ? <Text style={styles.errorText}>{formErrors.notes}</Text> : null}
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleAddMovie}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <Text style={styles.addBtnText}>+ Add Movie</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* FILTERS & SEARCH */}
        <View style={styles.card}>
          <View style={styles.filterHeader}>
            <Text style={styles.sectionTitle}>Filter & Search</Text>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearFilters}>
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
          </View>

          {/* Search box */}
          <View style={styles.formGroup}>
            <Text style={styles.filterLabel}>Search (Title or Director):</Text>
            <TextInput
              style={styles.input}
              placeholder="Type to filter..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Genre Filter */}
          <View style={styles.formGroup}>
            <Text style={styles.filterLabel}>Genre:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
              {['All', ...GENRES].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.filterChip, selectedGenre === g ? styles.filterChipActive : null]}
                  onPress={() => setSelectedGenre(g)}
                >
                  <Text style={[styles.filterChipText, selectedGenre === g ? styles.filterChipTextActive : null]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Status Filter */}
          <View style={styles.formGroup}>
            <Text style={styles.filterLabel}>Status:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
              {['All', ...STATUSES].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.filterChip, selectedStatus === s ? styles.filterChipActive : null]}
                  onPress={() => setSelectedStatus(s)}
                >
                  <Text style={[styles.filterChipText, selectedStatus === s ? styles.filterChipTextActive : null]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Favorites Only Switch */}
          <View style={styles.switchRow}>
            <Text style={styles.filterLabel}>Favorites only:</Text>
            <Switch
              value={favoritesOnly}
              onValueChange={setFavoritesOnly}
              trackColor={{ false: '#334155', true: '#38BDF8' }}
              thumbColor={favoritesOnly ? '#F8FAFC' : '#94A3B8'}
            />
          </View>
        </View>

        {/* SUMMARY SECTION */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryStatsRow}>
            <View style={styles.summaryStatItem}>
              <Text style={styles.statLabel}>Total Shown:</Text>
              <Text testID="movie-count" style={styles.statValue}>{filteredMovies.length}</Text>
            </View>
            <View style={styles.summaryStatItem}>
              <Text style={styles.statLabel}>Favorites:</Text>
              <Text testID="favorite-count" style={styles.statValue}>{favoriteCount}</Text>
            </View>
          </View>

          {summaryBreakdown.length > 0 ? (
            <View style={styles.breakdownTable}>
              <Text style={styles.breakdownTitle}>Status Breakdown:</Text>
              {summaryBreakdown.map((row) => (
                <View key={row.status} style={styles.breakdownRow}>
                  <Text style={styles.breakdownStatusName}>{row.status}</Text>
                  <Text style={styles.breakdownStatusCount}>{row.count}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* MOVIES LIST */}
        <View style={{ marginBottom: 40 }}>
          <Text style={[styles.sectionTitle, { marginHorizontal: 4, marginBottom: 12 }]}>
            Movies ({filteredMovies.length})
          </Text>

          {loadingMovies ? (
            <ActivityIndicator size="small" color="#38BDF8" style={{ marginVertical: 20 }} />
          ) : filteredMovies.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🎬</Text>
              <Text testID="movies-empty" style={styles.emptyText}>No movies found</Text>
            </View>
          ) : (
            filteredMovies.map((item) => (
              <TouchableOpacity
                key={item.id}
                testID="movie-item"
                style={styles.movieCard}
                onPress={() => navigation.navigate('Detail', { movieId: item.id })}
                activeOpacity={0.8}
              >
                <View style={styles.movieCardHeader}>
                  <Text style={styles.movieTitle} numberOfLines={1}>{item.title}</Text>
                  <TouchableOpacity
                    onPress={() => handleToggleFavorite(item)}
                    style={styles.starButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={item.favorite ? 'star' : 'star-outline'}
                      size={24}
                      color={item.favorite ? '#F59E0B' : '#64748B'}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.movieDirector}>Directed by: {item.director}</Text>

                <View style={styles.movieBadgeRow}>
                  <View style={styles.genreBadge}>
                    <Text style={styles.genreBadgeText}>{item.genre}</Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{item.status}</Text>
                  </View>
                  {item.rating !== undefined && item.rating !== null ? (
                    <View style={styles.ratingBadge}>
                      <Text style={styles.ratingBadgeText}>★ {item.rating}/5</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
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
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  userSection: {
    flex: 1,
    marginRight: 12,
  },
  userLabel: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 14,
    color: '#F1F5F9',
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 14,
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
  addBtn: {
    backgroundColor: '#38BDF8',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  addBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 15,
  },
  successBanner: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  successBannerText: {
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#451A1A',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorBannerText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '500',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  clearBtnText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '600',
  },
  filterLabel: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 6,
    fontWeight: '600',
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  filterChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  summaryStatItem: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#38BDF8',
  },
  breakdownTable: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  breakdownStatusName: {
    color: '#E2E8F0',
    fontSize: 13,
  },
  breakdownStatusCount: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '600',
  },
  movieCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  movieCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  movieTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
    marginRight: 10,
  },
  starButton: {
    padding: 4,
  },
  movieDirector: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 10,
  },
  movieBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  genreBadge: {
    backgroundColor: '#0369A1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  genreBadgeText: {
    color: '#E0F2FE',
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    color: '#F1F5F9',
    fontSize: 11,
    fontWeight: '600',
  },
  ratingBadge: {
    backgroundColor: '#78350F',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ratingBadgeText: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '600',
  },
});

