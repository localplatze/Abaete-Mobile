import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';
import { MaterialIcons } from '@expo/vector-icons';
import { ref, push, set as firebaseSet, serverTimestamp } from 'firebase/database';
import { FIREBASE_DB, FIREBASE_AUTH } from '../services/firebaseConnection';

export const AddTaskModal = ({ visible, onClose, patientId }) => {
    const [title, setTitle] = useState('');
    const [instructions, setInstructions] = useState('');
    const [dueDate, setDueDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveTask = async () => {
        if (!title.trim() || !instructions.trim()) {
            Alert.alert("Campos Obrigatórios", "Por favor, preencha o título e as instruções da tarefa.");
            return;
        }

        setIsSaving(true);
        const professionalId = FIREBASE_AUTH.currentUser?.uid;
        if (!professionalId) {
            Alert.alert("Erro", "Não foi possível identificar o profissional. Faça login novamente.");
            setIsSaving(false);
            return;
        }

        const newTask = {
            patientId: patientId,
            professionalId: professionalId,
            title: title.trim(),
            instructions: instructions.trim(),
            dueDate: dueDate.toISOString().split('T')[0], // Salva a data no formato YYYY-MM-DD
            status: 'pending_responsible', // Status inicial
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            // Outros campos como planActivityId podem ser adicionados aqui se necessário
        };
        
        try {
            const tasksRef = ref(FIREBASE_DB, 'homeworkTasks');
            const newTaskRef = push(tasksRef);
            await firebaseSet(newTaskRef, newTask);
            
            Alert.alert("Sucesso", "Tarefa de casa atribuída com sucesso!");
            onClose(); // Fecha o modal
            setTitle(''); // Limpa os campos
            setInstructions('');
            setDueDate(new Date());
        } catch (error) {
            console.error("Erro ao salvar tarefa:", error);
            Alert.alert("Erro", "Não foi possível salvar a tarefa. Tente novamente.");
        } finally {
            setIsSaving(false);
        }
    };

    const onChangeDate = (event, selectedDate) => {
        setShowDatePicker(false);
        if (selectedDate) {
            setDueDate(selectedDate);
        }
    };

    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Nova Tarefa de Casa</Text>
                    
                    <Text style={styles.modalLabel}>Título da Tarefa</Text>
                    <TextInput style={styles.input} placeholder="Ex: Praticar nomeação de cores" value={title} onChangeText={setTitle} />
                    
                    <Text style={styles.modalLabel}>Instruções para o Responsável</Text>
                    <TextInput style={[styles.input, styles.textArea]} placeholder="Descreva a atividade em detalhes..." multiline value={instructions} onChangeText={setInstructions} />
                    
                    <Text style={styles.modalLabel}>Data de Entrega</Text>
                    <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
                        <Text>{dueDate.toLocaleDateString('pt-BR')}</Text>
                        <MaterialIcons name="calendar-today" size={20} color={ABAETE_COLORS.textSecondary} />
                    </TouchableOpacity>
                    {showDatePicker && (<DateTimePicker value={dueDate} mode="date" display="default" onChange={onChangeDate} minimumDate={new Date()} />)}
                    
                    <View style={styles.modalButtonContainer}>
                        <TouchableOpacity style={styles.modalButtonSecondary} onPress={onClose} disabled={isSaving}>
                            <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButtonPrimary, isSaving && styles.modalButtonDisabled]} onPress={handleSaveTask} disabled={isSaving}>
                            {isSaving ? <ActivityIndicator color="white" /> : <Text style={styles.modalButtonPrimaryText}>Salvar Tarefa</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// Estilos para o modal
const styles = StyleSheet.create({
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { width: '90%', backgroundColor: 'white', borderRadius: 12, padding: 20 },
    modalTitle: { fontFamily: FONT_FAMILY.Bold, fontSize: 20, color: ABAETE_COLORS.primaryBlue, marginBottom: 20, textAlign: 'center' },
    modalLabel: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 14, color: ABAETE_COLORS.textSecondary, marginBottom: 8, marginTop: 10 },
    input: { borderWidth: 1, borderColor: ABAETE_COLORS.lightGray, borderRadius: 8, padding: 12, fontSize: 15, fontFamily: FONT_FAMILY.Regular },
    textArea: { minHeight: 100, textAlignVertical: 'top' },
    dateInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: ABAETE_COLORS.lightGray, borderRadius: 8, padding: 12 },
    modalButtonContainer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 25 },
    modalButtonPrimary: { backgroundColor: ABAETE_COLORS.primaryBlue, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', minWidth: 100 },
    modalButtonPrimaryText: { color: 'white', fontFamily: FONT_FAMILY.SemiBold, fontSize: 15 },
    modalButtonSecondary: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, marginRight: 10 },
    modalButtonSecondaryText: { color: ABAETE_COLORS.textSecondary, fontFamily: FONT_FAMILY.SemiBold, fontSize: 15 },
    modalButtonDisabled: { backgroundColor: ABAETE_COLORS.mediumGray },
});