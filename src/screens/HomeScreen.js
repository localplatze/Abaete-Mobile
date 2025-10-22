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
  Keyboard, Modal
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, onValue, query, orderByChild, equalTo, get, push, set as firebaseSet, remove } from 'firebase/database';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Video } from 'expo-av';
import { LineChart } from "react-native-gifted-charts";
import { Picker } from '@react-native-picker/picker';

import { FIREBASE_AUTH, FIREBASE_DB } from '../services/firebaseConnection';
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';
import { getCachedUserData } from '../services/userCache';
import { AnamneseCard } from '../components/AnamneseCard';

// --- CONFIGURAÇÕES E FUNÇÕES AUXILIARES ---

LocaleConfig.locales['pt-br'] = { monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'], monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'], dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'], dayNamesShort: ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'], today: 'Hoje' };
LocaleConfig.defaultLocale = 'pt-br';

const timeAgo = (dateStr) => { if (!dateStr) return ''; const date = new Date(dateStr); const seconds = Math.floor((new Date() - date) / 1000); let interval = seconds / 31536000; if (interval > 1) return `Há ${Math.floor(interval)} anos`; interval = seconds / 2592000; if (interval > 1) return `Há ${Math.floor(interval)} meses`; interval = seconds / 86400; if (interval > 1) return `Há ${Math.floor(interval)} dias`; interval = seconds / 3600; if (interval > 1) return `Há ${Math.floor(interval)} horas`; interval = seconds / 60; if (interval > 1) return `Há ${Math.floor(interval)} minutos`; return "Agora"; };

