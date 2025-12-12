import { User, Transaction, AppSettings, UserRole } from '../types';

const KEYS = {
  USERS: 'cg_users',
  TRANSACTIONS: 'cg_transactions',
  SETTINGS: 'cg_settings',
  SESSION: 'cg_session',
};

// Initialize default data if empty
const initStorage = () => {
  if (!localStorage.getItem(KEYS.USERS)) {
    const defaultUsers: User[] = [
      {
        id: '1',
        username: 'admin',
        password: '123',
        balance: 100000,
        role: UserRole.ADMIN,
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        username: 'user',
        password: '123',
        balance: 500,
        role: UserRole.USER,
        createdAt: new Date().toISOString(),
      }
    ];
    localStorage.setItem(KEYS.USERS, JSON.stringify(defaultUsers));
  }
  if (!localStorage.getItem(KEYS.SETTINGS)) {
    const defaultSettings: AppSettings = {
      merchantUpi: 'gamepay@axisbank',
      qrCodeUrl: '',
    };
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(defaultSettings));
  }
  if (!localStorage.getItem(KEYS.TRANSACTIONS)) {
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify([]));
  }
};

initStorage();

export const StorageService = {
  // --- USER ---
  getUsers: (): User[] => {
    return JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
  },

  getUser: (username: string): User | undefined => {
    const users = StorageService.getUsers();
    return users.find(u => u.username === username);
  },

  createUser: (username: string, password: string): User => {
    const users = StorageService.getUsers();
    if (users.find(u => u.username === username)) {
      throw new Error('Username already exists');
    }
    const newUser: User = {
      id: Date.now().toString(),
      username,
      password,
      balance: 0,
      role: UserRole.USER,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    return newUser;
  },

  updateBalance: (username: string, amountChange: number) => {
    const users = StorageService.getUsers();
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex === -1) return;
    
    users[userIndex].balance += amountChange;
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    
    // Update session if it's the current user
    const session = StorageService.getSession();
    if (session && session.username === username) {
      session.balance = users[userIndex].balance;
      localStorage.setItem(KEYS.SESSION, JSON.stringify(session));
    }
  },

  // --- AUTH ---
  login: (username: string, password: string): User => {
    const user = StorageService.getUser(username);
    if (!user || user.password !== password) {
      throw new Error('Invalid credentials');
    }
    localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
    return user;
  },

  logout: () => {
    localStorage.removeItem(KEYS.SESSION);
  },

  getSession: (): User | null => {
    const session = localStorage.getItem(KEYS.SESSION);
    return session ? JSON.parse(session) : null;
  },

  // --- TRANSACTIONS ---
  getTransactions: (): Transaction[] => {
    return JSON.parse(localStorage.getItem(KEYS.TRANSACTIONS) || '[]');
  },

  createTransaction: (data: Omit<Transaction, 'id' | 'status' | 'date'>) => {
    const txs = StorageService.getTransactions();
    const newTx: Transaction = {
      ...data,
      id: Date.now().toString(),
      status: 'pending',
      date: new Date().toISOString(),
    };
    txs.push(newTx);
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));
    return newTx;
  },

  updateTransactionStatus: (id: string, status: 'success' | 'failed') => {
    const txs = StorageService.getTransactions();
    const txIndex = txs.findIndex(t => t.id === id);
    if (txIndex === -1) return;

    const tx = txs[txIndex];
    
    // If approving a deposit, add balance
    if (status === 'success' && tx.status === 'pending') {
      if (tx.type === 'deposit') {
        StorageService.updateBalance(tx.username, tx.amount);
      }
    }
    
    // If rejecting a withdrawal, refund the balance
    if (status === 'failed' && tx.type === 'withdrawal' && tx.status === 'pending') {
       StorageService.updateBalance(tx.username, tx.amount);
    }

    txs[txIndex].status = status;
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));
  },

  // --- SETTINGS ---
  getSettings: (): AppSettings => {
    return JSON.parse(localStorage.getItem(KEYS.SETTINGS) || '{}');
  },
  
  saveSettings: (settings: AppSettings) => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  },

  // --- SYSTEM ---
  resetDatabase: () => {
    localStorage.clear();
    initStorage();
    window.location.reload();
  },

  getBackupJSON: () => {
    const data = {
      users: JSON.parse(localStorage.getItem(KEYS.USERS) || '[]'),
      transactions: JSON.parse(localStorage.getItem(KEYS.TRANSACTIONS) || '[]'),
      settings: JSON.parse(localStorage.getItem(KEYS.SETTINGS) || '{}'),
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }
};