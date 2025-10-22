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
import * as DocumentPicker from 'expo-document-picker';

const getTodaysDateString = () => {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  return `${day}/${month}/${year}`;
};

const timeAgo = (dateStr) => {
    // FIX: Add a check to prevent crashing on invalid date strings.
    if (!dateStr) return 'Data inválida';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Data inválida'; // Check if the date is valid

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

const getInitials = (name = '') => {
    if (!name) return '??';
    const names = name.split(' ');
    const first = names[0] ? names[0][0] : '';
    const last = names.length > 1 ? names[names.length - 1][0] : '';
    return `${first}${last}`.toUpperCase();
};

const phaseTranslations = {
    baseline: 'Linha de Base',
    intervention: 'Intervenção',
    maintenance: 'Manutenção',
    generalization: 'Generalização',
};

const ProfHomeAgendaContent = ({ navigation, professionalId }) => {
  const [todaysAgenda, setTodaysAgenda] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!professionalId) return;

    const schedulesRef = query(ref(FIREBASE_DB, 'schedules'), orderByChild('professionalId'), equalTo(professionalId));
    
    const unsubscribe = onValue(schedulesRef, async (snapshot) => {
        setLoading(true);
        if (!snapshot.exists()) {
            setTodaysAgenda([]);
            setLoading(false);
            return;
        }

        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=Domingo, 1=Segunda, ...

        let generatedAppointments = [];
        const patientDataCache = {};

        // Itera sobre cada regra de agendamento do profissional
        for (const scheduleId in snapshot.val()) {
            const schedule = { id: scheduleId, ...snapshot.val()[scheduleId] };

            // FIX: Add robust checks for startDate and endDate to prevent RangeError.
            // This is the most likely cause of the crash on the home screen.
            if (!schedule.startDate || !schedule.endDate) {
                console.warn(`Schedule rule ${scheduleId} is missing start or end date. Skipping.`);
                continue;
            }

            const ruleStartDate = new Date(schedule.startDate + 'T00:00:00');
            const ruleEndDate = new Date(schedule.endDate + 'T23:59:59');

            // Also check if the created dates are valid
            if (isNaN(ruleStartDate.getTime()) || isNaN(ruleEndDate.getTime())) {
                console.warn(`Schedule rule ${scheduleId} has invalid start or end date format. Skipping.`);
                continue;
            }

            if (today < ruleStartDate || today > ruleEndDate) continue;

            // 2. Verificar se há horários para o dia da semana atual na grade
            const timetableForDay = Array.isArray(schedule.weeklyTimetable)
                ? schedule.weeklyTimetable[dayOfWeek]
                : schedule.weeklyTimetable[dayOfWeek.toString()];
            
            if (timetableForDay) {
                for (const time of timetableForDay) {
                    const [hour, minute] = time.split(':');
                    const appointmentDateTime = new Date(today);
                    appointmentDateTime.setHours(parseInt(hour), parseInt(minute), 0, 0);

                    const exceptionKey = appointmentDateTime.toISOString().replace(/\./g, ',');
                    if (schedule.exceptions?.cancelled?.[exceptionKey]) continue;

                    if (!patientDataCache[schedule.patientId]) {
                        const patientSnap = await get(ref(FIREBASE_DB, `users/${schedule.patientId}`));
                        if (patientSnap.exists()) patientDataCache[schedule.patientId] = patientSnap.val();
                    }
                    const patientData = patientDataCache[schedule.patientId];
                    if (!patientData) continue;

                    generatedAppointments.push({
                        id: `${schedule.id}_${appointmentDateTime.getTime()}`,
                        dateTimeStart: appointmentDateTime.toISOString(),
                        type: schedule.type,
                        patientId: schedule.patientId,
                        patientName: patientData.displayName,
                        programId: schedule.programId,
                        programName: schedule.programName,
                        isVirtual: true,
                    });
                }
            }
        }
        
        generatedAppointments.sort((a, b) => new Date(a.dateTimeStart) - new Date(b.dateTimeStart));
        setTodaysAgenda(generatedAppointments);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [professionalId]);

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
        data={todaysAgenda} 
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainerClean}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.agendaCardClean} onPress={() => {
              if (item.type === 'Sessão ABA') {
                navigation.navigate('NewAba', { 
                  appointmentData: item,
                  patientId: item.patientId, 
                  patientName: item.patientName,
                  professionalId: professionalId, 
                  programId: item.programId
                });
              }
            }}>
            <View style={styles.agendaCardTime}>
              <Text style={styles.agendaHourText}>{String(new Date(item.dateTimeStart).getHours()).padStart(2, '0')}</Text>
              <Text style={styles.agendaMinuteText}>{String(new Date(item.dateTimeStart).getMinutes()).padStart(2, '0')}</Text>
            </View>
            <View style={styles.agendaCardDivider} />
            <View style={styles.agendaCardDetails}>
              <Text style={styles.agendaCardPaciente}>{item.patientName}</Text>
              {item.type === 'Sessão ABA' ? (
                <Text style={styles.agendaCardProgramName}>{item.programName || 'Programa ABA'}</Text>
              ) : (
                <Text style={styles.agendaCardTipo}>{item.type}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptySectionText}>Nenhum agendamento para hoje.</Text>}
        ListFooterComponent={<View style={{ height: 80 }} />}
      />
    </View>
  );
};

