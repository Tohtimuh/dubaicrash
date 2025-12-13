import React, { useEffect, useState } from 'react';
import { ApiService } from '../services/storage';
import { User, UserRole } from '../types';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, requireAdmin = false }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
        try {
            const sessionUser = await ApiService.getSession();
            if (!sessionUser) {
                window.location.hash = '#/login';
                return;
            }
            
            if (requireAdmin && sessionUser.role !== UserRole.ADMIN) {
                window.location.hash = '#/'; // Redirect to home if not admin
                return;
            }

            // Get fresh profile
            const freshUser = await ApiService.getUser(sessionUser.id);
            if(freshUser) {
                setUser(freshUser);
            } else {
                window.location.hash = '#/login';
            }
        } catch (e) {
            console.error(e);
            window.location.hash = '#/login';
        } finally {
            setLoading(false);
        }
    };
    checkAuth();
  }, [requireAdmin]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-dark-900 text-white gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <div>Loading...</div>
    </div>
  );

  return <>{children}</>;
};

export default AuthGuard;