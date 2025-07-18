// src/screens/ProfHomeScreen.js (Profissional) - VERSÃO COMPLETA E INTEGRADA
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Image, FlatList, Platform,
  TextInput, ActivityIndicator, Alert,
  Modal, Button, Keyboard
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';

// --- IMPORTS DO FIREBASE ---
import { FIREBASE_AUTH, FIREBASE_DB } from './../services/firebaseConnection';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  ref, onValue, get, query, orderByChild, 
  equalTo, off, push, set as firebaseSet 
} from 'firebase/database';


// --- FUNÇÃO HELPER DE DATA ---
const getTodaysDateString = () => {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0'); // Mês é base 0
  const year = today.getFullYear();
  return `${day}/${month}/${year}`;
};

// --- NOVO COMPONENTE: MODAL DE AGENDAMENTO ---
const AddAppointmentModal = ({ visible, onClose, onSave, professionalId, patients }) => {
  const [patientId, setPatientId] = useState('');
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [type, setType] = useState('Sessão ABA');
  const [isSaving, setIsSaving] = useState(false);
  
  // Controles para os seletores de data/hora
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleSavePress = async () => {
    Keyboard.dismiss();
    if (!patientId) {
      Alert.alert("Campo Obrigatório", "Por favor, selecione um paciente.");
      return;
    }

    setIsSaving(true);
    
    // Unir data e hora
    const combinedDateTime = new Date(
        scheduleDate.getFullYear(),
        scheduleDate.getMonth(),
        scheduleDate.getDate(),
        startTime.getHours(),
        startTime.getMinutes()
    );

    const appointmentData = {
      patientId,
      professionalId,
      scheduleDate: scheduleDate.toLocaleDateString('pt-BR'), // Formato DD/MM/AAAA
      dateTimeStart: combinedDateTime.toISOString(),
      type,
      // Valores padrão
      status: 'scheduled',
      createdBy: professionalId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Campos a serem preenchidos depois
      dateTimeEnd: '',
      durationMinutes: '',
      location: '',
      notesProfessional: '',
      notesResponsible: ''
    };

    await onSave(appointmentData);
    setIsSaving(false);
  };
  
  // Funções para lidar com os seletores de data/hora
  const onChangeDate = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setScheduleDate(selectedDate);
    }
  };
  
  const onChangeTime = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setStartTime(selectedTime);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Novo Agendamento</Text>

          {/* Seletor de Paciente */}
          <Text style={styles.modalLabel}>Paciente</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={patientId}
              onValueChange={(itemValue) => setPatientId(itemValue)}
            >
              <Picker.Item label="Selecione um paciente..." value="" />
              {patients.map(p => (
                <Picker.Item key={p.id} label={p.fullName} value={p.id} />
              ))}
            </Picker>
          </View>

          {/* Seletor de Data */}
          <Text style={styles.modalLabel}>Data</Text>
          <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
            <Text>{scheduleDate.toLocaleDateString('pt-BR')}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={scheduleDate}
              mode="date"
              display="default"
              onChange={onChangeDate}
            />
          )}

          {/* Seletor de Hora */}
          <Text style={styles.modalLabel}>Horário de Início</Text>
           <TouchableOpacity style={styles.dateInput} onPress={() => setShowTimePicker(true)}>
            <Text>{startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={startTime}
              mode="time"
              display="default"
              is24Hour={true}
              onChange={onChangeTime}
            />
          )}
          
          {/* Seletor de Tipo */}
          <Text style={styles.modalLabel}>Tipo de Sessão</Text>
          <View style={styles.pickerContainer}>
             <Picker
                selectedValue={type}
                onValueChange={(itemValue) => setType(itemValue)}
             >
                <Picker.Item label="Sessão ABA" value="Sessão ABA" />
                <Picker.Item label="Avaliação" value="Avaliação" />
                <Picker.Item label="Consulta" value="Consulta" />
                <Picker.Item label="Sessão Online" value="Sessão Online" />
             </Picker>
          </View>

          <View style={styles.modalButtonContainer}>
            <TouchableOpacity style={styles.modalButtonSecondary} onPress={onClose}>
              <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButtonPrimary, isSaving && styles.modalButtonDisabled]} 
              onPress={handleSavePress} 
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={ABAETE_COLORS.white} />
              ) : (
                <Text style={styles.modalButtonPrimaryText}>Salvar Agendamento</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// --- COMPONENTE DA ABA AGENDA ---
const ProfHomeAgendaContent = ({ navigation, professionalId }) => {
  const [agenda, setAgenda] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false); // <-- NOVO ESTADO
  const [availablePatients, setAvailablePatients] = useState([]); // <-- NOVO ESTADO

  // Busca a lista de pacientes uma vez para o modal
  useEffect(() => {
    if (!professionalId) return;

    const usersRef = query(ref(FIREBASE_DB, 'users'), orderByChild('role'), equalTo('patient'));
    const listener = onValue(usersRef, (snapshot) => {
        const patients = [];
        snapshot.forEach(child => {
            const patientData = { id: child.key, ...child.val() };
            if (Array.isArray(patientData.assignedProfessionalIds) && patientData.assignedProfessionalIds.includes(professionalId)) {
                patients.push({ id: patientData.id, fullName: patientData.fullName });
            }
        });
        setAvailablePatients(patients);
    });

    return () => off(usersRef, 'value', listener);
  }, [professionalId]);

  // <-- NOVA FUNÇÃO PARA SALVAR O AGENDAMENTO
    const handleSaveAppointment = async (data) => {
      try {
        // Gera um novo ID único para o agendamento
        const newAppointmentRef = push(ref(FIREBASE_DB, 'appointments'));
        
        // Salva os dados no Firebase
        await firebaseSet(newAppointmentRef, data);

        Alert.alert("Sucesso", "Agendamento criado com sucesso!");
        setModalVisible(false); // Fecha o modal
      } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        Alert.alert("Erro", "Não foi possível salvar o agendamento. Tente novamente.");
      }
    };

  useEffect(() => {
    if (!professionalId) return;

    setLoading(true);
    const todayStr = getTodaysDateString();

    const appointmentsRef = query(
      ref(FIREBASE_DB, 'appointments'),
      orderByChild('professionalId'),
      equalTo(professionalId)
    );

    const listener = onValue(appointmentsRef, async (snapshot) => {
      if (!snapshot.exists()) {
        setAgenda([]);
        setLoading(false);
        return;
      }

      const allAppointments = [];
      snapshot.forEach(childSnapshot => {
        allAppointments.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });

      const todayAppointments = allAppointments.filter(app => 
        app.scheduleDate === todayStr && app.status === 'scheduled'
      );

      if (todayAppointments.length === 0) {
        setAgenda([]);
        setLoading(false);
        return;
      }
      
      const appointmentsWithPatientNames = await Promise.all(
        todayAppointments.map(async (app) => {
          const patientRef = ref(FIREBASE_DB, `users/${app.patientId}`);
          const patientSnap = await get(patientRef);
          const patientName = patientSnap.exists() ? patientSnap.val().fullName : "Paciente";
          return { ...app, patientName };
        })
      );
      
      appointmentsWithPatientNames.sort((a, b) => new Date(a.dateTimeStart) - new Date(b.dateTimeStart));

      setAgenda(appointmentsWithPatientNames);
      setLoading(false);
    });

    return () => off(appointmentsRef, 'value', listener);
  }, [professionalId]);
  
  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} /></View>;
  }

  return (
    <View style={styles.contentAreaClean}>
      <View style={styles.tabHeaderContainer}>
        <Text style={styles.pageTitleClean}>Agenda de Hoje</Text>
        <TouchableOpacity onPress={() => console.log("Abrir calendário")}>
          <MaterialIcons name="calendar-today" size={26} color={ABAETE_COLORS.primaryBlue} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={agenda}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainerClean}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.agendaCardClean}
            // --- MODIFICAÇÃO AQUI ---
            onPress={() => {
              if (item.type === 'Sessão ABA') {
                // Navega para a nova tela, passando os dados necessários
                navigation.navigate('NewAba', {
                  appointmentId: item.id,
                  patientId: item.patientId,
                  patientName: item.patientName,
                });
              } else {
                // Lógica para outros tipos de agendamento (se houver)
                console.log("Detalhe do agendamento:", item.id);
              }
            }}
          >
            <View style={styles.agendaCardTime}>
              <Text style={styles.agendaHourText}>{new Date(item.dateTimeStart).toLocaleTimeString('pt-BR', { hour: '2-digit' })}</Text>
              <Text style={styles.agendaMinuteText}>{new Date(item.dateTimeStart).toLocaleTimeString('pt-BR', { minute: '2-digit' })}</Text>
            </View>
            <View style={styles.agendaCardDivider} />
            <View style={styles.agendaCardDetails}>
              <Text style={styles.agendaCardPaciente}>{item.patientName}</Text>
              <Text style={styles.agendaCardTipo}>{item.type}</Text>
              <View style={styles.agendaCardActions}>
                   <TouchableOpacity style={styles.actionChip} onPress={() => console.log("Evolução")}>
                      <MaterialIcons name="edit-note" size={18} color={ABAETE_COLORS.secondaryBlue} />
                      <Text style={styles.actionChipText}>Evolução</Text>
                   </TouchableOpacity>
                   <TouchableOpacity style={styles.actionChip} onPress={() => console.log("Ver Paciente")}>
                      <MaterialIcons name="person-search" size={18} color={ABAETE_COLORS.secondaryBlue} />
                      <Text style={styles.actionChipText}>Paciente</Text>
                   </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptySectionText}>Nenhum agendamento para hoje.</Text>}
        ListFooterComponent={<View style={{height: 80}} />}
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


