import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/movie';
import { useAuth } from '../context/AuthContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'List' }],
      });
    }
  }, [user, loading, navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerLogo}>CineList</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={[styles.btn, styles.btnLogin]} 
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnLoginText}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.btn, styles.btnRegister]} 
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnRegisterText}>Register</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroSection}>
          <Text testID="home-title" style={styles.title}>CineList</Text>
          <Text style={styles.subtitle}>
            Your private, personalized movie watchlist. Keep track of what to watch, what you are watching, and rate your favorite films.
          </Text>
        </View>

        <View style={styles.cardsSection}>
          <View style={styles.card}>
            <Text style={styles.cardIcon}>🎬</Text>
            <Text style={styles.cardTitle}>Track what you watch</Text>
            <Text style={styles.cardDescription}>
              Easily catalog movies you plan to watch, currently watching, or already finished.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardIcon}>🗂️</Text>
            <Text style={styles.cardTitle}>Sort by status</Text>
            <Text style={styles.cardDescription}>
              Filter by genre and watch status instantly, and search by title or director.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardIcon}>⭐</Text>
            <Text style={styles.cardTitle}>Rate your favorites</Text>
            <Text style={styles.cardDescription}>
              Mark your top movies as favorites and leave custom ratings and review notes.
            </Text>
          </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  headerLogo: {
    fontSize: 22,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnLogin: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  btnLoginText: {
    color: '#38BDF8',
    fontWeight: '600',
    fontSize: 14,
  },
  btnRegister: {
    backgroundColor: '#38BDF8',
  },
  btnRegisterText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
  },
  container: {
    padding: 24,
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#F8FAFC',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  cardsSection: {
    width: '100%',
    gap: 16,
    marginTop: 12,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardIcon: {
    fontSize: 28,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
});

