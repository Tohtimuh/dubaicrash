export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export interface User {
  id: string;
  username: string;
  password: string; // Stored in plain text as per request simulation requirements
  balance: number;
  role: UserRole;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  username: string; // Denormalized for easier display
  type: 'deposit' | 'withdrawal';
  amount: number;
  status: 'pending' | 'success' | 'failed';
  date: string;
  upiId?: string;
  utr?: string; // Transaction reference number
}

export interface AppSettings {
  merchantUpi: string;
  qrCodeUrl: string;
}

export interface GameHistoryItem {
  crashPoint: number;
  hash: string;
}

export interface Bet {
  userId: string;
  amount: number;
  cashoutAt?: number;
  cashedOutAt?: number;
  profit?: number;
}