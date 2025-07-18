import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';
import { FIREBASE_AUTH, FIREBASE_DB } from '../services/firebaseConnection';
import { ref, update } from 'firebase/database';
import * as Location from 'expo-location';


const TargetForm = ({ target, index, onUpdate, onRemove }) => {
  // --- NOVO: Estado para controlar a visibilidade do formulário ---
  const [isExpanded, setIsExpanded] = useState(true); // Começa expandido por padrão

  const helpOptions = [
    { label: 'Selecione a ajuda...', value: '' },
    { label: 'AFL - Ajuda Física Leve', value: 'AFL' },
    { label: 'AFL 2S - Ajuda Física Leve com Atraso de 2S', value: 'AFL_2S' },
    { label: 'AFL 4S - Ajuda Física Leve com Atraso de 4S', value: 'AFL_4S' },
    { label: 'AG - Ajuda Gestual', value: 'AG' },
    { label: 'AV - Ajuda Visual', value: 'AV' },
  ];

  const showHelp = (title, message) => Alert.alert(title, message);

  return (
    <View style={styles.targetContainer}>
      {/* --- MODIFICADO: Cabeçalho agora é um botão para minimizar/maximizar --- */}
      <TouchableOpacity style={styles.targetHeader} onPress={() => setIsExpanded(!isExpanded)}>
        <View style={styles.targetHeaderLeft}>
          <MaterialIcons 
            name={isExpanded ? 'keyboard-arrow-down' : 'keyboard-arrow-right'} 
            size={28} 
            color={ABAETE_COLORS.secondaryBlue} 
          />
          <Text style={styles.targetTitle}>Meta {index + 1}</Text>
        </View>
        <TouchableOpacity onPress={onRemove}>
          <MaterialIcons name="delete-outline" size={26} color={ABAETE_COLORS.errorRed} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* --- NOVO: O conteúdo do formulário só renderiza se estiver expandido --- */}
      {isExpanded && (
        <View style={styles.formContent}>
          <Text style={styles.targetTimestamp}>Iniciada em: {target.date} às {target.time}</Text>
          
          {/* Materiais Necessários */}
          <View style={styles.labelContainer}>
            <Text style={styles.label}>Materiais Necessários</Text>
            <TouchableOpacity onPress={() => showHelp('Materiais Necessários', 'Liste todos os materiais usados, como: Folha de registro, brinquedos, jogos, reforçadores, etc.')}>
              <MaterialIcons name="help-outline" size={20} color={ABAETE_COLORS.secondaryBlue} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, { height: 80 }]}
            placeholder="Folha de registro, computador, jogo speed cups..."
            value={target.materials}
            onChangeText={text => onUpdate({ materials: text })}
            multiline
          />

          {/* Procedimento de Ensino */}
          <View style={styles.labelContainer}>
            <Text style={styles.label}>Procedimento de Ensino</Text>
            <TouchableOpacity onPress={() => showHelp('Procedimento de Ensino', 'Descreva a estratégia utilizada (DTT, DRA, etc.) e como a atividade foi conduzida.')}>
              <MaterialIcons name="help-outline" size={20} color={ABAETE_COLORS.secondaryBlue} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, { height: 100 }]}
            placeholder="Estratégia de aplicação ABA (DTT) e (DRA)..."
            value={target.procedure}
            onChangeText={text => onUpdate({ procedure: text })}
            multiline
          />

          {/* Quantidade de Tentativas */}
          <Text style={styles.label}>Quantidade de Tentativas</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="Ex: 5"
            value={target.attempts}
            onChangeText={text => onUpdate({ attempts: text })}
          />
          
          {/* Tipo de Ajuda */}
          <Text style={styles.label}>Tipo de Ajuda Oferecida</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={target.helpType}
              onValueChange={value => onUpdate({ helpType: value })}
            >
              {helpOptions.map(opt => <Picker.Item key={opt.value} label={opt.label} value={opt.value} />)}
            </Picker>
          </View>

          {/* Resposta Comportamental */}
          <Text style={styles.label}>Resposta Comportamental / Análise</Text>
          <TextInput
            style={[styles.input, { height: 120 }]}
            placeholder="Descreva o comportamento do paciente durante a atividade, dificuldades e sucessos."
            value={target.behavioralResponse}
            onChangeText={text => onUpdate({ behavioralResponse: text })}
            multiline
          />
        </View>
      )}
    </View>
  );
};

