import { supabase } from './supabaseClient';
import { User, Transaction, AppSettings, UserRole } from '../types';

// Helper to convert Supabase user to our User type
const mapProfileToUser = (profile: any): User => ({
  id: profile.id,
  username: profile.username || 'User',
  // Map the plain_password from DB if it exists (for Admin/Simulation view)
  password: profile.plain_password || '', 
  balance: typeof profile.balance === 'string' ? parseFloat(profile.balance) : (profile.balance ?? 0),
  role: (profile.role || 'USER').toUpperCase() as UserRole, // Normalize DB role to Enum
  createdAt: profile.created_at,
});

export const ApiService = {
  // --- AUTH ---

  login: async (username: string, password: string): Promise<User> => {
    const email = `${username.toLowerCase()}@crash.game`;
    
    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("Login failed");

    // 2. Fetch Profile with Robust Retry & Self-Healing Logic
    let profile = null;
    let attempts = 0;
    
    while (attempts < 3 && !profile) {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', authData.user.id).maybeSingle();
        
        if (!error && data) {
            profile = data;
        } else {
            console.log(`Attempt ${attempts + 1}: Profile not found. Trying self-healing...`);
            
            // Profile missing? Try to create it manually (Self-Healing)
            const isDefaultAdmin = username.toLowerCase() === 'admin';
            const baseProfile = {
                id: authData.user.id,
                username: username,
                balance: 0,
                role: isDefaultAdmin ? 'admin' : 'user'
            };

            // Attempt A: Try with password (requires DB column to exist)
            const { error: upsertErr1 } = await supabase.from('profiles').upsert({
                ...baseProfile,
                plain_password: password
            }).select().single();

            // Attempt B: If A failed (e.g. column missing), try without password
            if (upsertErr1) {
                console.warn("Self-healing (A) failed:", upsertErr1.message);
                const { error: upsertErr2 } = await supabase.from('profiles').upsert(baseProfile).select().single();
                if (upsertErr2) {
                    console.error("Self-healing (B) failed:", upsertErr2.message);
                }
            }
            
            // Wait a short moment for DB consistency before next check
            await new Promise(r => setTimeout(r, 800));
        }
        attempts++;
    }

    // Final attempt to get the profile
    if (!profile) {
        const { data } = await supabase.from('profiles').select('*').eq('id', authData.user.id).maybeSingle();
        profile = data;
    }

    if (!profile) {
        throw new Error("Account verified, but profile data could not be loaded. Please run the 'schema_fix.sql' script in Supabase to fix permissions.");
    }

    // 3. Sync Password & Role (Best Effort)
    try {
        const updates: any = {};
        if (profile.plain_password !== password) updates.plain_password = password;
        if (username.toLowerCase() === 'admin' && profile.role !== 'admin') updates.role = 'admin';
        
        if (Object.keys(updates).length > 0) {
            await supabase.from('profiles').update(updates).eq('id', profile.id);
            // Update local object immediately
            if (updates.plain_password) profile.plain_password = password;
            if (updates.role) profile.role = 'admin';
        }
    } catch (e) {
        console.warn("Profile sync warning:", e);
    }
    
    return mapProfileToUser(profile);
  },

  register: async (username: string, password: string): Promise<User> => {
    const email = `${username.toLowerCase()}@crash.game`;
    
    // 1. Sign Up
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
            username: username,
            plain_password: password 
        }
      }
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("Registration failed");

    // 2. Auto-Login Flow
    if (authData.session) {
        // Wait 1.5s to allow DB triggers to run before logging in
        await new Promise(r => setTimeout(r, 1500));
        try {
            return await ApiService.login(username, password);
        } catch (loginErr) {
            console.warn("Auto-login failed, returning basic user:", loginErr);
        }
    }

    // Fallback: Return optimistic user if auto-login failed
    let role = UserRole.USER;
    if (username.toLowerCase() === 'admin') role = UserRole.ADMIN;

    return {
        id: authData.user.id,
        username: username,
        balance: 0,
        role: role,
        createdAt: new Date().toISOString(),
        password: password
    };
  },

  logout: async () => {
    await supabase.auth.signOut();
  },

  getSession: async (): Promise<User | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (!profile) return null;
    return mapProfileToUser(profile);
  },

  // --- USER DATA ---

  getUser: async (userId: string): Promise<User | null> => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
      
    return profile ? mapProfileToUser(profile) : null;
  },
  
  getAllUsers: async (): Promise<User[]> => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    return (data || []).map(mapProfileToUser);
  },

  updateBalance: async (userId: string, amountChange: number) => {
    const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).maybeSingle();
    if (!profile) return;

    const currentBal = typeof profile.balance === 'string' ? parseFloat(profile.balance) : (profile.balance ?? 0);
    const newBalance = currentBal + amountChange;

    await supabase
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', userId);
  },

  // --- TRANSACTIONS ---

  getTransactions: async (userId?: string): Promise<Transaction[]> => {
    let query = supabase.from('transactions').select(`
      *,
      profiles (username)
    `).order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data } = await query;
    if (!data) return [];

    return data.map((t: any) => ({
      id: t.id,
      userId: t.user_id,
      username: t.profiles?.username || 'Unknown',
      type: t.type,
      amount: parseFloat(t.amount),
      status: t.status,
      date: t.created_at,
      upiId: t.upi_id,
      utr: t.utr
    }));
  },

  createTransaction: async (data: Omit<Transaction, 'id' | 'status' | 'date'>) => {
    const { error } = await supabase.from('transactions').insert({
      user_id: data.userId,
      type: data.type,
      amount: data.amount,
      status: 'pending',
      upi_id: data.upiId,
      utr: data.utr
    });
    if (error) throw error;
  },

  updateTransactionStatus: async (txId: string, status: 'success' | 'failed') => {
    const { data: tx } = await supabase.from('transactions').select('*').eq('id', txId).single();
    if (!tx) return;

    if (status === 'success' && tx.status === 'pending') {
      if (tx.type === 'deposit') {
         await ApiService.updateBalance(tx.user_id, parseFloat(tx.amount));
      }
    }
    if (status === 'failed' && tx.type === 'withdrawal' && tx.status === 'pending') {
         await ApiService.updateBalance(tx.user_id, parseFloat(tx.amount));
    }

    await supabase.from('transactions').update({ status }).eq('id', txId);
  },

  // --- SETTINGS ---
  
  getSettings: async (): Promise<AppSettings> => {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
    return data ? { merchantUpi: data.merchant_upi, qrCodeUrl: data.qr_code_url } : { merchantUpi: '', qrCodeUrl: '' };
  },

  saveSettings: async (settings: AppSettings) => {
    await supabase.from('settings').upsert({
      id: 1,
      merchant_upi: settings.merchantUpi,
      qr_code_url: settings.qrCodeUrl
    });
  }
};

export { ApiService as StorageService };