// --- COMPONENTE DA ABA PACIENTES ---
const ProfPacientesContent = ({ navigation, professionalId }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [pacientes, setPacientes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!professionalId) return;
        setLoading(true);

        const usersRef = query(ref(FIREBASE_DB, 'users'), orderByChild('role'), equalTo('patient'));
        
        const listener = onValue(usersRef, async (snapshot) => {
            if (!snapshot.exists()) {
                setPacientes([]);
                setLoading(false);
                return;
            }

            // PASSO 1: Primeiro, apenas filtre e colete os pacientes que correspondem.
            const matchingPatients = [];
            snapshot.forEach(child => {
                const patientData = { id: child.key, ...child.val() };
                if (Array.isArray(patientData.assignedProfessionalIds) && patientData.assignedProfessionalIds.includes(professionalId)) {
                    matchingPatients.push(patientData);
                }
            });

            // Se nenhum paciente foi encontrado para este profissional, encerre cedo.
            if (matchingPatients.length === 0) {
                setPacientes([]);
                setLoading(false);
                return;
            }

            // PASSO 2: Agora, crie as promises para buscar dados adicionais, com tratamento de erro individual.
            const patientsPromises = matchingPatients.map(async (patient) => {
                try { // <--- INÍCIO DO BLOCO TRY/CATCH
                    const appointmentsRef = query(ref(FIREBASE_DB, 'appointments'), orderByChild('patientId'), equalTo(patient.id));
                    const appSnapshot = await get(appointmentsRef);
                    let nextSession = 'Nenhuma sessão futura';
                    
                    if (appSnapshot.exists()) {
                        const now = new Date();
                        const futureApps = [];
                        appSnapshot.forEach(appChild => {
                            const appData = appChild.val();
                            if (appData.professionalId === professionalId && new Date(appData.dateTimeStart) > now) {
                                futureApps.push(appData);
                            }
                        });

                        if(futureApps.length > 0) {
                            futureApps.sort((a,b) => new Date(a.dateTimeStart) - new Date(b.dateTimeStart));
                            const nextApp = futureApps[0];
                            const date = new Date(nextApp.dateTimeStart);
                            nextSession = `${date.toLocaleDateString('pt-BR')} - ${date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
                        }
                    }
                    // Retorna o paciente com sucesso
                    return { ...patient, nextSession };

                } catch (error) { // <--- CAPTURA ERRO PARA UM ÚNICO PACIENTE
                    console.error(`Falha ao buscar dados para o paciente ${patient.id}:`, error);
                    // Retorna o paciente mesmo em caso de erro, mas com uma mensagem clara.
                    // Isso impede que o Promise.all trave.
                    return { ...patient, nextSession: 'Erro ao carregar dados' };
                }
            });

            // Promise.all agora é seguro, pois cada promise individualmente tem tratamento de erro.
            const resolvedPatients = await Promise.all(patientsPromises);
            setPacientes(resolvedPatients);
            setLoading(false);
        });

        return () => off(usersRef, 'value', listener);
    }, [professionalId]);

    // O resto do componente não muda
    const filteredPacientes = pacientes.filter(p =>
        p.fullName && p.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (loading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} /></View>;
    }

    return (
        <View style={styles.contentAreaClean}>
            <View style={styles.tabHeaderContainer}>
                <Text style={styles.pageTitleClean}>Meus Pacientes</Text>
            </View>
            <View style={styles.searchBarContainer}>
                <MaterialIcons name="search" size={22} color={ABAETE_COLORS.mediumGray} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar paciente..."
                    placeholderTextColor={ABAETE_COLORS.mediumGray}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>
            <FlatList
              data={filteredPacientes}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContainerClean}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pacienteListItemClean} onPress={() => console.log("Detalhes Paciente", item.id)}>
                  <Image source={{uri: item.profilePicture || `https://via.placeholder.com/100?text=${item.fullName.charAt(0)}`}} style={styles.pacienteListImage} />
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


// --- COMPONENTE DA ABA PENDÊNCIAS ---
const ProfTarefasAlertasContent = ({ navigation, professionalId }) => {
    const [tasks, setTasks] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!professionalId) return;
        setLoading(true);

        const tasksRef = query(
            ref(FIREBASE_DB, 'homeworkTasks'),
            orderByChild('professionalId'),
            equalTo(professionalId)
        );

        const listener = onValue(tasksRef, async (snapshot) => {
            if (!snapshot.exists()) {
                setTasks({});
                setLoading(false);
                return;
            }

            const allTasksPromises = [];
            snapshot.forEach(child => {
                const task = { id: child.key, ...child.val() };
                allTasksPromises.push(
                    get(ref(FIREBASE_DB, `users/${task.patientId}`)).then(patientSnap => ({
                        ...task,
                        patientName: patientSnap.exists() ? patientSnap.val().fullName : 'Desconhecido'
                    }))
                );
            });
            
            const tasksWithPatientNames = await Promise.all(allTasksPromises);
            tasksWithPatientNames.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
            
            const groupedTasks = tasksWithPatientNames.reduce((acc, task) => {
                const status = task.status;
                if (!acc[status]) acc[status] = [];
                acc[status].push(task);
                return acc;
            }, {});

            setTasks(groupedTasks);
            setLoading(false);
        });

        return () => off(tasksRef, 'value', listener);
    }, [professionalId]);

    if (loading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} /></View>;
    }

    const renderTaskList = (taskList, emptyMessage) => {
      if (!taskList || taskList.length === 0) {
        return <Text style={styles.emptySectionText}>{emptyMessage}</Text>;
      }
      return taskList.map(tarefa => (
        <TouchableOpacity key={tarefa.id} style={styles.listItemClean} onPress={() => console.log("Revisar tarefa", tarefa.id)}>
            <View style={[styles.listItemIconContainer, {backgroundColor: ABAETE_COLORS.yellowOpaco}]}>
                <MaterialIcons name="rate-review" size={24} color={ABAETE_COLORS.yellowDark} />
            </View>
            <View style={styles.listItemTextContainer}>
                <Text style={styles.listItemTitle}>{tarefa.patientName}: {tarefa.title}</Text>
                <Text style={styles.listItemSubtitle}>Prazo: {new Date(tarefa.dueDate).toLocaleDateString('pt-BR')}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={ABAETE_COLORS.mediumGray} />
        </TouchableOpacity>
      ));
    };

    return (
    <ScrollView style={styles.contentScrollViewClean} contentContainerStyle={styles.contentContainerClean}>
        <Text style={styles.pageTitleClean}>Pendências e Alertas</Text>

        <Text style={styles.sectionTitleClean}>Aguardando seu Feedback</Text>
        {renderTaskList(tasks['completed_by_responsible'], 'Nenhuma tarefa para revisar.')}
        
        <Text style={[styles.sectionTitleClean, {marginTop: 30}]}>Pendentes com o Responsável</Text>
        {renderTaskList(tasks['pending_responsible'], 'Nenhuma tarefa pendente com responsáveis.')}

        {/* Adicione outras seções para outros status aqui, se desejar */}
    </ScrollView>
    );
};


// --- COMPONENTE DA ABA PERFIL ---
const ProfPerfilContent = ({ navigation, professional, onLogout }) => (
  <ScrollView style={styles.contentScrollViewClean} contentContainerStyle={styles.contentContainerClean}>
    <View style={styles.profileHeaderClean}>
        <Image 
          source={{uri: professional.profilePicture || 'https://via.placeholder.com/100?text=DR'}} 
          style={styles.profileImageClean} 
        />
        <Text style={styles.profileNameClean}>{professional.fullName || 'Nome não informado'}</Text>
        <Text style={styles.profileEmailClean}>{professional.email}</Text>
        <Text style={styles.profileProfessionClean}>
            {professional.specialty || 'Especialidade'} | {professional.licenseNumber ? `Registro ${professional.licenseNumber}` : ''}
        </Text>
    </View>
    {[
        {label: 'Editar Perfil', icon: 'edit', action: () => console.log('Editar Perfil')},
        {label: 'Minha Disponibilidade', icon: 'event-available', action: () => console.log('Disponibilidade')},
        {label: 'Configurações', icon: 'settings', action: () => console.log('Configurações')},
        {label: 'Ajuda & Suporte', icon: 'help-outline', action: () => console.log('Ajuda')},
    ].map(item => (
        <TouchableOpacity key={item.label} style={styles.profileMenuItemClean} onPress={item.action}>
            <MaterialIcons name={item.icon} size={24} color={ABAETE_COLORS.secondaryBlue} style={styles.profileMenuIcon} />
            <Text style={styles.profileMenuItemTextClean}>{item.label}</Text>
            <MaterialIcons name="chevron-right" size={24} color={ABAETE_COLORS.mediumGray} />
        </TouchableOpacity>
    ))}
    <TouchableOpacity style={[styles.profileMenuItemClean, {marginTop: 20}]} onPress={onLogout}>
        <MaterialIcons name="logout" size={24} color={ABAETE_COLORS.errorRed} style={styles.profileMenuIcon} />
        <Text style={[styles.profileMenuItemTextClean, {color: ABAETE_COLORS.errorRed}]}>Sair</Text>
    </TouchableOpacity>
  </ScrollView>
);


// --- COMPONENTE PRINCIPAL PROFHOME ---
export const ProfHomeScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('Agenda');
  const [professional, setProfessional] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(FIREBASE_AUTH, (user) => {
      if (user) {
        const userRef = ref(FIREBASE_DB, `users/${user.uid}`);
        const unsubscribeDb = onValue(userRef, (snapshot) => {
          if (snapshot.exists()) {
            setProfessional({ uid: user.uid, ...snapshot.val() });
          } else {
            Alert.alert("Erro de Acesso", "Não foi possível encontrar os dados do profissional.", [{ text: "OK", onPress: handleLogout }]);
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
      Alert.alert("Erro", "Não foi possível sair. Tente novamente.");
    }
  };

  const renderContent = () => {
    if (loading || !professional) {
      return <View style={styles.centered}><ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} /></View>;
    }
    switch (activeTab) {
      case 'Agenda':
        return <ProfHomeAgendaContent navigation={navigation} professionalId={professional.uid} />;
      case 'Pacientes':
        return <ProfPacientesContent navigation={navigation} professionalId={professional.uid} />;
      case 'Pendências':
        return <ProfTarefasAlertasContent navigation={navigation} professionalId={professional.uid} />;
      case 'Perfil':
        return <ProfPerfilContent navigation={navigation} professional={professional} onLogout={handleLogout} />;
      default:
        return <ProfHomeAgendaContent navigation={navigation} professionalId={professional.uid} />;
    }
  };

  const tabs = [
    { name: 'Agenda', icon: 'event-note', label: 'Agenda' },
    { name: 'Pacientes', icon: 'groups', label: 'Pacientes' },
    { name: 'Pendências', icon: 'rule', label: 'Pendências' },
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
            <Text
              style={[
                styles.navItemTextClean,
                { color: activeTab === tab.name ? ABAETE_COLORS.primaryBlue : ABAETE_COLORS.mediumGray,
                  fontFamily: activeTab === tab.name ? FONT_FAMILY.SemiBold : FONT_FAMILY.Regular,
                },
              ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};


// --- ESTILOS ---
const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ABAETE_COLORS.white,
  },
  safeAreaClean: { flex: 1, backgroundColor: ABAETE_COLORS.white },
  headerClean: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 15,
    paddingBottom: 10, backgroundColor: ABAETE_COLORS.white,
    borderBottomWidth: 1, borderBottomColor: ABAETE_COLORS.lightGray,
  },
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
  agendaCardClean: {
    flexDirection: 'row', backgroundColor: ABAETE_COLORS.white, borderRadius: 12, marginBottom: 15, padding: 15,
    borderWidth: 1, borderColor: ABAETE_COLORS.lightGray, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  agendaCardTime: { alignItems: 'center', justifyContent: 'center', paddingRight: 15 },
  agendaHourText: { fontFamily: FONT_FAMILY.Bold, fontSize: 22, color: ABAETE_COLORS.primaryBlue },
  agendaMinuteText: { fontFamily: FONT_FAMILY.Regular, fontSize: 14, color: ABAETE_COLORS.secondaryBlue, marginTop: -2 },
  agendaCardDivider: { width: 2, backgroundColor: ABAETE_COLORS.yellow, marginRight: 15, borderRadius: 1 },
  agendaCardDetails: { flex: 1 },
  agendaCardPaciente: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 16, color: ABAETE_COLORS.textPrimary },
  agendaCardTipo: { fontFamily: FONT_FAMILY.Regular, fontSize: 14, color: ABAETE_COLORS.textSecondary, marginBottom: 8 },
  agendaCardActions: { flexDirection: 'row', marginTop: 8 },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: ABAETE_COLORS.lightPink, paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 15, marginRight: 10,
  },
  actionChipText: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 12, color: ABAETE_COLORS.secondaryBlue, marginLeft: 5 },
  fabClean: {
    position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: ABAETE_COLORS.primaryBlue,
    alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: ABAETE_COLORS.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3,
  },
  searchBarContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 10,
    paddingHorizontal: 12, marginBottom: 15, height: 48,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: '100%', fontFamily: FONT_FAMILY.Regular, fontSize: 15, color: ABAETE_COLORS.textPrimary },
  pacienteListItemClean: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: ABAETE_COLORS.white, padding: 15,
    borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: ABAETE_COLORS.lightGray,
  },
  pacienteListImage: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: ABAETE_COLORS.lightGray },
  pacienteListInfo: { flex: 1 },
  pacienteListName: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 16, color: ABAETE_COLORS.textPrimary },
  pacienteListNextSession: { fontFamily: FONT_FAMILY.Regular, fontSize: 13, color: ABAETE_COLORS.textSecondary, marginTop: 2 },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Fundo semitransparente
  },
  modalContent: {
    width: '90%',
    backgroundColor: ABAETE_COLORS.white,
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontFamily: FONT_FAMILY.Bold,
    fontSize: 20,
    color: ABAETE_COLORS.primaryBlue,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontFamily: FONT_FAMILY.SemiBold,
    fontSize: 14,
    color: ABAETE_COLORS.textSecondary,
    marginBottom: 5,
    marginTop: 10,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: ABAETE_COLORS.lightGray,
    borderRadius: 8,
    marginBottom: 10,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: ABAETE_COLORS.lightGray,
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 25,
  },
  modalButtonPrimary: {
    backgroundColor: ABAETE_COLORS.primaryBlue,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1, // Faz o botão ocupar mais espaço
    marginLeft: 10,
  },
  modalButtonPrimaryText: {
      color: ABAETE_COLORS.white,
      fontFamily: FONT_FAMILY.SemiBold,
      fontSize: 15,
  },
  modalButtonSecondary: {
      backgroundColor: 'transparent',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: ABAETE_COLORS.mediumGray,
      alignItems: 'center',
      justifyContent: 'center',
  },
  modalButtonSecondaryText: {
      color: ABAETE_COLORS.textSecondary,
      fontFamily: FONT_FAMILY.SemiBold,
      fontSize: 15,
  },
  modalButtonDisabled: {
      backgroundColor: ABAETE_COLORS.mediumGray,
  },
});