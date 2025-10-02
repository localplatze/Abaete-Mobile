import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database';
import { FIREBASE_DB } from '../services/firebaseConnection';
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';
import { MaterialIcons } from '@expo/vector-icons';
import { getCachedUserData } from '../services/userCache';

LocaleConfig.locales['pt-br'] = {
  monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  dayNames: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
  dayNamesShort: ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'],
  today: 'Hoje'
};
LocaleConfig.defaultLocale = 'pt-br';

const AppointmentItem = ({ item, navigation, professionalId, onCancelAppointment }) => {
    const [patientName, setPatientName] = useState('Carregando...');

    useEffect(() => {
        let isMounted = true;
        getCachedUserData(item.patientId).then(user => {
            if (isMounted) setPatientName(user.displayName);
        });
        return () => { isMounted = false; };
    }, [item.patientId]);

    const statusMap = {
        scheduled: { text: 'Agendado', color: ABAETE_COLORS.primaryBlue, icon: 'event' },
        completed: { text: 'Concluído', color: ABAETE_COLORS.successGreen, icon: 'check-circle' },
        cancelled_by_professional: { text: 'Cancelado', color: ABAETE_COLORS.errorRed, icon: 'cancel' },
    };
    const statusInfo = statusMap[item.status] || { text: item.status, color: ABAETE_COLORS.textSecondary, icon: 'help-outline' };

    const handleLongPress = () => {
        // Permite o cancelamento apenas de agendamentos futuros
        if (item.status === 'scheduled' && new Date(item.dateTimeStart) > new Date()) {
            Alert.alert(
                "Cancelar Agendamento",
                `Deseja cancelar a sessão de ${item.type} com ${patientName}?`,
                [
                    { text: "Não", style: "cancel" },
                    { text: "Sim, Cancelar", style: "destructive", onPress: () => onCancelAppointment(item.id) }
                ]
            );
        }
    };

    return (
        <TouchableOpacity 
            style={[styles.agendaCardClean, item.status !== 'scheduled' && styles.disabledCard]} 
            onPress={() => {
                if (item.type === 'Sessão ABA' && item.status === 'scheduled') {
                    navigation.navigate('NewAba', { 
                        appointmentId: item.id, patientId: item.patientId, patientName: patientName,
                        professionalId: professionalId, programId: item.programId
                    });
                }
            }}
            onLongPress={handleLongPress}
            disabled={item.status !== 'scheduled'}
        >
            <View style={styles.agendaCardTime}>
                <Text style={styles.agendaHourText}>{new Date(item.dateTimeStart).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            <View style={[styles.agendaCardDivider, { backgroundColor: statusInfo.color }]} />
            <View style={styles.agendaCardDetails}>
                <Text style={styles.agendaCardPaciente}>{patientName}</Text>
                <Text style={styles.agendaCardTipo}>{item.programName || item.type}</Text>
                <View style={styles.statusBadge}>
                    <MaterialIcons name={statusInfo.icon} size={14} color={statusInfo.color} />
                    <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>{statusInfo.text}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

// Cache para nomes de pacientes
const userCache = {};
async function getCachedPatientName(patientId) {
    if (userCache[patientId]) return userCache[patientId];
    const snapshot = await get(ref(FIREBASE_DB, `users/${patientId}`));
    const name = snapshot.exists() ? snapshot.val().displayName || snapshot.val().fullName : "Paciente";
    userCache[patientId] = name;
    return name;
}

export const CalendarScreen = ({ route, navigation }) => {
    const { professionalId } = route.params;
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [appointmentsByDate, setAppointmentsByDate] = useState({});
    const [markedDates, setMarkedDates] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!professionalId) return;
        const appointmentsRef = query(ref(FIREBASE_DB, 'appointments'), orderByChild('professionalId'), equalTo(professionalId));
        
        const unsubscribe = onValue(appointmentsRef, (snapshot) => {
            const fetchedAppointments = {};
            const marks = {};
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const app = { id: child.key, ...child.val() };
                    const dateStr = new Date(app.dateTimeStart).toISOString().split('T')[0];
                    if (!fetchedAppointments[dateStr]) fetchedAppointments[dateStr] = [];
                    fetchedAppointments[dateStr].push(app);

                    // A marcação agora depende do status
                    if (app.status === 'scheduled') {
                        marks[dateStr] = { marked: true, dotColor: ABAETE_COLORS.primaryBlue };
                    }
                });
            }
            setAppointmentsByDate(fetchedAppointments);
            setMarkedDates(marks);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [professionalId]);

    const handleCancelAppointment = async (appointmentId) => {
        const appointmentRef = ref(FIREBASE_DB, `appointments/${appointmentId}`);
        try {
            await update(appointmentRef, {
                status: 'cancelled_by_professional',
                updatedAt: new Date().toISOString()
            });
            Alert.alert("Sucesso", "O agendamento foi cancelado.");
        } catch (error) {
            console.error("Erro ao cancelar agendamento:", error);
            Alert.alert("Erro", "Não foi possível cancelar o agendamento.");
        }
    };

    const appointmentsForSelectedDay = useMemo(() => {
        const appointments = appointmentsByDate[selectedDate] || [];
        return appointments.sort((a, b) => {
            // Lógica de ordenação: Agendado > Concluído > Cancelado, depois por horário
            const statusOrder = { 'scheduled': 1, 'completed': 2, 'cancelled_by_professional': 3 };
            if ((statusOrder[a.status] || 99) !== (statusOrder[b.status] || 99)) {
                return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
            }
            return new Date(a.dateTimeStart) - new Date(b.dateTimeStart);
        });
    }, [selectedDate, appointmentsByDate]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}><MaterialIcons name="arrow-back" size={26} color={ABAETE_COLORS.primaryBlue} /></TouchableOpacity>
                <Text style={styles.headerTitle}>Calendário</Text>
                <View style={{ width: 26 }} />
            </View>

            <Calendar
                current={selectedDate}
                onDayPress={(day) => setSelectedDate(day.dateString)}
                markedDates={{ ...markedDates, [selectedDate]: { ...markedDates[selectedDate], selected: true, selectedColor: ABAETE_COLORS.primaryBlue } }}
                theme={{ arrowColor: ABAETE_COLORS.primaryBlue, todayTextColor: ABAETE_COLORS.primaryBlue, textMonthFontFamily: FONT_FAMILY.Bold, textDayHeaderFontFamily: FONT_FAMILY.SemiBold }}
            />

            <View style={styles.listHeader}>
                <Text style={styles.listTitle}>Agendamentos para {new Date(selectedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} style={{ marginTop: 20 }}/>
            ) : (
                <FlatList
                    data={appointmentsForSelectedDay}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => <AppointmentItem item={item} navigation={navigation} professionalId={professionalId} />}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={<Text style={styles.emptyText}>Nenhum agendamento para este dia.</Text>}
                />
            )}
        </SafeAreaView>
    );
};

