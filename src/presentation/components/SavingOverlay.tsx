import { CloudSync } from 'lucide-react';

interface SavingOverlayProps {
    isVisible: boolean;
}

export const SavingOverlay: React.FC<SavingOverlayProps> = ({ isVisible }) => {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[9999] flex items-center justify-center transition-all duration-300">
            <div className="bg-white p-8 rounded-3xl shadow-2xl border border-indigo-50 flex flex-col items-center space-y-4 animate-in zoom-in-95 fade-in duration-300">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
                        <CloudSync className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-bold text-gray-900">Sincronizando con Drive</h3>
                    <p className="text-sm text-gray-500">Guardando cambios de forma segura...</p>
                </div>
                <div className="w-32 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 animate-progress w-full origin-left"></div>
                </div>
            </div>
        </div>
    );
};
