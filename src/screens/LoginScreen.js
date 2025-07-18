import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';


// 1. Imports do Firebase
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ref, get } from 'firebase/database'; // Import para consultar o Realtime DB
import { FIREBASE_AUTH, FIREBASE_DB } from './../services/firebaseConnection'; // Importe do seu arquivo de config

const { width: windowWidth } = Dimensions.get('window');

export const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // 2. Lógica de Login atualizada
  const handleLogin = async () => {
    if (!email || !password) {
      setError('Por favor, preencha e-mail e senha.');
      return;
    }
    setError('');
    setIsLoading(true);
    
    try {
      // Passo 1: Autenticar com e-mail e senha
      const userCredential = await signInWithEmailAndPassword(FIREBASE_AUTH, email, password);
      const user = userCredential.user;
      
      // Passo 2: Buscar o 'role' do usuário no Realtime Database
      // Assumindo que a estrutura é /users/{userId}/role
      const userRef = ref(FIREBASE_DB, `users/${user.uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        const userRole = userData.role; // Ou o nome do campo que você usa (ex: tipo, perfil)

        // Passo 3: Redirecionar com base no 'role'
        if (userRole === 'patient') {
          navigation.replace('Home'); 
        } else if (userRole === 'professional') {
          navigation.replace('ProfHome');
        } else if (userRole === 'admin') {
          navigation.replace('AdminHome');
        } else {
          setError('Você não tem permissão para acessar este aplicativo.');
        }
      } else {
        // Se não encontrar o registro do usuário no DB
        setError('Dados do usuário não encontrados ou acesso não permitido.');
        // await FIREBASE_AUTH.signOut();
      }

    } catch (e) {
      // Tratamento de erros de autenticação (igual ao seu código web)
      if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setError('E-mail ou senha inválidos.');
      } else if (e.code === 'auth/invalid-email') {
        setError('Formato de e-mail inválido.');
      } else {
        setError('Ocorreu um erro ao tentar fazer login.');
        console.error("Firebase login error:", e);
      }
    } finally {
       setIsLoading(false); // Garante que o loading para
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
    <StatusBar style="light" backgroundColor="#07638F" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollViewContent}>
          <View style={styles.container}>
            <Image
              source={require('../../assets/images/abaete_logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.title}>Acesse sua Conta</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.inputContainer}>
              <MaterialIcons name="email" size={22} color={ABAETE_COLORS.mediumGray} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Seu e-mail"
                placeholderTextColor={ABAETE_COLORS.mediumGray}
                value={email}
                onChangeText={(text) => { setEmail(text); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
              />
            </View>

            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={22} color={ABAETE_COLORS.mediumGray} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Sua senha"
                placeholderTextColor={ABAETE_COLORS.mediumGray}
                value={password}
                onChangeText={(text) => { setPassword(text); setError(''); }}
                secureTextEntry={!showPassword}
                textContentType="password"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIconContainer}>
                <MaterialIcons name={showPassword ? "visibility-off" : "visibility"} size={22} color={ABAETE_COLORS.mediumGray} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotPasswordButton} onPress={() => navigation.navigate('Recover')}>
              <Text style={styles.forgotPasswordText}>Esqueci minha senha</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: isLoading ? ABAETE_COLORS.mediumGray : ABAETE_COLORS.primaryBlue }]}
              onPress={handleLogin} // 3. Ação do botão chama a função de login
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={ABAETE_COLORS.white} />
              ) : (
                <Text style={styles.buttonText}>Entrar</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// --- FIM DAS ALTERAÇÕES ---

// (Seus estilos continuam os mesmos aqui)
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ABAETE_COLORS.white,
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
    paddingVertical: 20,
  },
  logo: {
    width: windowWidth * 0.4,
    height: (windowWidth * 0.4) * (2/3),
    marginBottom: 30,
  },
  title: {
    fontFamily: FONT_FAMILY.SemiBold,
    fontSize: 24,
    color: ABAETE_COLORS.primaryBlue,
    marginBottom: 20,
  },
  errorText: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 14,
    color: ABAETE_COLORS.errorRed,
    marginBottom: 15,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ABAETE_COLORS.white,
    borderWidth: 1,
    borderColor: ABAETE_COLORS.lightGray,
    borderRadius: 12,
    marginBottom: 18,
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
  eyeIconContainer: {
    paddingHorizontal: 15,
    height: '100%',
    justifyContent: 'center',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 25,
  },
  forgotPasswordText: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 14,
    color: ABAETE_COLORS.secondaryBlue,
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
    color: ABAETE_COLORS.white,
  },
});