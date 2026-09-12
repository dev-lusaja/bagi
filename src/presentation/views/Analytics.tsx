import { useState, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import { formatCurrency } from '../utils/format';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, ArrowLeftRight, Filter, Calendar } from 'lucide-react';
import { Account, Card, Category, Transaction } from '../../domain/entities';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function Analytics({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  if (onNavigate) {
    // Optional navigation callback support
  }
  const { service } = useBudget();
  const currentDate = new Date();

  // Period A (Base Month) - Defaults to Current Month
  const [yearA, setYearA] = useState(currentDate.getFullYear());
  const [monthA, setMonthA] = useState(currentDate.getMonth() + 1);

  // Period B (Compared Month) - Defaults to Previous Month
  const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const [yearB, setYearB] = useState(prevDate.getFullYear());
  const [monthB, setMonthB] = useState(prevDate.getMonth() + 1);

  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [txsA, setTxsA] = useState<Transaction[]>([]);
  const [txsB, setTxsB] = useState<Transaction[]>([]);

  useEffect(() => {
    const init = async () => {
      const [accs, crds, cats] = await Promise.all([
        service.getAccounts(),
        service.getCards(),
        service.getCategories()
      ]);
      setAccounts(accs as Account[]);
      setCards(crds as Card[]);
      setCategories(cats as Category[]);
      if (accs.length > 0 && !accountId) {
        setAccountId(accs[0].id.toString());
      }
    };
    init();
  }, [service, accountId]);

  useEffect(() => {
    const fetchComparisonData = async () => {
      const [dataA, dataB] = await Promise.all([
        service.getTransactions({ year: yearA, month: monthA, noLimit: true }),
        service.getTransactions({ year: yearB, month: monthB, noLimit: true })
      ]);

      const isCard = accountId.startsWith('c-');
      const actualId = parseInt(accountId.replace('c-', ''));

      const filterTx = (txList: Transaction[]) => {
        if (!accountId) return txList;
        return txList.filter((t: Transaction) => isCard ? t.card_id === actualId : t.account_id === actualId);
      };

      setTxsA(filterTx(dataA as Transaction[]));
      setTxsB(filterTx(dataB as Transaction[]));
    };

    fetchComparisonData();
  }, [service, yearA, monthA, yearB, monthB, accountId]);

  // Currency selection for formatting
  const isCard = accountId.startsWith('c-');
  const actualId = parseInt(accountId.replace('c-', ''));
  const selectedAcc = !isCard ? accounts.find(a => a.id.toString() === accountId) : null;
  const selectedCard = isCard ? cards.find(c => c.id === actualId) : null;
  const currency = selectedAcc?.currency || selectedCard?.currency || 'COP';

  // Process expenses per category for Month A and Month B
  const expenseCats = categories.filter(c => c.type === 'EXPENSE');

  const catMapA: Record<number, number> = {};
  txsA.forEach(t => {
    const cat = categories.find(c => c.id === t.category_id);
    if (cat?.type === 'EXPENSE') {
      catMapA[t.category_id] = (catMapA[t.category_id] || 0) + t.amount;
    }
  });

  const catMapB: Record<number, number> = {};
  txsB.forEach(t => {
    const cat = categories.find(c => c.id === t.category_id);
    if (cat?.type === 'EXPENSE') {
      catMapB[t.category_id] = (catMapB[t.category_id] || 0) + t.amount;
    }
  });

  const totalSpentA = Object.values(catMapA).reduce((a, b) => a + b, 0);
  const totalSpentB = Object.values(catMapB).reduce((a, b) => a + b, 0);

  const totalDiff = totalSpentA - totalSpentB;
  const totalDiffPercent = totalSpentB > 0 ? ((totalSpentA - totalSpentB) / totalSpentB) * 100 : (totalSpentA > 0 ? 100 : 0);

  // Category comparison data
  const categoryComparisons = expenseCats.map(cat => {
    const valA = catMapA[cat.id] || 0;
    const valB = catMapB[cat.id] || 0;
    const diff = valA - valB;
    const diffPercent = valB > 0 ? ((valA - valB) / valB) * 100 : (valA > 0 ? 100 : 0);
    return {
      id: cat.id,
      name: cat.name,
      valA,
      valB,
      diff,
      absDiff: Math.abs(diff),
      diffPercent
    };
  }).filter(c => c.valA > 0 || c.valB > 0);

  // Order categories by highest absolute monetary impact
  categoryComparisons.sort((a, b) => b.absDiff - a.absDiff);

  // Find highest increase & highest savings
  const highestIncrease = [...categoryComparisons]
    .filter(c => c.diff > 0)
    .sort((a, b) => b.diff - a.diff)[0];

  const highestSavings = [...categoryComparisons]
    .filter(c => c.diff < 0)
    .sort((a, b) => a.diff - b.diff)[0]; // Most negative diff

  const monthLabelA = `${MONTH_NAMES[monthA - 1]} ${yearA}`;
  const monthLabelB = `${MONTH_NAMES[monthB - 1]} ${yearB}`;

  const chartData = categoryComparisons.map(c => ({
    name: c.name,
    [monthLabelA]: c.valA,
    [monthLabelB]: c.valB,
    diff: c.diff,
    diffPercent: c.diffPercent,
    valA: c.valA,
    valB: c.valB
  }));

  // Dynamic height for responsive horizontal bar chart
  const chartHeight = Math.max(300, chartData.length * 60);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 sm:gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-500 tracking-tight">
            Analítica Comparativa
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1 font-medium">
            Compara tus hábitos de gasto entre periodos (Mes Base vs. Mes Comparado).
          </p>
        </div>

        {/* Account Filter */}
        <div className="relative group w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-indigo-500 transition-colors" />
          <select
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-gray-100 bg-white text-xs font-bold text-gray-600 outline-none focus:ring-2 focus:ring-indigo-100 transition-all appearance-none cursor-pointer shadow-sm shadow-black/5 min-w-[200px] min-h-[44px]"
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
          >
            <optgroup label="Cuentas">
              {accounts.map((a: Account) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </optgroup>
            {cards.length > 0 && (
              <optgroup label="Tarjetas">
                {cards.map((c: Card) => <option key={`c-${c.id}`} value={`c-${c.id}`}>{c.name} ({c.currency})</option>)}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      {/* Period Selection Controls */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
          <Calendar className="w-4 h-4" />
          <span>Selección de Periodos a Comparar</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Period A Selector (Mes Base) */}
          <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/60 space-y-2">
            <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest block">
              Mes Base (Mes A)
            </span>
            <div className="flex items-center gap-2">
              <select
                className="flex-1 bg-white border border-indigo-200 text-xs font-bold text-gray-700 px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
                value={monthA}
                onChange={e => setMonthA(parseInt(e.target.value))}
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                className="w-24 bg-white border border-indigo-200 text-xs font-bold text-gray-700 px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
                value={yearA}
                onChange={e => setYearA(parseInt(e.target.value))}
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Period B Selector (Mes Comparado) */}
          <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100/60 space-y-2">
            <span className="text-[10px] font-black uppercase text-purple-600 tracking-widest block">
              Mes Comparado (Mes B)
            </span>
            <div className="flex items-center gap-2">
              <select
                className="flex-1 bg-white border border-purple-200 text-xs font-bold text-gray-700 px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-purple-200 cursor-pointer"
                value={monthB}
                onChange={e => setMonthB(parseInt(e.target.value))}
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                className="w-24 bg-white border border-purple-200 text-xs font-bold text-gray-700 px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-purple-200 cursor-pointer"
                value={yearB}
                onChange={e => setYearB(parseInt(e.target.value))}
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Total Variation Card */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Variación Total Gastos</span>
            <div className={`p-2.5 rounded-2xl ${totalDiff > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <ArrowLeftRight className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-gray-800 tracking-tight">
                {formatCurrency(totalSpentA, currency)}
              </span>
              <span className="text-xs text-gray-400 font-semibold">vs {formatCurrency(totalSpentB, currency)}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${totalDiff > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {totalDiff >= 0 ? '+' : ''}{formatCurrency(totalDiff, currency)} ({totalDiffPercent >= 0 ? '+' : ''}{totalDiffPercent.toFixed(1)}%)
              </span>
              <span className="text-[10px] text-gray-400 font-medium">respecto a {MONTH_NAMES[monthB - 1]}</span>
            </div>
          </div>
        </div>

        {/* Highest Increase Card */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Mayor Incremento</span>
            <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div>
            {highestIncrease ? (
              <>
                <p className="text-xl font-black text-gray-800 truncate mb-1">{highestIncrease.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-rose-600">
                    +{formatCurrency(highestIncrease.diff, currency)}
                  </span>
                  <span className="text-xs font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md">
                    +{highestIncrease.diffPercent.toFixed(1)}%
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 font-medium mt-1">
                  {formatCurrency(highestIncrease.valB, currency)} → {formatCurrency(highestIncrease.valA, currency)}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400 italic font-medium">No hay incrementos en este periodo</p>
            )}
          </div>
        </div>

        {/* Highest Savings Card */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Mayor Ahorro</span>
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div>
            {highestSavings ? (
              <>
                <p className="text-xl font-black text-gray-800 truncate mb-1">{highestSavings.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-600">
                    {formatCurrency(highestSavings.diff, currency)}
                  </span>
                  <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {highestSavings.diffPercent.toFixed(1)}%
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 font-medium mt-1">
                  {formatCurrency(highestSavings.valB, currency)} → {formatCurrency(highestSavings.valA, currency)}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400 italic font-medium">No hay reducciones en este periodo</p>
            )}
          </div>
        </div>
      </div>

      {/* Main Chart Section: Category Side-by-Side Comparison */}
      <div className="bg-white p-5 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
        <div>
          <h3 className="text-xl font-black text-gray-800 tracking-tight">Comparativa por Categorías</h3>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            Gasto acumulado en {monthLabelA} vs. {monthLabelB}, ordenado por mayor impacto en la diferencia.
          </p>
        </div>

        {chartData.length === 0 ? (
          <div className="py-16 text-center text-gray-400 font-medium bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            No hay gastos registrados en los dos periodos seleccionados para esta cuenta/tarjeta.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Horizontal Bar Chart (Side-by-side) */}
            <div style={{ width: '100%', height: chartHeight }} className="overflow-x-auto">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
                  barGap={4}
                  barCategoryGap={16}
                >
                  <XAxis
                    type="number"
                    tickFormatter={(val) => formatCurrency(val, currency)}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={{ stroke: '#f3f4f6' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#374151' }}
                    width={110}
                    axisLine={{ stroke: '#f3f4f6' }}
                  />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [
                      formatCurrency(Number(value) || 0, currency),
                      String(name)
                    ]}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: '1px solid #f3f4f6',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey={monthLabelA} fill="#6366f1" radius={[0, 8, 8, 0]} barSize={14} />
                  <Bar dataKey={monthLabelB} fill="#a855f7" radius={[0, 8, 8, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed Category Table / Breakdown List */}
            <div className="pt-6 border-t border-gray-100">
              <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-4">
                Detalle y Variación por Categoría
              </h4>
              <div className="space-y-3">
                {chartData.map((item, idx) => {
                  const isUp = item.diff > 0;
                  const isZero = item.diff === 0;

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-gray-50/70 border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 group hover:bg-white hover:shadow-md transition-all"
                    >
                      <div className="flex-1">
                        <span className="text-sm font-bold text-gray-800 block">{item.name}</span>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span>{monthLabelA}: <strong className="text-indigo-600">{formatCurrency(item.valA, currency)}</strong></span>
                          <span>vs</span>
                          <span>{monthLabelB}: <strong className="text-purple-600">{formatCurrency(item.valB, currency)}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="text-right">
                          <span className={`text-sm font-black block ${isUp ? 'text-rose-600' : isZero ? 'text-gray-500' : 'text-emerald-600'}`}>
                            {isUp ? '+' : ''}{formatCurrency(item.diff, currency)}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block ${isUp ? 'bg-rose-100 text-rose-700' : isZero ? 'bg-gray-200 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>
                            {isUp ? '+' : ''}{item.diffPercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
