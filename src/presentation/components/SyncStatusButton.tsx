import { CloudAlert, CloudCheck, Loader2 } from 'lucide-react';

interface SyncStatusButtonProps {
    isSyncing: boolean;
    hasPendingChanges: boolean;
    onSync: () => void;
}

export const SyncStatusButton: React.FC<SyncStatusButtonProps> = ({ isSyncing, hasPendingChanges, onSync }) => {
    const label = isSyncing ? 'Sincronizando…' : hasPendingChanges ? 'Sincronizar cambios pendientes' : 'Todo sincronizado';

    return (
        <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            title={label}
            aria-label={label}
            className={`relative w-10 h-10 flex items-center justify-center rounded-control transition-colors active:scale-95 ${isSyncing ? 'text-indigo-600' :
                hasPendingChanges ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' :
                    'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                }`}
        >
            {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> :
                hasPendingChanges ? <CloudAlert className="w-5 h-5" /> :
                    <CloudCheck className="w-5 h-5" />}
            {/* Pending is a real alert: a pinging dot invites a tap (static under prefers-reduced-motion) */}
            {!isSyncing && hasPendingChanges && (
                <span className="absolute top-1 right-1 flex w-2.5 h-2.5" aria-hidden="true">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-amber-500 border border-white" />
                </span>
            )}
        </button>
    );
};
