import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, 
    Image, ActivityIndicator, FlatList, TextInput, Keyboard, Modal
} from 'react-native';
import { ref, onValue, query, orderByChild, firebaseSet, push, 
    get, remove, equalTo
} from 'firebase/database';
import { getCachedUserData } from '../services/userCache';
import { FIREBASE_DB, FIREBASE_AUTH } from '../services/firebaseConnection';
import { AddTaskModal } from '../components/AddTaskModal';
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LineChart } from "react-native-gifted-charts";
import { Picker } from '@react-native-picker/picker';
import { Video } from 'expo-av';

// Componentes para cada Aba
const OverviewTab = ({ patient }) => {
    const infoCards = [
        { icon: 'cake', label: 'Idade', value: patient.age ? `${patient.age} anos` : 'N/A' },
        { icon: 'healing', label: 'Diagnóstico', value: patient.diagnosis || 'Não informado' },
        { icon: 'family-restroom', label: 'Responsável', value: patient.responsibleData?.fullName || 'Não informado' },
        { icon: 'phone', label: 'Contato', value: patient.responsibleData?.phoneNumber || 'Não informado' },
    ];

    return (
        <View style={styles.tabContent}>
            <View style={styles.infoGrid}>
                {infoCards.map(card => (
                    <View key={card.label} style={styles.infoCard}>
                        <MaterialIcons name={card.icon} size={24} color={ABAETE_COLORS.primaryBlue} />
                        <Text style={styles.infoCardLabel}>{card.label}</Text>
                        <Text style={styles.infoCardValue}>{card.value}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Queixa Principal / Observações</Text>
                <Text style={styles.sectionText}>{patient.observations || 'Nenhuma observação registrada.'}</Text>
            </View>
        </View>
    );
};

const phaseTranslations = {
    baseline: 'Linha de Base',
    intervention: 'Intervenção',
    maintenance: 'Manutenção',
    generalization: 'Generalização',
    'Não iniciada': 'Não iniciada'
};

// SUBSTITUA O COMPONENTE ProgramsTab POR ESTE
const ProgramsTab = ({ patient, navigation }) => {
    const programs = patient.assignedPrograms ? Object.values(patient.assignedPrograms) : [];
    
    if (programs.length === 0) {
        return <View style={styles.tabContent}><Text style={styles.emptyTabText}>Nenhum programa atribuído.</Text></View>;
    }
    
    return (
        <View style={styles.tabContent}>
            {programs.map((program) => {
                const phaseKey = patient.programProgress?.[program.templateId]?.currentPhase || 'Não iniciada';
                const translatedPhase = phaseTranslations[phaseKey] || phaseKey; // Usa a tradução

                return (
                    <View key={program.templateId} style={styles.programCard}>
                        <View style={{flex: 1, marginRight: 10}}>
                            <Text style={styles.programTitle} numberOfLines={2}>{program.name}</Text>
                            <Text style={styles.programPhase}>
                                Fase Atual: <Text style={{fontFamily: FONT_FAMILY.SemiBold}}>{translatedPhase}</Text>
                            </Text>
                        </View>
                        <TouchableOpacity 
                            style={styles.startSessionButton} 
                            onPress={() => navigation.navigate('NewAba', { 
                                patientId: patient.id, 
                                programId: program.templateId 
                            })}
                        >
                            <MaterialIcons name="play-arrow" size={24} color="white" />
                            <Text style={styles.startSessionButtonText}>Iniciar</Text>
                        </TouchableOpacity>
                    </View>
                );
            })}
        </View>
    );
};

const ProgressItem = ({ program, progress, navigation }) => {
    // Pega as 5 sessões mais recentes do histórico para este programa
    const recentSessions = progress.sessionHistory
        .filter(session => session.appointmentId) // Garante que a sessão tem um ID
        .slice(0, 5);

    const translatedPhase = phaseTranslations[progress.currentPhase] || progress.currentPhase;

    return (
        <View style={styles.section}>
            <View style={styles.sessionHeader}>
                <Text style={styles.sessionProgramName}>{program.name}</Text>
                <View style={styles.programPhaseBadge}>
                    <Text style={styles.programPhaseText}>{translatedPhase}</Text>
                </View>
            </View>
            
            {/* Aqui você pode adicionar um gráfico com as últimas 5 accuracies */}

            <Text style={styles.subsectionTitle}>Últimas Sessões Registradas</Text>
            {recentSessions.length > 0 ? (
                recentSessions.map(session => (
                    <TouchableOpacity 
                        key={session.appointmentId} 
                        style={styles.sessionListItem}
                        // Futuramente, pode navegar para uma tela de detalhes da sessão
                        onPress={() => console.log("Ver detalhes da sessão:", session.appointmentId)}
                    >
                        <Text style={styles.sessionDate}>{new Date(session.date).toLocaleDateString('pt-BR')}</Text>
                        <View style={[styles.accuracyBadge, session.accuracy >= 80 ? styles.accuracyGood : styles.accuracyRegular]}>
                            <Text style={styles.accuracyText}>{session.accuracy}%</Text>
                        </View>
                    </TouchableOpacity>
                ))
            ) : (
                <Text style={styles.emptyTabTextSmall}>Nenhum registro de sessão para este programa.</Text>
            )}
        </View>
    );
};

const PHASE_ORDER = ['baseline', 'intervention', 'maintenance', 'generalization'];
const PHASE_TRANSLATIONS = {
    baseline: 'Linha de Base', intervention: 'Intervenção',
    maintenance: 'Manutenção', generalization: 'Generalização'
};
const PHASE_COLORS = {
    baseline: { bg: 'rgba(254, 226, 226, 0.7)', border: '#F87171' },
    intervention: { bg: 'rgba(254, 249, 195, 0.7)', border: '#FBBF24' },
    maintenance: { bg: 'rgba(221, 237, 254, 0.7)', border: '#367BF5' },
    generalization: { bg: 'rgba(222, 247, 236, 0.7)', border: '#34D399' }
};

const ProgressChart = ({ chartData, programConfig }) => {
    if (chartData.length < 2) {
        return <View style={styles.emptyChartContainer}><Text style={styles.emptyTabText}>Dados insuficientes para gerar o gráfico.</Text></View>;
    }

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
                    // Adiciona seção de fundo
                    sections.push({ color: PHASE_COLORS[lastPhase]?.bg || 'transparent', startValue: startIndex, endValue: index - 1 });
                    // Adiciona linha divisória
                    verticalLines.push({ index: index -1, color: ABAETE_COLORS.lightGray, dash: [5, 5] });
                }
                // Calcula o meio do bloco da fase anterior para o rótulo
                const middleIndex = startIndex + Math.floor((index - 1 - startIndex) / 2);
                if (lastPhase) specialLabelIndices[middleIndex] = PHASE_TRANSLATIONS[lastPhase];
                
                startIndex = index;
                lastPhase = point.phase;
            }
        });
        // Adiciona a última seção e rótulo
        sections.push({ color: PHASE_COLORS[lastPhase]?.bg || 'transparent', startValue: startIndex, endValue: chartData.length - 1 });
        const lastMiddleIndex = startIndex + Math.floor((chartData.length - 1 - startIndex) / 2);
        if (lastPhase) specialLabelIndices[lastMiddleIndex] = PHASE_TRANSLATIONS[lastPhase];

        return { sections, verticalLines, labels, specialLabelIndices };
    }, [chartData]);
    
    return (
        <LineChart
            data={chartData}
            height={220} color={ABAETE_COLORS.primaryBlue} thickness={3} curved
            spacing={60} initialSpacing={20}
            // Eixos
            yAxisLabelSuffix="%" yAxisTextStyle={{ color: ABAETE_COLORS.textSecondary }}
            yAxisOffset={0} maxValue={100} noOfSections={5}
            // Rótulos do Eixo X customizados
            xAxisLabelComponent={(index) => (
                <View style={{ width: 60, marginLeft: index === 0 ? -15 : 0 }}>
                    <Text style={{ color: ABAETE_COLORS.textSecondary, textAlign: 'center' }}>{chartProps.labels[index]}</Text>
                    {chartProps.specialLabelIndices[index] && (
                        <Text style={{ color: ABAETE_COLORS.primaryBlue, textAlign: 'center', fontSize: 12, fontFamily: FONT_FAMILY.SemiBold, marginTop: 4 }}>
                            {chartProps.specialLabelIndices[index]}
                        </Text>
                    )}
                </View>
            )}
            xAxisLabelsHeight={40} // Aumenta a altura para caber o nome da fase
            // Fundo e Divisórias
            rulesColor={ABAETE_COLORS.lightGray} showXAxisIndices={false}
            sections={chartProps.sections}
            verticalLines={chartProps.verticalLines}
            // Pontos
            dataPointsColor={ABAETE_COLORS.primaryBlue}
        />
    );
};

