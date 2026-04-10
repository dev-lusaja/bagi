import { useState, useEffect } from 'react';
import { LayoutDashboard, Receipt, Settings, LogOut, Home as HomeIcon, Loader2, CloudCheck, CloudAlert, User } from 'lucide-react';
import Home from './presentation/views/Home';
import Dashboard from './presentation/views/Dashboard';
import Transactions from './presentation/views/Transactions';
import SettingsView from './presentation/views/Settings';
import Login from './presentation/views/Login';
import { useBudget } from './presentation/context/BudgetContext';
import { SavingOverlay } from './presentation/components/SavingOverlay';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [imgError, setImgError] = useState(false);
  const { isInitialized, isSyncing, hasPendingChanges, sync, userInfo, isAuthenticated, logout } = useBudget();

  useEffect(() => {
    setImgError(false);
  }, [userInfo]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingChanges]);

  if (!isInitialized) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 space-y-6">
        <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl shadow-indigo-100/50 border border-indigo-50 flex items-center justify-center p-2 overflow-hidden animate-bounce">
          <img src="/logo_circle.png" className="w-full h-full object-contain" alt="Logo" />
        </div>
        <div className="flex items-center space-x-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-bold uppercase tracking-widest text-[10px]">Cargando Bagi...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
      <SavingOverlay isVisible={isSyncing} />
      
      {/* Sidebar Navigation (Desktop) */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col shadow-sm">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-3 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-indigo-50 shadow-sm flex items-center justify-center overflow-hidden p-1">
              <img src="/logo_circle.png" className="w-full h-full object-contain" alt="Bagi" />
            </div>
            <h1 className="text-xl font-black text-gray-800 tracking-tighter">Bagi</h1>
          </div>
          <button 
            onClick={sync}
            disabled={isSyncing}
            className={`p-2 rounded-lg transition-all ${
              isSyncing ? 'animate-pulse text-indigo-400' : 
              hasPendingChanges ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 
              'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
            title={isSyncing ? 'Sincronizando...' : hasPendingChanges ? 'Cambios pendientes - Clic para sincronizar' : 'Todo sincronizado'}
          >
            {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : 
             hasPendingChanges ? <CloudAlert className="w-5 h-5" /> : 
             <CloudCheck className="w-5 h-5" />}
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('home')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'home' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
            <HomeIcon className="w-5 h-5" />
            <span>Inicio</span>
          </button>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
            <LayoutDashboard className="w-5 h-5" />
            <span>Presupuesto</span>
          </button>
          <button 
            onClick={() => setActiveTab('transactions')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'transactions' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Receipt className="w-5 h-5" />
            <span>Transacciones</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'settings' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Settings className="w-5 h-5" />
            <span>Configuración</span>
          </button>
        </nav>
        <div className="p-4 border-t border-gray-100 space-y-4">
           {userInfo && (
             <div className="px-4 py-2 flex items-center gap-3">
               {userInfo.picture && !imgError ? (
                 <img 
                   src={userInfo.picture} 
                   referrerPolicy="no-referrer"
                   onError={() => setImgError(true)}
                   className="w-8 h-8 rounded-full border border-gray-100 shadow-sm" 
                   alt="" 
                 />
               ) : (
                 <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                   <User className="w-4 h-4" />
                 </div>
               )}
               <div className="overflow-hidden">
                 <p className="text-xs font-bold text-gray-800 truncate">{userInfo.name}</p>
                 <p className="text-[10px] text-gray-400">Google Account</p>
               </div>
             </div>
           )}
           <button 
              onClick={logout}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors">
              <LogOut className="w-5 h-5" />
              <span>Cerrar Sesión</span>
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto p-4 md:p-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'home' && <Home onNavigate={setActiveTab} />}
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'transactions' && <Transactions />}
          {activeTab === 'settings' && <SettingsView />}
        </div>
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 flex items-center justify-around p-3 pb-safe shadow-lg z-50">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${activeTab === 'home' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <HomeIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold">Inicio</span>
        </button>
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${activeTab === 'dashboard' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-[10px] font-bold">Resumen</span>
        </button>
        <button onClick={() => setActiveTab('transactions')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${activeTab === 'transactions' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <Receipt className="w-6 h-6" />
          <span className="text-[10px] font-bold">Registro</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${activeTab === 'settings' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <Settings className="w-6 h-6" />
          <span className="text-[10px] font-bold">Ajustes</span>
        </button>
      </nav>
    </div>
  );
}
