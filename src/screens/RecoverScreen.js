// src/screens/RecoverScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';
// import { sendPasswordResetEmail } from 'firebase/auth'; // Import do Firebase
// import { auth } from '../services/firebaseConfig'; // Seu arquivo de config do Firebase

export const RecoverScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleRecoverPassword = async () => {
    if (!email) {
      setError('Por favor, informe seu e-mail.');
      return;
    }
    setError('');
    setSuccessMessage('');
    setIsLoading(true);
    try {
      // Lógica de recuperação com Firebase
      // await sendPasswordResetEmail(auth, email);
      setSuccessMessage('Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha em breve. Verifique sua caixa de entrada e spam.');
      console.log('Simulando envio de recuperação para:', email); // Simulação
    } catch (e) {
       if (e.code === 'auth/invalid-email') {
        setError('Formato de e-mail inválido.');
      } else if (e.code === 'auth/user-not-found') {
        // Por segurança, podemos mostrar a mesma mensagem de sucesso
        setSuccessMessage('Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha em breve. Verifique sua caixa de entrada e spam.');
      }
      else {
        setError('Ocorreu um erro ao tentar enviar o e-mail de recuperação.');
        console.error("Firebase recovery error:", e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" backgroundColor="#07638F" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back-ios" size={24} color={ABAETE_COLORS.primaryBlue} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recuperar Senha</Text>
        <View style={{width: 24}} />{/* Espaço para centralizar o título */}
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollViewContent}>
            <View style={styles.container}>
                <MaterialIcons name="lock-reset" size={60} color={ABAETE_COLORS.primaryBlue} style={styles.iconHeader} />
                <Text style={styles.instructionText}>
                    Informe seu e-mail cadastrado para enviarmos as instruções de recuperação de senha.
                </Text>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

                {!successMessage && ( // Só mostra o campo e botão se não houver mensagem de sucesso
                    <>
                        <View style={styles.inputContainer}>
                            <MaterialIcons name="email" size={22} color={ABAETE_COLORS.mediumGray} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Seu e-mail de cadastro"
                                placeholderTextColor={ABAETE_COLORS.mediumGray}
                                value={email}
                                onChangeText={(text) => { setEmail(text); setError(''); }}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                textContentType="emailAddress"
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: isLoading ? ABAETE_COLORS.mediumGray : ABAETE_COLORS.yellow }]}
                            onPress={handleRecoverPassword}
                            disabled={isLoading}
                        >
                        {isLoading ? (
                            <ActivityIndicator color={ABAETE_COLORS.textPrimary} />
                        ) : (
                            <Text style={[styles.buttonText, {color: ABAETE_COLORS.textPrimary}]}>Enviar Link</Text>
                        )}
                        </TouchableOpacity>
                    </>
                )}
                 {successMessage && (
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: ABAETE_COLORS.primaryBlue, marginTop: 20 }]}
                        onPress={() => navigation.navigate('Login')}
                    >
                        <Text style={styles.buttonText}>Voltar para Login</Text>
                    </TouchableOpacity>
                )}
            </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ABAETE_COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 40,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: ABAETE_COLORS.lightGray,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontFamily: FONT_FAMILY.SemiBold,
    fontSize: 18,
    color: ABAETE_COLORS.primaryBlue,
  },
  keyboardView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: 20, // Espaço para o teclado
  },
  iconHeader: {
    marginBottom: 25,
  },
  instructionText: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 16,
    color: ABAETE_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 24,
  },
  errorText: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 14,
    color: ABAETE_COLORS.errorRed,
    marginBottom: 15,
    textAlign: 'center',
  },
  successText: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 15,
    color: ABAETE_COLORS.successGreen, // Ou primaryBlue para consistência
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ABAETE_COLORS.white,
    borderWidth: 1,
    borderColor: ABAETE_COLORS.lightGray,
    borderRadius: 12,
    marginBottom: 25,
    width: '100%',
    height: 55,
  },
  inputIcon: {
    paddingHorizontal: 15,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 16,
    color: ABAETE_COLORS.textPrimary,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 55,
  },
  buttonText: {
    fontFamily: FONT_FAMILY.Bold,
    fontSize: 16,
  },
});