const ProgressTab = ({ patient }) => {
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
                    if (app.status === 'completed' && app.abaData?.programId) completedSessions.push(app);
                });
            }
            setAllSessions(completedSessions.sort((a, b) => new Date(a.dateTimeStart) - new Date(b.dateTimeStart)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [patient.id, availablePrograms]);

    const programConfig = patient.assignedPrograms?.[selectedProgramId];
    const filteredSessions = allSessions.filter(session => session.abaData.programId === selectedProgramId);

    const generalChartData = filteredSessions.map(session => ({
        value: session.abaData.accuracy,
        label: new Date(session.dateTimeStart).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        phase: session.abaData.phaseConducted,
    }));

    if (loading) return <ActivityIndicator style={{ marginTop: 40 }} size="large" color={ABAETE_COLORS.primaryBlue} />;
    if (availablePrograms.length === 0) return <View style={styles.tabContent}><Text style={styles.emptyTabText}>Nenhum programa atribuído a este paciente.</Text></View>;

    return (
        <ScrollView style={styles.tabContent}>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Analisar Programa</Text>
                <View style={styles.pickerContainer}>
                    <Picker selectedValue={selectedProgramId} onValueChange={(itemValue) => setSelectedProgramId(itemValue)}>
                        {availablePrograms.map(prog => <Picker.Item key={prog.id} label={prog.name} value={prog.id} />)}
                    </Picker>
                </View>
            </View>

            <View style={styles.chartSection}>
                <Text style={styles.sectionTitle}>Progresso Geral do Programa</Text>
                <View style={styles.chartContainer}>
                    <ProgressChart chartData={generalChartData} programConfig={programConfig} />
                </View>
            </View>

            {programConfig?.targets?.map(targetName => {
                const targetChartData = filteredSessions.map(session => {
                    const trial = session.abaData.trialsData.find(t => t.target === targetName);
                    if (!trial?.attempts?.length) return null;
                    const correct = trial.attempts.filter(a => a.score === 1).length;
                    const accuracy = (correct / trial.attempts.length) * 100;
                    return {
                        value: accuracy,
                        label: new Date(session.dateTimeStart).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                        phase: session.abaData.phaseConducted,
                    };
                }).filter(Boolean);

                return (
                    <View key={targetName} style={styles.chartSection}>
                        <Text style={styles.sectionTitle}>{`Progresso do Alvo: "${targetName}"`}</Text>
                        <View style={styles.chartContainer}>
                            <ProgressChart chartData={targetChartData} programConfig={programConfig} />
                        </View>
                    </View>
                );
            })}
        </ScrollView>
    );
};

