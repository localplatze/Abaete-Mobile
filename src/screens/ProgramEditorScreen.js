import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, TextInput, ScrollView, StyleSheet, Switch,
    TouchableOpacity, Alert, ActivityIndicator, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { ref, get, update, set } from 'firebase/database';
import { FIREBASE_DB, FIREBASE_AUTH } from '../services/firebaseConnection';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// --- Constantes de UI ---
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';

// ====================================================================
// --- COMPONENTES DE UI REUTILIZÁVEIS E ESTILIZADOS ---
// ====================================================================

// Card para agrupar seções de forma elegante
const Card = ({ title, children }) => (
    <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        {children}
    </View>
);

// Input com ícone e label flutuante
const IconTextInput = ({ icon, label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false, ...props }) => (
    <View style={[styles.inputContainer, multiline && { minHeight: 100, alignItems: 'flex-start' }]}>
        {icon && <MaterialIcons name={icon} size={22} color={ABAETE_COLORS.textSecondary} style={styles.inputIcon} />}
        <TextInput
            style={[styles.input, multiline && { textAlignVertical: 'top', height: '100%' }]}
            value={String(value)}
            onChangeText={onChangeText}
            placeholder={label} // Usando o label como placeholder para um design mais limpo
            placeholderTextColor={ABAETE_COLORS.textSecondary}
            keyboardType={keyboardType}
            multiline={multiline}
            {...props}
        />
    </View>
);

// Linha com Switch estilizado
const CustomSwitchRow = ({ label, value, onValueChange }) => (
    <View style={styles.switchRow}>
        <Text style={styles.label}>{label}</Text>
        <Switch
            trackColor={{ false: ABAETE_COLORS.lightGray, true: ABAETE_COLORS.secondaryBlue }}
            thumbColor={value ? ABAETE_COLORS.primaryBlue : '#f4f3f4'}
            onValueChange={onValueChange}
            value={value}
        />
    </View>
);

// Picker estilizado dentro de uma "caixa"
const StyledPicker = ({ selectedValue, onValueChange, items, label }) => (
    <View>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.pickerWrapper}>
            <Picker
                selectedValue={selectedValue}
                onValueChange={onValueChange}
                style={styles.picker}
            >
                {items.map(item => <Picker.Item key={item.value} label={item.label} value={item.value} />)}
            </Picker>
        </View>
    </View>
);

// Tag para exibir itens em uma lista (ex: alvos, níveis de ajuda)
const Tag = ({ text, onRemove }) => (
    <View style={styles.tag}>
        <Text style={styles.tagText}>{text}</Text>
        {onRemove && (
            <TouchableOpacity onPress={onRemove} style={styles.tagRemoveIcon}>
                <MaterialIcons name="close" size={16} color={ABAETE_COLORS.primaryBlue} />
            </TouchableOpacity>
        )}
    </View>
);

// Texto explicativo para critérios
const CriterionText = ({ text }) => (
    <Text style={styles.criterionText}>
        <MaterialIcons name="info-outline" size={14} color={ABAETE_COLORS.secondaryBlue} />
        <Text> Critério de Avanço: {text}</Text>
    </Text>
);

// ====================================================================
// --- TELA PRINCIPAL ---
// ====================================================================

