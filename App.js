import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Font from 'expo-font';
import { registerForPushNotifications, listenToNotifications } from './src/services/firebaseConnection';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RecoverScreen } from './src/screens/RecoverScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProfHomeScreen } from './src/screens/ProfHomeScreen';
import { AdminHomeScreen } from './src/screens/AdminHomeScreen';
import { ProgramEditorScreen } from './src/screens/ProgramEditorScreen';
import { NewAbaScreen } from './src/screens/NewAbaScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { PatientDetailScreen } from './src/screens/PatientDetailScreen';
import { AnamneseScreen } from './src/screens/AnamneseScreen';

const Stack = createStackNavigator();

async function loadFonts() {
  await Font.loadAsync({
    'MerriweatherSans-Regular': require('./assets/fonts/MerriweatherSans-Regular.ttf'),
    'MerriweatherSans-Bold': require('./assets/fonts/MerriweatherSans-Bold.ttf'),
    'MerriweatherSans-SemiBold': require('./assets/fonts/MerriweatherSans-SemiBold.ttf'),
  });
}

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    loadFonts().then(() => setFontsLoaded(true));
  }, []);
  
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#FFFFFF' }
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Recover" component={RecoverScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="ProfHome" component={ProfHomeScreen} />
        <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
        <Stack.Screen name="ProgramEditor" component={ProgramEditorScreen} />
        <Stack.Screen name="NewAba" component={NewAbaScreen} />
        <Stack.Screen name="Calendar" component={CalendarScreen} />
        <Stack.Screen name="PatientDetail" component={PatientDetailScreen} />
        <Stack.Screen name="Anamnese" component={AnamneseScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}