const TasksTab = ({ patientId, onAddTask }) => {
    // Futuramente, você buscará as tarefas do Firebase aqui.
    const tasks = []; // Placeholder

    return (
        <View style={styles.tabContent}>
            <TouchableOpacity style={styles.addTaskButton} onPress={onAddTask}>
                <MaterialIcons name="add" size={22} color={ABAETE_COLORS.primaryBlue} />
                <Text style={styles.addTaskButtonText}>Nova Tarefa para o Responsável</Text>
            </TouchableOpacity>
            {tasks.length === 0 ? (
                <Text style={styles.emptyTabText}>Nenhuma tarefa de casa atribuída.</Text>
            ) : (
                <Text>Lista de tarefas aqui...</Text>
            )}
        </View>
    );
};

const FeedTab = ({ patientId }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!patientId) { setLoading(false); return; }
        const feedRef = ref(FIREBASE_DB, `patientFeeds/${patientId}`);
        const q = query(feedRef, orderByChild('createdAt'));
        const unsubscribe = onValue(q, (snapshot) => {
            if (!snapshot.exists()) { setPosts([]); setLoading(false); return; }
            const postsData = [];
            snapshot.forEach(postNode => postsData.push({ id: postNode.key, ...postNode.val() }));
            setPosts(postsData.reverse());
            setLoading(false);
        }, (error) => { console.error("Erro ao buscar feed:", error); setLoading(false); });
        return () => unsubscribe();
    }, [patientId]);
    
    if (loading) return <ActivityIndicator style={{ marginTop: 40 }} size="large" color={ABAETE_COLORS.primaryBlue} />;

    // AGORA O FEED RETORNA A LISTA COMPLETA, NÃO SÓ O CONTEÚDO
    return (
        <FlatList
            data={posts}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <PostItem post={item} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.tabContent} // Aplica o padding
            ListEmptyComponent={<Text style={styles.emptyTabText}>Nenhuma publicação neste feed.</Text>}
        />
    );
};