const EditProfileModal = ({ visible, onClose, user, onSave }) => {
    if (!visible) return null;

    const [activeTab, setActiveTab] = useState('pessoal');
    const [formData, setFormData] = useState({ 
        gender: 'prefer_not_say',
        status: 'active',
        ...user 
    });
    const [isSaving, setIsSaving] = useState(false);
    const [documents, setDocuments] = useState([]);

    useEffect(() => {
        const docsRef = ref(FIREBASE_DB, `users/${user.uid}/documents`);
        const unsubscribe = onValue(docsRef, (snapshot) => {
            const docs = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => docs.push({ id: child.key, ...child.val() }));
            }
            setDocuments(docs);
        });
        return () => unsubscribe();
    }, [user.uid]);

    const handleInputChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
    const handleSave = async () => {
        setIsSaving(true);
        await onSave(formData);
        setIsSaving(false);
    };
    
    const handlePickAndUpload = async (category) => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                multiple: true,
            });
    
            if (!result.canceled) {
                Alert.alert("Upload", `Enviando ${result.assets.length} arquivo(s)...`);
                for (const asset of result.assets) {
                    // Aqui entraria a sua lógica de upload para o Dropbox
                    // Esta é uma simulação, você precisa implementar a função real
                    console.log(`Simulando upload para Dropbox: ${asset.name}, Categoria: ${category}`);
                    // Exemplo: const sharedLink = await uploadToDropbox(asset.uri, ...);
                    // Depois de obter o link, salve no Firebase:
                    // const docData = { fileName: asset.name, category, dropboxSharedLink: sharedLink, uploadedAt: serverTimestamp() };
                    // await push(ref(FIREBASE_DB, `users/${user.uid}/documents`), docData);
                }
            }
        } catch (error) {
            console.error("Erro ao selecionar documento:", error);
            Alert.alert("Erro", "Não foi possível selecionar o documento.");
        }
    };

    const renderDocumentList = (category) => {
        const categoryDocs = documents.filter(doc => doc.category === category);
        if (categoryDocs.length === 0) {
            return <Text style={styles.emptySectionText}>Nenhum documento nesta categoria.</Text>
        }
        return categoryDocs.map(doc => (
            <View key={doc.id} style={styles.documentItem}>
                <MaterialIcons name="description" size={24} color={ABAETE_COLORS.secondaryBlue} />
                <Text style={styles.documentName} numberOfLines={1}>{doc.fileName}</Text>
                {/* Botão para abrir o link e outro para deletar */}
            </View>
        ));
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'pessoal':
                return (
                    <View>
                        <Text style={styles.inputLabel}>Nome Completo</Text>
                        <TextInput style={styles.input} value={formData.fullName} onChangeText={v => handleInputChange('fullName', v)} placeholder="Nome Completo" />
                        
                        <Text style={styles.inputLabel}>Nome de Exibição</Text>
                        <TextInput style={styles.input} value={formData.displayName} onChangeText={v => handleInputChange('displayName', v)} placeholder="Nome de Exibição" />

                        <Text style={styles.inputLabel}>Data de Nascimento</Text>
                        <TextInput style={styles.input} value={formData.birthday} onChangeText={v => handleInputChange('birthday', v)} placeholder="AAAA-MM-DD" />
                        
                        <Text style={styles.inputLabel}>CPF</Text>
                        <TextInput style={styles.input} value={formData.cpf} onChangeText={v => handleInputChange('cpf', v)} placeholder="CPF" keyboardType="numeric" />
                        
                        <Text style={styles.inputLabel}>RG</Text>
                        <TextInput style={styles.input} value={formData.rg} onChangeText={v => handleInputChange('rg', v)} placeholder="RG" />
                        
                        <Text style={styles.inputLabel}>Telefone</Text>
                        <TextInput style={styles.input} value={formData.phoneNumber} onChangeText={v => handleInputChange('phoneNumber', v)} placeholder="Telefone" keyboardType="phone-pad" />

                        <Text style={styles.inputLabel}>Gênero</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={formData.gender} onValueChange={v => handleInputChange('gender', v)}>
                                <Picker.Item label="Prefiro não informar" value="prefer_not_say" />
                                <Picker.Item label="Masculino" value="male" />
                                <Picker.Item label="Feminino" value="female" />
                                <Picker.Item label="Outro" value="other" />
                            </Picker>
                        </View>

                        <Text style={styles.inputLabel}>Endereço Completo</Text>
                        <TextInput style={styles.input} value={formData.address} onChangeText={v => handleInputChange('address', v)} placeholder="Endereço Completo" />
                        
                        <Text style={styles.inputLabel}>Título de Eleitor</Text>
                        <TextInput style={styles.input} value={formData.tituloEleitor} onChangeText={v => handleInputChange('tituloEleitor', v)} placeholder="Título de Eleitor" />
                    </View>
                );
            case 'profissional':
                return (
                    <View>
                        <Text style={styles.inputLabel}>Especialidade Principal</Text>
                        <TextInput style={styles.input} value={formData.specialty} onChangeText={v => handleInputChange('specialty', v)} placeholder="Especialidade Principal" />
                        
                        <Text style={styles.inputLabel}>Nº Identidade Profissional</Text>
                        <TextInput style={styles.input} value={formData.licenseNumber} onChangeText={v => handleInputChange('licenseNumber', v)} placeholder="Nº Identidade Profissional" />

                        <Text style={styles.inputLabel}>Status</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={formData.status} onValueChange={v => handleInputChange('status', v)}>
                                <Picker.Item label="Ativo" value="active" />
                                <Picker.Item label="Inativo" value="inactive" />
                            </Picker>
                        </View>

                        <Text style={styles.inputLabel}>Biografia / Mini-currículo</Text>
                        <TextInput style={[styles.input, { height: 120, textAlignVertical: 'top' }]} value={formData.bio} onChangeText={v => handleInputChange('bio', v)} placeholder="Biografia" multiline />
                    </View>
                );
            case 'documentos':
                return (
                    <View>
                        <Text style={styles.sectionTitleClean}>Contrato</Text>
                        <TouchableOpacity style={styles.uploadButton} onPress={() => handlePickAndUpload('Contrato')}>
                            <Text style={styles.uploadButtonText}>Anexar Contrato</Text>
                        </TouchableOpacity>
                        {renderDocumentList('Contrato')}

                        <Text style={styles.sectionTitleClean}>Documentos Pessoais</Text>
                        <TouchableOpacity style={styles.uploadButton} onPress={() => handlePickAndUpload('Documento Pessoal')}>
                            <Text style={styles.uploadButtonText}>Anexar Documentos</Text>
                        </TouchableOpacity>
                        {renderDocumentList('Documento Pessoal')}

                        <Text style={styles.sectionTitleClean}>Qualificações</Text>
                        <TouchableOpacity style={styles.uploadButton} onPress={() => handlePickAndUpload('Qualificação')}>
                            <Text style={styles.uploadButtonText}>Anexar Qualificações</Text>
                        </TouchableOpacity>
                        {renderDocumentList('Qualificação')}
                    </View>
                );
        }
    };

    return (
        <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={{ flex: 1, backgroundColor: ABAETE_COLORS.white }}>
                <View style={[styles.headerClean, { justifyContent: 'space-between' }]}>
                    <Text style={styles.pageTitleClean}>Editar Perfil</Text>
                    <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={28} color={ABAETE_COLORS.textPrimary} /></TouchableOpacity>
                </View>
                <View style={styles.tabBar}>
                    <TouchableOpacity onPress={() => setActiveTab('pessoal')} style={[styles.tabItem, activeTab === 'pessoal' && styles.tabItemActive]}><Text style={styles.tabText}>Pessoal</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveTab('profissional')} style={[styles.tabItem, activeTab === 'profissional' && styles.tabItemActive]}><Text style={styles.tabText}>Profissional</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveTab('documentos')} style={[styles.tabItem, activeTab === 'documentos' && styles.tabItemActive]}><Text style={styles.tabText}>Documentos</Text></TouchableOpacity>
                </View>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
                    {renderTabContent()}
                </ScrollView>
                <View style={styles.modalFooter}>
                    <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
                        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Salvar Alterações</Text>}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const AvailabilityModal = ({ visible, onClose, user, onSave }) => {
    if (!visible) return null;
    
    const [availability, setAvailability] = useState(user.availability || {});
    const [isSaving, setIsSaving] = useState(false);
    const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    const addInterval = (dayIndex) => {
        const dayIntervals = availability[dayIndex] || [];
        // Adiciona um novo intervalo padrão
        setAvailability(prev => ({
            ...prev,
            [dayIndex]: [...dayIntervals, { start: '08:00', end: '12:00' }]
        }));
    };

    const removeInterval = (dayIndex, intervalIndex) => {
        const dayIntervals = availability[dayIndex] || [];
        const newIntervals = dayIntervals.filter((_, index) => index !== intervalIndex);
        setAvailability(prev => ({
            ...prev,
            [dayIndex]: newIntervals
        }));
    };

    const updateIntervalTime = (dayIndex, intervalIndex, part, newTime) => {
        const dayIntervals = [...(availability[dayIndex] || [])];
        dayIntervals[intervalIndex][part] = newTime;
        setAvailability(prev => ({ ...prev, [dayIndex]: dayIntervals }));
    };
    
    const handleSave = async () => {
        setIsSaving(true);
        // Filtra dias sem intervalos antes de salvar
        const cleanedAvailability = Object.entries(availability).reduce((acc, [key, value]) => {
            if (value && value.length > 0) acc[key] = value;
            return acc;
        }, {});
        await onSave(cleanedAvailability);
        setIsSaving(false);
    };

    const renderTimeInterval = (interval, dayIndex, intervalIndex) => (
        <View key={intervalIndex} style={styles.intervalContainer}>
            <TextInput
                style={styles.intervalInput}
                value={interval.start}
                placeholder="Início"
                onChangeText={newTime => updateIntervalTime(dayIndex, intervalIndex, 'start', newTime)}
            />
            <Text style={styles.intervalSeparator}>às</Text>
            <TextInput
                style={styles.intervalInput}
                value={interval.end}
                placeholder="Fim"
                onChangeText={newTime => updateIntervalTime(dayIndex, intervalIndex, 'end', newTime)}
            />
            <TouchableOpacity onPress={() => removeInterval(dayIndex, intervalIndex)}>
                <MaterialIcons name="delete-outline" size={24} color={ABAETE_COLORS.errorRed} />
            </TouchableOpacity>
        </View>
    );

    return (
        <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={{ flex: 1, backgroundColor: ABAETE_COLORS.white }}>
                <View style={[styles.headerClean, { justifyContent: 'space-between' }]}>
                    <Text style={styles.pageTitleClean}>Minha Disponibilidade</Text>
                    <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={28} color={ABAETE_COLORS.textPrimary} /></TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                    {daysOfWeek.map((day, dayIndex) => (
                        <View key={dayIndex} style={styles.dayContainer}>
                            <Text style={styles.dayLabel}>{day}</Text>
                            {(availability[dayIndex] || []).map((interval, intervalIndex) => renderTimeInterval(interval, dayIndex, intervalIndex))}
                            <TouchableOpacity style={styles.addIntervalButton} onPress={() => addInterval(dayIndex)}>
                                <MaterialIcons name="add" size={22} color={ABAETE_COLORS.primaryBlue} />
                                <Text style={styles.addIntervalButtonText}>Adicionar intervalo</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>
                <View style={styles.modalFooter}>
                    <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
                         {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Salvar Disponibilidade</Text>}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
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

const ProfPerfilContent = ({ navigation, professional, onLogout }) => {
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [availabilityModalVisible, setAvailabilityModalVisible] = useState(false);
    const [userProfile, setUserProfile] = useState(professional);

    // Placeholder para as funções de salvar, a lógica completa virá nos modais
    const handleSaveProfile = async (updatedData) => {
        // ... Lógica para salvar os dados do perfil ...
        setEditModalVisible(false);
    };

    const handleSaveAvailability = async (availabilityData) => {
      try {
          const availabilityRef = ref(FIREBASE_DB, `users/${userProfile.uid}/availability`);
          
          await firebaseSet(availabilityRef, availabilityData);

          setAvailabilityModalVisible(false); // Fecha o modal
          Alert.alert("Sucesso", "Sua disponibilidade foi atualizada.");
      } catch (error) {
          console.error("Erro ao salvar disponibilidade:", error);
          Alert.alert("Erro", "Não foi possível salvar a disponibilidade. Tente novamente.");
      }
  };

    const menuItems = [
        { label: 'Editar Perfil', icon: 'edit', action: () => setEditModalVisible(true) },
        { label: 'Disponibilidade', icon: 'event-available', action: () => setAvailabilityModalVisible(true) },
    ];

    return (
        <ScrollView style={styles.contentScrollViewClean} contentContainerStyle={styles.contentContainerClean}>
            <View style={styles.profileHeaderClean}>
                {userProfile.profilePicture ? (
                    <Image source={{ uri: userProfile.profilePicture }} style={styles.profileImageClean} />
                ) : (
                    <View style={styles.profileInitialsContainer}>
                        <Text style={styles.profileInitialsText}>{getInitials(userProfile.fullName)}</Text>
                    </View>
                )}
                <Text style={styles.profileNameClean}>{userProfile.fullName || 'Nome do Profissional'}</Text>
                <Text style={styles.profileEmailClean}>{userProfile.email}</Text>
                <Text style={styles.profileProfessionClean}>{userProfile.specialty || 'Especialidade'}</Text>
            </View>

            {menuItems.map(item => (
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

            <EditProfileModal visible={editModalVisible} onClose={() => setEditModalVisible(false)} user={userProfile} onSave={handleSaveProfile} />
            <AvailabilityModal visible={availabilityModalVisible} onClose={() => setAvailabilityModalVisible(false)} user={userProfile} onSave={handleSaveAvailability} />
        </ScrollView>
    );
};

export const ProfHomeScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('Agenda');
  const [professional, setProfessional] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const handleLogout = async () => { try { await signOut(FIREBASE_AUTH); navigation.replace('Login'); } catch (error) { console.error("Erro logout:", error); Alert.alert("Erro", "Não foi possível sair."); } };

  const renderContent = () => {
    if (loading || !professional) {
      return <View style={styles.centered}><ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} /></View>;
    }
    switch (activeTab) {
      case 'Agenda': return <ProfHomeAgendaContent navigation={navigation} professionalId={professional.uid} />;
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
  profileInitialsContainer: {
    width: 110, 
    height: 110, 
    borderRadius: 55, 
    marginBottom: 12, 
    borderWidth: 3, 
    borderColor: ABAETE_COLORS.primaryBlue,
    backgroundColor: ABAETE_COLORS.lightPink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitialsText: {
    fontFamily: FONT_FAMILY.Bold,
    fontSize: 40,
    color: ABAETE_COLORS.primaryBlue,
  },
  input: {
    height: 50,
    borderColor: ABAETE_COLORS.lightGray,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 16,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: ABAETE_COLORS.lightGray,
  },
  saveButton: {
    backgroundColor: ABAETE_COLORS.primaryBlue,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontFamily: FONT_FAMILY.SemiBold,
    fontSize: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: ABAETE_COLORS.lightGray,
    marginHorizontal: 20,
  },
  tabItem: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    marginRight: 15,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: ABAETE_COLORS.primaryBlue,
  },
  tabText: {
    fontFamily: FONT_FAMILY.SemiBold,
    fontSize: 16,
    color: ABAETE_COLORS.textSecondary,
  },
  uploadButton: {
    backgroundColor: ABAETE_COLORS.lightPink,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  uploadButtonText: {
    color: ABAETE_COLORS.primaryBlue,
    fontFamily: FONT_FAMILY.SemiBold,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  documentName: {
    marginLeft: 10,
    flex: 1,
    fontFamily: FONT_FAMILY.Regular,
  },
  // --- Estilos para o Modal de Disponibilidade ---
  dayContainer: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: ABAETE_COLORS.lightGray,
    paddingBottom: 20,
  },
  dayLabel: {
    fontFamily: FONT_FAMILY.Bold,
    fontSize: 18,
    color: ABAETE_COLORS.textPrimary,
    marginBottom: 10,
  },
  slotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  timeSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10,
    marginBottom: 10,
  },
  timeSlotInput: {
    fontFamily: FONT_FAMILY.SemiBold,
    fontSize: 16,
    padding: 5,
    marginRight: 5,
  },
  addSlotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ABAETE_COLORS.primaryBlue,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addSlotButtonText: {
    color: ABAETE_COLORS.primaryBlue,
    fontFamily: FONT_FAMILY.SemiBold,
    marginLeft: 5,
  },
  inputLabel: {
    fontFamily: FONT_FAMILY.SemiBold,
    fontSize: 14,
    color: ABAETE_COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    height: 50,
    borderColor: ABAETE_COLORS.lightGray,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  
  // --- Estilos para o Modal de Disponibilidade (Novo) ---
  dayContainer: {
    marginBottom: 15,
    backgroundColor: ABAETE_COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ABAETE_COLORS.lightGray,
    padding: 15,
  },
  dayLabel: {
    fontFamily: FONT_FAMILY.Bold,
    fontSize: 18,
    color: ABAETE_COLORS.textPrimary,
    marginBottom: 15,
  },
  intervalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  intervalInput: {
    flex: 1,
    height: 45,
    borderColor: ABAETE_COLORS.lightGray,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    textAlign: 'center',
    fontFamily: FONT_FAMILY.SemiBold,
    fontSize: 16,
  },
  intervalSeparator: {
    marginHorizontal: 10,
    fontFamily: FONT_FAMILY.Regular,
    color: ABAETE_COLORS.textSecondary,
  },
  addIntervalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ABAETE_COLORS.primaryBlue,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 10,
  },
  addIntervalButtonText: {
    color: ABAETE_COLORS.primaryBlue,
    fontFamily: FONT_FAMILY.SemiBold,
    marginLeft: 8,
  },
});