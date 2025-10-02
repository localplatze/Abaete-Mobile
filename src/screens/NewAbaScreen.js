import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView, View, Text, ScrollView, TouchableOpacity, StyleSheet, 
  Alert, ActivityIndicator, FlatList, TextInput, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';
import { FIREBASE_DB } from '../services/firebaseConnection';
import { ref, onValue, get, update, off, set, push } from 'firebase/database';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';

const phaseTranslations = {
    baseline: 'Linha de Base',
    intervention: 'Intervenção',
    maintenance: 'Manutenção',
    generalization: 'Generalização',
};

const TargetTrialCard = ({ targetName, program, onRegisterTrial, detailedHelpLevels }) => {
  const [trials, setTrials] = useState([]);
  const [nextHelpLevelKey, setNextHelpLevelKey] = useState(program.helpLevels?.[0] || 'I'); // Chave do próximo nível
  
  const isHelpEnabled = program.programProgress?.currentPhase !== 'baseline';

  const addTrial = (status) => {
    // Busca a pontuação com base na chave do nível de ajuda selecionado
    const helpScore = isHelpEnabled ? (detailedHelpLevels[nextHelpLevelKey]?.score ?? 0) : 1.0; // Baseline é sempre 1.0 se correto
    const isCorrect = status === '+';

    const newTrial = {
      id: `trial_${Date.now()}_${Math.random()}`,
      status, // "+" ou "E"
      helpUsed: isHelpEnabled ? nextHelpLevelKey : 'N/A',
      // A pontuação final da tentativa é o score da ajuda se a resposta for correta, senão é 0.
      score: isCorrect ? helpScore : 0.0,
      timestamp: new Date().toISOString()
    };
    
    const updatedTrials = [...trials, newTrial];
    setTrials(updatedTrials);
    onRegisterTrial(targetName, updatedTrials);
  };

  const removeTrial = (indexToRemove) => {
    Alert.alert("Remover Tentativa", "Deseja remover este registro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => {
        const updatedTrials = trials.filter((_, index) => index !== indexToRemove);
        setTrials(updatedTrials);
        onRegisterTrial(targetName, updatedTrials);
      }}
    ]);
  };

  const minAttempts = program.targetsConfig?.minAttempts || 1;

  // Filtra apenas os níveis de ajuda disponíveis para este programa
  const availableHelpOptions = (program.helpLevels || []).map(key => ({ key, ...detailedHelpLevels[key] }));

  return (
    <View style={styles.targetCard}>
      <Text style={styles.targetCardTitle}>{targetName}</Text>
      
      {/* SEÇÃO DE ENTRADA DE DADOS */}
      <View style={styles.trialInputSection}>
        {isHelpEnabled ? (
          <View style={styles.pickerContainerSmall}>
            <Picker
              selectedValue={nextHelpLevelKey}
              onValueChange={(itemValue) => setNextHelpLevelKey(itemValue)}
              enabled={isHelpEnabled}
              style={{ height: 65 }}
            >
              {availableHelpOptions.map(level => 
                <Picker.Item key={level.key} label={`${level.key} - ${level.name}`} value={level.key} />
              )}
            </Picker>
          </View>
        ) : (
          <View style={styles.baselineHelpTextContainer}>
             <Text style={styles.baselineHelpText}>Nenhum nível de ajuda aplicado (Linha de Base)</Text>
          </View>
        )}
      </View>
      
      {/* Botões de Resposta (simplificados para correto/incorreto) */}
      <View style={styles.trialButtons}>
        <TouchableOpacity style={[styles.trialButton, styles.correctButton]} onPress={() => addTrial('+')}><Text style={styles.trialButtonText}>Correto (+)</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.trialButton, styles.incorrectButton]} onPress={() => addTrial('E')}><Text style={styles.trialButtonText}>Incorreto (E)</Text></TouchableOpacity>
      </View>
      
      {/* Indicador de Tentativas Mínimas */}
      <View style={styles.attemptTracker}>
        <Text style={styles.attemptText}>Tentativas: {trials.length} / {minAttempts}</Text>
        <View style={styles.attemptDotsContainer}>
            {[...Array(minAttempts)].map((_, i) => <View key={i} style={[styles.attemptDot, i < trials.length && styles.attemptDotFilled]} />)}
        </View>
      </View>

      {/* LOG DE TENTATIVAS */}
      <View style={styles.trialsLog}>
        {trials.map((trial, index) => (
          <TouchableOpacity key={trial.id} onLongPress={() => removeTrial(index)} style={styles.trialLogItemContainer}>
            <Text style={styles.trialLogStatus}>{trial.status}</Text>
            <Text style={styles.trialLogHelp}>({detailedHelpLevels[trial.helpUsed]?.name || trial.helpUsed})</Text>
            <Text style={styles.trialLogScore}>Pontos: {trial.score.toFixed(2)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const RescheduleModal = ({ visible, onSchedule, onDismiss, suggestedDate }) => {
  const [scheduleDate, setScheduleDate] = useState(suggestedDate);
  const [scheduleTime, setScheduleTime] = useState(suggestedDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Garante que o estado seja resetado para a nova sugestão sempre que o modal abrir
  useEffect(() => {
    if (visible) {
      setScheduleDate(suggestedDate);
      setScheduleTime(suggestedDate);
    }
  }, [visible, suggestedDate]);
  
  const onChangeDate = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) setScheduleDate(selectedDate);
  };
  
  const onChangeTime = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) setScheduleTime(selectedTime);
  };

  const handleSchedulePress = () => {
    const combinedDateTime = new Date(
        scheduleDate.getFullYear(), scheduleDate.getMonth(), scheduleDate.getDate(),
        scheduleTime.getHours(), scheduleTime.getMinutes()
    );
    onSchedule(combinedDateTime); // Envia o objeto Date completo
  };

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onDismiss}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <MaterialIcons name="check-circle-outline" size={48} color={ABAETE_COLORS.successGreen} style={{ alignSelf: 'center', marginBottom: 15 }} />
          <Text style={styles.modalTitle}>Sessão Salva!</Text>
          <Text style={styles.modalText}>Deseja agendar a próxima sessão para este paciente?</Text>

          {/* Seletores de Data e Hora */}
          <View style={styles.datePickerRow}>
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
              <MaterialIcons name="event" size={20} color={ABAETE_COLORS.textSecondary} />
              <Text style={styles.dateInputText}>{scheduleDate.toLocaleDateString('pt-BR')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowTimePicker(true)}>
              <MaterialIcons name="access-time" size={20} color={ABAETE_COLORS.textSecondary} />
              <Text style={styles.dateInputText}>{scheduleTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
            </TouchableOpacity>
          </View>
          
          {showDatePicker && <DateTimePicker value={scheduleDate} mode="date" display="default" onChange={onChangeDate} />}
          {showTimePicker && <DateTimePicker value={scheduleTime} mode="time" display="default" is24Hour={true} onChange={onChangeTime} />}

          <View style={styles.modalButtonContainer}>
            <TouchableOpacity style={[styles.modalButton, styles.modalButtonSecondary]} onPress={onDismiss}>
              <Text style={styles.modalButtonTextSecondary}>Não, obrigado</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.modalButtonPrimary]} onPress={handleSchedulePress}>
              <Text style={styles.modalButtonTextPrimary}>Agendar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// --- TELA PRINCIPAL: NewAbaScreen ---