const PostItem = ({ post }) => {
    const [author, setAuthor] = useState(null);
    const [commentsVisible, setCommentsVisible] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [isImageModalVisible, setImageModalVisible] = useState(false);
    const [selectedImageUri, setSelectedImageUri] = useState(null);
    
    // useEffect para buscar o autor (permanece igual)
    useEffect(() => {
        let isMounted = true;
        if (post.authorId) {
            getCachedUserData(post.authorId).then(userData => {
                if (isMounted) setAuthor(userData);
            });
        }
        return () => { isMounted = false; };
    }, [post.authorId]);

    // useEffect para carregar comentários quando a seção for aberta
    useEffect(() => {
        if (commentsVisible) {
            const commentsRef = query(ref(FIREBASE_DB, `patientFeeds/${post.patientId}/${post.id}/comments`), orderByChild('createdAt'));
            
            const unsubscribe = onValue(commentsRef, async (snapshot) => {
                if (snapshot.exists()) {
                    // Mapeia as promessas para buscar os dados de cada autor de comentário
                    const commentsPromises = Object.values(snapshot.val()).map(async (comment) => ({
                        ...comment,
                        author: await getCachedUserData(comment.authorId)
                    }));
                    const resolvedComments = await Promise.all(commentsPromises);
                    setComments(resolvedComments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
                } else {
                    setComments([]);
                }
            });
            return () => unsubscribe(); // Limpa o listener ao desmontar ou fechar
        }
    }, [commentsVisible, post.id, post.patientId]);

    const openImageModal = (uri) => {
        setSelectedImageUri(uri);
        setImageModalVisible(true);
    };

    const handleToggleLike = async () => {
        const currentUserId = FIREBASE_AUTH.currentUser?.uid;
        if (!currentUserId) return;
        const likeRef = ref(FIREBASE_DB, `patientFeeds/${post.patientId}/${post.id}/likes/${currentUserId}`);
        const snapshot = await get(likeRef);
        snapshot.exists() ? remove(likeRef) : firebaseSet(likeRef, true);
    };

    const handleAddComment = async () => {
        const currentUserId = FIREBASE_AUTH.currentUser?.uid;
        if (!commentText.trim() || !currentUserId) return;
        const newCommentRef = push(ref(FIREBASE_DB, `patientFeeds/${post.patientId}/${post.id}/comments`));
        await firebaseSet(newCommentRef, {
            text: commentText.trim(),
            authorId: currentUserId,
            createdAt: new Date().toISOString(),
        });
        setCommentText('');
        Keyboard.dismiss();
    };

    if (!author) { return <View style={[styles.postCard, { height: 120 }]}><ActivityIndicator /></View>; }

    const authorName = author.displayName || author.fullName || 'Usuário';
    const likesCount = post.likes ? Object.keys(post.likes).length : 0;
    const commentsCount = post.comments ? Object.keys(post.comments).length : 0;
    const isLiked = post.likes && FIREBASE_AUTH.currentUser && post.likes[FIREBASE_AUTH.currentUser.uid];

    return (
        <View style={styles.postCard}>
            <View style={styles.postHeader}>
                <Image source={{ uri: author.profilePicture || `https://ui-avatars.com/api/?name=${authorName.replace(' ', '+')}` }} style={styles.postAvatar} />
                <View><Text style={styles.postAuthorName}>{authorName}</Text><Text style={styles.postTimestamp}>{timeAgo(post.createdAt)}</Text></View>
            </View>
            <Text style={styles.postText}>{post.text}</Text>

            {/* SEÇÃO DE MÍDIA ADICIONADA */}
            {post.media && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.postMediaContainer}>
                    {Object.values(post.media).map((mediaFile, index) => (
                        <TouchableOpacity key={index} onPress={() => mediaFile.type === 'image' && openImageModal(mediaFile.url)}>
                            {mediaFile.type === 'image' ? (
                                <Image source={{ uri: mediaFile.url }} style={styles.mediaItem} />
                            ) : mediaFile.type === 'video' ? (
                                <Video source={{ uri: mediaFile.url }} style={styles.mediaItem} useNativeControls resizeMode="cover" />
                            ) : null}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Ações do Post */}
            <View style={styles.postActions}>
                <TouchableOpacity style={styles.actionButton} onPress={handleToggleLike}>
                    <MaterialIcons name={isLiked ? "thumb-up" : "thumb-up-off-alt"} size={22} color={isLiked ? ABAETE_COLORS.primaryBlue : ABAETE_COLORS.textSecondary} />
                    <Text style={[styles.actionButtonText, isLiked && styles.actionButtonLiked]}>{likesCount > 0 ? likesCount : ''} Curtir</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => setCommentsVisible(!commentsVisible)}>
                    <MaterialIcons name="chat-bubble-outline" size={22} color={ABAETE_COLORS.textSecondary} />
                    <Text style={styles.actionButtonText}>{commentsCount > 0 ? commentsCount : ''} Comentar</Text>
                </TouchableOpacity>
            </View>

            {/* Seção de Comentários */}
            {commentsVisible && (
                <View style={styles.commentsSection}>
                    {comments.map((comment, index) => (
                        <View key={index} style={styles.commentItem}>
                            <View style={styles.commentAvatar}>
                                <Text style={styles.commentAvatarText}>{(comment.author.displayName || 'U').charAt(0)}</Text>
                            </View>
                            <View style={styles.commentContent}>
                                <Text style={styles.commentAuthor}>{comment.author.displayName}</Text>
                                <Text style={styles.commentText}>{comment.text}</Text>
                            </View>
                        </View>
                    ))}
                    <View style={styles.commentInputContainer}>
                        <TextInput style={styles.commentInput} placeholder="Adicione um comentário..." value={commentText} onChangeText={setCommentText} />
                        <TouchableOpacity style={styles.sendCommentButton} onPress={handleAddComment}>
                            <MaterialIcons name="send" size={24} color={ABAETE_COLORS.primaryBlue} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* MODAL DE IMAGEM ADICIONADO */}
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

const timeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return `Há ${Math.floor(interval)} anos`;
    interval = seconds / 2592000;
    if (interval > 1) return `Há ${Math.floor(interval)} meses`;
    interval = seconds / 86400;
    if (interval > 1) return `Há ${Math.floor(interval)} dias`;
    interval = seconds / 3600;
    if (interval > 1) return `Há ${Math.floor(interval)} horas`;
    interval = seconds / 60;
    if (interval > 1) return `Há ${Math.floor(interval)} minutos`;
    return "Agora";
};

export const PatientDetailScreen = ({ route, navigation }) => {
    const { patientId } = route.params;
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [isTaskModalVisible, setTaskModalVisible] = useState(false);

    useEffect(() => {
        const patientRef = ref(FIREBASE_DB, `users/${route.params.patientId}`);
        const unsubscribe = onValue(patientRef, (snapshot) => {
            if(snapshot.exists()) {
                const data = snapshot.val();
                const age = data.birthday ? new Date().getFullYear() - new Date(data.birthday).getFullYear() : null;
                setPatient({ id: route.params.patientId, ...data, age });
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [route.params.patientId]);


    // Componente do Cabeçalho para a FlatList
    const renderHeader = () => (
        <>
            <View style={styles.profileHeader}>
                <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
                    <MaterialIcons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <View style={styles.profileInfo}>
                    <Image
                        source={{ uri: patient.profilePicture || `https://ui-avatars.com/api/?name=${patient.fullName.replace(' ', '+')}&background=eaf1fe&color=367BF5&font-size=0.4` }}
                        style={styles.profileImage}
                    />
                    <Text style={styles.profileName}>{patient.displayName}</Text>
                    <Text style={styles.profileStatus}>{patient.status === 'active' ? 'Ativo' : 'Inativo'}</Text>
                </View>
                <TouchableOpacity style={styles.headerButton} onPress={() => { /* sua função handleShare */ }}>
                    <MaterialIcons name="share" size={24} color="white" />
                </TouchableOpacity>
            </View>
            <View style={styles.tabNavContainer}>
                {/* As abas agora fazem parte do cabeçalho */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabNav}>
                    {[
                        { id: 'overview', label: 'Visão Geral' },
                        { id: 'progress', label: 'Progresso' },
                        { id: 'tasks', label: 'Tarefas' },
                        { id: 'feed', label: 'Feed' },
                    ].map(tab => (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]}
                            onPress={() => setActiveTab(tab.id)}
                        >
                            <Text style={[styles.tabButtonText, activeTab === tab.id && styles.tabButtonTextActive]}>{tab.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </>
    );

    if (loading) { return <View style={styles.centered}><ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} /></View>; }
    if (!patient) { return <View style={styles.centered}><Text>Paciente não encontrado.</Text></View>; }

    // AS ABAS QUE NÃO SÃO LISTAS SÃO ENVOLVIDAS EM UM ÚNICO ITEM DE DADOS PARA A FLATLIST
    const nonListData = [{ key: 'content' }];
    
    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar style="light" />
            {activeTab === 'feed' ? (
                <>
                    {renderHeader()}
                    <FeedTab patientId={patient.id} />
                </>
            ) : (
                <FlatList
                    data={nonListData}
                    keyExtractor={item => item.key}
                    ListHeaderComponent={renderHeader}
                    renderItem={() => {
                        switch (activeTab) {
                            case 'overview': return <OverviewTab patient={patient} />;
                            case 'progress': return <ProgressTab patient={patient} />; // Passa o objeto 'patient' completo
                            case 'tasks': return <TasksTab patientId={patient.id} onAddTask={() => setTaskModalVisible(true)} />;
                            default: return null;
                        }
                    }}
                />
            )}
            <AddTaskModal visible={isTaskModalVisible} onClose={() => setTaskModalVisible(false)} patientId={patient.id} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    safeArea: { flex: 1, backgroundColor: ABAETE_COLORS.backgroundMain },
    profileHeader: {
        backgroundColor: ABAETE_COLORS.primaryBlue,
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerButton: {
        padding: 8,
    },
    profileInfo: {
        alignItems: 'center',
        marginTop: -10,
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    profileName: {
        fontFamily: FONT_FAMILY.Bold,
        fontSize: 22,
        color: 'white',
        marginTop: 12,
    },
    profileStatus: {
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 14,
        color: 'white',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 15,
        marginTop: 8,
        textTransform: 'capitalize',
    },
    tabNavContainer: {
        backgroundColor: ABAETE_COLORS.backgroundMain, // Para o efeito sticky funcionar
    },
    tabNav: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: ABAETE_COLORS.lightGray,
    },
    tabButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        marginRight: 10,
    },
    tabButtonActive: {
        backgroundColor: ABAETE_COLORS.primaryBlue,
    },
    tabButtonText: {
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 14,
        color: ABAETE_COLORS.textSecondary,
    },
    tabButtonTextActive: {
        color: 'white',
    },
    tabContent: {
        padding: 16,
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        margin: -8, /* Negativo para alinhar com as bordas do padding */
    },
    infoCard: {
        width: '50%',
        padding: 8,
    },
    infoCardContent: {
        backgroundColor: ABAETE_COLORS.white,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: ABAETE_COLORS.lightGray,
    },
    infoCardLabel: {
        fontFamily: FONT_FAMILY.Regular,
        fontSize: 13,
        color: ABAETE_COLORS.textSecondary,
        marginTop: 8,
    },
    infoCardValue: {
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 15,
        color: ABAETE_COLORS.textPrimary,
        marginTop: 4,
    },
    section: {
        backgroundColor: ABAETE_COLORS.white,
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
        borderWidth: 1,
        borderColor: ABAETE_COLORS.lightGray,
    },
    sectionTitle: {
        fontFamily: FONT_FAMILY.Bold,
        fontSize: 16,
        color: ABAETE_COLORS.textPrimary,
        marginBottom: 10,
    },
    sectionText: {
        fontFamily: FONT_FAMILY.Regular,
        fontSize: 14,
        color: ABAETE_COLORS.textSecondary,
        lineHeight: 22,
    },
    emptyTabText: {
        textAlign: 'center',
        marginTop: 40,
        fontFamily: FONT_FAMILY.Regular,
        color: ABAETE_COLORS.textSecondary,
    },
    programCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: ABAETE_COLORS.lightGray,
        marginBottom: 12,
    },
    programTitle: {
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 16,
        color: ABAETE_COLORS.textPrimary,
        marginBottom: 4,
    },
    programPhase: {
        fontFamily: FONT_FAMILY.Regular,
        fontSize: 14,
        color: ABAETE_COLORS.textSecondary,
    },
    startSessionButton: {
        backgroundColor: ABAETE_COLORS.primaryBlue,
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    startSessionButtonText: {
        color: 'white',
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 14,
        marginLeft: 4,
    },
    addTaskButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ABAETE_COLORS.primaryBlueLight,
        padding: 15,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: ABAETE_COLORS.primaryBlue
    },
    addTaskButtonText: {
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 16,
        color: ABAETE_COLORS.primaryBlue,
        marginLeft: 8,
    },
    // Estilos para o Feed (reaproveitados do seu ProfHomeScreen.js)
    postCard: { backgroundColor: ABAETE_COLORS.white, borderRadius: 12, marginBottom: 15, padding: 15, borderWidth: 1, borderColor: ABAETE_COLORS.lightGray, },
    postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, },
    postAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10, backgroundColor: ABAETE_COLORS.lightGray, },
    postAuthorName: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 15, color: ABAETE_COLORS.textPrimary, },
    postTimestamp: { fontFamily: FONT_FAMILY.Regular, fontSize: 12, color: ABAETE_COLORS.mediumGray, },
    postText: { fontFamily: FONT_FAMILY.Regular, fontSize: 15, color: ABAETE_COLORS.textPrimary, lineHeight: 22 },
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
        borderRadius: 8,
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
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    commentInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
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
    sessionCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: ABAETE_COLORS.lightGray,
        marginBottom: 12,
    },
    sessionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    sessionDate: {
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 14,
        color: ABAETE_COLORS.textSecondary,
    },
    accuracyBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
    },
    accuracyGood: {
        backgroundColor: '#dcfce7', // Verde claro
    },
    accuracyRegular: {
        backgroundColor: '#fef3c7', // Amarelo claro
    },
    accuracyText: {
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 12,
        color: '#166534', // Verde escuro (bom) ou #92400e (amarelo escuro)
    },
    sessionProgramName: {
        fontFamily: FONT_FAMILY.Bold,
        fontSize: 16,
        color: ABAETE_COLORS.textPrimary,
        marginBottom: 8,
    },
    sessionNotes: {
        fontFamily: FONT_FAMILY.Regular,
        fontSize: 14,
        color: ABAETE_COLORS.textSecondary,
        lineHeight: 20,
    },
    filterContainer: {
        flexDirection: 'row',
        paddingVertical: 10,
        marginBottom: 20,
    },
    filterChip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#e9ecef',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#e9ecef'
    },
    filterChipActive: {
        backgroundColor: ABAETE_COLORS.primaryBlueLight,
        borderColor: ABAETE_COLORS.primaryBlue,
    },
    filterChipText: {
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 14,
        color: ABAETE_COLORS.textSecondary,
    },
    filterChipTextActive: {
        color: ABAETE_COLORS.primaryBlue,
    },
    chartContainer: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        height: 280, // Altura fixa para o gráfico
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: ABAETE_COLORS.lightGray
    },
    emptyChartContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    programPhaseBadge: {
        backgroundColor: ABAETE_COLORS.primaryBlueLight,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 15,
    },
    programPhaseText: {
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 13,
        color: ABAETE_COLORS.primaryBlue,
        textTransform: 'capitalize',
    },
    subsectionTitle: {
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 14,
        color: ABAETE_COLORS.textSecondary,
        marginTop: 20,
        marginBottom: 10,
        paddingBottom: 5,
        borderBottomWidth: 1,
        borderBottomColor: ABAETE_COLORS.lightGray,
    },
    sessionListItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    emptyTabTextSmall: {
        textAlign: 'center',
        marginTop: 20,
        fontFamily: FONT_FAMILY.Regular,
        color: ABAETE_COLORS.textSecondary,
        fontSize: 14,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: ABAETE_COLORS.lightGray,
        borderRadius: 8,
        marginBottom: 10,
        backgroundColor: ABAETE_COLORS.white,
    },
    chartSection: {
        backgroundColor: ABAETE_COLORS.white,
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
        borderWidth: 1,
        borderColor: ABAETE_COLORS.lightGray,
    },
    chartContainer: {
        height: 280, // Altura ajustada
        justifyContent: 'center',
        paddingTop: 20, // Espaço para o gráfico respirar
    },
    emptyChartContainer: {
        height: 220,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    // Estilos para o Picker em ProgressTab
    pickerContainer: {
        borderWidth: 1,
        borderColor: ABAETE_COLORS.lightGray,
        borderRadius: 8,
        marginBottom: 10,
        backgroundColor: ABAETE_COLORS.white,
    },

    // Estilos para os Gráficos em ProgressTab
    chartSection: {
        backgroundColor: ABAETE_COLORS.white,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 8, // Menos padding horizontal para o gráfico
        marginTop: 16,
        borderWidth: 1,
        borderColor: ABAETE_COLORS.lightGray,
    },
    chartContainer: {
        height: 280,
        justifyContent: 'center',
        marginTop: 10,
    },
    emptyChartContainer: {
        height: 220,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },

    // Estilos para a Mídia no Feed (copiados de ProfHome)
    postMediaContainer: {
        marginTop: 10,
        marginBottom: 10,
        height: 200, 
    },
    mediaItem: {
        width: 280,
        height: 200,
        borderRadius: 8,
        marginRight: 10,
        backgroundColor: '#e9ecef',
    },
    imageModalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageModalContent: {
        width: '100%',
        height: '80%',
    },
    closeModalButton: {
        position: 'absolute',
        top: 60,
        right: 20,
        zIndex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
        padding: 8,
    },
});