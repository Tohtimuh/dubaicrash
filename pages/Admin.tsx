import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/storage';
import { Transaction, User, AppSettings } from '../types';
import { LogOut, Save, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ merchantUpi: '', qrCodeUrl: '' });
  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals' | 'users' | 'settings'>('deposits');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
        const [allUsers, allTxs, sets] = await Promise.all([
            ApiService.getAllUsers(),
            ApiService.getTransactions(),
            ApiService.getSettings()
        ]);
        setUsers(allUsers);
        setTransactions(allTxs);
        setSettings(sets);
    } catch (e) {
        console.error(e);
        setMsg('Failed to load data');
    } finally {
        setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: 'success' | 'failed') => {
    if (processingId) return; // Prevent double actions
    setProcessingId(id);
    try {
        // Optimistic UI update: Remove from list immediately
        setTransactions(prev => prev.filter(t => t.id !== id));
        
        await ApiService.updateTransactionStatus(id, status);
        
        setMsg(`Transaction ${status}`);
        setTimeout(() => setMsg(''), 3000);
        
        // Refresh purely to ensure sync, but logic is handled
        refreshData(); 
    } catch (e) {
        console.error(e);
        setMsg('Action failed');
        refreshData(); // Revert UI on failure
    } finally {
        setProcessingId(null);
    }
  };

  const saveSettings = async () => {
    await ApiService.saveSettings(settings);
    setMsg('Settings saved');
    setTimeout(() => setMsg(''), 3000);
  };

  const pendingDeposits = transactions.filter(t => t.type === 'deposit' && t.status === 'pending');
  const pendingWithdrawals = transactions.filter(t => t.type === 'withdrawal' && t.status === 'pending');

  return (
    <div className="min-h-screen bg-dark-900 text-gray-200">
      <header className="bg-dark-800 border-b border-dark-700 p-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-accent">Admin Control Panel</h1>
        <div className="flex gap-4">
            <button onClick={refreshData} disabled={loading} className="flex items-center gap-2 hover:text-white">
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={async () => { await ApiService.logout(); window.location.hash = '#/login'; }} className="flex items-center gap-2 text-danger hover:text-red-400"><LogOut size={18} /> Logout</button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-dark-800 p-4 space-y-2 border-r border-dark-700">
           <button onClick={() => setActiveTab('deposits')} className={`w-full text-left p-3 rounded transition-colors ${activeTab === 'deposits' ? 'bg-primary text-white font-bold' : 'hover:bg-dark-700'}`}>
              Deposits {pendingDeposits.length > 0 && <span className="float-right bg-accent text-dark-900 text-xs px-2 py-0.5 rounded-full font-bold">{pendingDeposits.length}</span>}
           </button>
           <button onClick={() => setActiveTab('withdrawals')} className={`w-full text-left p-3 rounded transition-colors ${activeTab === 'withdrawals' ? 'bg-primary text-white font-bold' : 'hover:bg-dark-700'}`}>
              Withdrawals {pendingWithdrawals.length > 0 && <span className="float-right bg-accent text-dark-900 text-xs px-2 py-0.5 rounded-full font-bold">{pendingWithdrawals.length}</span>}
           </button>
           <button onClick={() => setActiveTab('users')} className={`w-full text-left p-3 rounded transition-colors ${activeTab === 'users' ? 'bg-primary text-white font-bold' : 'hover:bg-dark-700'}`}>
              Users
           </button>
           <button onClick={() => setActiveTab('settings')} className={`w-full text-left p-3 rounded transition-colors ${activeTab === 'settings' ? 'bg-primary text-white font-bold' : 'hover:bg-dark-700'}`}>
              Settings
           </button>
        </aside>

        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {msg && <div className="mb-4 p-3 bg-success/20 text-success border border-success/40 rounded">{msg}</div>}

          {/* DEPOSITS TAB */}
          {activeTab === 'deposits' && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Pending Deposits</h2>
              <div className="grid gap-4">
                {pendingDeposits.length === 0 ? <div className="text-gray-500">No pending deposits.</div> : 
                 pendingDeposits.map(tx => (
                   <div key={tx.id} className="bg-dark-800 p-4 rounded-lg border border-dark-700 flex flex-col md:flex-row justify-between items-center gap-4">
                      <div>
                        <div className="font-bold text-lg text-white">₹{tx.amount}</div>
                        <div className="text-gray-400 text-sm">User: <span className="text-white">{tx.username}</span></div>
                        <div className="text-gray-400 text-sm">UTR: <span className="text-accent font-mono">{tx.utr}</span></div>
                        <div className="text-gray-500 text-xs">{new Date(tx.date).toLocaleString()}</div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                            onClick={() => handleStatusUpdate(tx.id, 'success')} 
                            disabled={!!processingId}
                            className={`bg-success hover:bg-green-600 text-white px-4 py-2 rounded font-bold flex items-center gap-1 ${processingId === tx.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {processingId === tx.id ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle size={16}/>} Approve
                        </button>
                        <button 
                            onClick={() => handleStatusUpdate(tx.id, 'failed')} 
                            disabled={!!processingId}
                            className={`bg-danger hover:bg-red-600 text-white px-4 py-2 rounded font-bold flex items-center gap-1 ${processingId === tx.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {processingId === tx.id ? <Loader2 className="animate-spin" size={16}/> : <XCircle size={16}/>} Reject
                        </button>
                      </div>
                   </div>
                 ))
                }
              </div>
            </div>
          )}

          {/* WITHDRAWALS TAB */}
          {activeTab === 'withdrawals' && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Pending Withdrawals</h2>
              <div className="grid gap-4">
                {pendingWithdrawals.length === 0 ? <div className="text-gray-500">No pending withdrawals.</div> : 
                 pendingWithdrawals.map(tx => (
                   <div key={tx.id} className="bg-dark-800 p-4 rounded-lg border border-dark-700 flex flex-col md:flex-row justify-between items-center gap-4">
                      <div>
                        <div className="font-bold text-lg text-danger">₹{tx.amount}</div>
                        <div className="text-gray-400 text-sm">User: <span className="text-white">{tx.username}</span></div>
                        <div className="text-gray-400 text-sm">UPI: <span className="text-white font-mono">{tx.upiId}</span></div>
                        <div className="text-gray-500 text-xs">{new Date(tx.date).toLocaleString()}</div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                            onClick={() => handleStatusUpdate(tx.id, 'success')} 
                            disabled={!!processingId}
                            className={`bg-success hover:bg-green-600 text-white px-4 py-2 rounded font-bold flex items-center gap-1 ${processingId === tx.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {processingId === tx.id ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle size={16}/>} Paid
                        </button>
                        <button 
                            onClick={() => handleStatusUpdate(tx.id, 'failed')} 
                            disabled={!!processingId}
                            className={`bg-danger hover:bg-red-600 text-white px-4 py-2 rounded font-bold flex items-center gap-1 ${processingId === tx.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {processingId === tx.id ? <Loader2 className="animate-spin" size={16}/> : <XCircle size={16}/>} Reject
                        </button>
                      </div>
                   </div>
                 ))
                }
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
             <div className="overflow-x-auto">
                <h2 className="text-2xl font-bold mb-4">User Database</h2>
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-dark-800 text-gray-400">
                         <th className="p-3">Username</th>
                         <th className="p-3">Password</th>
                         <th className="p-3">Balance</th>
                         <th className="p-3">Role</th>
                         <th className="p-3">Joined</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-dark-700">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-dark-800">
                          <td className="p-3 text-white font-medium">{u.username}</td>
                          <td className="p-3 text-gray-400 font-mono text-xs">{u.password || '---'}</td>
                          <td className="p-3 text-accent font-bold">₹{u.balance.toFixed(2)}</td>
                          <td className="p-3 text-gray-400 text-xs">{u.role}</td>
                          <td className="p-3 text-gray-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
             <div className="max-w-lg">
                <h2 className="text-2xl font-bold mb-4">Payment Settings</h2>
                <div className="space-y-4">
                   <div>
                     <label className="block text-gray-400 mb-1">Merchant UPI ID</label>
                     <input 
                       type="text" 
                       value={settings.merchantUpi} 
                       onChange={e => setSettings({...settings, merchantUpi: e.target.value})}
                       className="w-full bg-dark-800 border border-dark-600 p-3 rounded text-white"
                     />
                   </div>
                   <div>
                     <label className="block text-gray-400 mb-1">QR Code Data/URL</label>
                     <input 
                       type="text" 
                       value={settings.qrCodeUrl} 
                       onChange={e => setSettings({...settings, qrCodeUrl: e.target.value})}
                       className="w-full bg-dark-800 border border-dark-600 p-3 rounded text-white"
                       placeholder="upi://pay?pa=..."
                     />
                   </div>
                   <button onClick={saveSettings} className="bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded font-bold flex items-center gap-2">
                     <Save size={20} /> Save Changes
                   </button>
                </div>
             </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminPanel;