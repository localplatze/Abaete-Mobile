import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image, FlatList, Platform, TextInput, ActivityIndicator, Alert, Modal, Keyboard } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';
import { FIREBASE_AUTH, FIREBASE_DB } from './../services/firebaseConnection';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Video } from 'expo-av';
import { getCachedUserData } from './../services/userCache';
import { ref, onValue, get, query, orderByChild, equalTo, off, push, set as firebaseSet, remove } from 'firebase/database';

const getTodaysDateString = () => {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  return `${day}/${month}/${year}`;
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

const AddAppointmentModal = ({ visible, onClose, onSave, professionalId, patients }) => {
  const [patientId, setPatientId] = useState('');
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [type, setType] = useState('Sessão ABA');
  const [isSaving, setIsSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Novos estados para o programa
  const [assignedPrograms, setAssignedPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');

  // Efeito para buscar os programas do paciente selecionado
  useEffect(() => {
    if (patientId && type === 'Sessão ABA') {
      const programsRef = ref(FIREBASE_DB, `users/${patientId}/assignedPrograms`);
      const unsubscribe = onValue(programsRef, (snapshot) => {
        const programs = [];
        if (snapshot.exists()) {
          snapshot.forEach(child => {
            programs.push({ id: child.key, ...child.val() });
          });
        }
        setAssignedPrograms(programs);
      });
      return () => unsubscribe();
    } else {
      setAssignedPrograms([]);
      setSelectedProgramId('');
    }
  }, [patientId, type]);

  const handleSavePress = async () => {
    Keyboard.dismiss();
    if (!patientId) { Alert.alert("Campo Obrigatório", "Por favor, selecione um paciente."); return; }
    if (type === 'Sessão ABA' && !selectedProgramId) {
      Alert.alert("Campo Obrigatório", "Por favor, selecione um programa para a Sessão ABA."); return;
    }

    setIsSaving(true);
    const combinedDateTime = new Date(scheduleDate.getFullYear(), scheduleDate.getMonth(), scheduleDate.getDate(), startTime.getHours(), startTime.getMinutes());
    
    const appointmentData = {
      patientId, professionalId, scheduleDate: scheduleDate.toLocaleDateString('pt-BR'),
      dateTimeStart: combinedDateTime.toISOString(), type, status: 'scheduled',
      createdBy: professionalId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

    // Adiciona dados do programa se for uma Sessão ABA
    if (type === 'Sessão ABA' && selectedProgramId) {
        appointmentData.programId = selectedProgramId;
        const program = assignedPrograms.find(p => p.id === selectedProgramId);
        appointmentData.programName = program?.name || 'Programa não encontrado';
    }

    await onSave(appointmentData);
    setIsSaving(false);
  };

  const onChangeDate = (event, selectedDate) => { setShowDatePicker(false); if (selectedDate) setScheduleDate(selectedDate); };
  const onChangeTime = (event, selectedTime) => { setShowTimePicker(false); if (selectedTime) setStartTime(selectedTime); };

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Novo Agendamento</Text>
          <ScrollView>
            <Text style={styles.modalLabel}>Paciente</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={patientId} onValueChange={(itemValue) => setPatientId(itemValue)}>
                <Picker.Item label="Selecione um paciente..." value="" />
                {patients.map(p => (<Picker.Item key={p.id} label={p.fullName} value={p.id} />))}
              </Picker>
            </View>

            <Text style={styles.modalLabel}>Data</Text>
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}><Text>{scheduleDate.toLocaleDateString('pt-BR')}</Text></TouchableOpacity>
            {showDatePicker && (<DateTimePicker value={scheduleDate} mode="date" display="default" onChange={onChangeDate} />)}
            
            <Text style={styles.modalLabel}>Horário de Início</Text>
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowTimePicker(true)}><Text>{startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text></TouchableOpacity>
            {showTimePicker && (<DateTimePicker value={startTime} mode="time" display="default" is24Hour={true} onChange={onChangeTime} />)}
            
            <Text style={styles.modalLabel}>Tipo de Sessão</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={type} onValueChange={(itemValue) => setType(itemValue)}>
                <Picker.Item label="Sessão ABA" value="Sessão ABA" /><Picker.Item label="Avaliação" value="Avaliação" />
              </Picker>
            </View>
            
            {type === 'Sessão ABA' && patientId && (
              <>
                <Text style={styles.modalLabel}>Programa ABA</Text>
                <View style={styles.pickerContainer}>
                  <Picker selectedValue={selectedProgramId} onValueChange={(itemValue) => setSelectedProgramId(itemValue)}>
                    <Picker.Item label="Selecione um programa..." value="" />
                    {assignedPrograms.map(p => (<Picker.Item key={p.id} label={p.name} value={p.id} />))}
                  </Picker>
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.modalButtonContainer}>
            <TouchableOpacity style={styles.modalButtonSecondary} onPress={onClose}><Text style={styles.modalButtonSecondaryText}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalButtonPrimary, isSaving && styles.modalButtonDisabled]} onPress={handleSavePress} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color={ABAETE_COLORS.white} /> : <Text style={styles.modalButtonPrimaryText}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const phaseTranslations = {
    baseline: 'Linha de Base',
    intervention: 'Intervenção',
    maintenance: 'Manutenção',
    generalization: 'Generalização',
};

const ProfHomeAgendaContent = ({ navigation, professionalId }) => {
  const [processedAgenda, setProcessedAgenda] = useState([]); // <- Estado final para a FlatList
  const [allAppointments, setAllAppointments] = useState([]); // <- Estado para dados brutos de agendamentos
  const [availablePatients, setAvailablePatients] = useState([]); // <- Estado para dados brutos de pacientes
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // Efeito 1: Busca e mantém atualizados os dados brutos (pacientes e agendamentos)
  useEffect(() => {
    if (!professionalId) return;
    
    // Listener para pacientes
    const patientsQuery = query(ref(FIREBASE_DB, 'users'), orderByChild('role'), equalTo('patient'));
    const unsubscribePatients = onValue(patientsQuery, (snapshot) => {
      const patientsList = [];
      snapshot.forEach(child => {
        const patientData = { id: child.key, ...child.val() };
        if (patientData.assignedProfessionalIds?.includes(professionalId)) {
          patientsList.push(patientData);
        }
      });
      setAvailablePatients(patientsList);
    });

    // Listener para agendamentos
    const appointmentsQuery = query(ref(FIREBASE_DB, 'appointments'), orderByChild('professionalId'), equalTo(professionalId));
    const unsubscribeAppointments = onValue(appointmentsQuery, (snapshot) => {
      const appointmentsList = [];
      snapshot.forEach(child => {
        appointmentsList.push({ id: child.key, ...child.val() });
      });
      setAllAppointments(appointmentsList);
    });

    return () => {
      unsubscribePatients();
      unsubscribeAppointments();
    };
  }, [professionalId]);

  // Efeito 2: Processa os dados SEMPRE que os dados brutos (pacientes OU agendamentos) mudarem.
  useEffect(() => {
    // Só processa se tivermos pacientes carregados para evitar dados incompletos.
    if (availablePatients.length > 0) {
      const todayStr = getTodaysDateString();

      const todayAppointments = allAppointments
        .filter(app => app.scheduleDate === todayStr && app.status === 'scheduled')
        .map(app => {
          const patientData = availablePatients.find(p => p.id === app.patientId);
          if (!patientData) return null; // Ignora o agendamento se o paciente não foi encontrado

          let programInfo = null;
          if (app.type === 'Sessão ABA' && app.programId && patientData.programProgress?.[app.programId]) {
            const progress = patientData.programProgress[app.programId];
            const programDetails = patientData.assignedPrograms?.[app.programId];
            const phaseKey = progress.currentPhase || 'Não iniciada';
            const phaseConfig = programDetails?.[phaseKey];

            if (phaseConfig) {
              const totalSessions = phaseConfig.sessions || 1;
              const completedSessions = progress.sessionHistory?.filter(s => s.phase === phaseKey).length || 0;
              programInfo = {
                phase: phaseTranslations[phaseKey] || phaseKey,
                sessionCount: `Sessão ${completedSessions + 1} de ${totalSessions}`
              };
            }
          }
          return { ...app, patientName: patientData.displayName, programInfo };
        })
        .filter(Boolean); // Remove quaisquer itens nulos

      todayAppointments.sort((a, b) => new Date(a.dateTimeStart) - new Date(b.dateTimeStart));
      setProcessedAgenda(todayAppointments);
    }
    setLoading(false);
  }, [allAppointments, availablePatients]); // Esta é a chave: reage a AMBAS as listas.

  const handleSaveAppointment = async (data) => {
    try {
      await firebaseSet(push(ref(FIREBASE_DB, 'appointments')), data);
      Alert.alert("Sucesso", "Agendamento criado com sucesso!");
      setModalVisible(false);
    } catch (error) { console.error("Erro:", error); Alert.alert("Erro", "Não foi possível salvar."); }
  };

  if (loading) { return <View style={styles.centered}><ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} /></View>; }

  return (
    <View style={styles.contentAreaClean}>
      <View style={styles.tabHeaderContainer}>
        <Text style={styles.pageTitleClean}>Agenda de Hoje</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Calendar', { professionalId })}>
          <MaterialIcons name="calendar-today" size={26} color={ABAETE_COLORS.primaryBlue} />
        </TouchableOpacity>
      </View>
      <FlatList 
        data={processedAgenda} 
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainerClean}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.agendaCardClean} onPress={() => {
              if (item.type === 'Sessão ABA') {
                navigation.navigate('NewAba', { 
                  appointmentId: item.id, patientId: item.patientId, patientName: item.patientName,
                  professionalId: professionalId, programId: item.programId
                });
              }
            }}>
            <View style={styles.agendaCardTime}>
              <Text style={styles.agendaHourText}>{new Date(item.dateTimeStart).toLocaleTimeString('pt-BR', { hour: '2-digit' })}</Text>
              <Text style={styles.agendaMinuteText}>{new Date(item.dateTimeStart).toLocaleTimeString('pt-BR', { minute: '2-digit' })}</Text>
            </View>
            <View style={styles.agendaCardDivider} />
            <View style={styles.agendaCardDetails}>
              <Text style={styles.agendaCardPaciente}>{item.patientName}</Text>
              {item.type === 'Sessão ABA' ? (
                <>
                  <Text style={styles.agendaCardProgramName}>{item.programName}</Text>
                  {item.programInfo && (<Text style={styles.agendaCardProgramInfo}>{item.programInfo.phase} • {item.programInfo.sessionCount}</Text>)}
                </>
              ) : (<Text style={styles.agendaCardTipo}>{item.type}</Text>)}
              <View style={styles.agendaCardActions}>
                <TouchableOpacity style={styles.actionChip} onPress={(e) => { e.stopPropagation(); navigation.navigate('PatientDetail', { patientId: item.patientId }); }}>
                    <MaterialIcons name="person-search" size={18} color={ABAETE_COLORS.secondaryBlue} />
                    <Text style={styles.actionChipText}>Paciente</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptySectionText}>Nenhum agendamento para hoje.</Text>}
        ListFooterComponent={<View style={{ height: 80 }} />}
      />
      <TouchableOpacity style={styles.fabClean} onPress={() => setModalVisible(true)}>
          <MaterialIcons name="add" size={30} color={ABAETE_COLORS.white} />
      </TouchableOpacity>
      <AddAppointmentModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
        onSave={handleSaveAppointment} 
        professionalId={professionalId} 
        patients={availablePatients} 
      />
    </View>
  );
};

