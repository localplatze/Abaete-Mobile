import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, FlatList,
  TouchableOpacity, Image, ActivityIndicator, Alert, Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';

// Imports do Firebase
import { FIREBASE_AUTH, FIREBASE_DB } from './../services/firebaseConnection';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, onValue, off } from 'firebase/database';


// --- COMPONENTES DAS ABAS ---

// Placeholder para a funcionalidade de Programas
const AdminProgramasContent = ({ navigation }) => {
    const [programs, setPrograms] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const programsRef = ref(FIREBASE_DB, 'programTemplates');
        const listener = onValue(programsRef, (snapshot) => {
            const data = [];
            snapshot.forEach(child => {
                data.push({ id: child.key, ...child.val() });
            });
            setPrograms(data);
            setLoading(false);
        });

        return () => off(programsRef, 'value', listener);
    }, []);

    if (loading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} /></View>;
    }

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.headerContainer}>
                <Text style={styles.pageTitleClean}>Modelos de Programas</Text>
                <Text style={styles.pageSubtitle}>Crie e gerencie modelos de programas ABA.</Text>
            </View>
            <FlatList
                data={programs}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        style={styles.card} 
                        onPress={() => navigation.navigate('ProgramEditor', { programId: item.id })}
                    >
                        <Text style={styles.cardTitle}>{item.name}</Text>
                        <View style={styles.tagContainer}>
                            <View style={styles.tag}>
                                <Text style={styles.tagText}>{item.type}</Text>
                            </View>
                            {(item.categories || []).map(cat => (
                                <View key={cat} style={[styles.tag, styles.categoryTag]}>
                                    <Text style={styles.tagText}>{cat}</Text>
                                </View>
                            ))}
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.placeholderContainer}>
                        <MaterialIcons name="assignment" size={48} color={ABAETE_COLORS.mediumGray} />
                        <Text style={styles.placeholderText}>Nenhum modelo de programa criado ainda. Toque em '+' para começar.</Text>
                    </View>
                }
                contentContainerStyle={{ padding: 16 }}
            />
            <TouchableOpacity 
                style={styles.fab} 
                onPress={() => navigation.navigate('ProgramEditor', { programId: null })}
            >
                <MaterialIcons name="add" size={30} color={ABAETE_COLORS.white} />
            </TouchableOpacity>
        </View>
    );
};

// Placeholder para a aba de Perfil
const AdminPerfilContent = ({ navigation, admin, onLogout }) => (
  <ScrollView style={styles.contentScrollViewClean}>
    <View style={styles.profileHeaderClean}>
        <Image 
          source={{uri: admin.profilePicture || `https://via.placeholder.com/100?text=${admin.displayName.charAt(0)}`}} 
          style={styles.profileImageClean} 
        />
        <Text style={styles.profileNameClean}>{admin.fullName || 'Admin'}</Text>
        <Text style={styles.profileEmailClean}>{admin.email}</Text>
    </View>
    {/* Outras opções do admin poderiam vir aqui */}
    <TouchableOpacity style={[styles.profileMenuItemClean, {marginTop: 20}]} onPress={onLogout}>
        <MaterialIcons name="logout" size={24} color={ABAETE_COLORS.errorRed} style={styles.profileMenuIcon} />
        <Text style={[styles.profileMenuItemTextClean, {color: ABAETE_COLORS.errorRed}]}>Sair</Text>
    </TouchableOpacity>
  </ScrollView>
);

// --- COMPONENTE PRINCIPAL ---

