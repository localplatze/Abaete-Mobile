import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
  FlatList,
  TextInput,
  Keyboard,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, onValue, query, orderByChild, equalTo, get, push, set as firebaseSet, remove } from 'firebase/database';
import { Calendar, LocaleConfig } from 'react-native-calendars';

import { FIREBASE_AUTH, FIREBASE_DB } from '../services/firebaseConnection';
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';
import { getCachedUserData } from '../services/userCache';

// --- CONFIGURAÇÕES E FUNÇÕES AUXILIARES ---

LocaleConfig.locales['pt-br'] = { monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'], monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'], dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'], dayNamesShort: ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'], today: 'Hoje' };
LocaleConfig.defaultLocale = 'pt-br';

const timeAgo = (dateStr) => { if (!dateStr) return ''; const date = new Date(dateStr); const seconds = Math.floor((new Date() - date) / 1000); let interval = seconds / 31536000; if (interval > 1) return `Há ${Math.floor(interval)} anos`; interval = seconds / 2592000; if (interval > 1) return `Há ${Math.floor(interval)} meses`; interval = seconds / 86400; if (interval > 1) return `Há ${Math.floor(interval)} dias`; interval = seconds / 3600; if (interval > 1) return `Há ${Math.floor(interval)} horas`; interval = seconds / 60; if (interval > 1) return `Há ${Math.floor(interval)} minutos`; return "Agora"; };


// --- COMPONENTES DAS ABAS ---

