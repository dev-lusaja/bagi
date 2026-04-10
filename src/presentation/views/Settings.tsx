import { useState, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import { formatCurrency } from '../utils/format';
import { HelpCircle, ArrowRightLeft, TrendingUp, TrendingDown, User, LogOut } from 'lucide-react';

const Section = ({ id, title, icon, children, openSection, setOpenSection }: any) => {
    const isOpen = openSection === id;
    return (
      <div className={`bg-white rounded-2xl shadow-sm border ${isOpen ? 'border-indigo-200' : 'border-gray-100'} transition-all overflow-hidden`}>
        <button 
          onClick={(e) => { e.preventDefault(); setOpenSection(isOpen ? '' : id); }}
          className={`w-full p-6 flex justify-between items-center hover:bg-gray-50 transition-colors ${isOpen ? 'bg-indigo-50/30' : ''}`}
        >
          <div className="flex items-center gap-4">
            <span className={`p-3 rounded-xl ${isOpen ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {icon}
            </span>
            <span className={`text-xl font-bold ${isOpen ? 'text-indigo-900' : 'text-gray-700'}`}>{title}</span>
          </div>
          <svg className={`w-6 h-6 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        {isOpen && <div className="p-6 border-t border-gray-50 bg-white">{children}</div>}
      </div>
    );
  };

export default function SettingsView() {
  const { service, userInfo, logout } = useBudget();
  const [imgError, setImgError] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recurringItems, setRecurringItems] = useState([]);
  
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState('EXPENSE');
  
  const [accName, setAccName] = useState('');
  const [accCurrency, setAccCurrency] = useState('COP');
  const [accCountry, setAccCountry] = useState('Colombia');

  const [cardName, setCardName] = useState('');
  const [cardType, setCardType] = useState('CREDIT');
  const [cardLimit, setCardLimit] = useState('');
  const [cardCurrency, setCardCurrency] = useState('COP');

  const [recName, setRecName] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recDay, setRecDay] = useState('1');
  const [recCatId, setRecCatId] = useState('');
  const [recSourceId, setRecSourceId] = useState(''); // account or card
  const [recNotes, setRecNotes] = useState('');
  const [recStartMonth, setRecStartMonth] = useState(new Date().getMonth() + 1);
  const [recStartYear, setRecStartYear] = useState(new Date().getFullYear());

  const [cardPaymentAccId, setCardPaymentAccId] = useState('');

  const [editingCardId, setEditingCardId] = useState(null);
  const [editCardLimit, setEditCardLimit] = useState('');

  const [editingRecId, setEditingRecId] = useState(null);
  const [editRecData, setEditRecData] = useState<any>(null);

  const [openSection, setOpenSection] = useState(null); // All closed by default
  const [showCatHelp, setShowCatHelp] = useState(false);

  const fetchAll = async () => {
    const [accs, crds, cats, recs] = await Promise.all([
      service.getAccounts(),
      service.getCards(),
      service.getCategories(),
      service.getRecurringItems()
    ]);
    
    setAccounts(accs as any);
    setCards(crds as any);
    setCategories(cats as any);
    setRecurringItems(recs as any);
  };

  useEffect(() => { fetchAll(); }, [service]);


  const addCategory = async (e: any) => {
    e.preventDefault();
    await service.addCategory({ name: newCatName, type: newCatType, user_id: 1 });
    setNewCatName(''); fetchAll();
  };

  const addAccount = async (e: any) => {
    e.preventDefault();
    await service.addAccount({ name: accName, currency: accCurrency, country: accCountry, user_id: 1 });
    setAccName(''); fetchAll();
  };

  const addCard = async (e: any) => {
    e.preventDefault();
    const budgetVal = 0.0;
    if (!cardPaymentAccId) {
      alert('Debes seleccionar una cuenta de pago.');
      return;
    }

    await service.addCard({ 
        name: cardName, 
        type: cardType, 
        currency: cardCurrency, 
        credit_limit: cardType === 'CREDIT' ? parseFloat(cardLimit) : null,
        payment_account_id: parseInt(cardPaymentAccId),
        monthly_payment_budget: budgetVal,
        user_id: 1
    });
    setCardName(''); setCardLimit(''); setCardPaymentAccId(''); fetchAll();
  };

  const saveCardEdit = async (card: any) => {
      await service.updateCard(card.id, {
          ...card,
          credit_limit: parseFloat(editCardLimit)
      });
      setEditingCardId(null);
      fetchAll();
  };

  const addRecurring = async (e: any) => {
    e.preventDefault();
    const isCardSource = recSourceId.startsWith('c-');
    const actualId = parseInt(recSourceId.replace('c-', ''));

    await service.addRecurringItem({
        name: recName,
        amount: parseFloat(recAmount),
        type: 'SERVICE', // Default type
        due_day: parseInt(recDay),
        category_id: parseInt(recCatId),
        account_id: isCardSource ? null : actualId,
        card_id: isCardSource ? actualId : null,
        notes: recNotes,
        start_month: recStartMonth,
        start_year: recStartYear,
        user_id: 1,
        is_active: true
    });
    setRecName(''); setRecAmount(''); setRecNotes(''); fetchAll();
  };

  const deleteItem = async (type: string, id: number) => {
    if (confirm('¿Estás seguro?')) {
        if (type === 'categories') await service.deleteCategory(id);
        if (type === 'accounts') await service.deleteAccount(id);
        if (type === 'cards') await service.deleteCard(id);
        if (type === 'recurring_items') await service.deleteRecurringItem(id);
        fetchAll();
    }
  };

  const saveRecEdit = async (item: any) => {
    await service.updateRecurringItem(item.id, {
      name: editRecData.name,
      amount: parseFloat(editRecData.amount),
      type: item.type,
      due_day: parseInt(editRecData.due_day),
      category_id: item.category_id,
      account_id: item.account_id,
      card_id: item.card_id,
      is_active: item.is_active,
      notes: editRecData.notes,
      start_month: parseInt(editRecData.start_month),
      start_year: parseInt(editRecData.start_year)
    });
    setEditingRecId(null);
    setEditRecData(null);
    fetchAll();
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex md:hidden justify-between items-center mb-8 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        {userInfo && (
          <div className="flex items-center gap-3">
            {userInfo.picture && !imgError ? (
              <img 
                src={userInfo.picture} 
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-10 h-10 rounded-full border border-gray-100 shadow-sm" 
                alt="" 
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                <User className="w-5 h-5" />
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-gray-800">{userInfo.name}</p>
              <p className="text-xs text-gray-400">Cuenta de Google</p>
            </div>
          </div>
        )}
        <button 
          onClick={logout}
          className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors"
          title="Cerrar Sesión"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <div>
        <h2 className="text-3xl lg:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-500">Configuración</h2>
        <p className="text-gray-500 mt-2">Personaliza tu experiencia y gestiona tus recursos financieros.</p>
      </div>

      <div className="flex flex-col gap-4 max-w-4xl">
        <Section 
          id="categories" 
          title="Categorías" 
          openSection={openSection}
          setOpenSection={setOpenSection}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 11h.01M7 15h.01M13 7h.01M13 11h.01M13 15h.01M17 7h.01M17 11h.01M17 15h.01M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>}
        >
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-gray-500 font-medium">Define cómo quieres clasificar tus movimientos.</p>
            <button 
              onClick={() => setShowCatHelp(!showCatHelp)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                showCatHelp ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              {showCatHelp ? 'Cerrar Guía' : 'Guía de Tipos'}
            </button>
          </div>

          {showCatHelp && (
            <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-4 duration-500">
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100/50">
                <div className="flex items-center gap-2 mb-2 text-rose-600">
                  <TrendingDown className="w-4 h-4" />
                  <span className="font-black text-xs uppercase tracking-wider">Gasto</span>
                </div>
                <p className="text-[11px] text-rose-800/70 leading-relaxed font-medium">
                  Reduce el saldo de tus cuentas y se descuenta de tu presupuesto mensual. Es la base para el seguimiento de tus límites.
                </p>
              </div>
              
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100/50">
                <div className="flex items-center gap-2 mb-2 text-emerald-600">
                  <TrendingUp className="w-4 h-4" />
                  <span className="font-black text-xs uppercase tracking-wider">Ingreso</span>
                </div>
                <p className="text-[11px] text-emerald-800/70 leading-relaxed font-medium">
                  Cualquier entrada de dinero (sueldo, ventas, premios). Aumenta tu disponibilidad de fondos en la cuenta seleccionada.
                </p>
              </div>

              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100/50">
                <div className="flex items-center gap-2 mb-2 text-blue-600">
                  <ArrowRightLeft className="w-4 h-4" />
                  <span className="font-black text-xs uppercase tracking-wider">Transferencia</span>
                </div>
                <p className="text-[11px] text-blue-800/70 leading-relaxed font-medium">
                  Movimientos entre tus propios recursos. No afectan tu gasto real ni ingreso total, solo cambian la ubicación del dinero.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={addCategory} className="flex gap-2 mb-6">
            <input className="flex-1 rounded-xl border-gray-200 shadow-sm p-3 border focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Nueva Categoría" value={newCatName} onChange={e => setNewCatName(e.target.value)} required />
            <select className="rounded-xl border-gray-200 shadow-sm p-3 border focus:ring-2 focus:ring-indigo-500 outline-none" value={newCatType} onChange={e => setNewCatType(e.target.value)}>
                <option value="EXPENSE">Gasto</option>
                <option value="INCOME">Ingreso</option>
                <option value="TRANSFER">Transferencia</option>
            </select>
            <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95">Agregar</button>
          </form>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            {categories.map((c: any) => (
                <div key={c.id} className="p-3 bg-gray-50 rounded-xl flex justify-between items-center group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-gray-100">
                    <div className="flex flex-col">
                        <span className="font-semibold text-gray-700">{c.name}</span>
                        <span className={`text-[10px] uppercase font-black tracking-tighter ${
                            c.type === 'INCOME' ? 'text-emerald-500' : 
                            c.type === 'TRANSFER' ? 'text-blue-500' : 'text-rose-500'
                        }`}>
                            {c.type === 'INCOME' ? 'Ingreso' : c.type === 'TRANSFER' ? 'Transferencia' : 'Gasto'}
                        </span>
                    </div>
                    <button onClick={() => deleteItem('categories', c.id)} className="text-gray-200 group-hover:text-rose-400 hover:text-rose-600 transition-all p-2 bg-white rounded-lg shadow-sm border border-transparent hover:border-rose-100">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </div>
            ))}
          </div>
        </Section>

        <Section 
          id="accounts" 
          title="Cuentas de Sueldo / Ahorro" 
          openSection={openSection}
          setOpenSection={setOpenSection}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}
        >
          <p className="text-sm text-gray-500 font-medium mb-6">Registra las cuentas donde recibes tus ingresos y mantienes tu dinero. Son el origen de fondos para todos tus pagos.</p>
          <form onSubmit={addAccount} className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-8">
              <input className="rounded-xl border-gray-200 shadow-sm p-3 border sm:col-span-2" placeholder="Nombre de la Cuenta" value={accName} onChange={e => setAccName(e.target.value)} required />
              <select 
                className="rounded-xl border-gray-200 shadow-sm p-3 border" 
                value={accCountry} 
                onChange={e => {
                  const country = e.target.value;
                  const currencyMap: Record<string, string> = {
                    'Colombia': 'COP',
                    'Perú': 'PEN',
                    'Estados Unidos': 'USD',
                    'Europa': 'EUR'
                  };
                  setAccCountry(country);
                  setAccCurrency(currencyMap[country] || 'COP');
                }}
              >
                  <option value="Colombia">Colombia (COP)</option>
                  <option value="Perú">Perú (PEN)</option>
                  <option value="Estados Unidos">Estados Unidos (USD)</option>
                  <option value="Europa">Unión Europea (EUR)</option>
              </select>
              <button type="submit" className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 font-bold">Crear</button>
          </form>
          <div className="grid grid-cols-1 gap-3">
              {accounts.map((a: any) => (
                  <div key={a.id} className="p-5 bg-indigo-50/40 rounded-2xl border border-indigo-100 flex justify-between items-center group hover:shadow-lg transition-all">
                      <div>
                          <p className="font-bold text-indigo-900 text-lg">{a.name}</p>
                          <div className="flex gap-2 items-center">
                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">{a.country}</p>
                            <span className="text-[10px] text-indigo-300">•</span>
                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">{a.currency}</p>
                          </div>
                      </div>
                      <div className="flex items-center gap-6">
                           <button onClick={() => deleteItem('accounts', a.id)} className="p-2 bg-white rounded-xl shadow-sm border border-transparent hover:border-rose-100 text-gray-200 group-hover:text-rose-400 hover:text-rose-600 transition-all">
                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                           </button>
                      </div>
                  </div>
              ))}
          </div>
        </Section>

        <Section 
          id="cards" 
          title="Mis Tarjetas" 
          openSection={openSection}
          setOpenSection={setOpenSection}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>}
        >
          <p className="text-sm text-gray-500 font-medium mb-6">Gestiona tus plásticos de débito o crédito. Bagi te ayudará a controlar los pagos mensuales y el uso de tus cupos.</p>
          <form onSubmit={addCard} className="flex flex-col space-y-4 mb-10 bg-gray-50 p-6 rounded-2xl border border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input className="rounded-xl border-gray-200 shadow-sm p-3 border" placeholder="Nombre de la Tarjeta" value={cardName} onChange={e => setCardName(e.target.value)} required />
                <div className="grid grid-cols-2 gap-2">
                    <select className="rounded-xl border-gray-200 shadow-sm p-3 border" value={cardType} onChange={e => setCardType(e.target.value)}>
                        <option value="CREDIT">Crédito</option>
                        <option value="DEBIT">Débito</option>
                    </select>
                    <select className="rounded-xl border-gray-200 shadow-sm p-3 border" value={cardCurrency} onChange={e => setCardCurrency(e.target.value)}>
                        <option value="COP">COP</option>
                        <option value="PEN">PEN</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                    </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {cardType === 'CREDIT' && (
                      <input type="number" step="0.01" className="rounded-xl border-gray-200 shadow-sm p-3 border" placeholder="Límite de Cupo" value={cardLimit} onChange={e => setCardLimit(e.target.value)} required />
                  )}
                  <select className="rounded-xl border-gray-200 shadow-sm p-3 border font-bold text-indigo-700" value={cardPaymentAccId} onChange={e => setCardPaymentAccId(e.target.value)} required>
                      <option value="">Selecciona Cuenta de Pago</option>
                      {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
              </div>
              <button type="submit" className="bg-indigo-600 text-white px-6 py-4 rounded-xl hover:bg-indigo-700 font-bold transition-all hover:scale-[1.01] active:scale-95">Agregar Tarjeta</button>
          </form>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {cards.map((c: any) => (
                  <div key={c.id} className="p-5 bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-xl transition-all relative group overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 -mr-12 -mt-12 rounded-full opacity-50 group-hover:bg-indigo-600 group-hover:opacity-10 transition-all"></div>
                      <div className="relative z-10 flex justify-between items-start text-sm">
                          <div>
                              <p className="font-black text-gray-800 text-xl leading-none mb-1">{c.name}</p>
                              <div className="flex gap-2 items-center">
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${c.type==='CREDIT'?'bg-purple-100 text-purple-600':'bg-amber-100 text-amber-600'}`}>{c.type === 'CREDIT'?'Crédito':'Débito'}</span>
                                  <span className="text-[10px] text-gray-400 font-bold uppercase">{c.currency}</span>
                                  {c.payment_account && (
                                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 font-bold border border-indigo-100 italic">Pagada desde: {c.payment_account.name}</span>
                                  )}
                              </div>
                          </div>
                           <div className="flex items-center gap-1 relative z-10">
                               {c.type === 'CREDIT' && (
                                   <button onClick={() => { setEditingCardId(c.id); setEditCardLimit(c.credit_limit || ''); }} className="text-gray-300 hover:text-indigo-500 transition-all p-1.5 rounded-lg hover:bg-indigo-50">
                                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                   </button>
                               )}
                               <button onClick={() => deleteItem('cards', c.id)} className="text-gray-200 group-hover:text-rose-400 hover:text-rose-600 transition-all p-1.5 rounded-lg hover:bg-rose-50">
                                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                               </button>
                           </div>
                      </div>
                       <div className="mt-6 flex justify-between items-end relative z-10">
                          <div className="text-2xl font-black text-gray-900 tracking-tighter">
                               {editingCardId === c.id ? (
                                   <div className="flex gap-2">
                                     <input type="number" step="0.01" className="w-32 rounded-lg border-gray-300 shadow-sm px-2 py-1 text-lg border font-bold" value={editCardLimit} onChange={e => setEditCardLimit(e.target.value)} />
                                     <button onClick={() => saveCardEdit(c)} className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm font-bold">OK</button>
                                     <button onClick={() => setEditingCardId(null)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded-lg text-sm font-bold">X</button>
                                   </div>
                               ) : (
                                   c.type === 'CREDIT' ? formatCurrency(c.credit_limit, c.currency) : 'Tarjeta Débito'
                               )}
                          </div>
                      </div>
                      {c.type === 'CREDIT' && editingCardId !== c.id && (
                          <p className="text-[10px] text-gray-400 mt-2 font-medium">Cupo Asignado</p>
                      )}
                  </div>
              ))}
          </div>
        </Section>

        <Section 
          id="recurring" 
          title="Obligaciones mensuales" 
          openSection={openSection}
          setOpenSection={setOpenSection}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}
        >
          <p className="text-sm text-gray-500 font-medium mb-6">Configura tus pagos recurrentes y suscripciones. Bagi los incluirá automáticamente en tu presupuesto de cada mes para evitar olvidos.</p>
          <form onSubmit={addRecurring} className="flex flex-col space-y-4 mb-8 bg-emerald-50/30 p-6 rounded-2xl border border-emerald-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-gray-400 ml-1 uppercase">Nombre de la obligación</label>
                      <input className="rounded-xl border-gray-200 shadow-sm p-3 border focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Netflix, Agua, Préstamo..." value={recName} onChange={e => setRecName(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-gray-400 ml-1 uppercase">Notas / Detalle</label>
                      <input className="rounded-xl border-gray-200 shadow-sm p-3 border focus:ring-2 focus:ring-emerald-500 outline-none font-medium" placeholder="Opcional: Nro contrato, plan, etc." value={recNotes} onChange={e => setRecNotes(e.target.value)} />
                  </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-gray-400 ml-1">MONTO APROXIMADO</label>
                      <input type="number" step="0.01" className="rounded-xl border-gray-200 shadow-sm p-3 border" value={recAmount} onChange={e => setRecAmount(e.target.value)} required />
                      <p className="text-[9px] text-emerald-600 font-bold ml-1 uppercase tracking-tighter">Este será el monto predeterminado al inicializar cada mes.</p>
                  </div>
                  <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-gray-400 ml-1">DÍA DE VENCIMIENTO</label>
                      <input type="number" min="1" max="31" className="rounded-xl border-gray-200 shadow-sm p-3 border" value={recDay} onChange={e => setRecDay(e.target.value)} required />
                  </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-gray-400 ml-1">CATEGORÍA</label>
                      <select className="rounded-xl border-gray-200 shadow-sm p-3 border" value={recCatId} onChange={e => setRecCatId(e.target.value)} required>
                          <option value="" disabled>Seleccionar</option>
                          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                  </div>
                  <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-gray-400 ml-1">CUENTA DE PAGO DEFECTO</label>
                      <select className="rounded-xl border-gray-200 shadow-sm p-3 border font-bold text-emerald-700" value={recSourceId} onChange={e => setRecSourceId(e.target.value)} required>
                          <option value="" disabled>Seleccionar Origen</option>
                          <optgroup label="Cuentas">
                            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </optgroup>
                          <optgroup label="Tarjetas">
                            {cards.map((c: any) => <option key={`c-${c.id}`} value={`c-${c.id}`}>{c.name}</option>)}
                          </optgroup>
                      </select>
                  </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-emerald-100/50 pt-4">
                  <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-emerald-600 ml-1 uppercase tracking-widest">Mes de Inicio</label>
                      <select className="rounded-xl border-gray-200 shadow-sm p-3 border font-bold" value={recStartMonth} onChange={e => setRecStartMonth(parseInt(e.target.value))} required>
                          {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                  </div>
                  <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-emerald-600 ml-1 uppercase tracking-widest">Año de Inicio</label>
                      <select className="rounded-xl border-gray-200 shadow-sm p-3 border font-bold" value={recStartYear} onChange={e => setRecStartYear(parseInt(e.target.value))} required>
                          {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                  </div>
              </div>
              <button type="submit" className="bg-emerald-600 text-white px-6 py-4 rounded-xl hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-100 transition-all active:scale-95 uppercase tracking-widest text-xs">Guardar Obligación</button>
          </form>
          <div className="space-y-4">
              {recurringItems.map((r: any) => (
                  <div key={r.id} className="p-5 bg-white border border-gray-100 rounded-3xl flex flex-col group hover:shadow-xl transition-all overflow-hidden relative">
                      {editingRecId === r.id ? (
                        <div className="space-y-4 animate-in fade-in duration-200">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-black text-indigo-400 uppercase">Nombre</label>
                              <input className="rounded-xl border-gray-200 p-2 text-sm font-bold border outline-none focus:ring-2 focus:ring-indigo-100" value={editRecData.name} onChange={e => setEditRecData({...editRecData, name: e.target.value})} />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-black text-indigo-400 uppercase">Notas / Detalle</label>
                              <input className="rounded-xl border-gray-200 p-2 text-sm border outline-none focus:ring-2 focus:ring-indigo-100 italic" value={editRecData.notes || ''} onChange={e => setEditRecData({...editRecData, notes: e.target.value})} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-black text-indigo-400 uppercase">Monto</label>
                              <input type="number" step="0.01" className="rounded-xl border-gray-200 p-2 text-sm font-black border outline-none focus:ring-2 focus:ring-indigo-100" value={editRecData.amount} onChange={e => setEditRecData({...editRecData, amount: e.target.value})} />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-black text-indigo-400 uppercase">Día Vencimiento</label>
                              <input type="number" min="1" max="31" className="rounded-xl border-gray-200 p-2 text-sm font-bold border outline-none focus:ring-2 focus:ring-indigo-100" value={editRecData.due_day} onChange={e => setEditRecData({...editRecData, due_day: e.target.value})} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Mes Inicio</label>
                              <select className="rounded-xl border-gray-200 p-2 text-sm font-bold border outline-none focus:ring-2 focus:ring-indigo-100" value={editRecData.start_month} onChange={e => setEditRecData({...editRecData, start_month: parseInt(e.target.value)})}>
                                {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Año Inicio</label>
                              <select className="rounded-xl border-gray-200 p-2 text-sm font-bold border outline-none focus:ring-2 focus:ring-indigo-100" value={editRecData.start_year} onChange={e => setEditRecData({...editRecData, start_year: parseInt(e.target.value)})}>
                                 {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button onClick={() => saveRecEdit(r)} className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100">Guardar</button>
                            <button onClick={() => {setEditingRecId(null); setEditRecData(null);}} className="px-6 bg-gray-100 text-gray-400 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95">X</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                              <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                              </div>
                              <div className="text-sm">
                                  <p className="font-black text-gray-800 text-base flex items-center gap-2">
                                    {r.name}
                                    {r.notes && (
                                      <span className="p-1 rounded bg-amber-50 text-amber-500" title={r.notes}>
                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                      </span>
                                    )}
                                  </p>
                                  <div className="flex gap-2 items-center mt-0.5">
                                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Vence día {r.due_day}</p>
                                      <span className="text-[10px] text-gray-200">•</span>
                                      <span className="text-[10px] px-2 py-0.5 rounded-lg bg-gray-50 text-gray-500 font-black uppercase border border-gray-100 tracking-tighter shadow-sm">
                                          {(accounts as any[]).find(a => a.id === r.account_id)?.name || 
                                          (cards as any[]).find(c => c.id === r.card_id)?.name}
                                      </span>
                                  </div>
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-4">
                              <div className="flex flex-col">
                                  <span className="text-xl font-black text-gray-900 tracking-tighter">
                                      {formatCurrency(
                                          r.amount,
                                          (accounts as any[]).find(a => a.id === r.account_id)?.currency || 
                                          (cards as any[]).find(c => c.id === r.card_id)?.currency
                                      )}
                                  </span>
                              </div>
                              <div className="flex gap-1">
                                  <button onClick={() => {setEditingRecId(r.id); setEditRecData(r);}} className="p-2 text-gray-200 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all active:scale-90">
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                  </button>
                                  <button onClick={() => deleteItem('recurring_items', r.id)} className="p-2 text-gray-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-90">
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                  </button>
                              </div>
                            </div>
                          </div>
                          {r.notes && (
                            <div className="mt-4 pt-4 border-t border-dashed border-gray-100 flex items-start gap-2">
                                <span className="text-[10px] font-black uppercase text-amber-500/60 tracking-widest mt-0.5">Nota:</span>
                                <p className="text-xs text-gray-500 font-medium italic leading-relaxed">{r.notes}</p>
                            </div>
                          )}
                        </>
                      )}
                  </div>
              ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
