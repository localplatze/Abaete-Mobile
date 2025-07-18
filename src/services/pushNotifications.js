import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { requestNotificationPermission } from './firebaseConnection';

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.warn('Notificações não funcionam em simuladores');
    return null;
  }

  try {
    // Usar função do Firebase para permissão
    const firebaseToken = await requestNotificationPermission();
    
    // Token do Expo (opcional, dependendo da sua implementação)
    const expoToken = await Notifications.getExpoPushTokenAsync();
    
    console.log('Firebase Token:', firebaseToken);
    console.log('Expo Token:', expoToken.data);
    
    // Aqui você pode enviar os tokens para seu backend
    return { firebaseToken, expoToken: expoToken.data };
  } catch (error) {
    console.error('Erro ao registrar notificações:', error);
    return null;
  }
}

// Configurar comportamento de notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});