const HomeContent = ({ patient }) => {
  const [appointments, setAppointments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patient?.id) { setLoading(false); return; }
    const now = new Date().toISOString();
    const appointmentsRef = query(ref(FIREBASE_DB, 'appointments'), orderByChild('patientId'), equalTo(patient.id));
    const tasksRef = query(ref(FIREBASE_DB, 'homeworkTasks'), orderByChild('patientId'), equalTo(patient.id));
    
    const unsubscribeApps = onValue(appointmentsRef, snapshot => {
      const futureApps = [];
      snapshot.forEach(child => { const app = child.val(); if (app.dateTimeStart > now && app.status === 'scheduled') futureApps.push({ id: child.key, ...app }); });
      setAppointments(futureApps.sort((a, b) => new Date(a.dateTimeStart) - new Date(b.dateTimeStart)));
      setLoading(false);
    });

    const unsubscribeTasks = onValue(tasksRef, snapshot => {
      const pendingTasks = [];
      snapshot.forEach(child => { const task = child.val(); if (task.status === 'pending_responsible') pendingTasks.push({ id: child.key, ...task }); });
      setTasks(pendingTasks);
    });

    return () => { unsubscribeApps(); unsubscribeTasks(); };
  }, [patient?.id]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} size="large" color={ABAETE_COLORS.primaryBlue} />;

  return (
    <ScrollView style={styles.contentScrollViewClean} contentContainerStyle={styles.contentContainerClean} showsVerticalScrollIndicator={false}>
      <Text style={styles.greetingTextClean}>Olá, <Text style={{ fontFamily: FONT_FAMILY.Bold }}>{patient.displayName.split(' ')[0]}!</Text></Text>
      <Text style={styles.subGreetingText}>Que bom te ver por aqui.</Text>
      
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Próximos Agendamentos</Text></View>
        {appointments.length > 0 ? appointments.slice(0, 2).map(evento => (
          <TouchableOpacity key={evento.id} style={styles.eventCardClean}>
            <View style={styles.eventIconContainer}><MaterialIcons name="event" size={24} color={ABAETE_COLORS.primaryBlue} /></View>
            <View style={styles.eventDetails}><Text style={styles.eventTitle}>{evento.type}</Text><Text style={styles.eventTime}>{new Date(evento.dateTimeStart).toLocaleDateString('pt-BR', {weekday: 'long', day: '2-digit', month: 'short'})} às {new Date(evento.dateTimeStart).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text></View>
          </TouchableOpacity>
        )) : <Text style={styles.emptySectionText}>Nenhum agendamento futuro.</Text>}
      </View>
      
      {tasks.length > 0 && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Atividades para Casa</Text></View>
          {tasks.map(tarefa => (
            <TouchableOpacity key={tarefa.id} style={styles.taskCardClean}>
              <View style={[styles.infoIconContainer, { backgroundColor: ABAETE_COLORS.yellowOpaco }]}><MaterialIcons name="home-work" size={24} color={ABAETE_COLORS.yellowDark} /></View>
              <View style={styles.infoTextContainer}><Text style={styles.infoCardTitle}>{tarefa.title}</Text><Text style={styles.infoCardDetail}>Prazo: {new Date(tarefa.dueDate).toLocaleDateString('pt-BR')}</Text></View>
              <View style={styles.taskStatusIndicator} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const AgendaContent = ({ patientId }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [appointments, setAppointments] = useState({});
    const [markedDates, setMarkedDates] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const appointmentsRef = query(ref(FIREBASE_DB, 'appointments'), orderByChild('patientId'), equalTo(patientId));
        const unsubscribe = onValue(appointmentsRef, snapshot => {
            const fetchedAppointments = {}; const marks = {};
            snapshot.forEach(child => {
                const app = { id: child.key, ...child.val() };
                const dateStr = new Date(app.dateTimeStart).toISOString().split('T')[0];
                if (!fetchedAppointments[dateStr]) fetchedAppointments[dateStr] = [];
                fetchedAppointments[dateStr].push(app);
                marks[dateStr] = { marked: true, dotColor: ABAETE_COLORS.primaryBlue };
            });
            setAppointments(fetchedAppointments); setMarkedDates(marks); setLoading(false);
        });
        return () => unsubscribe();
    }, [patientId]);
    
    const appointmentsForSelectedDay = appointments[selectedDate] || [];

    return (
        <View style={styles.contentAreaClean}>
            <Text style={styles.pageTitleClean}>Agenda</Text>
            <Calendar onDayPress={(day) => setSelectedDate(day.dateString)} markedDates={{ ...markedDates, [selectedDate]: { ...markedDates[selectedDate], selected: true, selectedColor: ABAETE_COLORS.primaryBlue } }} theme={{ arrowColor: ABAETE_COLORS.primaryBlue }}/>
            <Text style={styles.listHeader}>Agendamentos para {new Date(selectedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</Text>
            {loading ? <ActivityIndicator/> : 
            <FlatList data={appointmentsForSelectedDay} keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <View style={styles.eventCardClean}>
                        <View style={styles.eventIconContainer}><MaterialIcons name="event" size={24} color={ABAETE_COLORS.primaryBlue} /></View>
                        <View style={styles.eventDetails}><Text style={styles.eventTitle}>{item.type}</Text><Text style={styles.eventTime}>{new Date(item.dateTimeStart).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text></View>
                    </View>
                )}
                ListEmptyComponent={<Text style={styles.emptySectionText}>Nenhum agendamento neste dia.</Text>}
            />}
        </View>
    );
};

const phaseTranslations = {
    baseline: 'Linha de Base',
    intervention: 'Intervenção',
    maintenance: 'Manutenção',
    generalization: 'Generalização',
    'Não iniciada': 'Não iniciada' // Para o caso padrão
};

const ProgressoContent = ({ patient }) => {
    const programs = patient.assignedPrograms ? Object.values(patient.assignedPrograms) : [];
    return (
        <View style={styles.contentAreaClean}>
            <Text style={styles.pageTitleClean}>Meus Programas</Text>
            {programs.length === 0 ? <Text style={styles.emptySectionText}>Nenhum programa de desenvolvimento ativo.</Text> :
                <FlatList data={programs} keyExtractor={item => item.templateId} renderItem={({item}) => {
                    const phaseKey = patient.programProgress?.[item.templateId]?.currentPhase || 'Não iniciada';
                    const phaseText = phaseTranslations[phaseKey] || phaseKey; // Usa a tradução ou a chave original

                    return (
                        <View style={styles.programCard}>
                            <View style={{flex: 1}}>
                                <Text style={styles.programTitle}>{item.name}</Text>
                                <Text style={styles.programPhase}>Fase Atual: <Text style={{fontFamily: FONT_FAMILY.SemiBold}}>{phaseText}</Text></Text>
                            </View>
                        </View>
                    );
                }} />
            }
        </View>
    );
};

const TarefasContent = ({ patientId }) => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const tasksRef = query(ref(FIREBASE_DB, 'homeworkTasks'), orderByChild('patientId'), equalTo(patientId));
        const unsubscribe = onValue(tasksRef, snapshot => {
            const allTasks = [];
            snapshot.forEach(child => allTasks.push({ id: child.key, ...child.val() }));
            setTasks(allTasks.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [patientId]);
    
    if(loading) return <ActivityIndicator/>;
    
    return (
        <View style={styles.contentAreaClean}>
            <Text style={styles.pageTitleClean}>Tarefas de Casa</Text>
            <FlatList data={tasks} keyExtractor={item => item.id}
                renderItem={({item}) => (
                    <TouchableOpacity style={styles.taskListItem}>
                        <View style={[styles.listItemIconContainer, item.status === 'pending_responsible' ? {backgroundColor: ABAETE_COLORS.yellowOpaco} : {backgroundColor: '#E8F5E9'}]}><MaterialIcons name={item.status === 'pending_responsible' ? "pending-actions" : "check-circle-outline"} size={24} color={item.status === 'pending_responsible' ? ABAETE_COLORS.yellowDark : ABAETE_COLORS.successGreen} /></View>
                        <View style={styles.listItemTextContainer}><Text style={styles.listItemTitle}>{item.title}</Text><Text style={styles.listItemSubtitle}>Prazo: {new Date(item.dueDate).toLocaleDateString('pt-BR')}</Text></View>
                        <MaterialIcons name="chevron-right" size={24} color={ABAETE_COLORS.mediumGray} />
                    </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptySectionText}>Nenhuma tarefa encontrada.</Text>}
            />
        </View>
    );
};

const PostItem = ({ post, currentUserId }) => {
    const [author, setAuthor] = useState(null);
    const [commentsVisible, setCommentsVisible] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');

    useEffect(() => {
        let isMounted = true;
        if (post.authorId) {
            getCachedUserData(post.authorId).then(userData => {
                if (isMounted) setAuthor(userData);
            });
        }
        return () => { isMounted = false; };
    }, [post.authorId]);

    useEffect(() => {
        if (commentsVisible) {
            const commentsRef = query(ref(FIREBASE_DB, `patientFeeds/${post.patientId}/${post.id}/comments`), orderByChild('createdAt'));
            const unsubscribe = onValue(commentsRef, async (snapshot) => {
                if (snapshot.exists()) {
                    const commentsPromises = Object.values(snapshot.val()).map(async (comment) => ({ ...comment, author: await getCachedUserData(comment.authorId) }));
                    const resolvedComments = await Promise.all(commentsPromises);
                    setComments(resolvedComments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
                } else {
                    setComments([]);
                }
            });
            return () => unsubscribe();
        }
    }, [commentsVisible, post.id, post.patientId]);

    const handleToggleLike = async () => {
        if (!currentUserId) return;
        const likeRef = ref(FIREBASE_DB, `patientFeeds/${post.patientId}/${post.id}/likes/${currentUserId}`);
        const snapshot = await get(likeRef);
        snapshot.exists() ? remove(likeRef) : firebaseSet(likeRef, true);
    };

    const handleAddComment = async () => {
        if (!commentText.trim() || !currentUserId) return;
        const newCommentRef = push(ref(FIREBASE_DB, `patientFeeds/${post.patientId}/${post.id}/comments`));
        await firebaseSet(newCommentRef, { text: commentText.trim(), authorId: currentUserId, createdAt: new Date().toISOString() });
        setCommentText('');
        Keyboard.dismiss();
    };

    if (!author) return <View style={[styles.postCard, { height: 120, justifyContent: 'center' }]}><ActivityIndicator color={ABAETE_COLORS.primaryBlue} /></View>;
    
    const authorName = author.displayName || author.fullName || 'Usuário';
    const likesCount = post.likes ? Object.keys(post.likes).length : 0;
    const commentsCount = post.comments ? Object.keys(post.comments).length : 0;
    const isLiked = post.likes && post.likes[currentUserId];

    return (
        <View style={styles.postCard}>
            <View style={styles.postHeader}><Image source={{ uri: author.profilePicture || `https://ui-avatars.com/api/?name=${authorName.replace(' ', '+')}` }} style={styles.postAvatar} /><View><Text style={styles.postAuthorName}>{authorName}</Text><Text style={styles.postTimestamp}>{timeAgo(post.createdAt)}</Text></View></View>
            <Text style={styles.postText}>{post.text}</Text>
            
            <View style={styles.postActions}>
                <TouchableOpacity style={styles.actionButton} onPress={handleToggleLike}><MaterialIcons name={isLiked ? "thumb-up" : "thumb-up-off-alt"} size={22} color={isLiked ? ABAETE_COLORS.primaryBlue : ABAETE_COLORS.textSecondary} /><Text style={[styles.actionButtonText, isLiked && styles.actionButtonLiked]}>{likesCount > 0 ? likesCount : ''} Curtir</Text></TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => setCommentsVisible(!commentsVisible)}><MaterialIcons name="chat-bubble-outline" size={22} color={ABAETE_COLORS.textSecondary} /><Text style={styles.actionButtonText}>{commentsCount > 0 ? commentsCount : ''} Comentar</Text></TouchableOpacity>
            </View>

            {commentsVisible && (
                <View style={styles.commentsSection}>
                    {comments.map((comment, index) => (
                        <View key={index} style={styles.commentItem}>
                            <View style={styles.commentAvatar}><Text style={styles.commentAvatarText}>{(comment.author.displayName || 'U').charAt(0)}</Text></View>
                            <View style={styles.commentContent}><Text style={styles.commentAuthor}>{comment.author.displayName}</Text><Text style={styles.commentText}>{comment.text}</Text></View>
                        </View>
                    ))}
                    <View style={styles.commentInputContainer}>
                        <TextInput style={styles.commentInput} placeholder="Adicione um comentário..." value={commentText} onChangeText={setCommentText} />
                        <TouchableOpacity style={styles.sendCommentButton} onPress={handleAddComment}><MaterialIcons name="send" size={24} color={ABAETE_COLORS.primaryBlue} /></TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
};


// SUBSTITUA O COMPONENTE FeedContent ANTERIOR POR ESTE
const FeedContent = ({ patientId, currentUserId }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!patientId) { setLoading(false); return; }
    const feedRef = ref(FIREBASE_DB, `patientFeeds/${patientId}`);
    const q = query(feedRef, orderByChild('createdAt'));
    const unsubscribe = onValue(q, (snapshot) => {
      if (!snapshot.exists()) { setPosts([]); setLoading(false); return; }
      const postsData = [];
      snapshot.forEach(node => postsData.push({ id: node.key, patientId: patientId, ...node.val() }));
      setPosts(postsData.reverse());
      setLoading(false);
    });
    return () => unsubscribe();
  }, [patientId]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} size="large" color={ABAETE_COLORS.primaryBlue} />;

  return (
    <View style={styles.contentAreaClean}>
      <Text style={styles.pageTitleClean}>Feed de Atualizações</Text>
      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <PostItem post={item} currentUserId={currentUserId} />}
        ListEmptyComponent={<Text style={styles.emptySectionText}>Nenhuma atualização no feed.</Text>}
      />
    </View>
  );
};

const PerfilContent = ({ patient, onLogout }) => (
  <ScrollView style={styles.contentScrollViewClean} contentContainerStyle={styles.contentContainerClean}>
    <View style={styles.profileHeaderClean}><Image source={{ uri: patient.profilePicture || `https://ui-avatars.com/api/?name=${(patient.displayName || 'P').replace(' ', '+')}` }} style={styles.profileImageClean} /><Text style={styles.profileNameClean}>{patient.displayName}</Text><Text style={styles.profileEmailClean}>{patient.email}</Text></View>
    {[ {label: 'Meus Dados', icon: 'person', action: () => {}}, {label: 'Responsáveis', icon: 'family-restroom', action: () => {}}, {label: 'Configurações', icon: 'settings', action: () => {}}, {label: 'Ajuda', icon: 'help-outline', action: () => {}} ].map(item => (
        <TouchableOpacity key={item.label} style={styles.profileMenuItemClean} onPress={item.action}><MaterialIcons name={item.icon} size={24} color={ABAETE_COLORS.secondaryBlue} style={styles.profileMenuIcon} /><Text style={styles.profileMenuItemTextClean}>{item.label}</Text><MaterialIcons name="chevron-right" size={24} color={ABAETE_COLORS.mediumGray} /></TouchableOpacity>
    ))}
    <TouchableOpacity style={[styles.profileMenuItemClean, { marginTop: 20 }]} onPress={onLogout}><MaterialIcons name="logout" size={24} color={ABAETE_COLORS.errorRed} style={styles.profileMenuIcon} /><Text style={[styles.profileMenuItemTextClean, { color: ABAETE_COLORS.errorRed }]}>Sair</Text></TouchableOpacity>
  </ScrollView>
);

// --- COMPONENTE PRINCIPAL ---
export const HomeScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('Home');
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(FIREBASE_AUTH, (currentUser) => {
      if (currentUser) {
        const patientId = currentUser.uid;
        const patientRef = ref(FIREBASE_DB, `users/${patientId}`);
        const unsubscribePatient = onValue(patientRef, (snapshot) => {
          if (snapshot.exists() && (snapshot.val().role === 'patient' || snapshot.val().role === 'responsible')) {
            setPatient({ id: patientId, ...snapshot.val() });
          } else {
            setPatient(null);
            if(snapshot.exists()) { console.warn("Usuário não é paciente/responsável."); handleLogout(); }
          }
          setLoading(false);
        });
        return () => unsubscribePatient();
      } else { setLoading(false); navigation.replace('Login'); }
    });
    return unsubscribeAuth;
  }, []);

  const handleLogout = async () => { try { await signOut(FIREBASE_AUTH); } catch (error) { console.error("Erro ao sair:", error); } };

  const renderContent = () => {
    if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} /></View>;
    if (!patient) return <View style={styles.centered}><Text style={styles.emptySectionText}>Nenhum paciente vinculado a esta conta.</Text></View>;
    
    switch (activeTab) {
      case 'Home': return <HomeContent navigation={navigation} patient={patient} />;
      case 'Agenda': return <AgendaContent patientId={patient.id} />;
      case 'Progresso': return <ProgressoContent patient={patient} />;
      case 'Tarefas': return <TarefasContent patientId={patient.id} />;
      case 'Feed': return <FeedContent patientId={patient.id} currentUserId={FIREBASE_AUTH.currentUser?.uid} />;
      case 'Perfil': return <PerfilContent patient={patient} onLogout={handleLogout} />;
      default: return <HomeContent navigation={navigation} patient={patient} />;
    }
  };

  const tabs = [{ name: 'Home', icon: 'home', label: 'Início' }, { name: 'Agenda', icon: 'event', label: 'Agenda'}, { name: 'Progresso', icon: 'leaderboard', label: 'Progresso' }, { name: 'Tarefas', icon: 'checklist', label: 'Tarefas' }, { name: 'Feed', icon: 'dynamic-feed', label: 'Feed' }, { name: 'Perfil', icon: 'account-circle', label: 'Perfil' }];

  return (
    <SafeAreaView style={styles.safeAreaClean}>
      <StatusBar style="dark" backgroundColor={ABAETE_COLORS.white} />
      <View style={styles.headerClean}><Image source={require('../../assets/images/abaete_logo_hor.png')} style={styles.headerLogoClean} resizeMode="contain" /></View>
      <View style={styles.contentAreaClean}>{renderContent()}</View>
      <View style={styles.bottomNavClean}>
        {tabs.map((tab) => (
          <TouchableOpacity key={tab.name} style={styles.navItemClean} onPress={() => setActiveTab(tab.name)}>
            <MaterialIcons name={tab.icon} size={28} color={activeTab === tab.name ? ABAETE_COLORS.primaryBlue : ABAETE_COLORS.mediumGray} />
            <Text style={[styles.navItemTextClean, { color: activeTab === tab.name ? ABAETE_COLORS.primaryBlue : ABAETE_COLORS.mediumGray, fontFamily: activeTab === tab.name ? FONT_FAMILY.SemiBold : FONT_FAMILY.Regular }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};

// --- ESTILOS ---
const styles = StyleSheet.create({
  safeAreaClean: { flex: 1, backgroundColor: ABAETE_COLORS.white },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  headerClean: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 15, paddingBottom: 10, backgroundColor: ABAETE_COLORS.white, borderBottomWidth: 1, borderBottomColor: ABAETE_COLORS.lightGray },
  headerLogoClean: { height: 38, width: 130 },
  contentAreaClean: { flex: 1 },
  contentScrollViewClean: { backgroundColor: ABAETE_COLORS.white },
  contentContainerClean: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  greetingTextClean: { fontFamily: FONT_FAMILY.Regular, fontSize: 24, color: ABAETE_COLORS.textPrimary, marginBottom: 5 },
  subGreetingText: { fontFamily: FONT_FAMILY.Regular, fontSize: 16, color: ABAETE_COLORS.textSecondary, marginBottom: 25 },
  sectionContainer: { marginBottom: 25 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontFamily: FONT_FAMILY.Bold, fontSize: 18, color: ABAETE_COLORS.textPrimary },
  pageTitleClean: { fontFamily: FONT_FAMILY.Bold, fontSize: 26, color: ABAETE_COLORS.textPrimary, marginBottom: 25, paddingHorizontal: 20, paddingTop: 20 },
  seeAllText: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 14, color: ABAETE_COLORS.primaryBlue },
  eventCardClean: { flexDirection: 'row', alignItems: 'center', backgroundColor: ABAETE_COLORS.primaryBlueLight, borderRadius: 12, padding: 15, marginBottom: 12 },
  eventIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: ABAETE_COLORS.white, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  eventDetails: { flex: 1 },
  eventTitle: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 15, color: ABAETE_COLORS.textPrimary },
  eventTime: { fontFamily: FONT_FAMILY.Regular, fontSize: 13, color: ABAETE_COLORS.textSecondary, marginTop: 2 },
  infoIconContainer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  infoTextContainer: { flex: 1 },
  infoCardTitle: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 15, color: ABAETE_COLORS.textPrimary, marginBottom: 3 },
  infoCardDetail: { fontFamily: FONT_FAMILY.Regular, fontSize: 14, color: ABAETE_COLORS.textSecondary, lineHeight: 20 },
  taskCardClean: { flexDirection: 'row', alignItems: 'center', backgroundColor: ABAETE_COLORS.white, borderRadius: 12, padding: 15, borderWidth: 1, borderColor: ABAETE_COLORS.lightGray },
  taskStatusIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: ABAETE_COLORS.yellow, marginLeft: 10 },
  emptySectionText: { fontFamily: FONT_FAMILY.Regular, fontSize: 15, color: ABAETE_COLORS.textSecondary, textAlign: 'center', marginTop: 10, paddingVertical: 20 },
  profileHeaderClean: { alignItems: 'center', paddingVertical: 25, marginBottom: 20 },
  profileImageClean: { width: 110, height: 110, borderRadius: 55, marginBottom: 12, borderWidth: 3, borderColor: ABAETE_COLORS.primaryBlue },
  profileNameClean: { fontFamily: FONT_FAMILY.Bold, fontSize: 22, color: ABAETE_COLORS.textPrimary },
  profileEmailClean: { fontFamily: FONT_FAMILY.Regular, fontSize: 15, color: ABAETE_COLORS.textSecondary, marginTop: 4 },
  profileMenuItemClean: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: ABAETE_COLORS.lightGray },
  profileMenuIcon: { marginRight: 15 },
  profileMenuItemTextClean: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 16, color: ABAETE_COLORS.textPrimary, flex: 1 },
  bottomNavClean: { flexDirection: 'row', height: Platform.OS === 'ios' ? 80 : 70, paddingBottom: Platform.OS === 'ios' ? 15 : 0, backgroundColor: ABAETE_COLORS.white, borderTopWidth: 1, borderTopColor: ABAETE_COLORS.lightGray, alignItems: 'flex-start' },
  navItemClean: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 10 },
  navItemTextClean: { fontFamily: FONT_FAMILY.Regular, fontSize: 10, marginTop: 4 },
  yellowOpaco: { backgroundColor: 'rgba(255, 222, 128, 0.2)' },
  yellowDark: { color: '#FFA000' },
  postCard: { backgroundColor: ABAETE_COLORS.white, borderRadius: 12, marginHorizontal: 20, marginBottom: 15, padding: 15, borderWidth: 1, borderColor: ABAETE_COLORS.lightGray },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  postAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  postAuthorName: { fontFamily: FONT_FAMILY.SemiBold, color: ABAETE_COLORS.textPrimary },
  postTimestamp: { fontSize: 12, color: ABAETE_COLORS.textSecondary },
  postText: { fontFamily: FONT_FAMILY.Regular, fontSize: 15, color: ABAETE_COLORS.textPrimary, lineHeight: 22 },
  listHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, fontFamily: FONT_FAMILY.Bold, fontSize: 18 },
  programCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', padding: 15, marginHorizontal:20, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: ABAETE_COLORS.lightGray },
  programTitle: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 16, color: ABAETE_COLORS.textPrimary },
  programPhase: { fontFamily: FONT_FAMILY.Regular, fontSize: 14, color: ABAETE_COLORS.textSecondary, marginTop: 4 },
  taskListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: ABAETE_COLORS.lightGray, marginHorizontal: 20 },
  listItemIconContainer: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  listItemTextContainer: { flex: 1 },
  listItemTitle: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 15, color: ABAETE_COLORS.textPrimary, marginBottom: 2 },
  listItemSubtitle: { fontFamily: FONT_FAMILY.Regular, fontSize: 13, color: ABAETE_COLORS.textSecondary },
  successGreen: { color: '#388E3C' },
  postActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 10,
        marginTop: 10,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
    },
    actionButtonText: {
        marginLeft: 6,
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 14,
        color: ABAETE_COLORS.textSecondary,
    },
    actionButtonLiked: {
        color: ABAETE_COLORS.primaryBlue,
    },
    commentsSection: {
        marginTop: 10,
        paddingTop: 10,
    },
    commentInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    commentInput: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 15,
        fontFamily: FONT_FAMILY.Regular,
    },
    sendCommentButton: {
        marginLeft: 10,
        padding: 8,
    },
    commentItem: {
        flexDirection: 'row',
        marginTop: 10,
    },
    commentAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
        backgroundColor: ABAETE_COLORS.lightGray,
        justifyContent: 'center',
        alignItems: 'center',
    },
    commentAvatarText: {
        color: ABAETE_COLORS.textSecondary,
        fontFamily: FONT_FAMILY.SemiBold,
    },
    commentContent: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        borderRadius: 12,
        padding: 10,
    },
    commentAuthor: {
        fontFamily: FONT_FAMILY.SemiBold,
        color: ABAETE_COLORS.textPrimary,
    },
    commentText: {
        fontFamily: FONT_FAMILY.Regular,
        color: ABAETE_COLORS.textSecondary,
    },
});