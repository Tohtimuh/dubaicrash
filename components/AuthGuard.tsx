import React, { useEffect, useState } from 'react';
import { StorageService } from '../services/storage';
import { User, UserRole } from '../types';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, requireAdmin = false }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = StorageService.getSession();
    if (!session) {
      window.location.hash = '#/login';
      return;
    }
    
    if (requireAdmin && session.role !== UserRole.ADMIN) {
      window.location.hash = '#/'; // Redirect to home if not admin
      return;
    }

    // Refresh data from storage to get latest balance
    const latestUser = StorageService.getUser(session.username);
    if (latestUser) {
        setUser(latestUser);
    } else {
        // Session invalid
        StorageService.logout();
        window.location.hash = '#/login';
    }
    setLoading(false);
  }, [requireAdmin]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-dark-900 text-white">Loading...</div>;

  return <>{children}</>;
};

export default AuthGuard;