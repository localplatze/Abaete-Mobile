import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';

export const AnamneseCard = ({ onPress }) => (
    <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pendência Importante</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={onPress}>
            <View style={styles.iconContainer}>
                <MaterialIcons name="assignment" size={28} color={ABAETE_COLORS.primaryBlue} />
            </View>
            <View style={styles.details}>
                <Text style={styles.title}>Formulário de Anamnese</Text>
                <Text style={styles.subtitle}>Por favor, preencha as informações iniciais do paciente para continuarmos.</Text>
            </View>
            <MaterialIcons name="arrow-forward-ios" size={18} color={ABAETE_COLORS.mediumGray} />
        </TouchableOpacity>
    </View>
);

const styles = StyleSheet.create({
    sectionContainer: { marginBottom: 25 },
    sectionHeader: { marginBottom: 15 },
    sectionTitle: { fontFamily: FONT_FAMILY.Bold, fontSize: 18, color: ABAETE_COLORS.textPrimary },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: ABAETE_COLORS.white,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: ABAETE_COLORS.yellow, // Destaque
        elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
    },
    iconContainer: {
        width: 50, height: 50, borderRadius: 25,
        backgroundColor: ABAETE_COLORS.primaryBlueLight,
        justifyContent: 'center', alignItems: 'center',
        marginRight: 15,
    },
    details: { flex: 1 },
    title: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 16, color: ABAETE_COLORS.textPrimary },
    subtitle: { fontFamily: FONT_FAMILY.Regular, fontSize: 14, color: ABAETE_COLORS.textSecondary, marginTop: 4 },
});