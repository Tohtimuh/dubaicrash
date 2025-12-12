import React, { useState } from 'react';
import { StorageService } from '../services/storage';
import { Link } from 'react-router-dom';
import { Info, RefreshCw } from 'lucide-react';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = StorageService.login(username, password);
      if (user.role === 'ADMIN') {
        window.location.hash = '#/admin';
      } else {
        window.location.hash = '#/';
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReset = () => {
    if(window.confirm("Are you sure? This will delete all users and reset to default.")) {
      StorageService.resetDatabase();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-dark-900">
      <div className="w-full max-w-md">
        
        {/* Login Card */}
        <div className="bg-dark-800 p-8 rounded-xl shadow-lg border border-dark-700 mb-6">
          <h1 className="text-3xl font-bold text-accent text-center mb-6">Login</h1>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Username</label>
              <input 
                type="text" 
                className="w-full bg-dark-700 border border-dark-600 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-colors"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Password</label>
              <input 
                type="password" 
                className="w-full bg-dark-700 border border-dark-600 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <div className="text-danger text-center text-sm">{error}</div>}
            <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-lg transition-colors">
              Login
            </button>
          </form>
          <div className="mt-4 text-center text-sm text-gray-400">
            Don't have an account? <Link to="/register" className="text-primary hover:underline">Register now</Link>
          </div>
        </div>

        {/* Demo Credentials Hint */}
        <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-xl flex gap-3 text-sm text-blue-200">
           <Info className="flex-shrink-0" size={20} />
           <div className="w-full">
             <div className="font-bold mb-1">Default Credentials (Automatic File)</div>
             <div className="grid grid-cols-2 gap-2 font-mono text-xs text-white">
                <div>
                   <div className="text-gray-400">Admin</div>
                   <div>User: admin</div>
                   <div>Pass: 123</div>
                </div>
                <div>
                   <div className="text-gray-400">Player</div>
                   <div>User: user</div>
                   <div>Pass: 123</div>
                </div>
             </div>
           </div>
        </div>
        
        <div className="text-center mt-6">
           <button onClick={handleReset} className="text-xs text-gray-600 hover:text-red-400 flex items-center justify-center gap-1 mx-auto">
             <RefreshCw size={12} /> Reset Database to Default
           </button>
        </div>

      </div>
    </div>
  );
};

export default Login;