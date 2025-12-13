import React, { useState } from 'react';
import { ApiService } from '../services/storage';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { UserRole } from '../types';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await ApiService.login(username, password);
      if (user.role === UserRole.ADMIN) {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
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
            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-lg transition-colors flex justify-center items-center gap-2"
            >
              {loading && <Loader2 className="animate-spin" size={20} />}
              {loading ? 'Signing In...' : 'Login'}
            </button>
          </form>
          <div className="mt-4 text-center text-sm text-gray-400">
            Don't have an account? <Link to="/register" className="text-primary hover:underline">Register now</Link>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;