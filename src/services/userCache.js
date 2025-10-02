import { ref, get } from 'firebase/database';
import { FIREBASE_DB } from './firebaseConnection';

const userCache = {};

export const getCachedUserData = async (userId) => {
  if (!userId) {
    return { displayName: 'Usuário desconhecido', fullName: 'Usuário desconhecido' };
  }
  if (userCache[userId]) {
    return userCache[userId];
  }

  const userRef = ref(FIREBASE_DB, `users/${userId}`);
  const snapshot = await get(userRef);

  if (snapshot.exists()) {
    const userData = snapshot.val();
    userCache[userId] = userData;
    return userData;
  }
  
  // Cache "negativo" para não buscar de novo um usuário que não existe
  userCache[userId] = { displayName: 'Usuário não encontrado', fullName: 'Usuário não encontrado' };
  return userCache[userId];
};

export const clearUserCache = () => {
    // Função útil para limpar o cache no logout, por exemplo
    Object.keys(userCache).forEach(key => delete userCache[key]);
};