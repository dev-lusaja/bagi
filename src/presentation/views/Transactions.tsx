import { useState, useEffect, Fragment } from 'react';
import { Filter, CreditCard, Wallet, Coins, Tags, Calendar, Trash2 } from 'lucide-react';
import { useBudget } from '../context/BudgetContext';
import { formatCurrency } from '../utils/format';

export default function Transactions() {
  const { service } = useBudget();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState([]);
  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // Pagination
  const PAGE_SIZE = 20;
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [filterCat, setFilterCat] = useState('');
  const [filterCurrency, setFilterCurrency] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [filterCard, setFilterCard] = useState('');
  
  // New Tx
  const [desc, setDesc] = useState('');
  const [amt, setAmt] = useState('');
  const [sourceId, setSourceId] = useState(''); // 'id' for account, 'c-id' for card
  const [catId, setCatId] = useState('');
  const [date, setDate] = useState('');

  const fetchFilters = async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    
    const filters: any = {
      limit: PAGE_SIZE,
      offset: isLoadMore ? offset + PAGE_SIZE : 0
    };
    
    if (filterCat) filters.category_id = parseInt(filterCat);
    if (filterCurrency) filters.currency = filterCurrency;
    if (filterAccount) filters.account_id = parseInt(filterAccount);
    if (filterCard) filters.card_id = parseInt(filterCard);
    
    const data = await service.getTransactions(filters);
    
    if (isLoadMore) {
      setTransactions(prev => [...prev, ...data]);
      setOffset(prev => prev + PAGE_SIZE);
    } else {
      setTransactions(data as any);
      setOffset(0);
    }
    
    setHasMore(data.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  const fetchBase = async () => {
    const [accs, crds, cats] = await Promise.all([
      service.getAccounts(),
      service.getCards(),
      service.getCategories()
    ]);
    setAccounts(accs as any);
    setCards(crds as any);
    setCategories(cats as any);
  };

  useEffect(() => { fetchBase(); }, []);
  useEffect(() => { fetchFilters(); }, [filterCat, filterCurrency, filterAccount, filterCard]);

  const addTx = async (e: any) => {
    e.preventDefault();
    const isCard = sourceId.startsWith('c-');
    const actualId = parseInt(sourceId.replace('c-', ''));
    
    await service.addTransaction({
        description: desc, 
        amount: parseFloat(amt), 
        account_id: isCard ? null : actualId,
        card_id: isCard ? actualId : null,
        category_id: parseInt(catId),
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        user_id: 1 // Default
    });
    setDesc(''); setAmt(''); 
    fetchFilters(); // Reset to first page
  };

  const deleteTx = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta transacción?')) return;
    await service.deleteTransaction(id);
    fetchFilters();
  }

  const getTxTypeBadge = (type: string) => {
    switch (type) {
      case 'INCOME':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-100">Ingreso</span>;
      case 'EXPENSE':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-50 text-rose-600 border border-rose-100">Gasto</span>;
      case 'TRANSFER':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-100">Transf</span>;
      default:
        return null;
    }
  };

  const groupedTransactions = (() => {
    const groups: { [key: string]: any[] } = {};
    const today = new Date().toLocaleDateString();
    
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toLocaleDateString();

    transactions.forEach(t => {
      const dateObj = new Date(t.date);
      const dateLocal = dateObj.toLocaleDateString();
      let key = '';
      
      if (dateLocal === today) key = 'Hoy';
      else if (dateLocal === yesterday) key = 'Ayer';
      else {
        key = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        key = key.charAt(0).toUpperCase() + key.slice(1);
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  })();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-500 tracking-tight">Transacciones</h2>
          <p className="text-gray-500 mt-1 font-medium">Controla cada movimiento de tu flujo de caja.</p>
        </div>
        <div className="bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100 text-right">
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Mostrando</p>
          <p className="text-xl font-black text-indigo-600 leading-none">{transactions.length}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold mb-5 flex items-center gap-2">
          <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
          Registrar nuevo movimiento
        </h3>
        <form onSubmit={addTx} className="grid grid-cols-1 md:grid-cols-6 gap-4">
           <div className="flex flex-col gap-1">
             <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Fecha</label>
             <input type="date" className="rounded-xl border border-gray-100 bg-gray-50/50 p-2.5 text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all" value={date} onChange={e=>setDate(e.target.value)} />
           </div>
           <div className="md:col-span-2 flex flex-col gap-1">
             <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Descripción</label>
             <input className="rounded-xl border border-gray-100 bg-gray-50/50 p-2.5 text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all" placeholder="Ej: Supermercado..." value={desc} onChange={e=>setDesc(e.target.value)} required />
           </div>
           <div className="flex flex-col gap-1">
             <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Monto</label>
             <input type="number" step="0.01" className="rounded-xl border border-gray-100 bg-gray-50/50 p-2.5 text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-bold" placeholder="0.00" value={amt} onChange={e=>setAmt(e.target.value)} required />
           </div>
           <div className="flex flex-col gap-1">
             <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Origen</label>
             <select className="rounded-xl border border-gray-100 bg-gray-50/50 p-2.5 text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all" value={sourceId} onChange={e=>setSourceId(e.target.value)} required>
               <option value="" disabled>Seleccionar...</option>
               <optgroup label="Cuentas">
                  {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
               </optgroup>
               <optgroup label="Tarjetas">
                  {cards.map((c: any) => <option key={`c-${c.id}`} value={`c-${c.id}`}>{c.name} ({c.currency})</option>)}
               </optgroup>
             </select>
           </div>
           <div className="flex flex-col gap-1">
             <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Categoría</label>
             <select className="rounded-xl border border-gray-100 bg-gray-50/50 p-2.5 text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all" value={catId} onChange={e=>setCatId(e.target.value)} required>
               <option value="" disabled>Seleccionar...</option>
               <optgroup label="Ingresos">
                 {categories.filter((c: any) => c.type === 'INCOME').map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
               </optgroup>
               <optgroup label="Transferencias">
                 {categories.filter((c: any) => c.type === 'TRANSFER').map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
               </optgroup>
               <optgroup label="Gastos">
                 {categories.filter((c: any) => c.type === 'EXPENSE').map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
               </optgroup>
             </select>
           </div>
           <button type="submit" className="md:col-span-6 bg-gray-900 text-white py-3 rounded-2xl hover:bg-gray-800 transition-all font-bold shadow-lg shadow-gray-200 active:scale-[0.98] mt-2">
             Guardar Transacción
           </button>
        </form>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 bg-gray-50/30">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Filter className="w-5 h-5 text-indigo-500" />
              Historial de movimientos
            </h3>
            
            <div className="grid grid-cols-2 md:flex md:items-center gap-2 w-full md:w-auto">
               <div className="relative group">
                 <Coins className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                 <select className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-100 bg-white text-xs font-bold text-gray-600 outline-none focus:ring-2 focus:ring-indigo-100 transition-all appearance-none cursor-pointer" value={filterCurrency} onChange={e=>setFilterCurrency(e.target.value)}>
                    <option value="">Moneda</option>
                    <option value="PEN">PEN</option>
                    <option value="COP">COP</option>
                 </select>
               </div>

               <div className="relative group">
                 <Tags className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                 <select className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-100 bg-white text-xs font-bold text-gray-600 outline-none focus:ring-2 focus:ring-indigo-100 transition-all appearance-none cursor-pointer" value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
                    <option value="">Categoría</option>
                    <optgroup label="Ingresos">
                      {categories.filter((c: any) => c.type === 'INCOME').map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                    <optgroup label="Transferencias">
                      {categories.filter((c: any) => c.type === 'TRANSFER').map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                    <optgroup label="Gastos">
                      {categories.filter((c: any) => c.type === 'EXPENSE').map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                 </select>
               </div>

               <div className="relative group">
                 <Wallet className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                 <select className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-100 bg-white text-xs font-bold text-gray-600 outline-none focus:ring-2 focus:ring-indigo-100 transition-all appearance-none cursor-pointer" value={filterAccount} onChange={e=>setFilterAccount(e.target.value)}>
                    <option value="">Cuenta</option>
                    {accounts.map((a:any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                 </select>
               </div>

               <div className="relative group">
                 <CreditCard className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                 <select className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-100 bg-white text-xs font-bold text-gray-600 outline-none focus:ring-2 focus:ring-indigo-100 transition-all appearance-none cursor-pointer" value={filterCard} onChange={e=>setFilterCard(e.target.value)}>
                    <option value="">Tarjeta</option>
                    {cards.map((c:any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
               </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Información</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo / Categoría</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Origen</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {Object.entries(groupedTransactions).map(([dateGroup, txs]) => (
                <Fragment key={dateGroup}>
                  <tr className="bg-gray-50/80">
                    <td colSpan={5} className="px-6 py-2">
                       <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                         <span className="text-[11px] font-black uppercase tracking-widest text-indigo-500">{dateGroup}</span>
                       </div>
                    </td>
                  </tr>
                  {txs.map((t: any) => (
                    <tr key={t.id} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                           <span className="text-gray-800 font-normal">{t.description}</span>

                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex flex-col gap-1.5">
                            {getTxTypeBadge(t.category?.type)}
                            <span className="text-gray-500 font-semibold text-xs ml-0.5">{t.category?.name}</span>
                         </div>
                      </td>
                       <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {t.card_id ? <CreditCard className="w-3.5 h-3.5 text-indigo-400" /> : <Wallet className="w-3.5 h-3.5 text-emerald-400" />}
                            <span className="text-gray-500 font-medium text-xs">{t.account?.name || t.card?.name}</span>
                          </div>
                       </td>
                       <td className={`px-6 py-4 text-right font-normal text-base ${t.category?.type === 'INCOME' ? 'text-emerald-600' : 'text-gray-600'}`}>
                          {formatCurrency(t.amount, t.account?.currency || t.card?.currency)}
                       </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => deleteTx(t.id)} 
                          className="p-2 text-gray-200 group-hover:text-rose-300 hover:text-white hover:bg-rose-500 rounded-xl transition-all shadow-sm"
                          title="Eliminar transacción"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-20">
                    <div className="flex flex-col items-center gap-4 text-gray-300">
                      <div className="p-5 bg-gray-50 rounded-full">
                        <Filter className="w-10 h-10 opacity-20" />
                      </div>
                      <div className="text-center">
                        <p className="font-black uppercase tracking-widest text-xs">Sin resultados</p>
                        <p className="text-sm mt-1">No encontramos movimientos que coincidan con los filtros.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {hasMore && (
          <div className="p-8 border-t border-gray-50 flex justify-center bg-gray-50/20">
            <button 
              onClick={() => fetchFilters(true)}
              disabled={loadingMore}
              className="px-8 py-3 bg-white border border-gray-200 rounded-2xl text-xs font-black uppercase tracking-[0.2em] text-gray-500 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-lg shadow-black/5 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
            >
              {loadingMore ? (
                <>
                  <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  Cargando...
                </>
              ) : 'Cargar más movimientos'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
