import React, { createContext, useContext, useEffect, useState } from 'react';
import { BudgetService } from '../../application/use-cases/BudgetService';
import { SqliteBudgetRepository } from '../../infrastructure/repositories/SqliteBudgetRepository';
import { GoogleDriveAdapter } from '../../infrastructure/adapters/GoogleDriveAdapter';
import * as Sentry from '@sentry/react';
import { AnalyticsService } from '../../services/AnalyticsService';
import { ErrorLogger } from '../../services/SentryLogger';

interface BudgetContextType {
    service: BudgetService;
    isInitialized: boolean;
    isSyncing: boolean;
    hasPendingChanges: boolean;
    userInfo: { name: string; picture: string; email: string } | null;
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
    const [userInfo, setUserInfo] = useState<{ name: string; picture: string; email: string } | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                service.setOnSyncStateChange(setIsSyncing);
                await service.init();
                
                const restored = await service.tryRestoreSession();
                if (restored) {
                    const info = service.getUserInfo();
                    setUserInfo(info);
                    setIsAuthenticated(true);
                    if (info?.email) {
                        Sentry.setUser({ id: info.email, email: info.email, username: info.name });
                        AnalyticsService.identify(info.email, info.name);
                    } else {
                        Sentry.setUser(null);
                    }
                }

                setIsInitialized(true);
            } catch (error: any) {
                ErrorLogger.capture(error, { source: 'BudgetContext - init' });
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
                const info = service.getUserInfo();
                setUserInfo(info);
                setIsAuthenticated(true);
                if (info?.email) {
                    Sentry.setUser({ id: info.email, email: info.email, username: info.name });
                    AnalyticsService.identify(info.email, info.name);
                } else {
                    Sentry.setUser(null);
                }
            } catch (error) {
                ErrorLogger.capture(error, { source: 'BudgetContext - login google' });
                await handleAuthError(error);
                throw error;
            }
        } else {
            throw new Error('OneDrive integration coming soon!');
        }
    };

    const logout = async () => {
        await service.logout();
        Sentry.setUser(null);
        AnalyticsService.reset();
        setIsAuthenticated(false);
        setUserInfo(null);
    };

    const sync = async () => {
        try {
            await service.syncToDrive();
        } catch (error) {
            ErrorLogger.capture(error, { source: 'BudgetContext - sync' });
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
