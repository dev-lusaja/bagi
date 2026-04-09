import React, { createContext, useContext, useEffect, useState } from 'react';
import { BudgetService } from '../../application/use-cases/BudgetService';
import { SqliteBudgetRepository } from '../../infrastructure/repositories/SqliteBudgetRepository';
import { GoogleDriveAdapter } from '../../infrastructure/adapters/GoogleDriveAdapter';

interface BudgetContextType {
    service: BudgetService;
    isInitialized: boolean;
    isSyncing: boolean;
    hasPendingChanges: boolean;
    userInfo: { name: string; picture: string } | null;
    isAuthenticated: boolean;
    login: (provider: 'google' | 'onedrive') => Promise<void>;
    logout: () => Promise<void>;
    sync: () => Promise<void>;
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

export const BudgetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [service] = useState(() => new BudgetService(new SqliteBudgetRepository(), new GoogleDriveAdapter()));
    const [isInitialized, setIsInitialized] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);
    const [userInfo, setUserInfo] = useState<{ name: string; picture: string } | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                service.setOnSyncStateChange(setIsSyncing);
                await service.init();
                
                const restored = await service.tryRestoreSession();
                if (restored) {
                    setUserInfo(service.getUserInfo());
                    setIsAuthenticated(true);
                }

                setIsInitialized(true);
            } catch (error: any) {
                console.error("Initialization failed", error);
                await handleAuthError(error);
                setIsInitialized(true);
            }
        };
        init();

        const pendingCheck = setInterval(() => {
            setHasPendingChanges(service.getHasPendingChanges());
        }, 1000);

        return () => clearInterval(pendingCheck);
    }, [service]);

    const handleAuthError = async (error: any) => {
        if (error.message === 'AUTH_ERROR') {
            await logout();
        }
    };

    const login = async (provider: 'google' | 'onedrive') => {
        if (provider === 'google') {
            try {
                await service.login();
                setUserInfo(service.getUserInfo());
                setIsAuthenticated(true);
            } catch (error) {
                await handleAuthError(error);
                throw error;
            }
        } else {
            alert('OneDrive integration coming soon!');
        }
    };

    const logout = async () => {
        await service.logout();
        setIsAuthenticated(false);
        setUserInfo(null);
    };

    const sync = async () => {
        try {
            await service.syncToDrive();
        } catch (error) {
            await handleAuthError(error);
        }
    };

    return (
        <BudgetContext.Provider value={{ service, isInitialized, isSyncing, hasPendingChanges, userInfo, isAuthenticated, login, logout, sync }}>
            {children}
        </BudgetContext.Provider>
    );
};

export const useBudget = () => {
    const context = useContext(BudgetContext);
    if (!context) throw new Error("useBudget must be used within a BudgetProvider");
    return context;
};