export const AdminHomeScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('Programas');
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(FIREBASE_AUTH, (user) => {
      if (user) {
        const userRef = ref(FIREBASE_DB, `users/${user.uid}`);
        const unsubscribeDb = onValue(userRef, (snapshot) => {
          if (snapshot.exists() && snapshot.val().role === 'admin') {
            setAdminUser({ uid: user.uid, ...snapshot.val() });
          } else {
            Alert.alert("Acesso Negado", "Você não tem permissão para acessar esta área.", [{ text: "Sair", onPress: handleLogout }]);
          }
          setLoading(false);
        });
        return () => off(userRef, 'value', unsubscribeDb);
      } else {
        navigation.replace('Login');
      }
    });
    return unsubscribeAuth;
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(FIREBASE_AUTH);
      navigation.replace('Login');
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  const renderContent = () => {
    if (loading || !adminUser) {
      return <View style={styles.centered}><ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} /></View>;
    }
    switch (activeTab) {
      case 'Programas':
        return <AdminProgramasContent navigation={navigation} />;
      case 'Perfil':
        return <AdminPerfilContent navigation={navigation} admin={adminUser} onLogout={handleLogout} />;
      default:
        return <AdminProgramasContent navigation={navigation} />;
    }
  };
  
  // Abas para o Admin
  const tabs = [
    { name: 'Programas', icon: 'assignment', label: 'Programas' },
    // Adicione outras abas aqui no futuro (ex: 'Usuários', 'Relatórios')
    { name: 'Perfil', icon: 'account-circle', label: 'Perfil' },
  ];

  return (
    <SafeAreaView style={styles.safeAreaClean}>
      <StatusBar style="dark" backgroundColor={ABAETE_COLORS.white} />
      <View style={styles.headerClean}>
        <Image source={require('../../assets/images/abaete_logo_hor.png')} style={styles.headerLogoClean} resizeMode="contain" />
      </View>
      <View style={{ flex: 1 }}>{renderContent()}</View>
      <View style={styles.bottomNavClean}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.name}
            style={styles.navItemClean}
            onPress={() => setActiveTab(tab.name)}>
            <MaterialIcons
              name={tab.icon}
              size={28}
              color={activeTab === tab.name ? ABAETE_COLORS.primaryBlue : ABAETE_COLORS.mediumGray}
            />
            <Text style={[ styles.navItemTextClean, { color: activeTab === tab.name ? ABAETE_COLORS.primaryBlue : ABAETE_COLORS.mediumGray } ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // --- GERAL ---
  safeAreaClean: { flex: 1, backgroundColor: ABAETE_COLORS.white },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // --- CABEÇALHO ---
  headerClean: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 15,
    paddingBottom: 10,
    backgroundColor: ABAETE_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: ABAETE_COLORS.lightGray,
  },
  headerLogoClean: { height: 38, width: 130 },
  
  // --- CONTEÚDO DA ABA ---
  headerContainer: { paddingHorizontal: 16, paddingTop: 20 },
  pageTitleClean: { fontFamily: FONT_FAMILY.Bold, fontSize: 26, color: ABAETE_COLORS.textPrimary, marginBottom: 5 },
  pageSubtitle: { fontFamily: FONT_FAMILY.Regular, fontSize: 16, color: ABAETE_COLORS.textSecondary, marginBottom: 10 },
  placeholderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, marginTop: 50 },
  placeholderText: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 16, color: ABAETE_COLORS.mediumGray, marginTop: 10, textAlign: 'center' },
  contentScrollViewClean: { flex: 1 },
  
  // --- CARDS DA LISTA DE PROGRAMAS ---
  card: {
    backgroundColor: ABAETE_COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: ABAETE_COLORS.lightGray,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardTitle: { fontFamily: FONT_FAMILY.Bold, fontSize: 18, color: ABAETE_COLORS.textPrimary, marginBottom: 10 },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: ABAETE_COLORS.secondaryBlue, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  categoryTag: { backgroundColor: ABAETE_COLORS.lightGray },
  tagText: { color: ABAETE_COLORS.white, fontFamily: FONT_FAMILY.SemiBold, fontSize: 12 },

  // --- BOTÃO FLUTUANTE (FAB) ---
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ABAETE_COLORS.primaryBlue,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },

  // --- PERFIL ---
  profileHeaderClean: { alignItems: 'center', paddingVertical: 25, marginBottom: 20 },
  profileImageClean: { width: 110, height: 110, borderRadius: 55, marginBottom: 12, borderWidth: 3, borderColor: ABAETE_COLORS.primaryBlue },
  profileNameClean: { fontFamily: FONT_FAMILY.Bold, fontSize: 22, color: ABAETE_COLORS.textPrimary },
  profileEmailClean: { fontFamily: FONT_FAMILY.Regular, fontSize: 15, color: ABAETE_COLORS.textSecondary, marginTop: 4 },
  profileMenuItemClean: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: ABAETE_COLORS.lightGray, marginHorizontal: 20 },
  profileMenuIcon: { marginRight: 15 },
  profileMenuItemTextClean: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 16, color: ABAETE_COLORS.textPrimary, flex: 1 },

  // --- NAVEGAÇÃO INFERIOR (BOTTOM NAV) ---
  bottomNavClean: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 80 : 70,
    paddingBottom: Platform.OS === 'ios' ? 15 : 0,
    backgroundColor: ABAETE_COLORS.white,
    borderTopWidth: 1,
    borderTopColor: ABAETE_COLORS.lightGray,
  },
  navItemClean: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 10 },
  navItemTextClean: { fontFamily: FONT_FAMILY.Regular, fontSize: 10, marginTop: 4 },
});