import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminPanel from './pages/Admin';
import Game from './pages/Game';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected User Routes */}
        <Route path="/" element={
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        } />
        
        <Route path="/game" element={
          <AuthGuard>
            <Game />
          </AuthGuard>
        } />

        {/* Protected Admin Routes */}
        <Route path="/admin" element={
          <AuthGuard requireAdmin={true}>
            <AdminPanel />
          </AuthGuard>
        } />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;