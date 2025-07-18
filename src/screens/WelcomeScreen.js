import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const onboardingData = [
  {
    id: '1',
    image: require('../../assets/images/onboarding-1.png'),
    title: 'Bem-vindo(a) ao Abaeté Conecta!',
    description: 'Seu espaço de cuidado, desenvolvimento e conexão. Estamos aqui para apoiar cada passo da jornada.',
  },
  {
    id: '2',
    image: require('../../assets/images/onboarding-2.png'),
    title: 'Acompanhe e Participe Ativamente',
    description: 'Profissionais e famílias conectados para um desenvolvimento transparente e colaborativo.',
  },
  {
    id: '3',
    image: require('../../assets/images/onboarding-3.png'),
    title: 'Tudo o que Você Precisa',
    description: 'Agenda, evoluções, atividades e comunicação direta. Simples, seguro e pensado para você.',
  },
];

export const WelcomeScreen = ({ navigation }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef(null);

  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      scrollViewRef.current?.scrollTo({
        x: SCREEN_WIDTH * (currentIndex + 1),
        animated: true,
      });
    } else {
      navigation.replace('Login');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
    <StatusBar style="dark" backgroundColor="#F6E2E0" />
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {onboardingData.map((item) => (
          <View key={item.id} style={styles.slide}>
            <Image source={item.image} style={styles.image} resizeMode="contain" />
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {onboardingData.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                currentIndex === index ? styles.paginationDotActive : {},
              ]}
            />
          ))}
        </View>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: currentIndex === onboardingData.length - 1 ? ABAETE_COLORS.yellow : ABAETE_COLORS.primaryBlue }]}
          onPress={handleNext}
        >
          <Text style={[styles.buttonText, {color: currentIndex === onboardingData.length - 1 ? ABAETE_COLORS.textPrimary : ABAETE_COLORS.white}]}>
            {currentIndex === onboardingData.length - 1 ? 'Começar' : 'Próximo'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ABAETE_COLORS.lightPink, // Fundo suave para o onboarding
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 150, // Espaço para o footer
  },
  image: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    marginBottom: 40,
  },
  title: {
    fontFamily: FONT_FAMILY.Bold,
    fontSize: 24,
    color: ABAETE_COLORS.primaryBlue,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 16,
    color: ABAETE_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 130,
    paddingHorizontal: 30,
    paddingBottom: 30, 
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  paginationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ABAETE_COLORS.mediumGray,
    marginHorizontal: 5,
  },
  paginationDotActive: {
    backgroundColor: ABAETE_COLORS.primaryBlue,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: FONT_FAMILY.Bold,
    fontSize: 16,
  },
});