const ProfPacientesContent = ({ navigation, professionalId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!professionalId) return;
    setLoading(true);
    const usersRef = query(ref(FIREBASE_DB, 'users'), orderByChild('role'), equalTo('patient'));
    const listener = onValue(usersRef, async (snapshot) => {
      if (!snapshot.exists()) { setPacientes([]); setLoading(false); return; }
      const matchingPatients = [];
      snapshot.forEach(child => { const patientData = { id: child.key, ...child.val() }; if (Array.isArray(patientData.assignedProfessionalIds) && patientData.assignedProfessionalIds.includes(professionalId)) { matchingPatients.push(patientData); } });
      if (matchingPatients.length === 0) { setPacientes([]); setLoading(false); return; }
      const patientsPromises = matchingPatients.map(async (patient) => {
        try {
          const appointmentsRef = query(ref(FIREBASE_DB, 'appointments'), orderByChild('patientId'), equalTo(patient.id));
          const appSnapshot = await get(appointmentsRef);
          let nextSession = 'Nenhuma sessão futura';
          if (appSnapshot.exists()) {
            const now = new Date(); const futureApps = [];
            appSnapshot.forEach(appChild => { const appData = appChild.val(); if (appData.professionalId === professionalId && new Date(appData.dateTimeStart) > now) { futureApps.push(appData); } });
            if (futureApps.length > 0) {
              futureApps.sort((a, b) => new Date(a.dateTimeStart) - new Date(b.dateTimeStart));
              const date = new Date(futureApps[0].dateTimeStart);
              nextSession = `${date.toLocaleDateString('pt-BR')} - ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            }
          } return { ...patient, nextSession };
        } catch (error) { console.error(`Falha para paciente ${patient.id}:`, error); return { ...patient, nextSession: 'Erro ao carregar' }; }
      });
      const resolvedPatients = await Promise.all(patientsPromises);
      setPacientes(resolvedPatients);
      setLoading(false);
    });
    return () => off(usersRef, 'value', listener);
  }, [professionalId]);

  const filteredPacientes = pacientes.filter(p => p.fullName && p.fullName.toLowerCase().includes(searchQuery.toLowerCase()));
  if (loading) { return <View style={styles.centered}><ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} /></View>; }
  
  return (
    <View style={styles.contentAreaClean}>
      <View style={styles.tabHeaderContainer}><Text style={styles.pageTitleClean}>Meus Pacientes</Text></View>
      <View style={styles.searchBarContainer}>
        <MaterialIcons name="search" size={22} color={ABAETE_COLORS.mediumGray} style={styles.searchIcon} />
        <TextInput style={styles.searchInput} placeholder="Buscar paciente..." placeholderTextColor={ABAETE_COLORS.mediumGray} value={searchQuery} onChangeText={setSearchQuery} />
      </View>
      <FlatList data={filteredPacientes} keyExtractor={item => item.id} contentContainerStyle={styles.listContainerClean} showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.pacienteListItemClean} onPress={() => navigation.navigate('PatientDetail', { patientId: item.id })}>
            <Image source={{ uri: item.profilePicture || `https://via.placeholder.com/100?text=${item.fullName.charAt(0)}` }} style={styles.pacienteListImage} />
            <View style={styles.pacienteListInfo}>
              <Text style={styles.pacienteListName}>{item.fullName}</Text>
              <Text style={styles.pacienteListNextSession}>Próxima: {item.nextSession}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={26} color={ABAETE_COLORS.mediumGray} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptySectionText}>Nenhum paciente encontrado.</Text>}
      />
    </View>
  );
};

const ProfFeedContent = ({ navigation, professionalId }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState('');
    const [activeCommentPostId, setActiveCommentPostId] = useState(null);
    // --- NOVOS ESTADOS PARA O MODAL DE IMAGEM ---
    const [isImageModalVisible, setImageModalVisible] = useState(false);
    const [selectedImageUri, setSelectedImageUri] = useState(null);

    useEffect(() => {
        const feedsRef = ref(FIREBASE_DB, 'patientFeeds');
        const listener = onValue(feedsRef, async (snapshot) => {
            if (!snapshot.exists()) { setPosts([]); setLoading(false); return; }
            const allPostsPromises = [];
            snapshot.forEach(patientFeedNode => {
                const patientId = patientFeedNode.key;
                patientFeedNode.forEach(postNode => {
                    const postData = postNode.val();
                    allPostsPromises.push(
                        Promise.all([ getCachedUserData(postData.authorId), getCachedUserData(patientId) ])
                        .then(async ([author, patient]) => {
                            let commentsWithAuthors = [];
                            if (postData.comments) {
                                const commentPromises = Object.values(postData.comments).map(async (comment) => {
                                    const commentAuthor = await getCachedUserData(comment.authorId);
                                    return { ...comment, author: commentAuthor };
                                });
                                commentsWithAuthors = await Promise.all(commentPromises);
                                commentsWithAuthors.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
                            }
                            return { id: postNode.key, ...postData, author, patient, patientId, comments: commentsWithAuthors };
                        })
                    );
                });
            });
            const resolvedPosts = await Promise.all(allPostsPromises);
            resolvedPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setPosts(resolvedPosts);
            setLoading(false);
        });
        return () => off(feedsRef, 'value', listener);
    }, []);

    // --- NOVA FUNÇÃO PARA ABRIR O MODAL DE IMAGEM ---
    const openImageModal = (uri) => {
        setSelectedImageUri(uri);
        setImageModalVisible(true);
    };

    const handleToggleLike = async (patientId, postId) => {
        const likeRef = ref(FIREBASE_DB, `patientFeeds/${patientId}/${postId}/likes/${professionalId}`);
        const snapshot = await get(likeRef);
        if (snapshot.exists()) {
            remove(likeRef);
        } else {
            firebaseSet(likeRef, true);
        }
    };

    const handleAddComment = async (patientId, postId) => {
        if (!commentText.trim()) return;
        const newCommentRef = push(ref(FIREBASE_DB, `patientFeeds/${patientId}/${postId}/comments`));
        await firebaseSet(newCommentRef, {
            text: commentText.trim(),
            authorId: professionalId,
            createdAt: new Date().toISOString(),
        });
        setCommentText('');
        Keyboard.dismiss();
    };

    const renderPostItem = useCallback(({ item }) => {
        const likesCount = item.likes ? Object.keys(item.likes).length : 0;
        const isLiked = item.likes && item.likes[professionalId];
        
        return (
            <View style={styles.postCard}>
                <View style={styles.postHeader}>
                    <Image source={{ uri: item.author.profilePicture || `https://via.placeholder.com/100?text=${item.author.displayName.charAt(0)}` }} style={styles.postAvatar} />
                    <View style={styles.postAuthorInfo}><Text style={styles.postAuthorName}>{item.author.displayName}</Text><Text style={styles.postPatientName}>para <Text style={{ fontFamily: FONT_FAMILY.SemiBold }}>{item.patient.displayName}</Text></Text></View>
                    <Text style={styles.postTimestamp}>{timeAgo(item.createdAt)}</Text>
                </View>

                <Text style={styles.postText}>{item.text}</Text>

                {/* --- MÍDIA RENDERIZADA EM UM SCROLL HORIZONTAL --- */}
                {item.media && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.postMediaContainer}>
                        {Object.values(item.media).map(mediaFile => (
                            <TouchableOpacity key={mediaFile.url} onPress={() => mediaFile.type === 'image' && openImageModal(mediaFile.url)}>
                                {mediaFile.type === 'image' ? (
                                    <Image source={{ uri: mediaFile.url }} style={styles.mediaItem} />
                                ) : mediaFile.type === 'video' ? (
                                    <Video source={{ uri: mediaFile.url }} style={styles.mediaItem} useNativeControls resizeMode="cover" />
                                ) : null}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
                
                <View style={styles.postActions}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleToggleLike(item.patientId, item.id)}>
                        <MaterialIcons name={isLiked ? "thumb-up" : "thumb-up-off-alt"} size={22} color={isLiked ? ABAETE_COLORS.primaryBlue : ABAETE_COLORS.textSecondary} />
                        <Text style={[styles.actionButtonText, isLiked && styles.actionButtonLiked]}>{likesCount} Curtir</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => setActiveCommentPostId(activeCommentPostId === item.id ? null : item.id)}>
                        <MaterialIcons name="chat-bubble-outline" size={22} color={ABAETE_COLORS.textSecondary} />
                        <Text style={styles.actionButtonText}>{item.comments.length} Comentar</Text>
                    </TouchableOpacity>
                </View>

                {activeCommentPostId === item.id && (
                    <View style={styles.commentsSection}>
                        {item.comments.map((comment, index) => (
                            <View key={index} style={styles.commentItem}>
                                <View style={styles.commentAvatar}><Text style={styles.commentAvatarText}>{(comment.author.displayName || 'U').charAt(0)}</Text></View>
                                <View style={styles.commentContent}>
                                    <Text style={styles.commentAuthor}>{comment.author.displayName}</Text>
                                    <Text style={styles.commentText}>{comment.text}</Text>
                                </View>
                            </View>
                        ))}
                        <View style={styles.commentInputContainer}>
                            <TextInput
                                style={styles.commentInput}
                                placeholder="Adicione um comentário..."
                                value={commentText}
                                onChangeText={setCommentText}
                            />
                            <TouchableOpacity style={styles.sendCommentButton} onPress={() => handleAddComment(item.patientId, item.id)}>
                                <MaterialIcons name="send" size={24} color={ABAETE_COLORS.primaryBlue} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        );
    }, [posts, activeCommentPostId, commentText, professionalId]);

    if (loading) { return <View style={styles.centered}><ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} /></View>; }
    
    return (
        <View style={styles.contentAreaClean}>
            <View style={styles.tabHeaderContainer}><Text style={styles.pageTitleClean}>Comunidade ABA</Text></View>
            <FlatList
                data={posts}
                keyExtractor={(item) => item.id}
                renderItem={renderPostItem}
                contentContainerStyle={styles.listContainerClean}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={styles.emptySectionText}>Nenhuma publicação na comunidade.</Text>}
            />
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

const ProfPerfilContent = ({ navigation, professional, onLogout }) => (
  <ScrollView style={styles.contentScrollViewClean} contentContainerStyle={styles.contentContainerClean}>
    <View style={styles.profileHeaderClean}>
      <Image source={{ uri: professional.profilePicture || 'https://via.placeholder.com/100?text=DR' }} style={styles.profileImageClean} />
      <Text style={styles.profileNameClean}>{professional.fullName || 'Nome'}</Text>
      <Text style={styles.profileEmailClean}>{professional.email}</Text>
      <Text style={styles.profileProfessionClean}>{professional.specialty || 'Especialidade'} | {professional.licenseNumber ? `Registro ${professional.licenseNumber}` : ''}</Text>
    </View>
    {[ { label: 'Editar Perfil', icon: 'edit', action: () => console.log('Editar Perfil') }, { label: 'Disponibilidade', icon: 'event-available', action: () => console.log('Disponibilidade') }, { label: 'Configurações', icon: 'settings', action: () => console.log('Configurações') }, { label: 'Ajuda & Suporte', icon: 'help-outline', action: () => console.log('Ajuda') },
    ].map(item => (
      <TouchableOpacity key={item.label} style={styles.profileMenuItemClean} onPress={item.action}>
        <MaterialIcons name={item.icon} size={24} color={ABAETE_COLORS.secondaryBlue} style={styles.profileMenuIcon} />
        <Text style={styles.profileMenuItemTextClean}>{item.label}</Text>
        <MaterialIcons name="chevron-right" size={24} color={ABAETE_COLORS.mediumGray} />
      </TouchableOpacity>
    ))}
    <TouchableOpacity style={[styles.profileMenuItemClean, { marginTop: 20 }]} onPress={onLogout}>
      <MaterialIcons name="logout" size={24} color={ABAETE_COLORS.errorRed} style={styles.profileMenuIcon} />
      <Text style={[styles.profileMenuItemTextClean, { color: ABAETE_COLORS.errorRed }]}>Sair</Text>
    </TouchableOpacity>
  </ScrollView>
);

export const ProfHomeScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('Agenda');
  const [professional, setProfessional] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agendaAppointments, setAgendaAppointments] = useState([]);
  const [availablePatients, setAvailablePatients] = useState([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(FIREBASE_AUTH, (user) => {
      if (user) {
        const userRef = ref(FIREBASE_DB, `users/${user.uid}`);
        const unsubscribeDb = onValue(userRef, (snapshot) => {
          if (snapshot.exists()) { setProfessional({ uid: user.uid, ...snapshot.val() }); }
          else { Alert.alert("Erro de Acesso", "Dados não encontrados.", [{ text: "OK", onPress: handleLogout }]); }
          setLoading(false);
        });
        return () => off(userRef, 'value', unsubscribeDb);
      } else { navigation.replace('Login'); }
    });
    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!professional) return;

    // 1. Busca todos os pacientes do profissional e os armazena
    const patientsQuery = query(ref(FIREBASE_DB, 'users'), orderByChild('role'), equalTo('patient'));
    const unsubscribePatients = onValue(patientsQuery, (snapshot) => {
      const patientsList = [];
      snapshot.forEach(child => {
        const patientData = { id: child.key, ...child.val() };
        if (patientData.assignedProfessionalIds?.includes(professional.uid)) {
          patientsList.push(patientData);
        }
      });
      setAvailablePatients(patientsList);
    });

    // 2. Busca todos os agendamentos do profissional
    const appointmentsQuery = query(ref(FIREBASE_DB, 'appointments'), orderByChild('professionalId'), equalTo(professional.uid));
    const unsubscribeAppointments = onValue(appointmentsQuery, (snapshot) => {
      const appointmentsList = [];
      snapshot.forEach(child => {
        appointmentsList.push({ id: child.key, ...child.val() });
      });
      setAgendaAppointments(appointmentsList);
    });

    return () => {
      unsubscribePatients();
      unsubscribeAppointments();
    };
  }, [professional]);

  const handleLogout = async () => { try { await signOut(FIREBASE_AUTH); navigation.replace('Login'); } catch (error) { console.error("Erro logout:", error); Alert.alert("Erro", "Não foi possível sair."); } };

  const renderContent = () => {
    if (loading || !professional) {
      return <View style={styles.centered}><ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} /></View>;
    }
    switch (activeTab) {
      case 'Agenda': 
        return <ProfHomeAgendaContent 
            navigation={navigation} 
            professionalId={professional.uid}
            appointments={agendaAppointments} // <-- Passa a lista de agendamentos
            patients={availablePatients}      // <-- Passa a lista de pacientes
        />;
      case 'Pacientes': return <ProfPacientesContent navigation={navigation} professionalId={professional.uid} />;
      case 'Comunidade': return <ProfFeedContent navigation={navigation} professionalId={professional.uid} />; // Nome atualizado
      case 'Perfil': return <ProfPerfilContent navigation={navigation} professional={professional} onLogout={handleLogout} />;
      default: return <ProfHomeAgendaContent navigation={navigation} professionalId={professional.uid} />;
    }
  };

  const tabs = [
    { name: 'Agenda', icon: 'event-note', label: 'Agenda' },
    { name: 'Pacientes', icon: 'groups', label: 'Pacientes' },
    { name: 'Comunidade', icon: 'dynamic-feed', label: 'Comunidade' },
    { name: 'Perfil', icon: 'account-circle', label: 'Perfil' },
  ];

  return (
    <SafeAreaView style={styles.safeAreaClean}>
      <StatusBar style="dark" backgroundColor={ABAETE_COLORS.white} />
      <View style={styles.headerClean}><Image source={require('../../assets/images/abaete_logo_hor.png')} style={styles.headerLogoClean} resizeMode="contain" /></View>
      <View style={{ flex: 1 }}>{renderContent()}</View>
      <View style={styles.bottomNavClean}>
        {tabs.map((tab) => (
          <TouchableOpacity key={tab.name} style={styles.navItemClean} onPress={() => setActiveTab(tab.name)}>
            <MaterialIcons name={tab.icon} size={28} color={activeTab === tab.name ? ABAETE_COLORS.primaryBlue : ABAETE_COLORS.mediumGray} />
            <Text style={[styles.navItemTextClean, { color: activeTab === tab.name ? ABAETE_COLORS.primaryBlue : ABAETE_COLORS.mediumGray, fontFamily: activeTab === tab.name ? FONT_FAMILY.SemiBold : FONT_FAMILY.Regular, }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: ABAETE_COLORS.white, },
  safeAreaClean: { flex: 1, backgroundColor: ABAETE_COLORS.white },
  headerClean: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 15, paddingBottom: 10, backgroundColor: ABAETE_COLORS.white, borderBottomWidth: 1, borderBottomColor: ABAETE_COLORS.lightGray, },
  headerLogoClean: { height: 38, width: 130 },
  contentAreaClean: { flex: 1, paddingHorizontal: 16, backgroundColor: ABAETE_COLORS.white },
  contentScrollViewClean: { flex: 1, backgroundColor: ABAETE_COLORS.white },
  contentContainerClean: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 },
  pageTitleClean: { fontFamily: FONT_FAMILY.Bold, fontSize: 26, color: ABAETE_COLORS.textPrimary, marginBottom: 5 },
  sectionTitleClean: { fontFamily: FONT_FAMILY.Bold, fontSize: 18, color: ABAETE_COLORS.textPrimary, marginBottom: 15, marginTop: 10 },
  emptySectionText: { fontFamily: FONT_FAMILY.Regular, fontSize: 15, color: ABAETE_COLORS.textSecondary, textAlign: 'center', marginTop: 20, paddingVertical: 20 },
  listItemClean: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: ABAETE_COLORS.lightGray },
  listItemIconContainer: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  listItemTextContainer: { flex: 1 },
  listItemTitle: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 15, color: ABAETE_COLORS.textPrimary, marginBottom: 2 },
  listItemSubtitle: { fontFamily: FONT_FAMILY.Regular, fontSize: 13, color: ABAETE_COLORS.textSecondary },
  profileHeaderClean: { alignItems: 'center', paddingVertical: 25, marginBottom: 20 },
  profileImageClean: { width: 110, height: 110, borderRadius: 55, marginBottom: 12, borderWidth: 3, borderColor: ABAETE_COLORS.primaryBlue },
  profileNameClean: { fontFamily: FONT_FAMILY.Bold, fontSize: 22, color: ABAETE_COLORS.textPrimary },
  profileEmailClean: { fontFamily: FONT_FAMILY.Regular, fontSize: 15, color: ABAETE_COLORS.textSecondary, marginTop: 4 },
  profileProfessionClean: { fontFamily: FONT_FAMILY.Regular, fontSize: 14, color: ABAETE_COLORS.secondaryBlue, marginTop: 2 },
  profileMenuItemClean: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: ABAETE_COLORS.lightGray },
  profileMenuIcon: { marginRight: 15 },
  profileMenuItemTextClean: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 16, color: ABAETE_COLORS.textPrimary, flex: 1 },
  bottomNavClean: { flexDirection: 'row', height: Platform.OS === 'ios' ? 80 : 70, paddingBottom: Platform.OS === 'ios' ? 15 : 0, backgroundColor: ABAETE_COLORS.white, borderTopWidth: 1, borderTopColor: ABAETE_COLORS.lightGray, alignItems: 'flex-start' },
  navItemClean: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 10 },
  navItemTextClean: { fontFamily: FONT_FAMILY.Regular, fontSize: 10, marginTop: 4 },
  yellowOpaco: { backgroundColor: 'rgba(255, 222, 128, 0.2)' },
  yellowDark: { color: '#FFA000' },
  tabHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingTop: 20 },
  listContainerClean: { paddingBottom: 20 },
  agendaCardClean: { flexDirection: 'row', backgroundColor: ABAETE_COLORS.white, borderRadius: 12, marginBottom: 15, padding: 15, borderWidth: 1, borderColor: ABAETE_COLORS.lightGray, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, },
  agendaCardTime: { alignItems: 'center', justifyContent: 'center', paddingRight: 15 },
  agendaHourText: { fontFamily: FONT_FAMILY.Bold, fontSize: 22, color: ABAETE_COLORS.primaryBlue },
  agendaMinuteText: { fontFamily: FONT_FAMILY.Regular, fontSize: 14, color: ABAETE_COLORS.secondaryBlue, marginTop: -2 },
  agendaCardDivider: { width: 2, backgroundColor: ABAETE_COLORS.yellow, marginRight: 15, borderRadius: 1 },
  agendaCardDetails: { flex: 1 },
  agendaCardPaciente: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 16, color: ABAETE_COLORS.textPrimary },
  agendaCardTipo: { fontFamily: FONT_FAMILY.Regular, fontSize: 14, color: ABAETE_COLORS.textSecondary, marginBottom: 8 },
  agendaCardActions: { flexDirection: 'row', marginTop: 8 },
  actionChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: ABAETE_COLORS.lightPink, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, marginRight: 10, },
  actionChipText: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 12, color: ABAETE_COLORS.secondaryBlue, marginLeft: 5 },
  fabClean: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: ABAETE_COLORS.primaryBlue, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: ABAETE_COLORS.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 10, paddingHorizontal: 12, marginBottom: 15, height: 48, },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: '100%', fontFamily: FONT_FAMILY.Regular, fontSize: 15, color: ABAETE_COLORS.textPrimary },
  pacienteListItemClean: { flexDirection: 'row', alignItems: 'center', backgroundColor: ABAETE_COLORS.white, padding: 15, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: ABAETE_COLORS.lightGray, },
  pacienteListImage: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: ABAETE_COLORS.lightGray },
  pacienteListInfo: { flex: 1 },
  pacienteListName: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 16, color: ABAETE_COLORS.textPrimary },
  pacienteListNextSession: { fontFamily: FONT_FAMILY.Regular, fontSize: 13, color: ABAETE_COLORS.textSecondary, marginTop: 2 },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)', },
  modalContent: { width: '90%', backgroundColor: ABAETE_COLORS.white, borderRadius: 12, padding: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, },
  modalTitle: { fontFamily: FONT_FAMILY.Bold, fontSize: 20, color: ABAETE_COLORS.primaryBlue, marginBottom: 20, textAlign: 'center', },
  modalLabel: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 14, color: ABAETE_COLORS.textSecondary, marginBottom: 5, marginTop: 10, },
  pickerContainer: { borderWidth: 1, borderColor: ABAETE_COLORS.lightGray, borderRadius: 8, marginBottom: 10, },
  dateInput: { borderWidth: 1, borderColor: ABAETE_COLORS.lightGray, borderRadius: 8, padding: 12, justifyContent: 'center', marginBottom: 10, },
  modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 25, },
  modalButtonPrimary: { backgroundColor: ABAETE_COLORS.primaryBlue, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flex: 1, marginLeft: 10, },
  modalButtonPrimaryText: { color: ABAETE_COLORS.white, fontFamily: FONT_FAMILY.SemiBold, fontSize: 15, },
  modalButtonSecondary: { backgroundColor: 'transparent', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: ABAETE_COLORS.mediumGray, alignItems: 'center', justifyContent: 'center', },
  modalButtonSecondaryText: { color: ABAETE_COLORS.textSecondary, fontFamily: FONT_FAMILY.SemiBold, fontSize: 15, },
  modalButtonDisabled: { backgroundColor: ABAETE_COLORS.mediumGray, },
  postCard: { backgroundColor: ABAETE_COLORS.white, borderRadius: 12, marginBottom: 15, padding: 15, borderWidth: 1, borderColor: ABAETE_COLORS.lightGray, },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, },
  postAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10, backgroundColor: ABAETE_COLORS.lightGray, },
  postAuthorInfo: { flex: 1, },
  postAuthorName: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 15, color: ABAETE_COLORS.textPrimary, },
  postPatientName: { fontFamily: FONT_FAMILY.Regular, fontSize: 13, color: ABAETE_COLORS.textSecondary, },
  postTimestamp: { fontFamily: FONT_FAMILY.Regular, fontSize: 12, color: ABAETE_COLORS.mediumGray, },
  postText: { fontFamily: FONT_FAMILY.Regular, fontSize: 15, color: ABAETE_COLORS.textPrimary, lineHeight: 22, marginBottom: 10, },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around', // Distribui os botões igualmente
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0', // Cor mais suave
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
    color: ABAETE_COLORS.primaryBlue, // Cor para quando está curtido
  },

  // Estilos para a seção de comentários
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
  postMediaContainer: {
    marginTop: 10,
    marginBottom: 10,
    // A altura agora é fixa para o carrossel
    height: 200, 
  },
  mediaItem: {
    width: 280, // Largura de cada item no carrossel
    height: 200,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#e9ecef',
  },
  
  // ADICIONE ESTES NOVOS ESTILOS PARA O MODAL DE IMAGEM:
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
    top: 50,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  agendaCardProgramName: {
    fontFamily: FONT_FAMILY.SemiBold,
    fontSize: 14,
    color: ABAETE_COLORS.secondaryBlue, // Cor de destaque para o programa
    marginBottom: 4,
  },
  agendaCardProgramInfo: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 13,
    color: ABAETE_COLORS.textSecondary,
    marginBottom: 8,
  },
});