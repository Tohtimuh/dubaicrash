import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/storage';
import { User, Transaction, AppSettings } from '../types';
import { Wallet, LogOut, History, PlayCircle, QrCode, Copy, CheckCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // Deposit State
  const [depositAmount, setDepositAmount] = useState<number>(500);
  const [depositUpi, setDepositUpi] = useState('');
  const [depositUtr, setDepositUtr] = useState('');
  const [depositStep, setDepositStep] = useState(1);
  const [settings, setSettings] = useState<AppSettings>({ merchantUpi: '', qrCodeUrl: '' });

  // Withdraw State
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawUpi, setWithdrawUpi] = useState('');

  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000); // Poll slower for async
    return () => clearInterval(interval);
  }, []);

  const refreshData = async () => {
    try {
        const session = await ApiService.getSession();
        if (session) {
            const freshUser = await ApiService.getUser(session.id);
            setUser(freshUser || null);
            
            const myTxs = await ApiService.getTransactions(session.id);
            setTransactions(myTxs);
            
            const fetchedSettings = await ApiService.getSettings();
            setSettings(fetchedSettings);
        }
    } catch (e) {
        console.error("Data fetch error", e);
    }
  };

  const showToastMsg = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = async () => {
    await ApiService.logout();
    window.location.hash = '#/login';
  };

  const handleDeposit = async () => {
    if (!user) return;
    try {
      await ApiService.createTransaction({
        userId: user.id,
        username: user.username,
        type: 'deposit',
        amount: depositAmount,
        upiId: depositUpi,
        utr: depositUtr
      });
      showToastMsg('Deposit request submitted!', 'success');
      setShowDepositModal(false);
      setDepositStep(1);
      setDepositUtr('');
      refreshData();
    } catch (e) {
      showToastMsg('Failed to submit deposit', 'error');
    }
  };

  const handleWithdraw = async () => {
    if (!user) return;
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      showToastMsg('Invalid amount', 'error');
      return;
    }
    if (amount > user.balance) {
      showToastMsg('Insufficient balance', 'error');
      return;
    }

    try {
      // Deduct balance immediately for withdrawal request (optimistic, but DB handles truth)
      await ApiService.updateBalance(user.id, -amount);
      
      await ApiService.createTransaction({
        userId: user.id,
        username: user.username,
        type: 'withdrawal',
        amount: amount,
        upiId: withdrawUpi
      });
      
      showToastMsg('Withdrawal requested!', 'success');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setWithdrawUpi('');
      refreshData();
    } catch (e) {
      showToastMsg('Withdrawal failed', 'error');
      refreshData(); // Sync back real balance
    }
  };

  if (!user) return <div className="min-h-screen bg-dark-900 flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-dark-900 pb-20 relative">
      {/* Header */}
      <header className="p-4 flex justify-between items-center bg-dark-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center text-xl font-bold text-gray-400">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm text-gray-400">Welcome</div>
            <div className="font-bold text-white">{user.username}</div>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setShowHistoryModal(true)} className="p-2 rounded-full bg-dark-700 hover:bg-dark-600 text-white">
             <History size={20} />
           </button>
           <button onClick={handleLogout} className="p-2 rounded-full bg-dark-700 hover:bg-dark-600 text-white">
             <LogOut size={20} />
           </button>
        </div>
      </header>

      {/* Balance */}
      <div className="p-4">
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 p-6 rounded-2xl shadow-lg border border-blue-800">
          <div className="flex items-center gap-2 text-blue-200 mb-2">
            <Wallet size={18} />
            <span className="text-sm font-medium">Total Balance</span>
          </div>
          <div className="text-4xl font-bold text-white tracking-tight">
            ₹{user.balance.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-4 px-4 mb-6">
        <button onClick={() => setShowDepositModal(true)} className="bg-primary hover:bg-primary-hover text-white py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform active:scale-95">
          Deposit
        </button>
        <button onClick={() => setShowWithdrawModal(true)} className="bg-dark-700 hover:bg-dark-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform active:scale-95">
          Withdraw
        </button>
      </div>

      {/* Game Card */}
      <div className="px-4 mb-8">
        <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl p-8 text-center relative overflow-hidden shadow-xl border border-indigo-800 group cursor-pointer transition-transform hover:scale-[1.02]">
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
           <h2 className="text-4xl font-black text-white mb-2 relative z-10 drop-shadow-md">CRASH</h2>
           <p className="text-indigo-200 mb-6 relative z-10">Win up to 100x your bet!</p>
           <Link to="/game" className="inline-flex items-center gap-2 bg-game-success hover:brightness-110 text-dark-900 font-bold py-3 px-8 rounded-full shadow-lg transition-colors relative z-10">
             <PlayCircle size={20} /> Play Now
           </Link>
        </div>
      </div>

      {/* Latest Transactions Preview */}
      <div className="px-4">
        <h3 className="text-gray-400 font-bold mb-3 uppercase text-xs tracking-wider">Recent Activity</h3>
        <div className="space-y-3">
          {transactions.slice(0, 3).map(tx => (
            <div key={tx.id} className="bg-dark-800 p-4 rounded-xl flex justify-between items-center border border-dark-700">
               <div>
                 <div className="font-bold text-white capitalize">{tx.type}</div>
                 <div className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString()}</div>
               </div>
               <div className="text-right">
                 <div className={`font-bold ${tx.type === 'deposit' ? 'text-success' : 'text-danger'}`}>
                   {tx.type === 'deposit' ? '+' : '-'}₹{tx.amount}
                 </div>
                 <div className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${
                   tx.status === 'success' ? 'bg-success/20 text-success' : 
                   tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-danger/20 text-danger'
                 }`}>
                   {tx.status}
                 </div>
               </div>
            </div>
          ))}
          {transactions.length === 0 && <div className="text-center text-gray-500 py-4">No transactions yet</div>}
        </div>
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 w-full max-w-sm rounded-2xl overflow-hidden border border-dark-700">
            <div className="p-4 border-b border-dark-700 flex justify-between items-center">
              <h3 className="font-bold text-xl">Deposit Funds</h3>
              <button onClick={() => setShowDepositModal(false)}><X className="text-gray-400" /></button>
            </div>
            
            <div className="p-5">
              {depositStep === 1 ? (
                <>
                  <label className="block text-gray-400 text-sm mb-2">Select Amount</label>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[500, 1000, 2000, 5000].map(amt => (
                      <button 
                        key={amt}
                        onClick={() => setDepositAmount(amt)}
                        className={`p-3 rounded-lg border-2 font-bold ${depositAmount === amt ? 'border-primary bg-primary/20 text-white' : 'border-dark-600 bg-dark-700 text-gray-400'}`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                  <label className="block text-gray-400 text-sm mb-2">Your UPI ID</label>
                  <input 
                    type="text" 
                    value={depositUpi} 
                    onChange={e => setDepositUpi(e.target.value)}
                    placeholder="e.g. user@okhdfc"
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg p-3 text-white mb-4 outline-none focus:border-primary"
                  />
                  <button 
                    onClick={() => {
                       if(depositUpi) setDepositStep(2);
                       else showToastMsg('Enter UPI ID', 'error');
                    }}
                    className="w-full bg-primary text-white font-bold py-3 rounded-lg"
                  >
                    Next
                  </button>
                </>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <div className="text-gray-400 text-sm mb-1">Send exactly</div>
                    <div className="text-3xl font-bold text-accent">₹{depositAmount}</div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg mx-auto w-48 h-48 mb-4 flex items-center justify-center">
                    {settings.qrCodeUrl ? (
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(settings.qrCodeUrl)}`} alt="QR" />
                    ) : (
                        <QrCode className="text-black w-24 h-24" />
                    )}
                  </div>
                  
                  <div className="bg-dark-700 p-3 rounded-lg flex justify-between items-center mb-4">
                    <span className="text-sm font-mono text-gray-300 truncate max-w-[180px]">{settings.merchantUpi}</span>
                    <button 
                        onClick={() => {
                            if(settings.merchantUpi) {
                                navigator.clipboard.writeText(settings.merchantUpi)
                                    .then(() => showToastMsg('UPI Copied!', 'success'))
                                    .catch(() => showToastMsg('Failed to copy', 'error'));
                            } else {
                                showToastMsg('No UPI ID set', 'error');
                            }
                        }}
                        className="text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:text-white transition-colors"
                    >
                      <Copy size={12} /> Copy
                    </button>
                  </div>

                  <label className="block text-gray-400 text-sm mb-2">UTR / Reference No.</label>
                  <input 
                    type="text" 
                    value={depositUtr} 
                    onChange={e => setDepositUtr(e.target.value)}
                    placeholder="12 digit UTR number"
                    maxLength={12}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg p-3 text-white mb-4 outline-none focus:border-primary"
                  />

                  <div className="flex gap-3">
                    <button onClick={() => setDepositStep(1)} className="flex-1 bg-dark-600 text-white font-bold py-3 rounded-lg">Back</button>
                    <button onClick={handleDeposit} className="flex-1 bg-success text-white font-bold py-3 rounded-lg">Submit</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 w-full max-w-sm rounded-2xl overflow-hidden border border-dark-700">
             <div className="p-4 border-b border-dark-700 flex justify-between items-center">
              <h3 className="font-bold text-xl">Withdraw</h3>
              <button onClick={() => setShowWithdrawModal(false)}><X className="text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Amount (Max: ₹{user.balance})</label>
                <input 
                  type="number"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg p-3 text-white outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Your UPI ID</label>
                <input 
                  type="text"
                  value={withdrawUpi}
                  onChange={e => setWithdrawUpi(e.target.value)}
                  placeholder="user@upi"
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg p-3 text-white outline-none focus:border-primary"
                />
              </div>
              <button onClick={handleWithdraw} className="w-full bg-primary text-white font-bold py-3 rounded-lg mt-2">
                Request Withdrawal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-dark-800 w-full max-w-md h-[80vh] rounded-2xl overflow-hidden border border-dark-700 flex flex-col">
              <div className="p-4 border-b border-dark-700 flex justify-between items-center">
                <h3 className="font-bold text-xl">Transaction History</h3>
                <button onClick={() => setShowHistoryModal(false)}><X className="text-gray-400" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                 {transactions.length > 0 ? transactions.map(tx => (
                    <div key={tx.id} className="bg-dark-700 p-3 rounded-lg flex justify-between items-center">
                        <div>
                          <div className="font-bold text-white text-sm capitalize">{tx.type}</div>
                          <div className="text-xs text-gray-400">{new Date(tx.date).toLocaleString()}</div>
                          <div className="text-xs text-gray-500 font-mono mt-1">Ref: {tx.utr || tx.id.slice(0,8)}</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${tx.type === 'deposit' ? 'text-success' : 'text-danger'}`}>
                            {tx.type === 'deposit' ? '+' : '-'}₹{tx.amount}
                          </div>
                           <span className={`text-xs px-2 py-0.5 rounded ${
                             tx.status === 'success' ? 'bg-success text-dark-900' :
                             tx.status === 'failed' ? 'bg-danger text-white' : 'bg-yellow-500 text-dark-900'
                           }`}>{tx.status}</span>
                        </div>
                    </div>
                 )) : <div className="text-center text-gray-500 mt-10">No history found</div>}
              </div>
           </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl z-[100] flex items-center gap-2 ${toast.type === 'success' ? 'bg-success' : 'bg-danger'}`}>
           {toast.type === 'success' ? <CheckCheck size={18} /> : <X size={18} />}
           <span className="font-bold">{toast.msg}</span>
        </div>
      )}
    </div>
  );
};

export default Dashboard;