export const NewAbaScreen = ({ route, navigation }) => {
  const { appointmentId, patientId, patientName } = route.params;
  const [step, setStep] = useState('program_selection');
  const [assignedPrograms, setAssignedPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [programProgress, setProgramProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [sessionData, setSessionData] = useState({});
  const [sessionNotes, setSessionNotes] = useState('');
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [detailedHelpLevels, setDetailedHelpLevels] = useState({});

  useEffect(() => {
    const programsRef = ref(FIREBASE_DB, `users/${patientId}/assignedPrograms`);
    const listener = onValue(programsRef, (snapshot) => {
      const programs = [];
      if (snapshot.exists()) { snapshot.forEach(child => programs.push({ id: child.key, ...child.val() })); }
      setAssignedPrograms(programs);
      setLoading(false);
    });
    return () => off(programsRef, 'value', listener);
  }, [patientId]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try { let location = await Location.getCurrentPositionAsync({}); setCurrentLocation(location); }
      catch (error) { console.error("Erro ao obter localização:", error); }
    })();
  }, []);

  const createSafeKey = (str) => {
      return str.replace(/[.#$[\]/]/g, '').replace(/\s+/g, '_');
  };

  const handleProgramSelection = async (program) => {
    setLoading(true);
    const progressRef = ref(FIREBASE_DB, `users/${patientId}/programProgress/${program.id}`);
    const snapshot = await get(progressRef);
    let currentProgress;

    const allHelpLevelsSnapshot = await get(ref(FIREBASE_DB, 'helpLevels'));
    if (allHelpLevelsSnapshot.exists()) {
        setDetailedHelpLevels(allHelpLevelsSnapshot.val());
    }

    program.programProgress = currentProgress; 
    setSelectedProgram(program);
    setProgramProgress(currentProgress);

    if (snapshot.exists()) {
      currentProgress = snapshot.val();
    } else {
      const initialPhase = program.baseline?.enabled ? 'baseline' : 'intervention';
      currentProgress = {
        currentPhase: initialPhase,
        currentHelpLevelIndex: 0,
        masteredTargets: [],
        sessionHistory: []
      };
      await set(progressRef, currentProgress);
    }
    
    // Injeta o progresso no objeto do programa para facilitar o acesso
    program.programProgress = currentProgress; 

    setSelectedProgram(program);
    setProgramProgress(currentProgress);
    setSessionStartTime(new Date());
    setStep('session_execution');
    const initialData = {};
    program.targets.forEach(target => {
      const safeKey = createSafeKey(target);
      initialData[safeKey] = []; 
    });
    setSessionData(initialData);
    setLoading(false);
  };

  const handleRegisterTrial = useCallback((targetName, trials) => {
    // ** CORREÇÃO APLICADA AQUI **
    const safeKey = createSafeKey(targetName);
    setSessionData(prevData => ({ ...prevData, [safeKey]: trials }));
  }, []);
  
  const getNextPhase = (currentPhase, program) => {
      const phaseOrder = ['baseline', 'intervention', 'generalization', 'maintenance'];
      const currentIndex = phaseOrder.indexOf(currentPhase);
      for (let i = currentIndex + 1; i < phaseOrder.length; i++) {
          const nextPhaseKey = phaseOrder[i];
          if (program[nextPhaseKey]?.enabled) {
              return nextPhaseKey;
          }
      }
      return 'completed'; // Programa finalizado
  };

  const evaluateAndProgress = (newSessionResult) => {
      // Cria uma cópia segura do progresso atual para evitar mutações
      let updatedProgress = JSON.parse(JSON.stringify(programProgress));
      
      // Garante que o histórico de sessões seja um array
      if (!Array.isArray(updatedProgress.sessionHistory)) {
          updatedProgress.sessionHistory = [];
      }

      // Adiciona o resultado da sessão atual no início do histórico
      // e mantém apenas os últimos 10-15 registros para performance
      updatedProgress.sessionHistory.unshift(newSessionResult);
      updatedProgress.sessionHistory = updatedProgress.sessionHistory.slice(0, 15);

      const currentPhaseKey = updatedProgress.currentPhase;
      const criteria = selectedProgram[currentPhaseKey];

      // Se a progressão automática estiver desativada, não faz mais nada
      if (!selectedProgram.autoProgression || !criteria) {
          return updatedProgress;
      }

      // Filtra o histórico para obter apenas as sessões da fase atual
      const sessionsInCurrentPhase = updatedProgress.sessionHistory.filter(s => s.phase === currentPhaseKey);

      let criteriaMet = false;

      // LÓGICA DE AVANÇO ESPECÍFICA PARA CADA FASE
      if (currentPhaseKey === 'intervention') {
          const requiredSessions = criteria.sessions || 3;
          const requiredAccuracy = criteria.successPercentage || 80;
          
          // Verifica se já temos o número mínimo de sessões no histórico para avaliar
          if (sessionsInCurrentPhase.length >= requiredSessions) {
              // Pega as X sessões mais recentes da fase atual
              const recentSessions = sessionsInCurrentPhase.slice(0, requiredSessions);
              // Verifica se TODAS elas atendem ao critério de acerto
              const allMetCriteria = recentSessions.every(session => session.accuracy >= requiredAccuracy);
              
              if (allMetCriteria) {
                  criteriaMet = true;
              }
          }
      } else { // Lógica para Baseline, Maintenance, Generalization
          const requiredSessions = criteria.sessions || 1;
          
          // Verifica se o número de sessões concluídas nesta fase é igual ou maior ao necessário
          if (sessionsInCurrentPhase.length >= requiredSessions) {
              criteriaMet = true;
          }
      }
      
      // Se o critério foi atendido, avança para a próxima fase
      if (criteriaMet) {
          console.log(`Critério para a fase '${currentPhaseKey}' atendido. Avançando...`);
          updatedProgress.currentPhase = getNextPhase(currentPhaseKey, selectedProgram);
          // Opcional: Você pode resetar o histórico aqui se quiser que cada fase comece do zero
          // updatedProgress.sessionHistory = []; 
      }
      
      return updatedProgress;
  };

  const handleSaveSession = async () => {
    if (!selectedProgram || !sessionStartTime) {
      Alert.alert("Erro", "Dados da sessão incompletos.");
      return;
    }
    setIsSaving(true);
    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - sessionStartTime.getTime()) / 60000);

    // --- CÁLCULO DE PONTUAÇÃO ---
    let totalScore = 0;
    let totalTrials = 0;
    Object.values(sessionData).forEach(trials => {
        trials.forEach(trial => {
            totalScore += trial.score; // Soma os scores já calculados
            totalTrials++;
        });
    });
    // A precisão agora é a média dos scores, em porcentagem
    const accuracy = totalTrials > 0 ? Math.round((totalScore / totalTrials) * 100) : 0;

    const trialsDataAsArray = Object.entries(sessionData).map(([targetName, trials]) => ({
        target: targetName.replace(/_/g, ' '),
        attempts: trials
    }));

    const newSessionResult = {
        date: endTime.toISOString(),
        accuracy, // Agora baseado em score
        phase: programProgress.currentPhase,
        durationMinutes,
        appointmentId: appointmentId
    };
    
    const newProgress = evaluateAndProgress(newSessionResult);

    const updateData = {
      status: 'completed',
      dateTimeEnd: endTime.toISOString(),
      durationMinutes,
      location: currentLocation ? { lat: currentLocation.coords.latitude, lon: currentLocation.coords.longitude } : null,
      updatedAt: new Date().toISOString(),
      abaData: {
        programId: selectedProgram.id,
        phaseConducted: programProgress.currentPhase,
        accuracy,
        trialsData: trialsDataAsArray,
        sessionNotes: sessionNotes.trim(),
      }
    };

    try {
      const appointmentRef = ref(FIREBASE_DB, `appointments/${appointmentId}`);
      const progressRef = ref(FIREBASE_DB, `users/${patientId}/programProgress/${selectedProgram.id}`);
      
      await update(appointmentRef, updateData);
      await set(progressRef, newProgress);

      setShowRescheduleModal(true);

    } catch (error) {
      console.error("Erro ao salvar sessão:", error);
      Alert.alert("Erro", `Não foi possível salvar a sessão. \n\nDetalhe: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
};

  const getNextSessionDate = () => {
    const frequency = selectedProgram?.maintenance?.frequency || 'Semanalmente';
    const nextDate = new Date();
    if (frequency === 'Diariamente') {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (frequency === 'Mensalmente') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else { // Semanalmente é o padrão
      nextDate.setDate(nextDate.getDate() + 7);
    }
    return nextDate;
  };

  const handleCreateNextSession = async (selectedDateTime) => {
    const professionalId = route.params?.professionalId || FIREBASE_AUTH.currentUser.uid;

    if (!professionalId) {
      Alert.alert("Erro", "Não foi possível identificar o profissional logado para agendar a sessão.");
      navigation.goBack();
      return;
    }

    const newAppointmentData = {
        patientId,
        professionalId,
        scheduleDate: selectedDateTime.toLocaleDateString('pt-BR'),
        dateTimeStart: selectedDateTime.toISOString(),
        type: 'Sessão ABA', // Mantém o tipo
        status: 'scheduled',
        createdBy: professionalId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    if (selectedProgram) {
        newAppointmentData.programId = selectedProgram.id;
        newAppointmentData.programName = selectedProgram.name;
    }

    try {
        const newAppointmentRef = push(ref(FIREBASE_DB, 'appointments'));
        await set(newAppointmentRef, newAppointmentData);
        Alert.alert("Agendado!", "A próxima sessão foi agendada com sucesso.", [
            { text: 'OK', onPress: () => navigation.goBack() }
        ]);
    } catch (error) {
        console.error("Erro ao agendar:", error);
        Alert.alert("Erro", "Não foi possível criar o próximo agendamento.");
        navigation.goBack();
    }
  };

  const handleDismissModal = () => {
      setShowRescheduleModal(false);
      navigation.goBack();
  };

  if (loading) {
    return <SafeAreaView style={styles.safeArea}><ActivityIndicator style={{ flex: 1 }} size="large" color={ABAETE_COLORS.primaryBlue} /></SafeAreaView>;
  }

  if (step === 'program_selection') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.headerTitle}>Sessão ABA</Text>
          <Text style={styles.patientInfo}>Paciente: {patientName}</Text>
          <Text style={styles.label}>Selecione o programa para esta sessão:</Text>
          {assignedPrograms.length > 0 ? (
            <FlatList data={assignedPrograms} keyExtractor={item => item.id} renderItem={({ item }) => (
              <TouchableOpacity style={styles.programItem} onPress={() => handleProgramSelection(item)}>
                <View>
                  <Text style={styles.programItemTitle}>{item.name}</Text>
                  <Text style={styles.programItemSubtitle}>{item.type}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={ABAETE_COLORS.primaryBlue} />
              </TouchableOpacity>
            )} />
          ) : <Text style={styles.emptyStateText}>Nenhum programa atribuído.</Text>}
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'session_execution' && selectedProgram) {
    const phaseKey = programProgress.currentPhase;
    const translatedPhase = phaseTranslations[phaseKey] || (phaseKey.charAt(0).toUpperCase() + phaseKey.slice(1));
    const phaseConfig = selectedProgram[phaseKey];
    const totalSessionsInPhase = phaseConfig?.sessions || 1;
    const completedSessionsInPhase = programProgress.sessionHistory?.filter(s => s.phase === phaseKey).length || 0;
    const sessionCounterText = `Sessão ${completedSessionsInPhase + 1} de ${totalSessionsInPhase}`;

    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.headerTitle}>{selectedProgram.name}</Text>
          <Text style={styles.patientInfo}>Paciente: {patientName}</Text>
          
          <View style={styles.infoBox}>
             <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                <Text style={styles.infoBoxTitle}>Fase Atual: <Text style={{ color: ABAETE_COLORS.textPrimary }}>{translatedPhase}</Text></Text>
                {phaseConfig?.sessions && <Text style={styles.phaseCounterText}>{sessionCounterText}</Text>}
             </View>
             <Text style={styles.infoBoxContent}>{selectedProgram.description}</Text>
          </View>

          <Text style={styles.sectionTitle}>Registro de Tentativas por Alvo</Text>
          <Text style={styles.sectionHelperText}>Toque nos botões para registrar. Pressione e segure um registro para apagar.</Text>

          {selectedProgram.targets.map((target, index) => (
            <TargetTrialCard 
              key={`${target}-${index}`} 
              targetName={target} 
              program={selectedProgram}
              onRegisterTrial={handleRegisterTrial} 
              detailedHelpLevels={detailedHelpLevels} 
            />
          ))}

          <Text style={styles.sectionTitle}>Observações Gerais da Sessão</Text>
          <TextInput
            style={styles.sessionNotesInput}
            placeholder="Anote aqui qualquer observação relevante..."
            value={sessionNotes}
            onChangeText={setSessionNotes}
            multiline
          />

          <TouchableOpacity style={styles.buttonPrimary} onPress={handleSaveSession} disabled={isSaving}>
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Finalizar e Salvar Sessão</Text>}
          </TouchableOpacity>
          <View style={{ height: 50 }} />
        </ScrollView>

        <RescheduleModal
          visible={showRescheduleModal}
          onDismiss={handleDismissModal}
          onSchedule={handleCreateNextSession}
          suggestedDate={getNextSessionDate()}
        />
      </SafeAreaView>
    );
  }

  return <SafeAreaView style={styles.safeArea} />;
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f6f8' },
  container: { flex: 1, padding: 20 },
  headerTitle: { 
    fontFamily: FONT_FAMILY.Bold, 
    fontSize: 24, 
    color: ABAETE_COLORS.primaryBlue, 
    textAlign: 'center',
    marginTop: 32,
  },
  patientInfo: { fontFamily: FONT_FAMILY.Regular, fontSize: 16, color: ABAETE_COLORS.textSecondary, textAlign: 'center', marginBottom: 20 },
  label: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 16, color: ABAETE_COLORS.textPrimary, marginBottom: 10 },
  emptyStateText: { textAlign: 'center', marginTop: 30, fontFamily: FONT_FAMILY.Regular, color: ABAETE_COLORS.textSecondary },
  programItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: ABAETE_COLORS.white, padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: ABAETE_COLORS.lightGray },
  programItemTitle: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 16, color: ABAETE_COLORS.textPrimary },
  programItemSubtitle: { fontFamily: FONT_FAMILY.Regular, fontSize: 14, color: ABAETE_COLORS.textSecondary },
  infoBox: { backgroundColor: ABAETE_COLORS.lightPink, padding: 15, borderRadius: 10, marginBottom: 20 },
  infoBoxTitle: { fontFamily: FONT_FAMILY.Bold, fontSize: 16, color: ABAETE_COLORS.primaryBlue, marginBottom: 5 },
  infoBoxContent: { fontFamily: FONT_FAMILY.Regular, fontSize: 14, color: ABAETE_COLORS.textPrimary, lineHeight: 20 },
  sectionTitle: { fontFamily: FONT_FAMILY.Bold, fontSize: 18, color: ABAETE_COLORS.textPrimary, marginBottom: 15 },
  trialButtons: { flexDirection: 'row' },
  noResponseButton: { backgroundColor: ABAETE_COLORS.mediumGray },
  trialsLogEmpty: { fontStyle: 'italic', color: ABAETE_COLORS.mediumGray, fontSize: 12 },
  trialLogItem: { fontFamily: FONT_FAMILY.Regular, fontSize: 12, marginRight: 8, marginBottom: 4, backgroundColor: '#f0f0f0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  buttonPrimary: { backgroundColor: ABAETE_COLORS.primaryBlue, padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontFamily: FONT_FAMILY.Bold, fontSize: 16 },
  sectionHelperText: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 14,
    color: ABAETE_COLORS.textSecondary,
    marginBottom: 15,
    marginTop: -10,
    textAlign: 'center',
  },
  trialLogItemContainer: { // <-- NOVO ESTILO para o item do log
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8, 
    marginBottom: 5, 
    backgroundColor: '#f0f0f0', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6,
  },
  trialLogItem: { 
    fontFamily: FONT_FAMILY.Regular, 
    fontSize: 14, // Aumentado para melhor leitura
  },
  trialLogDeleteIcon: { // <-- NOVO ESTILO para o ícone de deletar
    marginLeft: 5,
  },
  sessionNotesInput: { // <-- NOVO ESTILO para o campo de observações
    backgroundColor: ABAETE_COLORS.white,
    borderWidth: 1,
    borderColor: ABAETE_COLORS.lightGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    fontFamily: FONT_FAMILY.Regular,
    textAlignVertical: 'top',
    height: 120,
    marginBottom: 10,
  },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '90%', backgroundColor: ABAETE_COLORS.white, borderRadius: 12, padding: 20 },
  modalTitle: { fontFamily: FONT_FAMILY.Bold, fontSize: 20, color: ABAETE_COLORS.primaryBlue, marginBottom: 15, textAlign: 'center' },
  modalText: { fontFamily: FONT_FAMILY.Regular, fontSize: 16, color: ABAETE_COLORS.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  modalButtonPrimary: { backgroundColor: ABAETE_COLORS.primaryBlue, marginLeft: 10 },
  modalButtonSecondary: { borderWidth: 1, borderColor: ABAETE_COLORS.mediumGray },
  modalButtonTextPrimary: { color: ABAETE_COLORS.white, fontFamily: FONT_FAMILY.SemiBold },
  modalButtonTextSecondary: { color: ABAETE_COLORS.textSecondary, fontFamily: FONT_FAMILY.SemiBold },
  datePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ABAETE_COLORS.lightGray,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  dateInputText: {
    marginLeft: 8,
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 16,
    color: ABAETE_COLORS.textPrimary,
  },
  phaseCounterText: {
    fontFamily: FONT_FAMILY.SemiBold,
    fontSize: 14,
    color: ABAETE_COLORS.secondaryBlue,
    alignSelf: 'flex-end',
    marginBottom: 5,
  },
  targetCard: { 
    backgroundColor: ABAETE_COLORS.white, borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: ABAETE_COLORS.lightGray 
  },
  targetCardTitle: { 
    fontFamily: FONT_FAMILY.SemiBold, fontSize: 16, color: ABAETE_COLORS.secondaryBlue, marginBottom: 15,
  },
  trialInputSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  pickerContainerSmall: {
    flex: 1, borderWidth: 1, borderColor: ABAETE_COLORS.lightGray, borderRadius: 8, marginRight: 10, justifyContent: 'center'
  },
  trialButtons: { 
    flexDirection: 'row', gap: 10 
  },
  trialButton: { 
    width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', elevation: 2,
  },
  trialButtonText: { color: ABAETE_COLORS.white, fontFamily: FONT_FAMILY.Bold, fontSize: 18 },
  correctButton: { backgroundColor: ABAETE_COLORS.successGreen },
  incorrectButton: { backgroundColor: ABAETE_COLORS.errorRed },

  attemptTracker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', },
  attemptText: { fontFamily: FONT_FAMILY.Regular, fontSize: 13, color: ABAETE_COLORS.textSecondary, },
  attemptDotsContainer: { flexDirection: 'row', },
  attemptDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ABAETE_COLORS.lightGray, marginLeft: 5, },
  attemptDotFilled: { backgroundColor: ABAETE_COLORS.primaryBlue, },
  
  trialsLog: { 
    marginTop: 10, 
  },
  trialsLogHeader: {
    fontFamily: FONT_FAMILY.SemiBold,
    fontSize: 13,
    color: ABAETE_COLORS.textSecondary,
    marginBottom: 10,
  },
  trialLogItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f7f9fc',
    borderRadius: 8,
    paddingLeft: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0'
  },
  trialLogStatus: {
    fontFamily: FONT_FAMILY.Bold,
    fontSize: 16,
    width: 30, // Largura fixa para alinhar
  },
  trialLogHelp: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 14,
    color: ABAETE_COLORS.textSecondary,
    flex: 1,
    textAlign: 'center',
  },
  trialLogPickerContainer: {
    flex: 1,
    height: 65, // Altura consistente
  },
  trialLogPicker: {
    height: 65,
    transform: [ { scaleX: 0.9 }, { scaleY: 0.9 } ] 
  },
  trialInputSection: {
    flexDirection: 'column', // Empilha o picker e os botões
    alignItems: 'stretch',
    marginBottom: 10,
  },
  pickerContainerSmall: {
    width: '100%', // Ocupa a largura total
    borderWidth: 1, 
    borderColor: ABAETE_COLORS.lightGray, 
    borderRadius: 8, 
    marginBottom: 15, // Espaço entre o picker e os botões
    justifyContent: 'center'
  },
  trialButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', // Distribui os botões
    gap: 10
  },
  trialButton: { 
    flex: 1, // Faz os botões ocuparem o espaço disponível
    height: 45, 
    borderRadius: 8, // Bordas menos arredondadas
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 2,
  },
  trialButtonText: { 
    color: ABAETE_COLORS.white, 
    fontFamily: FONT_FAMILY.Bold, 
    fontSize: 16 // Um pouco menor para caber texto
  },
  baselineHelpTextContainer: {
    width: '100%',
    padding: 10,
    backgroundColor: '#f7f9fc',
    borderRadius: 8,
    marginBottom: 15,
  },
  baselineHelpText: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 14,
    color: ABAETE_COLORS.textSecondary,
    textAlign: 'center',
  },
  trialsLog: { 
    marginTop: 10, 
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  trialLogItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f9fc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  trialLogStatus: {
    fontFamily: FONT_FAMILY.Bold,
    fontSize: 16,
    width: 30,
  },
  trialLogHelp: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 14,
    color: ABAETE_COLORS.textSecondary,
    flex: 1, // Ocupa o espaço do meio
    textAlign: 'center',
  },
  trialLogScore: {
    fontFamily: FONT_FAMILY.SemiBold,
    fontSize: 14,
    color: ABAETE_COLORS.primaryBlue,
  }
});