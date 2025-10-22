import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView, View, Text, ScrollView, TouchableOpacity, StyleSheet, 
  Alert, ActivityIndicator, FlatList, TextInput, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';
import { FIREBASE_DB } from '../services/firebaseConnection';
import { ref, onValue, get, update, off, set, push, remove } from 'firebase/database';

const phaseTranslations = {
    baseline: 'Linha de Base',
    intervention: 'Intervenção',
    maintenance: 'Manutenção',
    generalization: 'Generalização',
};

const ProgramTabs = ({ activePrograms, activeProgramId, onSelectProgram, onEndProgram }) => (
    <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.programTabsContainer}>
            {activePrograms.map(prog => (
                <TouchableOpacity
                    key={prog.id}
                    style={[styles.programTab, activeProgramId === prog.id && styles.programTabActive]}
                    onPress={() => onSelectProgram(prog.id)}
                >
                    <Text style={[styles.programTabText, activeProgramId === prog.id && styles.programTabTextActive]} numberOfLines={1}>
                        {prog.name}
                    </Text>
                    <TouchableOpacity style={styles.closeTabButton} onPress={() => onEndProgram(prog.id)}>
                        <MaterialIcons name="close" size={16} color={activeProgramId === prog.id ? '#fff' : ABAETE_COLORS.textSecondary} />
                    </TouchableOpacity>
                </TouchableOpacity>
            ))}
        </ScrollView>
    </View>
);

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

