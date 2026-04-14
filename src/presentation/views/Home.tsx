import { useState, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import { formatCurrency } from '../utils/format';
import { 
  ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';
import { CreditCard, Landmark, Wallet, CheckCircle2, AlertCircle, Tag, Repeat, HelpCircle, Info } from 'lucide-react';
import { OnboardingChecklist } from '../components/OnboardingChecklist';

export default function Home({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { service } = useBudget();
  const [year] = useState(new Date().getFullYear());
  const [month] = useState(new Date().getMonth() + 1);
  
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [globalBudgets, setGlobalBudgets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [recurringItems, setRecurringItems] = useState<any[]>([]);
  const [showOnboardingManual, setShowOnboardingManual] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [accs, crds, gb, txs, cats, recs] = await Promise.all([
        service.getAccounts(),
        service.getCards(),
        service.getGlobalBudgets(year, month),
        service.getTransactions(),
        service.getCategories(),
        service.getRecurringItems(),
      ]);
      
      setAccounts(accs);
      setCards(crds);
      setGlobalBudgets(gb);
      setCategories(cats);
      setRecurringItems(recs);
      setTransactions(txs.filter((t: any) => {
        const d = new Date(t.date);
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
      }));
    };
    fetchData();
  }, [service, year, month]);

  const renderAccountSummary = (account: any) => {
    const linkedCards = cards.filter(c => c.payment_account_id === account.id);
    
    // 1. Gasto directo de la cuenta (Efectivo/Débito)
    const accTransactions = transactions.filter(t => t.account_id === account.id && !t.card_id);
    const accSpent = accTransactions.reduce((acc, t) => {
      const cat = categories.find(c => c.id === t.category_id);
      return cat?.type === 'EXPENSE' ? acc + t.amount : acc;
    }, 0);

    // 2. Gasto de cada tarjeta vinculada
    const cardDetails = linkedCards.map(card => {
      const cardTx = transactions.filter(t => t.card_id === card.id);
      const spent = cardTx.reduce((acc, t) => {
        const cat = categories.find(c => c.id === t.category_id);
        return cat?.type === 'EXPENSE' ? acc + t.amount : acc;
      }, 0);
      return { 
        ...card, 
        spent, 
        available: card.type === 'CREDIT' ? (card.credit_limit || 0) - spent : 0 
      };
    });

    const totalCardsSpent = cardDetails.reduce((acc, c) => acc + c.spent, 0);
    const totalSpent = accSpent + totalCardsSpent;

    const gb = globalBudgets.find(b => b.account_id === account.id);
    const budgetLimit = gb ? gb.total_amount : 0;
    const totalPercent = budgetLimit > 0 ? Math.round((totalSpent / budgetLimit) * 100) : (totalSpent > 0 ? 100 : 0);
    const accountAvailable = budgetLimit - totalSpent;

    const chartData = [
      { name: 'Spent', value: totalPercent, fill: totalPercent > 100 ? '#f43f5e' : (totalPercent > 80 ? '#f59e0b' : '#6366f1') }
    ];

    return (
      <div key={`acc-${account.id}`} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col gap-6 group hover:shadow-xl transition-all duration-500 bg-gradient-to-b from-white to-gray-50/20">
        
        {/* Parte Superior: Gráfico Maestro y Título */}
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-32 h-32 shrink-0">
            <div style={{ width: '100%', height: '100%', minWidth: 1, minHeight: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart 
                  cx="50%" cy="50%" 
                  innerRadius="80%" outerRadius="100%" 
                  barSize={10} 
                  data={chartData} 
                  startAngle={90} endAngle={90 + (3.6 * Math.min(100, totalPercent))}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar background dataKey="value" cornerRadius={30} angleAxisId={0} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-black tracking-tighter ${totalPercent > 100 ? 'text-rose-600' : 'text-gray-900'}`}>{totalPercent}%</span>
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Ejecución</span>
            </div>
          </div>

          <div className="flex-1 space-y-4 text-center sm:text-left">
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-1">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-100">
                  <Landmark className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-black text-gray-800 tracking-tight">{account.name}</h3>
              </div>
              <div className="flex items-center justify-center sm:justify-start mb-1">
                <p className="text-gray-400 font-bold text-[10px] uppercase tracking-[0.2em]">Saldo Libre</p>
              </div>
              <p className={`text-1xl sm:text-2xl font-black tracking-tight ${accountAvailable < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {formatCurrency(accountAvailable, account.currency)}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                <span>Total Gastado:</span>
                <span className="text-gray-800">{formatCurrency(totalSpent, account.currency)}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                <span>Presupuesto:</span>
                <span className="text-gray-800">{formatCurrency(budgetLimit, account.currency)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const orphanedCards = cards.filter(c => !c.payment_account_id);
  const currentGlobalBudget = globalBudgets.find(b => b.month === month && b.year === year);
  
  const onboardingSteps = [
    { id: 'categories', title: 'Categorías', completed: categories.length > 0, icon: Tag, action: () => onNavigate?.('settings'), actionLabel: 'Ver', description: 'Revisa/crea tus categorías.' },
    { id: 'accounts', title: 'Cuentas', completed: accounts.length > 0, icon: Landmark, action: () => onNavigate?.('settings'), actionLabel: 'Crear', description: 'Registra tu cuenta sueldo.' },
    { id: 'cards', title: 'Tarjetas', completed: cards.length > 0, icon: CreditCard, action: () => onNavigate?.('settings'), actionLabel: 'Asociar', description: 'Configura tus tarjetas de crédito.' },
    { id: 'recurring', title: 'Recurrentes', completed: recurringItems.length > 0, icon: Repeat, action: () => onNavigate?.('transactions'), actionLabel: 'Agregar', description: 'Registra tus gastos recurrentes.' },
    { id: 'budget', title: 'Presupuesto', completed: !!currentGlobalBudget, icon: Wallet, action: () => onNavigate?.('dashboard'), actionLabel: 'Definir', description: 'Asigna tus gastos mensuales.' }
  ];

  const onboardingComplete = onboardingSteps.every(s => s.completed);
  const showOnboarding = !onboardingComplete || showOnboardingManual;

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-500 tracking-tight">Inicio</h2>
          <p className="text-gray-500 mt-1 font-medium">Control unificado de tus cuentas este mes.</p>
        </div>

        <div className="flex items-center gap-3">
          {onboardingComplete && (
            <button 
              onClick={() => setShowOnboardingManual(!showOnboardingManual)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 font-bold text-xs hover:bg-indigo-100 transition-all shadow-sm"
            >
              <HelpCircle className="w-4 h-4" />
              {showOnboardingManual ? 'Ocultar guía' : 'Guía rápida'}
            </button>
          )}
          <div className="flex items-center gap-3 bg-indigo-50 px-5 py-2.5 rounded-2xl border border-indigo-100 shadow-sm">
             <div className="text-indigo-400">
               <CheckCircle2 className="w-4 h-4" />
             </div>
             <span className="text-sm font-black text-indigo-700 uppercase tracking-widest leading-none mt-0.5">{new Date().toLocaleString('es-ES', { month: 'long' })}</span>
             <span className="text-indigo-600 font-black text-lg leading-none">{year}</span>
          </div>
        </div>
      </div>

      {showOnboarding && (
        <div className="animate-in slide-in-from-top-4 duration-500">
          <OnboardingChecklist steps={onboardingSteps} />
        </div>
      )}

      <div className="space-y-12">
        {accounts.map(acc => renderAccountSummary(acc))}
        
        {orphanedCards.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 px-4">
              <div className="h-px flex-1 bg-gray-100" />
              <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.4em]">Otras Tarjetas (Sin Vincular)</h4>
              <div className="h-px flex-1 bg-gray-100" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {orphanedCards.map(card => {
                const cardTx = transactions.filter(t => t.card_id === card.id);
                const spent = cardTx.reduce((acc, t) => {
                  const cat = categories.find(c => c.id === t.category_id);
                  return cat?.type === 'EXPENSE' ? acc + t.amount : acc;
                }, 0);
                return (
                  <div key={card.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all">
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-3 bg-gray-50 text-gray-400 rounded-2xl">
                        <CreditCard className="w-6 h-6" />
                      </div>
                      <AlertCircle className="w-5 h-5 text-amber-400" />
                    </div>
                    <p className="text-xl font-black text-gray-800 mb-1">{card.name}</p>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Independiente</p>
                    <div className="bg-gray-50 p-4 rounded-2xl space-y-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase">Consumo</p>
                      <p className="text-2xl font-black text-gray-800">{formatCurrency(spent, card.currency)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {accounts.length === 0 && cards.length === 0 && (
          <div className="py-32 text-center bg-white rounded-[4rem] border border-dashed border-gray-200">
            <div className="max-w-xs mx-auto space-y-6">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300 shadow-inner">
                <Landmark className="w-10 h-10" />
              </div>
              <p className="text-gray-500 font-bold text-lg">No se han configurado cuentas bancarias.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
