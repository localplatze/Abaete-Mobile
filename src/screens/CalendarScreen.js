import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { ref, onValue, query, orderByChild, equalTo, update, set as firebaseSet, remove } from 'firebase/database';
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
    const statusInfo = {
        scheduled: { text: 'Agendado', color: ABAETE_COLORS.primaryBlue, icon: 'event' },
        completed: { text: 'Concluído', color: ABAETE_COLORS.successGreen, icon: 'check-circle' },
        cancelled: { text: 'Cancelado', color: ABAETE_COLORS.errorRed, icon: 'cancel' },
    }[item.status] || { text: item.status, color: ABAETE_COLORS.textSecondary, icon: 'help-outline' };

    const handleLongPress = () => {
        if (item.status === 'scheduled' && new Date(item.dateTimeStart) > new Date()) {
            Alert.alert(
                "Cancelar Agendamento",
                `Deseja cancelar a sessão de ${item.type} com ${item.patientName}?`,
                [
                    { text: "Não", style: "cancel" },
                    { text: "Sim", style: "destructive", onPress: () => onCancelAppointment(item) }
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
                        appointmentData: item, // Passa o objeto inteiro para a tela de ABA
                        patientId: item.patientId, patientName: item.patientName,
                        professionalId: item.professionalId, programId: item.programId
                    });
                }
            }}
            onLongPress={handleLongPress}
            disabled={item.status !== 'scheduled'}
        >
            <View style={styles.agendaCardTime}>
                <Text style={styles.agendaHourText}>{String(new Date(item.dateTimeStart).getHours()).padStart(2, '0')}</Text>
                <Text style={styles.agendaMinuteText}>{String(new Date(item.dateTimeStart).getMinutes()).padStart(2, '0')}</Text>
            </View>
            <View style={[styles.agendaCardDivider, { backgroundColor: statusInfo.color }]} />
            <View style={styles.agendaCardDetails}>
                <Text style={styles.agendaCardPaciente}>{item.patientName}</Text>
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
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    // Estados para os dados processados
    const [appointmentsByDate, setAppointmentsByDate] = useState({});
    const [markedDates, setMarkedDates] = useState({});
    const [loading, setLoading] = useState(true);

    // Efeito principal que busca dados e processa o calendário
    useEffect(() => {
        if (!professionalId) return;

        const schedulesRef = query(ref(FIREBASE_DB, 'schedules'), orderByChild('professionalId'), equalTo(professionalId));
        const appointmentsRef = query(ref(FIREBASE_DB, 'appointments'), orderByChild('professionalId'), equalTo(professionalId));

        const processData = async (schedulesSnapshot, appointmentsSnapshot) => {
            setLoading(true);
            
            const schedules = schedulesSnapshot.exists() ? schedulesSnapshot.val() : {};
            const appointments = appointmentsSnapshot.exists() ? appointmentsSnapshot.val() : {};
            
            const patientCache = {};
            const generatedAppointments = {};
            const marks = {};

            const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
            const endOfMonth = new Date(currentYear, currentMonth, 0);

            // 1. Gera agendamentos "virtuais" a partir das regras em 'schedules'
            for (const scheduleId in schedules) {
                const rule = { id: scheduleId, ...schedules[scheduleId] };
                for (let day = new Date(startOfMonth); day <= endOfMonth; day.setDate(day.getDate() + 1)) {
                    const ruleStart = new Date(rule.startDate + 'T00:00:00');
                    const ruleEnd = new Date(rule.endDate + 'T23:59:59');

                    if (day >= ruleStart && day <= ruleEnd) {
                        const dayOfWeek = day.getDay();
                        const timetableForDay = Array.isArray(rule.weeklyTimetable) ? rule.weeklyTimetable[dayOfWeek] : rule.weeklyTimetable[dayOfWeek.toString()];
                        
                        if (timetableForDay) {
                            for (const time of timetableForDay) {
                                const [hour, minute] = time.split(':');
                                const appDateTime = new Date(day);
                                appDateTime.setHours(parseInt(hour), parseInt(minute), 0, 0);
                                const exceptionKey = appDateTime.toISOString().replace(/\./g, ',');

                                if (!rule.exceptions?.cancelled?.[exceptionKey]) {
                                    const dateStr = day.toISOString().split('T')[0];
                                    if (!generatedAppointments[dateStr]) generatedAppointments[dateStr] = [];
                                    
                                    if (!patientCache[rule.patientId]) {
                                        const user = await getCachedUserData(rule.patientId);
                                        patientCache[rule.patientId] = user.displayName;
                                    }

                                    generatedAppointments[dateStr].push({
                                        id: `${rule.id}_${appDateTime.getTime()}`,
                                        isVirtual: true, // Identifica que veio de uma regra
                                        ...rule,
                                        patientName: patientCache[rule.patientId],
                                        dateTimeStart: appDateTime.toISOString(),
                                        status: 'scheduled'
                                    });
                                    marks[dateStr] = { marked: true, dotColor: ABAETE_COLORS.primaryBlue };
                                }
                            }
                        }
                    }
                }
            }
            
            // 2. Mescla com agendamentos "reais" de 'appointments' (concluídos, cancelados, únicos)
            for (const appId in appointments) {
                const app = { id: appId, ...appointments[appId] };
                const appDate = new Date(app.dateTimeStart);

                if (appDate.getFullYear() === currentYear && appDate.getMonth() === currentMonth - 1) {
                    const dateStr = appDate.toISOString().split('T')[0];
                    if (!generatedAppointments[dateStr]) generatedAppointments[dateStr] = [];

                    if (!patientCache[app.patientId]) {
                        const user = await getCachedUserData(app.patientId);
                        patientCache[app.patientId] = user.displayName;
                    }

                    // Se já existe um agendamento virtual no mesmo horário, remove-o
                    const existingVirtualIndex = generatedAppointments[dateStr].findIndex(vApp => new Date(vApp.dateTimeStart).getTime() === appDate.getTime());
                    if (existingVirtualIndex !== -1) {
                        generatedAppointments[dateStr].splice(existingVirtualIndex, 1);
                    }
                    
                    generatedAppointments[dateStr].push({ ...app, patientName: patientCache[app.patientId] });

                    if (app.status === 'scheduled') {
                        marks[dateStr] = { marked: true, dotColor: ABAETE_COLORS.primaryBlue };
                    }
                }
            }

            setAppointmentsByDate(generatedAppointments);
            setMarkedDates(marks);
            setLoading(false);
        };

        let schedulesData, appointmentsData;
        const onSchedules = onValue(schedulesRef, (snapshot) => { schedulesData = snapshot; if (appointmentsData) processData(schedulesData, appointmentsData); });
        const onAppointments = onValue(appointmentsRef, (snapshot) => { appointmentsData = snapshot; if (schedulesData) processData(schedulesData, appointmentsData); });

        return () => {
            onSchedules();
            onAppointments();
        };
    }, [professionalId, currentMonth, currentYear]);

    const handleCancelAppointment = useCallback(async (appointment) => {
        if (appointment.isVirtual) {
            // Se é um agendamento de uma regra, adiciona uma exceção
            const [scheduleId, isoDateTime] = appointment.id.split('_');
            const exceptionKey = isoDateTime.replace(/\./g, ',');
            const exceptionRef = ref(FIREBASE_DB, `schedules/${scheduleId}/exceptions/cancelled/${exceptionKey}`);
            try {
                await firebaseSet(exceptionRef, true);
                Alert.alert("Sucesso", "A ocorrência foi cancelada.");
            } catch (error) { Alert.alert("Erro", "Não foi possível cancelar."); }
        } else {
            // Se é um agendamento único, atualiza seu status
            const appointmentRef = ref(FIREBASE_DB, `appointments/${appointment.id}`);
            try {
                await update(appointmentRef, { status: 'cancelled' });
                Alert.alert("Sucesso", "O agendamento foi cancelado.");
            } catch (error) { Alert.alert("Erro", "Não foi possível cancelar."); }
        }
    }, []);

    const appointmentsForSelectedDay = useMemo(() => {
        const appointments = appointmentsByDate[selectedDate] || [];
        return appointments.sort((a, b) => new Date(a.dateTimeStart) - new Date(b.dateTimeStart));
    }, [selectedDate, appointmentsByDate]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}><MaterialIcons name="arrow-back" size={26} color={ABAETE_COLORS.primaryBlue} /></TouchableOpacity>
                <Text style={styles.headerTitle}>Calendário</Text>
                <View style={{ width: 26 }} />
            </View>

            <Calendar
                onMonthChange={(month) => {
                    setCurrentMonth(month.month);
                    setCurrentYear(month.year);
                }}
                onDayPress={(day) => setSelectedDate(day.dateString)}
                markedDates={{ ...markedDates, [selectedDate]: { ...markedDates[selectedDate], selected: true, selectedColor: ABAETE_COLORS.primaryBlue } }}
                theme={{ arrowColor: ABAETE_COLORS.primaryBlue, todayTextColor: ABAETE_COLORS.primaryBlue, textMonthFontFamily: FONT_FAMILY.Bold, textDayHeaderFontFamily: FONT_FAMILY.SemiBold }}
            />

            <View style={styles.listHeader}>
                <Text style={styles.listTitle}>Agendamentos para {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={ABAETE_COLORS.primaryBlue} style={{ marginTop: 20 }}/>
            ) : (
                <FlatList
                    data={appointmentsForSelectedDay}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => <AppointmentItem item={item} navigation={navigation} onCancelAppointment={handleCancelAppointment} />}
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