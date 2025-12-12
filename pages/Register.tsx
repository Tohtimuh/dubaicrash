import React, { useState } from 'react';
import { StorageService } from '../services/storage';
import { Link } from 'react-router-dom';

const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      StorageService.createUser(username, password);
      alert('Registration successful! Please login.');
      window.location.hash = '#/login';
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-dark-800 p-8 rounded-xl shadow-lg w-full max-w-md border border-dark-700">
        <h1 className="text-3xl font-bold text-accent text-center mb-6">Create Account</h1>
        <form onSubmit={handleRegister} className="space-y-6">
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
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Confirm Password</label>
            <input 
              type="password" 
              className="w-full bg-dark-700 border border-dark-600 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-colors"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="text-danger text-center text-sm">{error}</div>}
          <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-lg transition-colors">
            Register
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-gray-400">
          Already have an account? <Link to="/login" className="text-primary hover:underline">Login</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;