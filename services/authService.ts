import { User, UserRole } from '../types';
import { invokeSheetAction } from './storageService';

const USERS_KEY = 'coldchain_users';
const CURRENT_USER_KEY = 'coldchain_current_user';

const DEFAULT_ADMIN: User = {
  username: 'KhaingThwin',
  password: 'Khaingthwin2025',
  name: 'System Admin',
  role: UserRole.ADMIN
};

export const initAuth = () => {
  try {
    const users = localStorage.getItem(USERS_KEY);
    if (!users) {
      localStorage.setItem(USERS_KEY, JSON.stringify([DEFAULT_ADMIN]));
    }
  } catch (e) {
    console.error("Auth init failed", e);
  }
};

// Syncs users from cloud to local storage
export const syncUsersFromCloud = async () => {
  try {
    const response = await invokeSheetAction('GET_USERS');
    if (response && response.users && Array.isArray(response.users)) {
      // Merge with default admin just in case
      let fetchedUsers: User[] = response.users;
      
      // Ensure we don't lose the emergency admin if cloud is empty/weird, 
      // but ideally cloud is source of truth.
      if (!fetchedUsers.find(u => u.username === 'KhaingThwin')) {
        fetchedUsers.push(DEFAULT_ADMIN);
      }

      localStorage.setItem(USERS_KEY, JSON.stringify(fetchedUsers));
      console.log("Users synced from cloud:", fetchedUsers.length);
      return true;
    }
  } catch (e: any) {
    // Quietly ignore missing configuration, only log actual network errors
    if (e.message === "No Sheet URL configured") {
        console.log("Cloud user sync skipped: No Sheet URL configured.");
        return false;
    }
    console.error("Failed to sync users from cloud:", e);
    return false;
  }
  return false;
};

export const login = (username: string, password: string): User | null => {
  initAuth();
  const usersStr = localStorage.getItem(USERS_KEY);
  const users: User[] = usersStr ? JSON.parse(usersStr) : [DEFAULT_ADMIN];
  
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  if (user) {
    // Return user without password for session state
    const safeUser = { ...user };
    delete safeUser.password;
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safeUser));
    return safeUser;
  }
  return null;
};

export const logout = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): User | null => {
  try {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
};

export const getUsers = (): User[] => {
  initAuth();
  const usersStr = localStorage.getItem(USERS_KEY);
  return usersStr ? JSON.parse(usersStr) : [];
};

export const addUser = async (user: User): Promise<boolean> => {
  // 1. Optimistic Update (Local)
  const users = getUsers();
  if (users.some(u => u.username.toLowerCase() === user.username.toLowerCase())) {
    return false; 
  }
  users.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // 2. Cloud Update
  try {
    await invokeSheetAction('ADD_USER', { user });
    return true;
  } catch (e: any) {
    if (e.message === "No Sheet URL configured") {
        console.log("User added locally. Cloud sync skipped (No Sheet URL).");
        return true;
    }
    console.error("Failed to add user to cloud:", e);
    // If cloud fails, we might want to revert local, OR queue it. 
    // For now, we'll keep local but warn.
    alert("User added locally but failed to sync to Cloud. Please check connection.");
    return true; 
  }
};

export const removeUser = async (username: string) => {
  if (username === 'KhaingThwin') return; 
  
  // 1. Optimistic Update (Local)
  let users = getUsers();
  users = users.filter(u => u.username !== username);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // 2. Cloud Update
  try {
    await invokeSheetAction('DELETE_USER', { username });
  } catch (e: any) {
    if (e.message === "No Sheet URL configured") {
        console.log("User removed locally. Cloud sync skipped (No Sheet URL).");
        return;
    }
    console.error("Failed to delete user from cloud:", e);
    alert("User removed locally but failed to sync to Cloud.");
  }
};