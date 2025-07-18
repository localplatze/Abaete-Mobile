import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth'; 
import { getDatabase, ref, set, remove } from 'firebase/database';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { getOrCreateDeviceId } from './deviceStorage';

const firebaseConfig = {
  apiKey: "AIzaSyAjbnCPDCnpIW-x34zNQSFUnprTSvGiUcE",
  authDomain: "abaete-8e79b.firebaseapp.com",
  databaseURL: "https://abaete-8e79b-default-rtdb.firebaseio.com",
  projectId: "abaete-8e79b",
  storageBucket: "abaete-8e79b.firebasestorage.app",
  messagingSenderId: "617693396011",
  appId: "1:617693396011:web:688c723b00edb61f04be6e",
  measurementId: "G-V8T29SQ8Z1"
};

const FIREBASE_APP = initializeApp(firebaseConfig);
const FIREBASE_DB = getDatabase(FIREBASE_APP);
const FIREBASE_AUTH = getAuth(FIREBASE_APP);

export { FIREBASE_APP, FIREBASE_DB, FIREBASE_AUTH };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function saveTokenToDatabase(token, deviceId) {
  try {
    const tokenRef = ref(FIREBASE_DB, `devices/${deviceId}`);
    
    await set(tokenRef, {
      token,
      deviceName: Device.deviceName || 'Dispositivo desconhecido',
      platform: Device.osName,
      model: Device.modelName,
      lastUpdated: new Date().toISOString(),
      isActive: true
    });
    
    console.log('Token salvo com sucesso');
    return true;
  } catch (error) {
    console.error('Erro ao salvar token:', error);
    return false;
  }
}

export async function registerForPushNotifications() {
  try {
    if (!Device.isDevice) {
      console.log('Notificações requerem um dispositivo físico');
      return null;
    }

    const deviceId = await getOrCreateDeviceId();
    if (!deviceId) {
      console.error('Não foi possível obter deviceId');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Permissão de notificação não concedida');
      return null;
    }
    
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig.extra.eas.projectId,
    })).data;
    
    await saveTokenToDatabase(token, deviceId);
    return token;
  } catch (error) {
    console.error('Erro ao registrar notificações:', error);
    return null;
  }
}

export function listenToNotifications(callback) {
  return Notifications.addNotificationReceivedListener(callback);
}

export function listenToNotificationInteractions(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}