const ProgramSelectionStep = ({ patientName, availablePrograms, onStartSession, loading }) => {
    // O Hook `useState` agora está no nível superior deste componente, o que é correto.
    const [selected, setSelected] = useState([]);

    const toggleSelection = (program) => {
        setSelected(prev => 
            prev.find(p => p.id === program.id)
                ? prev.filter(p => p.id !== program.id)
                : [...prev, program]
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Text style={styles.headerTitle}>Iniciar Sessão ABA</Text>
                <Text style={styles.patientInfo}>Paciente: {patientName}</Text>
                <Text style={styles.label}>Selecione os programas a serem aplicados:</Text>
                
                {loading ? <ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} /> : (
                    <FlatList
                        data={availablePrograms}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => {
                            const isSelected = selected.find(p => p.id === item.id);
                            return (
                                <TouchableOpacity 
                                    style={[styles.programItem, isSelected && styles.programItemSelected]} 
                                    onPress={() => toggleSelection(item)}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.programItemTitle, isSelected && {color: ABAETE_COLORS.primaryBlue}]}>{item.name}</Text>
                                        <Text style={styles.programItemSubtitle}>Fase Atual: {phaseTranslations[item.programProgress.currentPhase]}</Text>
                                    </View>
                                    <MaterialIcons 
                                        name={isSelected ? "check-box" : "check-box-outline-blank"} 
                                        size={26} 
                                        color={ABAETE_COLORS.primaryBlue} 
                                    />
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={<Text style={styles.emptyStateText}>Nenhum programa atribuído a este paciente.</Text>}
                    />
                )}

                <TouchableOpacity 
                    style={[styles.buttonPrimary, selected.length === 0 && {backgroundColor: ABAETE_COLORS.mediumGray}]} 
                    onPress={() => onStartSession(selected)} 
                    disabled={selected.length === 0}
                >
                    <Text style={styles.buttonText}>Iniciar Sessão ({selected.length})</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

// --- TELA PRINCIPAL: NewAbaScreen ---
export const NewAbaScreen = ({ route, navigation }) => {
    const { appointmentData: initialAppointmentData, patientId, patientName, professionalId } = route.params; 
    
    // Estados principais
    const [step, setStep] = useState('program_selection');
    const [availablePrograms, setAvailablePrograms] = useState([]);
    const [activePrograms, setActivePrograms] = useState([]);
    const [activeProgramId, setActiveProgramId] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Estados para coletar dados da sessão
    const [sessionStartTime, setSessionStartTime] = useState(null); // Guarda o momento em que a sessão REALMENTE começou
    const [sessionTrialData, setSessionTrialData] = useState({}); // Guarda os dados das tentativas
    const [completedProgramData, setCompletedProgramData] = useState({}); // Guarda os resultados de programas já finalizados
    const [isSaving, setIsSaving] = useState(false);
    
    const [detailedHelpLevels, setDetailedHelpLevels] = useState({});

    useEffect(() => {
        const programsRef = ref(FIREBASE_DB, `users/${patientId}/assignedPrograms`);
        const listener = onValue(programsRef, (snapshot) => {
            const programs = [];
            if (snapshot.exists()) {
                const promises = Object.entries(snapshot.val()).map(async ([programId, programData]) => {
                    const program = { id: programId, ...programData };
                    const progressSnap = await get(ref(FIREBASE_DB, `users/${patientId}/programProgress/${programId}`));
                    program.programProgress = progressSnap.exists() 
                        ? progressSnap.val() 
                        : { currentPhase: program.baseline?.enabled ? 'baseline' : 'intervention', sessionHistory: [] };
                    return program;
                });
                Promise.all(promises).then(resolvedPrograms => {
                    setAvailablePrograms(resolvedPrograms);
                    setLoading(false);
                });
            } else {
                setLoading(false);
            }
        });
        
        get(ref(FIREBASE_DB, 'helpLevels')).then(snap => snap.exists() && setDetailedHelpLevels(snap.val()));

        return () => off(programsRef, 'value', listener);
    }, [patientId]);

    const handleStartSession = (selectedPrograms) => {
        if (selectedPrograms.length === 0) return;
        
        setSessionStartTime(new Date()); // Apenas marca o tempo de início
        setActivePrograms(selectedPrograms);
        setActiveProgramId(selectedPrograms[0].id);
        setStep('session_execution'); // Simplesmente muda a tela, sem DB
    };

    const handleRegisterTrial = useCallback((programId, targetName, trials) => {
        const safeKey = targetName.replace(/[.#$[\]/]/g, '_');
        setSessionTrialData(prev => ({
            ...prev,
            [programId]: { ...(prev[programId] || {}), [safeKey]: trials }
        }));
    }, []);

    const handleEndProgram = (programIdToEnd) => {
        const programName = activePrograms.find(p => p.id === programIdToEnd)?.name;
        Alert.alert("Encerrar Programa", `Deseja finalizar o programa "${programName}"?`, [
            { text: "Cancelar", style: "cancel" },
            { text: "Finalizar", onPress: () => finalizeProgram(programIdToEnd) }
        ]);
    };

    const finalizeProgram = (programIdToFinalize) => {
        const program = activePrograms.find(p => p.id === programIdToFinalize);
        const programTrials = sessionTrialData[programIdToFinalize] || {};
        
        // Calcula a acurácia para este programa
        let totalScore = 0, totalTrials = 0;
        Object.values(programTrials).forEach(trials => {
            trials.forEach(trial => { totalScore += trial.score; totalTrials++; });
        });
        const accuracy = totalTrials > 0 ? Math.round((totalScore / totalTrials) * 100) : 0;
        
        // Guarda os dados finalizados deste programa no estado
        setCompletedProgramData(prev => ({
            ...prev,
            [programIdToFinalize]: {
                accuracy,
                phaseConducted: program.programProgress.currentPhase,
                programId: program.id,
                programName: program.name,
                trialsData: Object.entries(programTrials).map(([targetKey, attempts]) => ({ 
                    target: targetKey.replace(/_/g, ' '), 
                    attempts 
                })),
            }
        }));

        // Remove o programa da lista ativa
        const remainingPrograms = activePrograms.filter(p => p.id !== programIdToFinalize);
        setActivePrograms(remainingPrograms);

        if (remainingPrograms.length > 0) {
            setActiveProgramId(remainingPrograms[0].id);
        } else {
            // Se foi o último, aciona o salvamento final de toda a sessão
            saveEntireSession();
        }
    };
    
    const saveEntireSession = async () => {
        if (isSaving) return;
        setIsSaving(true);
        
        // Agrupa os dados de todos os programas finalizados
        const finalAbaData = Object.values(completedProgramData);

        // Se nenhum dado foi coletado, não salva nada
        if (finalAbaData.length === 0) {
            Alert.alert("Atenção", "Nenhuma tentativa foi registrada. A sessão não será salva.", [
                { text: "OK", onPress: () => navigation.goBack() }
            ]);
            setIsSaving(false);
            return;
        }

        const endTime = new Date();
        const durationMinutes = Math.round((endTime.getTime() - sessionStartTime.getTime()) / 60000);
        
        // Pega a acurácia média de todos os programas aplicados
        const overallAccuracy = Math.round(finalAbaData.reduce((sum, prog) => sum + prog.accuracy, 0) / finalAbaData.length);

        const finalAppointment = {
            patientId, professionalId,
            dateTimeStart: sessionStartTime.toISOString(),
            dateTimeEnd: endTime.toISOString(),
            durationMinutes,
            status: 'completed',
            type: 'Sessão ABA',
            createdAt: new Date().toISOString(),
            createdBy: professionalId,
            // O abaData agora pode conter múltiplos programas
            abaData: {
                accuracy: overallAccuracy,
                sessionNotes: '', // Adicionar um campo de notas gerais se desejar
                programs: finalAbaData, // Array com os resultados de cada programa
            }
        };

        try {
            // A ÚNICA operação de escrita no Firebase
            await push(ref(FIREBASE_DB, 'appointments'), finalAppointment);

            // Adiciona a exceção na regra de 'schedules' para invalidar o agendamento virtual
            if (initialAppointmentData.isVirtual) {
                const [scheduleId, timestamp] = initialAppointmentData.id.split('_');
                const originalDateTime = new Date(parseInt(timestamp));
                const exceptionKey = createSafeFirebaseKeyFromDate(originalDateTime); // Use a função auxiliar que criamos
                await set(ref(FIREBASE_DB, `schedules/${scheduleId}/exceptions/cancelled/${exceptionKey}`), true);
            }
            
            Alert.alert("Sessão Salva", "Todos os dados da sessão foram salvos com sucesso.", [
                { text: "OK", onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error("Erro ao salvar sessão:", error);
            Alert.alert("Erro", "Não foi possível salvar a sessão.");
        } finally {
            setIsSaving(false);
        }
    };

    // ----- RENDERIZAÇÃO -----
    
    if (step === 'program_selection') {
        return (
            <ProgramSelectionStep
                patientName={patientName}
                availablePrograms={availablePrograms}
                onStartSession={handleStartSession}
                loading={loading}
            />
        );
    }
    
    if (step === 'session_execution') {
        const currentProgram = activePrograms.find(p => p.id === activeProgramId);
        
        // --- LÓGICA DE CÁLCULO ADICIONADA AQUI ---
        let phaseKey, translatedPhase, phaseConfig, totalSessionsInPhase, completedSessionsInPhase, sessionCounterText = '';

        if (currentProgram) {
            phaseKey = currentProgram.programProgress.currentPhase;
            translatedPhase = phaseTranslations[phaseKey] || (phaseKey.charAt(0).toUpperCase() + phaseKey.slice(1));
            phaseConfig = currentProgram[phaseKey]; // Ex: currentProgram.baseline, currentProgram.intervention
            
            if (phaseConfig?.sessions) {
                totalSessionsInPhase = phaseConfig.sessions;
                // O histórico de sessões ainda não está sendo atualizado em tempo real,
                // então vamos pegar do progresso inicial
                completedSessionsInPhase = currentProgram.programProgress.sessionHistory?.filter(s => s.phase === phaseKey).length || 0;
                sessionCounterText = `Sessão ${completedSessionsInPhase + 1} de ${totalSessionsInPhase}`;
            }
        }
        // --- FIM DA LÓGICA ---

        return (
            <SafeAreaView style={styles.safeArea}>
                <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[2]}>
                    <Text style={styles.headerTitle}>Sessão em Andamento</Text>
                    <Text style={styles.patientInfo}>Paciente: {patientName}</Text>
                    
                    <ProgramTabs
                        activePrograms={activePrograms}
                        activeProgramId={activeProgramId}
                        onSelectProgram={setActiveProgramId}
                        onEndProgram={handleEndProgram}
                    />

                    {currentProgram ? (
                        <View style={{ marginTop: 20 }}>
                            {/* --- infoBox CORRIGIDO E COMPLETO --- */}
                            <View style={styles.infoBox}>
                              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                                  <Text style={styles.infoBoxTitle}>Fase Atual: <Text style={{ color: ABAETE_COLORS.textPrimary }}>{translatedPhase}</Text></Text>
                                  {sessionCounterText ? <Text style={styles.phaseCounterText}>{sessionCounterText}</Text> : null}
                              </View>
                              {currentProgram.description ? <Text style={styles.infoBoxContent}>{currentProgram.description}</Text> : null}
                            </View>
                            {/* --- FIM DA CORREÇÃO --- */}

                            <Text style={styles.sectionTitle}>Registro de Tentativas</Text>
                            {currentProgram.targets.map(target => (
                                <TargetTrialCard 
                                    key={`${currentProgram.id}-${target}`} 
                                    targetName={target} 
                                    program={currentProgram}
                                    onRegisterTrial={(targetName, trials) => handleRegisterTrial(currentProgram.id, targetName, trials)} 
                                    detailedHelpLevels={detailedHelpLevels} 
                                />
                            ))}
                        </View>
                    ) : (
                        <View style={styles.centered}>
                            <ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} />
                            <Text style={styles.emptyStateText}>Finalizando e salvando sessão...</Text>
                        </View>
                    )}
                    
                    <View style={{ height: 50 }} />
                </ScrollView>
                {isSaving && <ActivityIndicator style={StyleSheet.absoluteFill} size="large" color={ABAETE_COLORS.primaryBlue} />}
            </SafeAreaView>
        );
    }

    return <SafeAreaView style={styles.safeArea}><ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} /></SafeAreaView>;
};

function createSafeFirebaseKeyFromDate(date) {
    const pad = (num) => String(num).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
}

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
  },
  // Estilos para seleção de múltiplos programas
  programItemSelected: {
    backgroundColor: ABAETE_COLORS.primaryBlueLight,
    borderColor: ABAETE_COLORS.primaryBlue,
  },
  
  // Estilos para a barra de abas de programas
  programTabsContainer: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: ABAETE_COLORS.lightGray,
  },
  programTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 10,
  },
  programTabActive: {
    backgroundColor: ABAETE_COLORS.primaryBlue,
  },
  programTabText: {
    fontFamily: FONT_FAMILY.SemiBold,
    color: ABAETE_COLORS.textSecondary,
    maxWidth: 120, // Evita que nomes longos quebrem o layout
  },
  programTabTextActive: {
    color: '#fff',
  },
  closeTabButton: {
    marginLeft: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});