// Reutilize e adapte os estilos da sua tela Home para consistência
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: ABAETE_COLORS.white,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: ABAETE_COLORS.lightGray,
        marginTop: 32,
    },
    headerTitle: {
        fontFamily: FONT_FAMILY.Bold,
        fontSize: 20,
        color: ABAETE_COLORS.textPrimary,
    },
    listHeader: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 10,
    },
    listTitle: {
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 16,
        color: ABAETE_COLORS.textPrimary,
    },
    listContainer: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 30,
        fontFamily: FONT_FAMILY.Regular,
        color: ABAETE_COLORS.textSecondary,
    },
    agendaCardClean: { flexDirection: 'row', backgroundColor: ABAETE_COLORS.white, borderRadius: 12, marginBottom: 15, padding: 15, borderWidth: 1, borderColor: ABAETE_COLORS.lightGray, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, },
    agendaCardTime: { alignItems: 'center', justifyContent: 'center', paddingRight: 15 },
    agendaHourText: { fontFamily: FONT_FAMILY.Bold, fontSize: 16, color: ABAETE_COLORS.primaryBlue },
    agendaCardDivider: { width: 2, backgroundColor: ABAETE_COLORS.yellow, marginRight: 15, borderRadius: 1 },
    agendaCardDetails: { flex: 1 },
    agendaCardPaciente: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 16, color: ABAETE_COLORS.textPrimary, marginBottom: 4 },
    agendaCardTipo: { fontFamily: FONT_FAMILY.Regular, fontSize: 14, color: ABAETE_COLORS.textSecondary },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        alignSelf: 'flex-start', // Garante que o badge não estique
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 15,
        backgroundColor: '#f0f0f0' // Fundo padrão
    },
    statusBadgeText: {
        marginLeft: 5,
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 12,
    },
    successGreen: {
        color: '#388E3C', // Cor que faltava
    },
    agendaCardClean: { 
        flexDirection: 'row', 
        backgroundColor: ABAETE_COLORS.white, 
        borderRadius: 12, 
        marginBottom: 15, 
        padding: 15, 
        borderWidth: 1, 
        borderColor: ABAETE_COLORS.lightGray, 
        elevation: 2, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 1 }, 
        shadowOpacity: 0.05, 
        shadowRadius: 2, 
    },
    disabledCard: {
        backgroundColor: '#f9fafb', // Um cinza bem claro para indicar inatividade
        opacity: 0.7,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 15,
        backgroundColor: '#f0f0f0'
    },
    statusBadgeText: {
        marginLeft: 5,
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 12,
    },
    successGreen: {
        color: '#388E3C',
    },
    errorRed: { // Nova cor para cancelado
        color: '#D32F2F',
    },
});