// --- TELA PRINCIPAL: NewAbaScreen ---
export const NewAbaScreen = ({ route, navigation }) => {
  const { appointmentId, patientId, patientName } = route.params;

  // Estados da tela
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [programNumber, setProgramNumber] = useState('');
  const [targets, setTargets] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão Negada', 'A localização não pode ser obtida sem permissão.');
        return;
      }

      try {
        let location = await Location.getCurrentPositionAsync({});
        setCurrentLocation(location);
      } catch (error) {
        console.error("Erro ao obter localização:", error);
        Alert.alert("Erro de Localização", "Não foi possível obter a localização atual.");
      }
    })();
  }, []);

  const handleStartSession = async () => {
    if (!programNumber.trim()) {
      Alert.alert('Campo Obrigatório', 'Por favor, insira o número do programa.');
      return;
    }
    
    const startTime = new Date();
    setSessionStartTime(startTime); // Guarda o objeto Date para o cálculo da duração
    
    // --- MODIFICAÇÃO: Atualiza o appointment com a data de início imediatamente
    const appointmentRef = ref(FIREBASE_DB, `appointments/${appointmentId}`);
    try {
      await update(appointmentRef, {
        dateTimeStart: startTime.toISOString(),
      });
      setIsSessionStarted(true);
      handleAddNewTarget();
    } catch (error) {
        console.error("Erro ao iniciar sessão:", error);
        Alert.alert("Erro", "Não foi possível iniciar a sessão. Verifique sua conexão.");
    }
  };
  
  const handleAddNewTarget = () => {
    const newTarget = {
      // Campos automáticos
      id: Date.now().toString(), // ID temporário para a key do React
      date: new Date().toLocaleDateString('pt-BR'),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit'}),
      // Campos a serem preenchidos
      materials: '',
      procedure: '',
      attempts: '',
      helpType: '', // Sigla
      behavioralResponse: '',
    };
    setTargets(prevTargets => [...prevTargets, newTarget]);
  };
  
  const handleUpdateTarget = (index, updatedField) => {
    const newTargets = [...targets];
    newTargets[index] = { ...newTargets[index], ...updatedField };
    setTargets(newTargets);
  };

  const handleRemoveTarget = (index) => {
    const newTargets = [...targets];
    newTargets.splice(index, 1);
    setTargets(newTargets);
  };
  
  const handleSaveSession = async () => {
    if (targets.length === 0) {
      Alert.alert("Atenção", "Adicione pelo menos uma meta para salvar a sessão.");
      return;
    }
    // Garante que a sessão foi iniciada corretamente
    if (!sessionStartTime) {
      Alert.alert("Erro", "O horário de início da sessão não foi registrado. Tente novamente.");
      return;
    }

    setIsSaving(true);
    const endTime = new Date();
    
    // Calcula a duração em minutos
    const durationMs = endTime.getTime() - sessionStartTime.getTime();
    const durationMinutes = Math.round(durationMs / 60000);

    // Objeto com os dados a serem ATUALIZADOS no appointment
    const updateData = {
      status: 'completed',
      dateTimeEnd: endTime.toISOString(),
      durationMinutes: durationMinutes,
      location: currentLocation 
        ? { lat: currentLocation.coords.latitude, lon: currentLocation.coords.longitude }
        : 'Localização não disponível',
      updatedAt: new Date().toISOString(),
      // Cria um objeto aninhado para os dados específicos da sessão ABA
      abaData: {
        programNumber,
        targets,
      }
    };
    
    try {
      // Referência direta ao agendamento existente
      const appointmentRef = ref(FIREBASE_DB, `appointments/${appointmentId}`);
      // Atualiza o nó com os novos dados
      await update(appointmentRef, updateData);
      
      Alert.alert("Sucesso!", "Sessão ABA salva com sucesso.", [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error("Erro ao salvar sessão ABA:", error);
      Alert.alert("Erro", "Não foi possível salvar a sessão. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- RENDERIZAÇÃO ---
  if (!isSessionStarted) {
    // --- VISUALIZAÇÃO 1: Iniciar Sessão ---
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.headerTitle}>Iniciar Sessão ABA</Text>
          <Text style={styles.patientInfo}>Paciente: {patientName}</Text>
          <Text style={styles.label}>Número do Programa</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: P-123"
            value={programNumber}
            onChangeText={setProgramNumber}
          />
          <TouchableOpacity style={styles.buttonPrimary} onPress={handleStartSession}>
            <Text style={styles.buttonText}>Iniciar Sessão</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- VISUALIZAÇÃO 2: Registrar Metas ---
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <Text style={styles.headerTitle}>Programa: {programNumber}</Text>
        <Text style={styles.patientInfo}>Registrando metas para {patientName}</Text>
        
        {targets.map((target, index) => (
          <TargetForm
            key={target.id}
            index={index}
            target={target}
            onUpdate={(field) => handleUpdateTarget(index, field)}
            onRemove={() => handleRemoveTarget(index)}
          />
        ))}

        <TouchableOpacity style={styles.buttonSecondary} onPress={handleAddNewTarget}>
          <MaterialIcons name="add-circle-outline" size={20} color={ABAETE_COLORS.primaryBlue} />
          <Text style={styles.buttonSecondaryText}>Adicionar Nova Meta</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.buttonPrimary} onPress={handleSaveSession} disabled={isSaving}>
          {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Salvar Sessão Completa</Text>}
        </TouchableOpacity>
        
        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: ABAETE_COLORS.white },
  container: { flex: 1, padding: 20, marginVertical: 32 },
  headerTitle: { fontFamily: FONT_FAMILY.Bold, fontSize: 24, color: ABAETE_COLORS.primaryBlue, textAlign: 'center' },
  patientInfo: { fontFamily: FONT_FAMILY.Regular, fontSize: 16, color: ABAETE_COLORS.textSecondary, textAlign: 'center', marginBottom: 20 },
  label: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 16, color: ABAETE_COLORS.textPrimary, marginBottom: 8, marginTop: 15 },
  labelContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: {
    backgroundColor: ABAETE_COLORS.white,
    borderWidth: 1, borderColor: ABAETE_COLORS.lightGray,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 16, fontFamily: FONT_FAMILY.Regular,
    textAlignVertical: 'top' // para multiline no Android
  },
  buttonPrimary: {
    backgroundColor: ABAETE_COLORS.primaryBlue,
    padding: 15, borderRadius: 8,
    alignItems: 'center', marginTop: 30,
  },
  buttonText: { color: '#fff', fontFamily: FONT_FAMILY.Bold, fontSize: 16 },
  buttonSecondary: {
    flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center',
    padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: ABAETE_COLORS.primaryBlue,
    marginTop: 20,
  },
  buttonSecondaryText: { color: ABAETE_COLORS.primaryBlue, fontFamily: FONT_FAMILY.SemiBold, fontSize: 16, marginLeft: 8 },
  // Estilos do Formulário de Meta
  targetContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: ABAETE_COLORS.lightGray,
    overflow: 'hidden', // Garante que o conteúdo não vaze quando recolhido
  },
  targetHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: 15, // Adiciona padding ao cabeçalho
    backgroundColor: '#f8f9fa' // Uma cor de fundo sutil para o cabeçalho
  },
  targetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetTitle: { 
    fontFamily: FONT_FAMILY.Bold, 
    fontSize: 18, 
    color: ABAETE_COLORS.secondaryBlue, 
    marginLeft: 8, // Espaçamento entre o ícone e o texto
  },
  formContent: {
    paddingHorizontal: 15, // Padding lateral para o conteúdo
    paddingBottom: 15,    // Padding inferior para o conteúdo
  },
  targetTimestamp: { 
    fontFamily: FONT_FAMILY.Regular, 
    fontSize: 12, 
    color: ABAETE_COLORS.textSecondary, 
    marginBottom: 10,
    marginTop: 5, // Pequeno espaço após o cabeçalho
  },
  pickerContainer: { borderWidth: 1, borderColor: ABAETE_COLORS.lightGray, borderRadius: 8, backgroundColor: ABAETE_COLORS.white, },
});