export const ProgramEditorScreen = ({ route, navigation }) => {
    const { programId } = route.params;
    const isEditing = !!programId;

    // --- ESTADOS ---
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Geral
    const [name, setName] = useState('');
    const [type, setType] = useState('Tentativa');
    const [categories, setCategories] = useState('');
    const [description, setDescription] = useState('');

    // Fases
    const [baselineEnabled, setBaselineEnabled] = useState(false);
    const [baselineSessions, setBaselineSessions] = useState('2');
    const [interventionSessions, setInterventionSessions] = useState('10');
    const [interventionPercentage, setInterventionPercentage] = useState('80');
    const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
    const [maintenanceSessions, setMaintenanceSessions] = useState('5');
    const [maintenanceFrequency, setMaintenanceFrequency] = useState('Semanalmente');
    const [generalizationEnabled, setGeneralizationEnabled] = useState(false);
    const [generalizationSessions, setGeneralizationSessions] = useState('3');
    const [autoProgression, setAutoProgression] = useState(true);

    // Alvos (Refatorado para usar array)
    const [minAttempts, setMinAttempts] = useState('5');
    const [individualProgression, setIndividualProgression] = useState(true);
    const [targets, setTargets] = useState([]); // Agora é um array
    const [newTarget, setNewTarget] = useState(''); // Input para novo alvo

    // Níveis de Ajuda (Refatorado para UX melhorada)
    const [allHelpLevels, setAllHelpLevels] = useState([]);
    const [selectedHelpLevels, setSelectedHelpLevels] = useState([]);
    const [isHelpPickerOpen, setIsHelpPickerOpen] = useState(false);

    const objective = useMemo(() => {
        return ['Frequência', 'Duração'].includes(type) ? 'Diminuição' : 'Aquisição';
    }, [type]);

    // --- CARREGAMENTO DE DADOS ---
    useEffect(() => {
        navigation.setOptions({ title: isEditing ? 'Editar Programa' : 'Novo Programa' });
        const fetchData = async () => {
            try {
                // Busca níveis de ajuda
                const helpLevelsSnapshot = await get(ref(FIREBASE_DB, 'helpLevels'));
                if (helpLevelsSnapshot.exists()) {
                    const levels = Object.entries(helpLevelsSnapshot.val()).map(([id, name]) => ({ id, name }));
                    setAllHelpLevels(levels);
                }

                // Carrega dados do programa se estiver editando
                if (isEditing) {
                    const programSnapshot = await get(ref(FIREBASE_DB, `programTemplates/${programId}`));
                    if (programSnapshot.exists()) {
                        const data = programSnapshot.val();
                        setName(data.name || '');
                        setType(data.type || 'Tentativa');
                        setCategories((data.categories || []).join(', '));
                        setDescription(data.description || '');
                        setBaselineEnabled(data.baseline?.enabled || false);
                        setBaselineSessions(String(data.baseline?.sessions || '2'));
                        setInterventionSessions(String(data.intervention?.sessions || '10'));
                        setInterventionPercentage(String(data.intervention?.successPercentage || '80'));
                        setMaintenanceEnabled(data.maintenance?.enabled || false);
                        setMaintenanceSessions(String(data.maintenance?.sessions || '5'));
                        setMaintenanceFrequency(data.maintenance?.frequency || 'Semanalmente');
                        setGeneralizationEnabled(data.generalization?.enabled || false);
                        setGeneralizationSessions(String(data.generalization?.sessions || '3'));
                        setAutoProgression(data.autoProgression ?? true);
                        setMinAttempts(String(data.targetsConfig?.minAttempts || '5'));
                        setIndividualProgression(data.targetsConfig?.individualProgression ?? true);
                        setTargets(data.targets || []);
                        setSelectedHelpLevels(data.helpLevels || []);
                    }
                }
            } catch (error) {
                console.error("Erro ao carregar dados:", error);
                Alert.alert("Erro", "Não foi possível carregar os dados.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [programId, isEditing, navigation]);

    // --- HANDLERS ---
    const handleAddTarget = () => {
        if (newTarget.trim() && !targets.includes(newTarget.trim())) {
            setTargets(prev => [...prev, newTarget.trim()]);
            setNewTarget('');
        }
    };

    const handleRemoveTarget = (targetToRemove) => {
        setTargets(prev => prev.filter(t => t !== targetToRemove));
    };

    const handleToggleHelpLevel = (levelId) => {
        setSelectedHelpLevels(prev =>
            prev.includes(levelId) ? prev.filter(id => id !== levelId) : [...prev, levelId]
        );
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Erro', 'O nome do programa é obrigatório.');
            return;
        }
        setIsSaving(true);

        const programData = {
            name, type, objective,
            categories: categories.split(',').map(c => c.trim()).filter(Boolean),
            description,
            baseline: { enabled: baselineEnabled, sessions: parseInt(baselineSessions, 10) || 0 },
            intervention: { sessions: parseInt(interventionSessions, 10) || 0, successPercentage: parseInt(interventionPercentage, 10) || 0 },
            maintenance: { enabled: maintenanceEnabled, sessions: parseInt(maintenanceSessions, 10) || 0, frequency: maintenanceFrequency },
            generalization: { enabled: generalizationEnabled, sessions: parseInt(generalizationSessions, 10) || 0 },
            autoProgression,
            targetsConfig: { minAttempts: parseInt(minAttempts, 10) || 0, individualProgression },
            targets,
            helpLevels: selectedHelpLevels,
            updatedAt: new Date().toISOString(),
        };

        try {
            if (isEditing) {
                await update(ref(FIREBASE_DB, `programTemplates/${programId}`), programData);
            } else {
                programData.id = uuidv4();
                programData.createdAt = new Date().toISOString();
                programData.createdBy = FIREBASE_AUTH.currentUser.uid;
                await set(ref(FIREBASE_DB, `programTemplates/${programData.id}`), programData);
            }
            Alert.alert('Sucesso!', 'Modelo de programa salvo.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } catch (error) {
            console.error("Erro ao salvar programa:", error);
            Alert.alert('Erro', 'Não foi possível salvar o programa.');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} /></View>;
    }

    // --- RENDER ---
    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.container}>
                
                <Card title="Informações Gerais">
                    <IconTextInput icon="article" label="Nome do Programa" value={name} onChangeText={setName} />
                    <StyledPicker
                        label="Tipo de Programa"
                        selectedValue={type}
                        onValueChange={setType}
                        items={[
                            { label: 'Tentativa', value: 'Tentativa' },
                            { label: 'Análise de Tarefas', value: 'Análise de Tarefas' },
                            { label: 'Frequência', value: 'Frequência' },
                            { label: 'Duração', value: 'Duração' },
                        ]}
                    />
                    <IconTextInput icon="flag" label="Objetivo" value={objective} onChangeText={() => {}} editable={false} />
                    <IconTextInput icon="category" label="Categorias (separadas por vírgula)" value={categories} onChangeText={setCategories} />
                    <IconTextInput icon="description" label="Descrição" value={description} onChangeText={setDescription} multiline />
                </Card>

                <Card title="Fases do Programa">
                    {/* Linha de Base */}
                    <CustomSwitchRow label="Habilitar Linha de Base" value={baselineEnabled} onValueChange={setBaselineEnabled} />
                    {baselineEnabled && (
                        <View style={styles.phaseDetails}>
                            <IconTextInput icon="format-list-numbered" label="Nº de Sessões" value={baselineSessions} onChangeText={setBaselineSessions} keyboardType="numeric" />
                            <CriterionText text={`Completar ${baselineSessions} sessões.`} />
                        </View>
                    )}
                    <View style={styles.divider} />

                    {/* Intervenção */}
                    <Text style={styles.subSectionTitle}>Intervenção</Text>
                    <View style={styles.phaseDetails}>
                       <IconTextInput icon="leaderboard" label="Nº de Sessões para Critério" value={interventionSessions} onChangeText={setInterventionSessions} keyboardType="numeric" />
                       <IconTextInput icon="check-circle-outline" label="% de Acertos para Critério" value={interventionPercentage} onChangeText={setInterventionPercentage} keyboardType="numeric" />
                       <CriterionText text={`Atingir ${interventionPercentage}% de acertos em ${interventionSessions} sessões.`} />
                    </View>
                    <View style={styles.divider} />

                    {/* Manutenção */}
                    <CustomSwitchRow label="Habilitar Manutenção" value={maintenanceEnabled} onValueChange={setMaintenanceEnabled} />
                     {maintenanceEnabled && (
                        <View style={styles.phaseDetails}>
                            <IconTextInput icon="event-repeat" label="Nº de Sessões" value={maintenanceSessions} onChangeText={setMaintenanceSessions} keyboardType="numeric" />
                             <StyledPicker
                                label="Frequência"
                                selectedValue={maintenanceFrequency}
                                onValueChange={setMaintenanceFrequency}
                                items={[
                                    { label: 'Diariamente', value: 'Diariamente' },
                                    { label: 'Semanalmente', value: 'Semanalmente' },
                                    { label: 'Mensalmente', value: 'Mensalmente' },
                                ]}
                             />
                            <CriterionText text={`Completar ${maintenanceSessions} sessões com frequência ${maintenanceFrequency.toLowerCase()}.`} />
                        </View>
                    )}
                    <View style={styles.divider} />

                    {/* Generalização */}
                    <CustomSwitchRow label="Habilitar Generalização" value={generalizationEnabled} onValueChange={setGeneralizationEnabled} />
                    {generalizationEnabled && (
                        <View style={styles.phaseDetails}>
                             <IconTextInput icon="people" label="Nº de Sessões" value={generalizationSessions} onChangeText={setGeneralizationSessions} keyboardType="numeric" />
                             <CriterionText text={`Completar ${generalizationSessions} sessões.`} />
                        </View>
                    )}
                    <View style={styles.divider} />
                    
                    <CustomSwitchRow label="Progressão Automática de Fases" value={autoProgression} onValueChange={setAutoProgression} />
                </Card>

                <Card title="Alvos">
                    <IconTextInput icon="functions" label="Nº Mínimo de Tentativas por Alvo" value={minAttempts} onChangeText={setMinAttempts} keyboardType="numeric" />
                    <CustomSwitchRow label="Progressão Individual de Alvos" value={individualProgression} onValueChange={setIndividualProgression} />
                    <View style={styles.addTargetContainer}>
                        <IconTextInput icon="add-task" label="Adicionar novo alvo" value={newTarget} onChangeText={setNewTarget} style={{ flex: 1 }} />
                        <TouchableOpacity style={styles.addButton} onPress={handleAddTarget}>
                            <MaterialIcons name="add" size={24} color={ABAETE_COLORS.white} />
                        </TouchableOpacity>
                    </View>
                    
                    {targets.length > 0 && (
                        <>
                            <Text style={styles.listHeader}>Alvos Adicionados:</Text>
                            <View style={styles.tagList}>
                                {targets.map(item => (
                                    <Tag key={item} text={item} onRemove={() => handleRemoveTarget(item)} />
                                ))}
                            </View>
                        </>
                    )}
                </Card>

                <Card title="Níveis de Ajuda">
                    <TouchableOpacity style={styles.pickerHeader} onPress={() => setIsHelpPickerOpen(!isHelpPickerOpen)}>
                        <Text style={styles.pickerHeaderText}>
                            {selectedHelpLevels.length > 0 ? `${selectedHelpLevels.length} níveis selecionados` : 'Selecionar níveis de ajuda'}
                        </Text>
                        <MaterialIcons name={isHelpPickerOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={24} color={ABAETE_COLORS.primaryBlue} />
                    </TouchableOpacity>

                    {isHelpPickerOpen && (
                        <View style={styles.chipContainer}>
                            {allHelpLevels.map(level => {
                                const isSelected = selectedHelpLevels.includes(level.id);
                                return (
                                    <TouchableOpacity
                                        key={level.id}
                                        style={[styles.chip, isSelected && styles.chipSelected]}
                                        onPress={() => handleToggleHelpLevel(level.id)}
                                    >
                                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                            {level.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                    
                    {selectedHelpLevels.length > 0 && (
                        <View style={styles.selectedItemsContainer}>
                            <Text style={styles.listHeader}>Níveis Escolhidos:</Text>
                            <View style={styles.tagList}>
                                {allHelpLevels
                                    .filter(level => selectedHelpLevels.includes(level.id))
                                    .map(level => <Tag key={level.id} text={level.name} />)
                                }
                            </View>
                        </View>
                    )}
                </Card>

                <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Salvar Programa</Text>}
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
};

// ====================================================================
// --- ESTILOS ---
// ====================================================================

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f0f2f5' },
    container: { padding: 16, paddingBottom: 50, gap: 16 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f5' },
    
    // --- Componente Card ---
    card: {
        backgroundColor: ABAETE_COLORS.white,
        borderRadius: 12,
        padding: 16,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        gap: 16, // Espaçamento entre os filhos do card
    },
    cardTitle: {
        fontFamily: FONT_FAMILY.Bold,
        fontSize: 20,
        color: ABAETE_COLORS.primaryBlue,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: ABAETE_COLORS.lightGray,
    },
    subSectionTitle: {
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 16,
        color: ABAETE_COLORS.textPrimary,
        marginTop: 8,
    },

    // --- Inputs e Pickers ---
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f7f9fc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: ABAETE_COLORS.lightGray,
        paddingHorizontal: 12,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        paddingVertical: Platform.OS === 'ios' ? 14 : 10,
        fontSize: 16,
        fontFamily: FONT_FAMILY.Regular,
        color: ABAETE_COLORS.textPrimary,
    },
    label: {
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 14,
        color: ABAETE_COLORS.textSecondary,
        marginBottom: 6,
        marginLeft: 4,
    },
    pickerWrapper: {
        backgroundColor: '#f7f9fc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: ABAETE_COLORS.lightGray,
        justifyContent: 'center',
    },
    picker: {
      color: ABAETE_COLORS.textPrimary,
    },

    // --- Switch ---
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },

    // --- Fases ---
    phaseDetails: {
        padding: 12,
        backgroundColor: '#fafbff',
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: ABAETE_COLORS.secondaryBlue,
        gap: 12,
    },
    criterionText: {
        fontFamily: FONT_FAMILY.Regular,
        fontSize: 13,
        color: ABAETE_COLORS.textSecondary,
        fontStyle: 'italic',
        marginTop: 4,
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#eef2f9',
    },
    divider: { height: 1, backgroundColor: '#e9ecef', marginVertical: 8 },

    // --- Alvos ---
    addTargetContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    addButton: {
        backgroundColor: ABAETE_COLORS.primaryBlue,
        padding: 12,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listHeader: {
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 14,
        color: ABAETE_COLORS.textPrimary,
        marginTop: 16,
        marginBottom: 8,
    },

    // --- Tags (para Alvos e Níveis de Ajuda) ---
    tagList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: ABAETE_COLORS.secondaryBlue + '20', // Azul secundário com 20% de opacidade
        borderRadius: 16,
        paddingVertical: 6,
        paddingLeft: 12,
        paddingRight: 6,
    },
    tagText: {
        fontFamily: FONT_FAMILY.Regular,
        color: ABAETE_COLORS.primaryBlue,
        fontSize: 14,
        marginRight: 6,
    },
    tagRemoveIcon: {
        backgroundColor: ABAETE_COLORS.white,
        borderRadius: 10,
        padding: 2,
    },

    // --- Níveis de Ajuda (Picker Customizado) ---
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: ABAETE_COLORS.lightGray,
    },
    pickerHeaderText: {
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 16,
        color: ABAETE_COLORS.textPrimary,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: ABAETE_COLORS.lightGray,
    },
    chip: {
        backgroundColor: ABAETE_COLORS.lightGray,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    chipSelected: {
        backgroundColor: ABAETE_COLORS.secondaryBlue,
        borderColor: ABAETE_COLORS.primaryBlue,
    },
    chipText: {
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 14,
        color: ABAETE_COLORS.textPrimary,
    },
    chipTextSelected: {
        color: ABAETE_COLORS.white,
    },
    selectedItemsContainer: {
        marginTop: 16,
    },

    // --- Botão Salvar ---
    saveButton: {
        backgroundColor: ABAETE_COLORS.primaryBlue,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        elevation: 2,
        shadowColor: ABAETE_COLORS.primaryBlue,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },
    saveButtonText: {
        color: ABAETE_COLORS.white,
        fontFamily: FONT_FAMILY.Bold,
        fontSize: 18,
    },
});