function createSafeFirebaseKeyFromDate(date) {
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

// --- COMPONENTES DAS ABAS ---

const HomeContent = ({ patient }) => {
    return (
        <View style={{flex: 1}}>
            <AgendaContent patientId={patient.id} showCalendar={false} />
        </View>
    );
};

const AgendaContent = ({ patientId, showCalendar = true }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    
    // O estado agora é um único objeto que guarda os agendamentos virtuais e as marcações
    const [calendarData, setCalendarData] = useState({ appointmentsByDate: {}, markedDates: {} });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!patientId) return;

        const schedulesRef = query(ref(FIREBASE_DB, 'schedules'), orderByChild('patientId'), equalTo(patientId));
        
        const unsubscribe = onValue(schedulesRef, (snapshot) => {
            setLoading(true);
            const schedules = snapshot.exists() ? snapshot.val() : {};
            const generatedAppointments = {};
            const marks = {};

            const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
            const endOfMonth = new Date(currentYear, currentMonth, 0);

            for (const scheduleId in schedules) {
                const rule = { id: scheduleId, ...schedules[scheduleId] };
                for (let day = new Date(startOfMonth); day <= endOfMonth; day.setDate(day.getDate() + 1)) {
                    // Proteção contra datas inválidas na regra
                    if (!rule.startDate || !rule.endDate || isNaN(new Date(rule.startDate)) || isNaN(new Date(rule.endDate))) continue;

                    if (day >= new Date(rule.startDate + 'T00:00:00') && day <= new Date(rule.endDate + 'T23:59:59')) {
                        const dayOfWeek = day.getDay();
                        const timetableForDay = Array.isArray(rule.weeklyTimetable) ? rule.weeklyTimetable[dayOfWeek] : rule.weeklyTimetable[dayOfWeek.toString()];
                        
                        if (timetableForDay) {
                            for (const time of timetableForDay) {
                                const [hour, minute] = time.split(':');
                                const appDateTime = new Date(day);
                                appDateTime.setHours(parseInt(hour), parseInt(minute), 0, 0);
                                
                                const oldExceptionKey = appDateTime.toISOString().replace(/\./g, ',');
                                const newExceptionKey = createSafeFirebaseKeyFromDate(appDateTime);

                                if (rule.exceptions?.cancelled?.[oldExceptionKey] || rule.exceptions?.completed?.[newExceptionKey]) continue;

                                const dateStr = day.toISOString().split('T')[0];
                                if (!generatedAppointments[dateStr]) generatedAppointments[dateStr] = [];
                                
                                generatedAppointments[dateStr].push({
                                    id: `${rule.id}_${appDateTime.getTime()}`,
                                    dateTimeStart: appDateTime.toISOString(),
                                    type: rule.type,
                                    // Adicione outros dados da regra se precisar
                                });
                                marks[dateStr] = { marked: true, dotColor: ABAETE_COLORS.primaryBlue };
                            }
                        }
                    }
                }
            }

            setCalendarData({ appointmentsByDate: generatedAppointments, markedDates: marks });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [patientId, currentMonth, currentYear]);
    
    // Usa os dados do estado `calendarData`
    const appointmentsForSelectedDay = calendarData.appointmentsByDate[selectedDate] || [];
    const displayDate = new Date(selectedDate + 'T12:00:00'); 

    return (
        <View style={styles.contentAreaClean}>
            {showCalendar && <Text style={styles.pageTitleClean}>Agenda</Text>}
            {showCalendar && (
                <Calendar
                    onMonthChange={(month) => {
                        setCurrentMonth(month.month);
                        setCurrentYear(month.year);
                    }}
                    onDayPress={(day) => setSelectedDate(day.dateString)}
                    markedDates={{ ...calendarData.markedDates, [selectedDate]: { ...(calendarData.markedDates[selectedDate] || {}), selected: true, selectedColor: ABAETE_COLORS.primaryBlue } }}
                    theme={{ arrowColor: ABAETE_COLORS.primaryBlue }}
                />
            )}
            <Text style={styles.listHeader}>{showCalendar ? `Agendamentos para ${displayDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}` : "Sessões de Hoje"}</Text>
            {loading ? <ActivityIndicator/> : 
            <FlatList data={appointmentsForSelectedDay} keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <View style={styles.eventCardClean}>
                        <View style={styles.eventIconContainer}><MaterialIcons name="event" size={24} color={ABAETE_COLORS.primaryBlue} /></View>
                        <View style={styles.eventDetails}>
                            <Text style={styles.eventTitle}>{item.type}</Text>
                            <Text style={styles.eventTime}>{new Date(item.dateTimeStart).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
                        </View>
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

const PHASE_ORDER = ['baseline', 'intervention', 'maintenance', 'generalization'];
const PHASE_COLORS = {
    baseline: { bg: 'rgba(254, 226, 226, 0.7)', border: '#F87171' },
    intervention: { bg: 'rgba(254, 249, 195, 0.7)', border: '#FBBF24' },
    maintenance: { bg: 'rgba(221, 237, 254, 0.7)', border: '#367BF5' },
    generalization: { bg: 'rgba(222, 247, 236, 0.7)', border: '#34D399' }
};

const ProgressChart = ({ chartData }) => {
    // Se não houver dados suficientes, mostra uma mensagem
    if (!chartData || chartData.length < 2) {
        return (
            <View style={styles.emptyChartContainer}>
                <MaterialIcons name="insights" size={48} color={ABAETE_COLORS.lightGray} />
                <Text style={styles.emptyTabText}>Dados insuficientes para gerar o gráfico.</Text>
            </View>
        );
    }
    
    // Hook para processar os dados e preparar as anotações do gráfico
    const chartProps = useMemo(() => {
        const sections = [];
        const verticalLines = [];
        const labels = chartData.map(d => d.label);
        const specialLabelIndices = {};

        let lastPhase = null;
        let startIndex = 0;

        chartData.forEach((point, index) => {
            if (point.phase !== lastPhase) {
                if (lastPhase !== null) {
                    // Adiciona a seção de fundo da fase anterior
                    sections.push({
                        color: PHASE_COLORS[lastPhase]?.bg || 'transparent',
                        startValue: startIndex,
                        endValue: index - 1,
                    });
                    // Adiciona a linha divisória vertical entre as fases
                    verticalLines.push({ index: index - 1, color: ABAETE_COLORS.lightGray, dash: [5, 5] });
                }
                // Calcula o índice do meio do bloco da fase anterior para posicionar o rótulo
                const middleIndex = startIndex + Math.floor((index - 1 - startIndex) / 2);
                if (lastPhase) specialLabelIndices[middleIndex] = phaseTranslations[lastPhase];
                
                startIndex = index;
                lastPhase = point.phase;
            }
        });
        // Adiciona a última seção e o último rótulo
        sections.push({ color: PHASE_COLORS[lastPhase]?.bg || 'transparent', startValue: startIndex, endValue: chartData.length - 1 });
        const lastMiddleIndex = startIndex + Math.floor((chartData.length - 1 - startIndex) / 2);
        if (lastPhase) specialLabelIndices[lastMiddleIndex] = phaseTranslations[lastPhase];

        return { sections, verticalLines, labels, specialLabelIndices };
    }, [chartData]);
    
    return (
        <LineChart
            data={chartData}
            height={220}
            color={ABAETE_COLORS.primaryBlue}
            thickness={3}
            curved
            spacing={60} // Espaçamento entre os pontos de dados
            initialSpacing={10}
            // --- Eixo Y ---
            yAxisLabelSuffix="%"
            yAxisTextStyle={{ color: ABAETE_COLORS.textSecondary }}
            yAxisOffset={0} // Garante que comece no 0
            maxValue={100}
            noOfSections={5} // Linhas horizontais (0, 20, 40, 60, 80, 100)
            // --- Eixo X Customizado ---
            xAxisLabelComponent={(index) => (
                <View style={{ width: 60, marginLeft: index === 0 ? -15 : 0 }}>
                    {/* Linha 1: Data */}
                    <Text style={{ color: ABAETE_COLORS.textSecondary, textAlign: 'center', fontSize: 12 }}>{chartProps.labels[index]}</Text>
                    {/* Linha 2: Nome da Fase (renderizado condicionalmente) */}
                    {chartProps.specialLabelIndices[index] && (
                        <Text style={{ color: ABAETE_COLORS.primaryBlue, textAlign: 'center', fontSize: 12, fontFamily: FONT_FAMILY.SemiBold, marginTop: 4 }}>
                            {chartProps.specialLabelIndices[index]}
                        </Text>
                    )}
                </View>
            )}
            xAxisLabelsHeight={40} // Aumenta a altura para caber o nome da fase
            // --- Fundo e Divisórias ---
            rulesColor={ABAETE_COLORS.lightGray}
            showXAxisIndices={false} // Esconde os índices padrão do eixo X
            sections={chartProps.sections}
            verticalLines={chartProps.verticalLines}
            // --- Pontos de Dados ---
            dataPointsColor={ABAETE_COLORS.primaryBlue}
            dataPointsRadius={4}
        />
    );
};

const ProgressoContent = ({ patient }) => {
    const [allSessions, setAllSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProgramId, setSelectedProgramId] = useState('');
    const availablePrograms = patient.assignedPrograms ? Object.values(patient.assignedPrograms) : [];

    useEffect(() => {
        if (availablePrograms.length > 0 && !selectedProgramId) {
            setSelectedProgramId(availablePrograms[0].id);
        }
        const appointmentsRef = query(ref(FIREBASE_DB, 'appointments'), orderByChild('patientId'), equalTo(patient.id));
        const unsubscribe = onValue(appointmentsRef, (snapshot) => {
            const completedSessions = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const app = { id: child.key, ...child.val() };
                    if (app.status === 'completed' && app.abaData?.programs) {
                        // Expande os programas de uma sessão em registros individuais
                        app.abaData.programs.forEach(progResult => {
                            completedSessions.push({ ...app, abaData: progResult });
                        });
                    }
                });
            }
            setAllSessions(completedSessions.sort((a, b) => new Date(a.dateTimeStart) - new Date(b.dateTimeStart)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [patient.id]);

    if (loading) return <ActivityIndicator style={{ marginTop: 40 }} size="large" color={ABAETE_COLORS.primaryBlue} />;
    if (availablePrograms.length === 0) return <View style={styles.contentAreaClean}><Text style={styles.pageTitleClean}>Meu Progresso</Text><Text style={styles.emptySectionText}>Nenhum programa atribuído.</Text></View>;

    const programConfig = patient.assignedPrograms?.[selectedProgramId];
    const filteredSessions = allSessions.filter(session => session.abaData.programId === selectedProgramId);
    
    const generalChartData = filteredSessions.map(session => ({
        value: session.abaData.accuracy,
        label: new Date(session.dateTimeStart).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        phase: session.abaData.phaseConducted,
    }));

    return (
        <ScrollView style={styles.contentAreaClean}>
            <Text style={styles.pageTitleClean}>Meu Progresso</Text>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Analisar Programa</Text>
                <View style={styles.pickerContainer}>
                    <Picker selectedValue={selectedProgramId} onValueChange={itemValue => setSelectedProgramId(itemValue)}>
                        {availablePrograms.map(prog => <Picker.Item key={prog.id} label={prog.name} value={prog.id} />)}
                    </Picker>
                </View>
            </View>

            <View style={styles.chartSection}>
                <Text style={styles.sectionTitle}>Progresso Geral</Text>
                <View style={styles.chartContainer}><ProgressChart chartData={generalChartData} /></View>
            </View>

            {programConfig?.targets?.map(targetName => {
                const targetChartData = filteredSessions.map(session => {
                    const trial = session.abaData.trialsData.find(t => t.target === targetName);
                    if (!trial?.attempts?.length) return null;
                    const correct = trial.attempts.filter(a => a.score === 1).length;
                    return {
                        value: (correct / trial.attempts.length) * 100,
                        label: new Date(session.dateTimeStart).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                        phase: session.abaData.phaseConducted,
                    };
                }).filter(Boolean);

                return (
                    <View key={targetName} style={styles.chartSection}>
                        <Text style={styles.sectionTitle}>{`Alvo: "${targetName}"`}</Text>
                        <View style={styles.chartContainer}><ProgressChart chartData={targetChartData} /></View>
                    </View>
                );
            })}
        </ScrollView>
    );
};

const TarefasContent = ({ patient, navigation }) => {
    const [tasks, setTasks] = useState([]);
    const [hasAnamnese, setHasAnamnese] = useState(true); // Começa como true para não piscar
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!patient?.id) return;
        
        // Verifica se a anamnese existe
        const anamneseRef = ref(FIREBASE_DB, `anamnesis/${patient.id}`);
        const unsubscribeAnamnese = onValue(anamneseRef, (snapshot) => {
            setHasAnamnese(snapshot.exists());
        });

        // Busca as tarefas de casa
        const tasksRef = query(ref(FIREBASE_DB, 'homeworkTasks'), orderByChild('patientId'), equalTo(patient.id));
        const unsubscribeTasks = onValue(tasksRef, snapshot => {
            const allTasks = [];
            snapshot.forEach(child => allTasks.push({ id: child.key, ...child.val() }));
            setTasks(allTasks.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
            setLoading(false);
        });
        
        return () => { unsubscribeAnamnese(); unsubscribeTasks(); };
    }, [patient?.id]);
    
    if(loading) return <ActivityIndicator/>;
    
    return (
        <ScrollView style={styles.contentAreaClean} contentContainerStyle={styles.contentContainerClean}>
            <Text style={styles.pageTitleClean}>Tarefas de Casa</Text>
            
            {!hasAnamnese && (
                <AnamneseCard onPress={() => navigation.navigate('Anamnese', { patient })} />
            )}
            
            <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Atividades Pendentes</Text></View>
                {tasks.length > 0 ? (
                    <FlatList data={tasks} keyExtractor={item => item.id} scrollEnabled={false}
                        renderItem={({item}) => (
                            <TouchableOpacity style={styles.taskListItem}>
                                {/* ... seu item de tarefa ... */}
                            </TouchableOpacity>
                        )}
                    />
                ) : (
                    <Text style={styles.emptySectionText}>Nenhuma tarefa de casa encontrada.</Text>
                )}
            </View>
        </ScrollView>
    );
};

const PostItem = ({ post, currentUserId }) => {
    const [author, setAuthor] = useState(null);
    const [commentsVisible, setCommentsVisible] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [isImageModalVisible, setImageModalVisible] = useState(false);
    const [selectedImageUri, setSelectedImageUri] = useState(null);

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

    const openImageModal = (uri) => {
        setSelectedImageUri(uri);
        setImageModalVisible(true);
    };

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

            {post.media && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.postMediaContainer}>
                    {Object.values(post.media).map((mediaFile, index) => (
                        <TouchableOpacity key={index} onPress={() => mediaFile.type === 'image' && openImageModal(mediaFile.url)}>
                            {mediaFile.type === 'image' ? <Image source={{ uri: mediaFile.url }} style={styles.mediaItem} />
                            : mediaFile.type === 'video' ? <Video source={{ uri: mediaFile.url }} style={styles.mediaItem} useNativeControls resizeMode="cover" />
                            : null}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}
            
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

            <Modal visible={isImageModalVisible} transparent={true} onRequestClose={() => setImageModalVisible(false)}>
                <View style={styles.imageModalContainer}>
                    <TouchableOpacity style={styles.closeModalButton} onPress={() => setImageModalVisible(false)}>
                        <MaterialIcons name="close" size={28} color="white" />
                    </TouchableOpacity>
                    <Image source={{ uri: selectedImageUri }} style={styles.imageModalContent} resizeMode="contain" />
                </View>
            </Modal>
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

const EditPatientModal = ({ visible, onClose, patient, onSave }) => {
    if (!visible) return null;

    const [formData, setFormData] = useState({ ...patient, responsibles: patient.responsibles || [] });
    
    const handleInputChange = (field, value) => setFormData(p => ({ ...p, [field]: value }));
    
    const handleResponsibleChange = (index, field, value) => {
        const updatedResponsibles = [...formData.responsibles];
        updatedResponsibles[index][field] = value;
        setFormData(p => ({ ...p, responsibles: updatedResponsibles }));
    };
    
    const addResponsible = () => setFormData(p => ({ ...p, responsibles: [...p.responsibles, {}] }));
    const removeResponsible = (index) => setFormData(p => ({ ...p, responsibles: p.responsibles.filter((_, i) => i !== index) }));

    return (
        <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.safeAreaClean}>
                <View style={[styles.headerClean, { justifyContent: 'space-between' }]}>
                    <Text style={styles.pageTitleClean}>Editar Dados</Text>
                    <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={28} /></TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={styles.contentContainerClean}>
                    <Text style={styles.sectionTitle}>Dados Pessoais</Text>
                    <TextInput style={styles.input} value={formData.fullName} onChangeText={v => handleInputChange('fullName', v)} placeholder="Nome Completo" />
                    <TextInput style={styles.input} value={formData.displayName} onChangeText={v => handleInputChange('displayName', v)} placeholder="Nome Social" />
                    <TextInput style={styles.input} value={formData.birthday} onChangeText={v => handleInputChange('birthday', v)} placeholder="Data de Nascimento (AAAA-MM-DD)" />
                    <TextInput style={styles.input} value={formData.cpf} onChangeText={v => handleInputChange('cpf', v)} placeholder="CPF" keyboardType="numeric" />
                    <View style={styles.pickerContainer}>
                      <Picker selectedValue={formData.gender} onValueChange={v => handleInputChange('gender', v)}>
                          <Picker.Item label="Prefiro não informar" value="prefer_not_say" />
                          <Picker.Item label="Masculino" value="male" />
                          <Picker.Item label="Feminino" value="female" />
                          <Picker.Item label="Outro" value="other" />
                      </Picker>
                    </View>

                    <Text style={styles.sectionTitle}>Responsáveis</Text>
                    {formData.responsibles.map((resp, index) => (
                        <View key={index} style={styles.responsibleCard}>
                            <TouchableOpacity style={styles.removeResponsibleBtn} onPress={() => removeResponsible(index)}>
                                <MaterialIcons name="delete-outline" size={24} color={ABAETE_COLORS.errorRed} />
                            </TouchableOpacity>
                            <TextInput style={styles.input} value={resp.fullName} onChangeText={v => handleResponsibleChange(index, 'fullName', v)} placeholder="Nome do Responsável" />
                            <TextInput style={styles.input} value={resp.relationship} onChangeText={v => handleResponsibleChange(index, 'relationship', v)} placeholder="Parentesco" />
                        </View>
                    ))}
                    <TouchableOpacity style={styles.addButton} onPress={addResponsible}>
                        <MaterialIcons name="add" size={20} color={ABAETE_COLORS.primaryBlue} />
                        <Text style={styles.addButtonText}>Adicionar Responsável</Text>
                    </TouchableOpacity>
                </ScrollView>
                <View style={styles.modalFooter}>
                    <TouchableOpacity style={styles.saveButton} onPress={() => onSave(formData)}>
                        <Text style={styles.saveButtonText}>Salvar Alterações</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const PerfilContent = ({ patient, onLogout }) => {
    const [isEditModalVisible, setEditModalVisible] = useState(false);

    const handleSaveProfile = async (updatedData) => {
        try {
            await update(ref(FIREBASE_DB, `users/${patient.id}`), updatedData);
            setEditModalVisible(false);
            Alert.alert("Sucesso", "Seus dados foram atualizados.");
        } catch (error) { Alert.alert("Erro", "Não foi possível salvar."); }
    };

    return (
        <ScrollView style={styles.contentScrollViewClean} contentContainerStyle={styles.contentContainerClean}>
            <View style={styles.profileHeaderClean}><Image source={{ uri: patient.profilePicture || `https://ui-avatars.com/api/?name=${(patient.displayName || 'P').replace(' ', '+')}` }} style={styles.profileImageClean} /><Text style={styles.profileNameClean}>{patient.displayName}</Text><Text style={styles.profileEmailClean}>{patient.email}</Text></View>
            <TouchableOpacity style={styles.profileMenuItemClean} onPress={() => setEditModalVisible(true)}>
                <MaterialIcons name="person" size={24} color={ABAETE_COLORS.secondaryBlue} style={styles.profileMenuIcon} />
                <Text style={styles.profileMenuItemTextClean}>Meus Dados e Responsáveis</Text>
                <MaterialIcons name="chevron-right" size={24} color={ABAETE_COLORS.mediumGray} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.profileMenuItemClean, { marginTop: 20 }]} onPress={onLogout}>
                <MaterialIcons name="logout" size={24} color={ABAETE_COLORS.errorRed} style={styles.profileMenuIcon} />
                <Text style={[styles.profileMenuItemTextClean, { color: ABAETE_COLORS.errorRed }]}>Sair</Text>
            </TouchableOpacity>

            <EditPatientModal 
                visible={isEditModalVisible} 
                onClose={() => setEditModalVisible(false)} 
                patient={patient} 
                onSave={handleSaveProfile} 
            />
        </ScrollView>
    );
};

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
      case 'Tarefas': return <TarefasContent patient={patient} navigation={navigation} />;
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
    // Estilos para os Gráficos em Progresso
    pickerContainer: { borderWidth: 1, borderColor: ABAETE_COLORS.lightGray, borderRadius: 8, marginBottom: 10, backgroundColor: ABAETE_COLORS.white },
    chartSection: { backgroundColor: ABAETE_COLORS.white, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 8, marginTop: 16, borderWidth: 1, borderColor: ABAETE_COLORS.lightGray },
    chartContainer: { height: 280, justifyContent: 'center', paddingTop: 20 },
    emptyChartContainer: { height: 220, alignItems: 'center', justifyContent: 'center', padding: 20 },
    
    // Estilos para a Mídia no Feed
    postMediaContainer: { marginTop: 10, marginBottom: 10, height: 200 },
    mediaItem: { width: 280, height: 200, borderRadius: 8, marginRight: 10, backgroundColor: '#e9ecef' },
    imageModalContainer: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'center', alignItems: 'center' },
    imageModalContent: { width: '100%', height: '80%' },
    closeModalButton: { position: 'absolute', top: 60, right: 20, zIndex: 1, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8 },
    input: {
      height: 50, borderColor: ABAETE_COLORS.lightGray, borderWidth: 1, borderRadius: 8,
      paddingHorizontal: 15, marginBottom: 15, fontFamily: FONT_FAMILY.Regular, fontSize: 16,
    },
    modalFooter: {
      padding: 20, borderTopWidth: 1, borderTopColor: ABAETE_COLORS.lightGray,
    },
    saveButton: {
      backgroundColor: ABAETE_COLORS.primaryBlue, padding: 15, borderRadius: 8, alignItems: 'center',
    },
    saveButtonText: {
      color: '#fff', fontFamily: FONT_FAMILY.SemiBold, fontSize: 16,
    },
    responsibleCard: {
      padding: 15, borderWidth: 1, borderColor: ABAETE_COLORS.lightGray, borderRadius: 12, marginBottom: 15,
    },
    removeResponsibleBtn: {
      position: 'absolute', top: 10, right: 10,
    },
    addButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      padding: 15, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: ABAETE_COLORS.primaryBlue,
    },
    addButtonText: {
      color: ABAETE_COLORS.primaryBlue, fontFamily: FONT_FAMILY.SemiBold, marginLeft: 8,
    },
});