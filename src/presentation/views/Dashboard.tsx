import { useState, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Filter } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import SmartAlertPanel from '../components/SmartAlertPanel';

export default function Dashboard() {
  const { service } = useBudget();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [accountId, setAccountId] = useState('');
  const [activeTab, setActiveTab] = useState('consumption');

  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [budgets, setBudgets] = useState([]); // category budgets
  const [cardBudgets, setCardBudgets] = useState<any[]>([]); // card budgets
  const [globalBudget, setGlobalBudget] = useState<any>(null); // global budget
  const [cards, setCards] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [allMonthlyTransactions, setAllMonthlyTransactions] = useState([]);
  const [prevMonthTransactions, setPrevMonthTransactions] = useState<any[]>([]);
  const [budgetObligations, setBudgetObligations] = useState([]);

  // Controla cuándo el motor de alertas puede arrancar.
  // Se pone en false cada vez que cambia la cuenta/mes y en true
  // solo cuando fetchDashboardData completa exitosamente.
  const [isDashboardDataReady, setIsDashboardDataReady] = useState(false);

  // Editing state
  const [isEditingGlobal, setIsEditingGlobal] = useState(false);
  const [editGlobalAmt, setEditGlobalAmt] = useState('');
  
  // UI state for details
  const [selectedCatDetail, setSelectedCatDetail] = useState<any>(null);
  const [selectedObligationDetail, setSelectedObligationDetail] = useState<any>(null);

  // New Global Budget form
  const [newGlobalAmt, setNewGlobalAmt] = useState('');

  // New category budget form
  const [newBgtCatId, setNewBgtCatId] = useState('');
  const [newBgtAmt, setNewBgtAmt] = useState('');

  // Inline card budget form
  const [inlineCardBgt, setInlineCardBgt] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    const init = async () => {
      const [accs, crds, cats] = await Promise.all([
        service.getAccounts(),
        service.getCards(),
        service.getCategories()
      ]);
      setAccounts(accs as any);
      setCards(crds as any);
      setCategories(cats as any);
      if (accs.length > 0 && !accountId) setAccountId(accs[0].id.toString());
    };
    init();
  }, [service]);

  const fetchDashboardData = async () => {
    if (!accountId) return;
    setIsDashboardDataReady(false); // Marcar datos como no listos mientras recargamos
    const isCard = accountId.startsWith('c-');
    const actualId = parseInt(accountId.replace('c-', ''));

    if (isCard) {
      setGlobalBudget(null);
      setBudgets([]);
      setCardBudgets([]);
    } else {
      const [gb, cb, crdb, obs] = await Promise.all([
        service.getGlobalBudgets(year, month),
        service.getCategoryBudgets(year, month),
        service.getCardBudgets(year, month),
        service.getBudgetObligations(year, month)
      ]);
      setGlobalBudget(gb.find((b: any) => b.account_id === actualId) || null);
      setBudgets(cb.filter((b: any) => b.account_id === actualId) as any);
      setCardBudgets(crdb.filter((b: any) => b.account_id === actualId) as any);
      setBudgetObligations(obs as any);
    }

    const monthlyTx = await service.getTransactions({ year, month, noLimit: true });

    // Fetch previous month and scope it to the same account/card for correct trend comparison
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthTxAll = await service.getTransactions({ year: prevYear, month: prevMonth, noLimit: true });
    const prevMonthFiltered = prevMonthTxAll.filter((t: any) => isCard ? t.card_id === actualId : t.account_id === actualId);
    setPrevMonthTransactions(prevMonthFiltered as any);

    setAllMonthlyTransactions(monthlyTx as any);
    const filtered = monthlyTx.filter((t: any) => isCard ? t.card_id === actualId : t.account_id === actualId);
    setTransactions(filtered as any);

    // Todos los datos están listos — el motor de alertas puede arrancar
    setIsDashboardDataReady(true);
  };

  useEffect(() => { fetchDashboardData(); }, [year, month, accountId]);

  const toggleEditGlobal = () => {
    if (globalBudget) {
      setEditGlobalAmt(globalBudget.total_amount.toString());
      setIsEditingGlobal(true);
    }
  };

  const updateGlobalBudget = async (e: any) => {
    e.preventDefault();
    if (!globalBudget || !editGlobalAmt || !accountId) return;
    await service.updateGlobalBudget(globalBudget.id, {
      year, month, total_amount: parseFloat(editGlobalAmt), account_id: parseInt(accountId)
    });
    setIsEditingGlobal(false);
    fetchDashboardData();
  };

  const addGlobalBudget = async (e: any) => {
    e.preventDefault();
    if (!newGlobalAmt || !accountId) return;
    await service.addGlobalBudget({
      year, month, total_amount: parseFloat(newGlobalAmt), account_id: parseInt(accountId)
    });
    setNewGlobalAmt(''); fetchDashboardData();
  };

  const addBudget = async (e: any) => {
    e.preventDefault();
    if (!newBgtCatId || !newBgtAmt) return;

    const amt = parseFloat(newBgtAmt);
    const catId = parseInt(newBgtCatId);
    
    // Reality-based validation: only check if the ADDITIONAL amount fits
    const actualAmt = actualsByCategory[catId] || 0;
    const additionalCommitment = Math.max(0, amt - actualAmt);

    if (globalBudget && additionalCommitment > remainingGlobal) {
      alert('Este monto excede el presupuesto global disponible real.');
      return;
    }

    await service.addCategoryBudget({
      year, month, amount: amt, category_id: catId, account_id: parseInt(accountId)
    });
    setNewBgtAmt(''); setNewBgtCatId(''); fetchDashboardData();
  };

  const deleteBudget = async (id: number) => {
    await service.deleteCategoryBudget(id);
    fetchDashboardData();
  }

  const addInlineCardBudget = async (cardId: number, e: any) => {
    e.preventDefault();
    const amtStr = inlineCardBgt[cardId];
    if (!amtStr) return;

    const amt = parseFloat(amtStr);
    
    if (globalBudget) {
      // Calcular consumo real de esta tarjeta específica para saber cuánto de su "exceso huérfano" recuperaremos
      const cardTx = (allMonthlyTransactions as any[]).filter((t: any) => t.card_id === cardId);
      const grossSpent = cardTx.reduce((sum: number, tx: any) => {
        const cat = (categories as any[]).find((c: any) => c.id === tx.category_id);
        return cat?.type === 'EXPENSE' ? sum + tx.amount : sum;
      }, 0);

      // Delta logic: only the part of 'amt' that is NOT yet spent counts against remainingGlobal
      const additionalCommitment = Math.max(0, amt - grossSpent);

      if (additionalCommitment > remainingGlobal) {
        alert('Este monto excede el presupuesto global disponible real.');
        return;
      }
    }

    await service.addCardBudget({
      year, month, amount: amt, card_id: cardId, account_id: parseInt(accountId)
    });
    
    setInlineCardBgt(prev => ({...prev, [cardId]: ''}));
    fetchDashboardData();
  };

  const deleteCardBudget = async (id: number) => {
    await service.deleteCardBudget(id);
    fetchDashboardData();
  }

  const initializeBudget = async () => {
    if (!accountId || accountId.startsWith('c-')) return;
    
    const actualId = parseInt(accountId);

    try {
      await service.initializeMonth(year, month, actualId, 1); // Using 1 as default userId
      fetchDashboardData();
      alert('Mes inicializado con éxito. Se han copiado los límites y proyectado las obligaciones.');
    } catch (error) {
      console.error('Error initializing budget:', error);
      alert('Hubo un error al inicializar el presupuesto del mes.');
    }
  };

  const payRecurring = async (item: any) => {
    const confirmAmt = prompt(`Confirmar monto para ${item.name}:`, item.amount.toString());
    if (confirmAmt === null) return;

    const amount = parseFloat(confirmAmt);
    if (isNaN(amount)) return;

    // Use linked account/card if available, otherwise current dashboard selection
    const finalAccountId = item.account_id || (accountId.startsWith('c-') ? null : parseInt(accountId));
    const finalCardId = item.card_id || (accountId.startsWith('c-') ? parseInt(accountId.replace('c-', '')) : null);

    await service.addTransaction({
      amount,
      description: `Pago Recurrente: ${item.name}`,
      date: new Date().toISOString(),
      category_id: item.category_id,
      budget_obligation_id: item.id,
      account_id: finalAccountId,
      card_id: finalCardId,
      user_id: 1 // Default
    });

    fetchDashboardData();
  };

  const updateObligationAmount = async (item: any) => {
    const newAmt = prompt(`Actualizar monto para ${item.name} (${item.year}-${item.month}):`, item.amount.toString());
    if (newAmt === null) return;
    const amount = parseFloat(newAmt);
    if (isNaN(amount)) return;

    await service.updateBudgetObligation(item.id, {
      ...item,
      amount
    });
    fetchDashboardData();
  };

  const payCard = async (card: any, currentSpent: number) => {
    const incomeCats = (categories as any[]).filter((c: any) => c.type === 'INCOME');
    const expenseCats = (categories as any[]).filter((c: any) => c.type === 'EXPENSE');
    const transferCats = (categories as any[]).filter((c: any) => c.type === 'TRANSFER');

    if (transferCats.length === 0 && incomeCats.length === 0) {
      alert("Debes crear al menos una categoría de tipo 'Transferencia' o 'Ingreso' para registrar abonos a tarjetas.");
      return;
    }

    let pagoCat = transferCats.find((c: any) => c.name.toLowerCase().includes('pago tarjeta') || c.name.toLowerCase().includes('pago de tarjeta'));
    if (!pagoCat) {
      pagoCat = expenseCats.find((c: any) => c.name.toLowerCase().includes('pago tarjeta') || c.name.toLowerCase().includes('pago de tarjeta'));
    }

    if (!pagoCat) {
      alert("Por favor crea una categoría llamada 'Pago tarjeta' para poder registrar la salida del dinero de tu cuenta.");
      return;
    }

    const defaultAmt = currentSpent > 0 ? currentSpent.toString() : '';
    const confirmAmt = prompt(`Confirmar monto a abonar a ${card.name}:`, defaultAmt);
    if (confirmAmt === null) return;
    const amount = parseFloat(confirmAmt);
    if (isNaN(amount) || amount <= 0) return;

    let catId = 0;
    const abonoCat = transferCats.find((c: any) => c.name.toLowerCase().includes('abono a tarjeta') || c.name.toLowerCase().includes('abono a'));
    
    if (abonoCat) {
      catId = abonoCat.id;
    } else {
      const altAbono = incomeCats.find((c: any) => c.name.toLowerCase().includes('abono a tarjeta') || c.name.toLowerCase().includes('abono a'));
      if (altAbono) {
        catId = altAbono.id;
      } else {
        const allPossible = [...transferCats, ...incomeCats];
        const catNames = allPossible.map((c: any, i: number) => `${i + 1}. ${c.name}`).join('\n');
        const catPick = prompt(`Selecciona la categoría para el ABONO (Ingreso a tarjeta):\n${catNames}`, "1");
        if (!catPick) return;
        const pickIdx = parseInt(catPick) - 1;
        if (pickIdx >= 0 && pickIdx < allPossible.length) {
          catId = allPossible[pickIdx].id;
        } else {
           return;
        }
      }
    }

    // 1. Ingreso a la tarjeta (para bajar la deuda)
    await service.addTransaction({
      amount,
      description: `Abono a Tarjeta: ${card.name}`,
      date: new Date().toISOString(),
      category_id: catId,
      account_id: null,
      card_id: card.id,
      user_id: 1
    });

    // 2. Gasto de la cuenta de banco
    const sourceAcc = card.payment_account_id || (!accountId.startsWith('c-') ? parseInt(accountId) : null);
    if (sourceAcc) {
      await service.addTransaction({
        amount,
        description: `Pago de Tarjeta: ${card.name}`,
        date: new Date().toISOString(),
        category_id: pagoCat.id,
        account_id: sourceAcc,
        card_id: null,
        user_id: 1
      });
    }

    fetchDashboardData();
  };

  const isCard = accountId.startsWith('c-');
  const actualId = parseInt(accountId.replace('c-', ''));
  const selectedCard = isCard ? (cards as any[]).find((c: any) => c.id === actualId) : null;
  const selectedAcc = !isCard ? (accounts as any[]).find((a: any) => a.id.toString() === accountId) : null;

  // Linked cards for correctly scoped spending (only when an account is selected)
  const linkedCards = !isCard ? cards.filter((c: any) => (c as any).payment_account_id === actualId) : [];

  // Calculate progress
  // For categories, we only show EXPENSES from the ACTUAL account/card (no mixing to avoid double counting)
  const scopedTransactions = (transactions as any[]).filter((t: any) => t.account_id === actualId || t.card_id === actualId);

  const actualsByCategory: any = {};
  scopedTransactions.forEach((t: any) => {
    const cat = (categories as any[]).find((c: any) => c.id === t.category_id);
    if (cat?.type !== 'EXPENSE') return; // Only expenses count for categories chart

    if (!actualsByCategory[t.category_id]) actualsByCategory[t.category_id] = 0;
    actualsByCategory[t.category_id] += t.amount;
  });

  // Reality-based outflow calculation scoped to THIS account and its linked cards
  const totalSpentGlobal = (allMonthlyTransactions as any[]).reduce((acc: number, t: any) => {
    const cat = (categories as any[]).find((c: any) => c.id === t.category_id);
    if (cat?.type !== 'EXPENSE') return acc;
    
    // Check if the transaction belongs to the current scope (Account or its Cards)
    const transactionAccountId = t.account_id;
    const transactionCardId = t.card_id;
    
    if (!isCard) {
      // Account view: show transactions from the account itself + its linked cards
      const isFromAccount = transactionAccountId === actualId;
      const isFromLinkedCard = linkedCards.some((lc: any) => lc.id === transactionCardId);
      return (isFromAccount || isFromLinkedCard) ? acc + t.amount : acc;
    }
    
    // Specific Card view: only transactions from this card
    return (transactionCardId === actualId) ? acc + t.amount : acc;
  }, 0);

  // For the UI details and card-specific logic
  const totalSpent = totalSpentGlobal; // Alias for cleaner JSX reading
  const monthlyReserved = cardBudgets.reduce((acc: number, b: any) => acc + b.amount, 0);

  // Consider an excess ONLY if individual card spent > its reserved budget
  const cardExcess = linkedCards.reduce((acc: number, card: any) => {
    const cardTx = (allMonthlyTransactions as any[]).filter((t: any) => t.card_id === card.id);
    const grossSpent = cardTx.reduce((sum: number, tx: any) => {
      const cat = (categories as any[]).find((c: any) => c.id === tx.category_id);
      if (cat?.type === 'EXPENSE') return sum + tx.amount;
      return sum;
    }, 0);
    const currentBgt = cardBudgets.find((b: any) => b.card_id === card.id);
    const bgtAmt = currentBgt ? currentBgt.amount : 0;
    return acc + Math.max(0, grossSpent - bgtAmt);
  }, 0);

  // Remaining budget based on reality (Cash Flow)
  const remainingGlobal = globalBudget ? globalBudget.total_amount - totalSpentGlobal : 0;
  
  // Planning Commitment: Sum of (Max(Budget, Spent)) for categories
  // PLUS the remaining (unused) card reserve to see if the WHOLE plan fits the WHOLE budget
  const totalRemainingCardReserve = linkedCards.reduce((acc: number, card: any) => {
    const cardTx = (allMonthlyTransactions as any[]).filter((t: any) => t.card_id === card.id);
    const grossSpent = cardTx.reduce((sum: number, tx: any) => {
      const cat = (categories as any[]).find((c: any) => c.id === tx.category_id);
      return cat?.type === 'EXPENSE' ? sum + tx.amount : sum;
    }, 0);
    const currentBgt = cardBudgets.find((b: any) => b.card_id === card.id);
    const bgtAmt = currentBgt ? currentBgt.amount : 0;
    return acc + Math.max(0, bgtAmt - grossSpent);
  }, 0);

  const totalPlannedCommitment = (categories as any[]).reduce((acc: number, cat: any) => {
    if (cat.type !== 'EXPENSE') return acc;
    const b = (budgets as any[]).find((b: any) => b.category_id === cat.id);
    const budgetAmt = b ? b.amount : 0;
    const actualAmt = actualsByCategory[cat.id] || 0;
    return acc + Math.max(budgetAmt, actualAmt);
  }, 0) + totalRemainingCardReserve;

  // Warning logic
  const isOverBudgeted = globalBudget && totalSpentGlobal > globalBudget.total_amount; // Current reality
  const isOverPlanned = globalBudget && totalPlannedCommitment > globalBudget.total_amount; // Planning level
  const budgetDiff = globalBudget ? Math.abs(totalPlannedCommitment - globalBudget.total_amount) : 0;
  
  const categoriesWithoutLimit = (categories as any[]).filter((c: any) => {
    const hasBudget = budgets.some((b: any) => b.category_id === c.id);
    const hasTx = actualsByCategory[c.id] > 0;
    return hasTx && !hasBudget && c.type === 'EXPENSE';
  });

  const categoriesToShow = (categories as any[]).filter((c: any) => {
    if (c.type === 'TRANSFER') return false; // Don't show transfers in consumption budget
    const hasBudget = budgets.some((b: any) => b.category_id === c.id);
    const hasTx = actualsByCategory[c.id] > 0;
    return (hasBudget || hasTx) && c.type === 'EXPENSE';
  });

  const filteredRecurring = (budgetObligations as any[]).filter(item => {
    if (item.card_id) return isCard && item.card_id === actualId;
    if (item.account_id) return !isCard && item.account_id === actualId;
    return !isCard; // Show items with no source only on accounts
  });

  const obligationsStatus = filteredRecurring.map(item => {
    const linkedTx = (transactions as any[]).find((t: any) => t.budget_obligation_id === item.id);
    const isPaid = !!linkedTx;
    const paidAmount = linkedTx ? linkedTx.amount : 0;
    const isPastDue = !isPaid && item.due_day < new Date().getDate();

    const itemSourceAcc = (accounts as any[]).find((a: any) => a.id === item.account_id);
    const itemSourceCard = (cards as any[]).find((c: any) => c.id === item.card_id);
    const itemCurrencyCode = itemSourceAcc?.currency || itemSourceCard?.currency || (selectedAcc?.currency || selectedCard?.currency);

    return { ...item, isPaid, isPastDue, itemCurrencyCode, paidAmount };
  });

  // --- Lógica de Arquitectura del Plan (Desglose Visual de Compromisos) ---
  const totalServicesPlan = (filteredRecurring as any[]).reduce((acc, item) => acc + item.amount, 0);
  const totalCardsPlan = (cardBudgets as any[]).reduce((acc, b) => acc + b.amount, 0);
  
  // Para los límites variables, restamos los servicios que ya están en esas categorías para no duplicar
  const totalVariableLimitsPlan = (budgets as any[]).reduce((acc, b) => {
    const recurringInCat = (filteredRecurring as any[])
      .filter(ri => ri.category_id === b.category_id)
      .reduce((s, ri) => s + ri.amount, 0);
    return acc + Math.max(0, b.amount - recurringInCat);
  }, 0);
  
  const totalPlannedArchitecture = totalServicesPlan + totalCardsPlan + totalVariableLimitsPlan;
  const theoreticalFreeBalance = globalBudget ? globalBudget.total_amount - totalPlannedArchitecture : 0;
  const isOverPlannedArchitecture = globalBudget && totalPlannedArchitecture > globalBudget.total_amount;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-500 tracking-tight">Presupuesto</h2>
          <p className="text-gray-500 mt-1 font-medium">Controla tus límites y gastos recurrentes.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-indigo-50 rounded-2xl border border-indigo-100 p-1 shadow-sm">
            <select 
              className="bg-transparent text-xs font-black text-indigo-700 uppercase tracking-wider px-3 py-1.5 outline-none cursor-pointer" 
              value={year} 
              onChange={e => setYear(parseInt(e.target.value))}
            >
              {[2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div className="w-px h-4 bg-indigo-200"></div>
            <select 
              className="bg-transparent text-xs font-black text-indigo-700 uppercase tracking-wider px-3 py-1.5 outline-none cursor-pointer" 
              value={month} 
              onChange={e => setMonth(parseInt(e.target.value))}
            >
              {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>

          <div className="relative group">
            <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-indigo-500 transition-colors" />
            <select 
              className="pl-9 pr-4 py-2.5 rounded-2xl border border-gray-100 bg-white text-xs font-bold text-gray-600 outline-none focus:ring-2 focus:ring-indigo-100 transition-all appearance-none cursor-pointer shadow-sm shadow-black/5 min-w-[180px]" 
              value={accountId} 
              onChange={e => setAccountId(e.target.value)}
            >
              <optgroup label="Cuentas">
                {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
              </optgroup>
              {cards.length > 0 && (
                <optgroup label="Tarjetas">
                  {cards.map((c: any) => <option key={`c-${c.id}`} value={`c-${c.id}`}>{c.name} ({c.currency})</option>)}
                </optgroup>
              )}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="col-span-1 md:col-span-2">
          {/* ADVERTENCIA DE PRESUPUESTO INSUFICIENTE (PLANIFICACIÓN) */}
          {isOverPlanned && (
            <div className="mb-6 bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3 text-rose-800 shadow-sm transition-all border-l-4 border-l-rose-500">
              <svg className="w-6 h-6 shrink-0 text-rose-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              <div>
                <h4 className="font-bold text-lg leading-none">Presupuesto insuficiente · Faltan {formatCurrency(budgetDiff, selectedAcc?.currency || 'PEN')}</h4>
                <p className="text-sm mt-1 text-rose-700/80 font-medium">Las categorías asignadas (objetivos) superan tu presupuesto global. Reduce límites o aumenta el presupuesto.</p>
              </div>
            </div>
          )}

          {/* ADVERTENCIA DE GASTO REAL EXCEDIDO */}
          {isOverBudgeted && (
            <div className="mb-6 bg-rose-600 p-4 rounded-xl flex items-start gap-3 text-white shadow-lg animate-pulse">
              <svg className="w-6 h-6 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              <div>
                <h4 className="font-bold">Gasto Excedido</h4>
                <p className="text-sm">¡Atención! Actualmente has gastado más dinero del que habías presupuestado para este mes ({formatCurrency(Math.abs(remainingGlobal), selectedAcc?.currency)} de déficit).</p>
              </div>
            </div>
          )}

          {/* ALERTAS GLOBALES */}
          {!isCard && (() => {
            const missingCards = linkedCards.filter((c: any) => !cardBudgets.some((b: any) => b.card_id === c.id));
            const hasMissingCards = missingCards.length > 0;
            const hasMissingCats = categoriesWithoutLimit.length > 0;
            
            if (!hasMissingCards && !hasMissingCats) return null;
            
            return (
              <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-3 text-amber-800 shadow-sm transition-all border-l-4 border-l-amber-500">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  <div>
                    <h4 className="font-bold text-lg leading-none">Acción Requerida: Configuración Pendiente</h4>
                    <p className="text-sm mt-1 text-amber-700/80 font-medium">Revisa estos puntos para que tu presupuesto sea preciso:</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-9">
                  {hasMissingCards && (
                    <div className="bg-white/50 p-2.5 rounded-lg border border-amber-100">
                      <p className="text-[10px] uppercase font-black text-amber-500 tracking-wider mb-1">Tarjetas sin reserva</p>
                      <p className="text-sm font-bold">{missingCards.map((c: any) => c.name).join(', ')}</p>
                    </div>
                  )}
                  {hasMissingCats && (
                    <div className="bg-white/50 p-2.5 rounded-lg border border-amber-100">
                      <p className="text-[10px] uppercase font-black text-amber-500 tracking-wider mb-1">Categorías sin límite</p>
                      <p className="text-sm font-bold">{categoriesWithoutLimit.map((c: any) => c.name).join(', ')}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* SMART ALERT PANEL: solo mes actual, datos ya filtrados por cuenta, oculto si no hay data en absoluto */}
          {!isCard && year === new Date().getFullYear() && month === new Date().getMonth() + 1 && (transactions.length > 0 || prevMonthTransactions.length > 0 || obligationsStatus.length > 0) && (
            <SmartAlertPanel
              currentMonthTx={transactions}
              prevMonthTx={prevMonthTransactions}
              categories={categories}
              categoryBudgets={budgets}
              budgetObligations={obligationsStatus}
              currency={selectedAcc?.currency || 'COP'}
              dataReady={isDashboardDataReady}
              accountId={accountId || ''}
            />
          )}

          {/* Tabs Navigation */}
          <div className="flex space-x-1 mb-6 bg-gray-100/50 p-1 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab('consumption')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'consumption' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
            >
              Consumo por categoría
            </button>
            <button
              onClick={() => setActiveTab('obligations')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'obligations' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
            >
              Obligaciones del mes
            </button>
            {!isCard && linkedCards.length > 0 && (
              <button
                onClick={() => setActiveTab('cards')}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'cards' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              >
                Tarjetas asociadas
              </button>
            )}
          </div>

          {activeTab === 'consumption' && (
            <>
              <h3 className="text-xl font-semibold mb-6">Consumo por categoría</h3>
              {categoriesToShow.length === 0 && <div className="p-8 text-center text-gray-400 bg-white border border-gray-100 rounded-2xl">No hay gastos registrados ni presupuestos para este mes.</div>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categoriesToShow.map((cat: any) => {
                  const b = (budgets as any[]).find((b: any) => b.category_id === cat.id);
                  const actual = actualsByCategory[cat.id] || 0;
                  const budgetAmt = b ? (b as any).amount : 0;

                  // Real percentage — no cap so we can show 3000% etc.
                  const percent = budgetAmt > 0 ? Math.round((actual / budgetAmt) * 100) : (actual > 0 ? 100 : 0);
                  const isOver = percent > 100;
                  let barColor = budgetAmt > 0 ? 'bg-emerald-500' : 'bg-indigo-400';
                  if (budgetAmt > 0) {
                    if (percent > 80) barColor = 'bg-amber-500';
                    if (isOver) barColor = 'bg-rose-500';
                  }

                  return (
                    <div key={cat.id} className={`bg-white p-5 rounded-3xl shadow-sm border relative group hover:shadow-md transition-all ${isOver ? 'border-rose-200 ring-2 ring-rose-100' : 'border-gray-100'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col gap-1">
                           <span className="text-gray-800 text-lg leading-tight flex items-center gap-2">
                              {cat?.name}
                              {!b && actual > 0 && (
                                <span className="text-amber-500" title="Categoría con consumo sin límite definido">
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                </span>
                              )}
                           </span>
                           <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Usado</span>
                              <span className="text-sm font-medium text-gray-700">{formatCurrency(actual, selectedAcc?.currency || selectedCard?.currency)}</span>
                           </div>
                        </div>

                        {b && (
                          <button
                            onClick={() => deleteBudget((b as any).id)}
                            className="p-2 rounded-xl text-gray-200 group-hover:text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-all border border-transparent shadow-sm hover:shadow-none"
                            title="Eliminar límite"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>

                      <div className="w-full bg-gray-100/80 rounded-full h-2 mb-4 overflow-hidden shadow-inner">
                        <div className={`${barColor} h-full rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, percent)}%` }}></div>
                      </div>

                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col gap-2">
                           <div className="flex items-center gap-1.5 text-[10px]">
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                              <span className="font-semibold text-gray-400 uppercase tracking-wider gap-1">Límite: <span className="text-gray-500">{budgetAmt > 0 ? formatCurrency(budgetAmt, selectedAcc?.currency || selectedCard?.currency) : 'Sin definir'}</span></span>
                           </div>
                           {budgetAmt > 0 && (
                             <div className={`flex items-center gap-1.5 text-[10px]`}>
                               <div className={`w-1.5 h-1.5 rounded-full ${isOver ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'}`}></div>
                               <span className={`font-semibold uppercase tracking-wider gap-1 ${isOver ? 'text-rose-500' : 'text-emerald-600'}`}>
                                 Disp: <span className={isOver ? 'text-rose-600 font-bold' : 'text-emerald-700 font-bold'}>{isOver ? '$0.00' : formatCurrency(budgetAmt - actual, selectedAcc?.currency || selectedCard?.currency)}</span>
                               </span>
                             </div>
                           )}
                        </div>
                        <span className={`font-black text-[10px] uppercase px-2.5 py-1 rounded-lg mt-0.5 ${isOver ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-200' : percent > 80 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                          {percent}%
                        </span>
                      </div>

                      <button 
                        onClick={() => setSelectedCatDetail(cat)}
                        className="mt-4 w-full py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-600 bg-indigo-50/50 hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100 active:scale-95"
                      >
                        Ver movimientos
                      </button>

                      {isOver && (
                        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-extrabold text-rose-600 bg-rose-50 px-3 py-2 rounded-xl border border-rose-100 uppercase tracking-widest shadow-sm">
                          <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                          Excedido por {formatCurrency(actual - budgetAmt, selectedAcc?.currency || selectedCard?.currency)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
          
          {activeTab === 'obligations' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h3 className="text-xl font-semibold mb-6">Obligaciones del mes</h3>
              {obligationsStatus.length === 0 && (
                <div className="p-8 text-center text-gray-400 bg-white border border-gray-100 rounded-2xl">
                  No tienes obligaciones recurrentes configuradas para este origen.
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {obligationsStatus.map((item: any) => (
                  <div key={item.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col gap-6 group hover:shadow-xl transition-all h-full relative overflow-hidden">
                    {/* Fila Superior: Nombre y Acción */}
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${item.isPaid ? 'bg-emerald-500' : (item.isPastDue ? 'bg-rose-500 animate-pulse' : 'bg-indigo-400')}`} />
                           <p className="text-xl text-gray-800 leading-tight">{item.name}</p>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400 pl-4">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                          <span className="text-[10px] font-black uppercase tracking-widest">Día {item.due_day}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedObligationDetail(item)}
                        className="p-3 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all active:scale-90 border border-transparent hover:border-indigo-100"
                        title="Ver detalles completo"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      </button>
                    </div>

                    {item.notes && (
                      <div className="mx-1 p-3 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                        <p className="text-[10px] text-gray-400 font-medium italic line-clamp-1">"{item.notes}"</p>
                      </div>
                    )}

                    {/* Fila Inferior: Comparativa y Botón Pago */}
                    <div className="mt-auto flex flex-col gap-4">
                       <div className="flex justify-between items-end bg-gray-50/30 p-4 rounded-3xl border border-gray-50">
                          <div className="flex flex-col">
                             <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Presupuestado</p>
                             <p className="text-xl font-medium text-gray-900">
                                {formatCurrency(item.amount, item.itemCurrencyCode)}
                             </p>
                             {!item.isPaid && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); updateObligationAmount(item); }}
                                  className="text-[10px] text-indigo-500 hover:text-indigo-700 font-medium underline mt-1 text-left"
                                >
                                  Editar monto para este mes
                                </button>
                             )}
                          </div>
                          
                          <div className="text-right">
                             {item.isPaid ? (
                               <>
                                 <p className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter mb-1">Pagado Real</p>
                                 <p className="text-2xl font-medium text-emerald-600">
                                   {formatCurrency(item.paidAmount, item.itemCurrencyCode)}
                                 </p>
                               </>
                             ) : (
                               <>
                                 <p className="text-[10px] font-black text-amber-500 uppercase tracking-tighter mb-1">Pendiente</p>
                                 <p className="text-2xl font-medium text-gray-300 italic">
                                    --
                                 </p>
                               </>
                             )}
                          </div>
                       </div>

                       {!item.isPaid ? (
                         <button
                           onClick={() => payRecurring(item)}
                           className="w-full flex items-center justify-center gap-3 py-4 bg-gray-900 text-white rounded-[1.5rem] hover:bg-indigo-600 transition-all shadow-xl shadow-gray-200 active:scale-95 font-black text-xs uppercase tracking-[0.2em]"
                         >
                           <span>REGISTRAR PAGO</span>
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                         </button>
                       ) : (
                         <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 font-black text-[10px] uppercase tracking-[0.2em]">
                           <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                           <span>OBLIGACIÓN CUBIERTA</span>
                         </div>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'cards' && !isCard && (
             <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-semibold">Tarjetas asociadas</h3>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {linkedCards.map((card: any) => {
                   const cardTx = (allMonthlyTransactions as any[]).filter((t: any) => t.card_id === card.id);
                   const grossSpent = cardTx.reduce((sum: number, tx: any) => {
                     const cat = (categories as any[]).find((c: any) => c.id === tx.category_id);
                     if (cat?.type === 'EXPENSE') return sum + tx.amount;
                     return sum;
                   }, 0);
                   const netSpent = cardTx.reduce((sum: number, tx: any) => {
                     const cat = (categories as any[]).find((c: any) => c.id === tx.category_id);
                     if (cat?.type === 'INCOME') return sum - tx.amount;
                     if (cat?.type === 'EXPENSE') return sum + tx.amount;
                     if (cat?.type === 'TRANSFER' && tx.card_id) return sum - tx.amount;
                     return sum;
                   }, 0);
                   
                   const pendingDebt = Math.max(0, netSpent);
                   const currentCardBudget = cardBudgets.find((b: any) => b.card_id === card.id);
                   const monthlyBudget = currentCardBudget ? currentCardBudget.amount : 0;
                   const budgetPercent = monthlyBudget > 0 ? (grossSpent / monthlyBudget) * 100 : 0;
                   const isOverBudget = monthlyBudget > 0 && grossSpent > monthlyBudget;

                   return (
                     <div key={card.id} className={`bg-white p-6 rounded-3xl shadow-sm border transition-all ${isOverBudget ? 'border-rose-200 shadow-rose-50/50' : 'border-gray-100 hover:shadow-md'}`}>
                        <div className="flex justify-between items-start mb-5">
                          <div>
                            <p className="text-xl text-gray-800 leading-tight mb-1">{card.name}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-black uppercase tracking-widest border border-indigo-100">
                              {card.type === 'CREDIT' ? 'Crédito' : 'Débito'}
                            </span>
                          </div>
                          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-inner">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                          </div>
                        </div>
                        
                        <div className="space-y-5">
                          {monthlyBudget > 0 ? (
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 mt-2">
                              <div className="flex justify-between items-end mb-2">
                                <div>
                                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Consumo del mes</p>
                                  <p className="text-lg font-medium text-gray-800">{formatCurrency(grossSpent, card.currency)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Reserva</p>
                                  <div className="flex items-center gap-1">
                                    <p className="text-sm font-medium text-gray-600">{formatCurrency(monthlyBudget, card.currency)}</p>
                                    <button onClick={() => deleteCardBudget(currentCardBudget.id)} className="text-gray-300 hover:text-rose-500 transition-colors" title="Eliminar reserva"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                                  </div>
                                </div>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden mb-1.5">
                                <div className={`h-full rounded-full transition-all duration-500 ${isOverBudget ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, budgetPercent)}%` }}></div>
                              </div>
                              {isOverBudget && (
                                <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                  Excedido por {formatCurrency(grossSpent - monthlyBudget, card.currency)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 mt-2 shadow-inner">
                              <p className="text-[10px] font-black text-amber-600 uppercase tracking-tighter mb-2">Asignar Límite</p>
                              <form onSubmit={(e) => addInlineCardBudget(card.id, e)} className="flex gap-2">
                                <input 
                                  type="number" 
                                  step="0.01" 
                                  placeholder={`Monto reserva`} 
                                  className="w-full rounded-xl bg-white border border-amber-200 p-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all font-semibold" 
                                  value={inlineCardBgt[card.id] || ''} 
                                  onChange={e => setInlineCardBgt({...inlineCardBgt, [card.id]: e.target.value})} 
                                  required 
                                />
                                <button type="submit" disabled={!globalBudget || remainingGlobal <= 0} className="px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                  Guardar
                                </button>
                              </form>
                            </div>
                          )}

                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-1">Deuda Pendiente</p>
                              <p className={`text-3xl font-medium bg-clip-text text-transparent ${pendingDebt > 0 ? 'bg-gradient-to-r from-gray-900 to-gray-600' : 'bg-gray-400'}`}>
                                {formatCurrency(pendingDebt, card.currency)}
                              </p>
                            </div>
                            {card.type === 'CREDIT' && card.credit_limit && (
                              <div className="text-right">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Disp. Crédito</p>
                                <p className="text-sm font-medium text-gray-600">{formatCurrency(card.credit_limit - netSpent, card.currency)}</p>
                              </div>
                            )}
                          </div>
                          
                          <button
                            onClick={() => payCard(card, pendingDebt)}
                            disabled={pendingDebt <= 0}
                            className={`w-full py-3 mt-2 text-white rounded-xl font-medium transition-all shadow-sm ${pendingDebt > 0 ? "bg-gray-900 hover:bg-gray-800 active:scale-95 hover:-translate-y-0.5" : "bg-gray-400 opacity-60 cursor-not-allowed"}`}
                          >
                            Realizar Abono
                          </button>
                        </div>
                     </div>
                   );
                 })}
               </div>
             </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {/* Global Budget Card */}
          <div className={`p-6 rounded-2xl shadow-md text-white transition-all ${isOverBudgeted ? 'bg-gradient-to-br from-rose-500 to-orange-600 ring-4 ring-rose-200' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
            {isOverBudgeted && (() => {
              const cardOverflow = monthlyReserved > globalBudget.total_amount;
              return (
                <div className="mb-4 p-3 bg-white/20 rounded-xl border border-white/30 text-xs font-bold space-y-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span>Presupuesto insuficiente · Faltan {formatCurrency(budgetDiff, selectedAcc?.currency)}</span>
                  </div>
                  <p className="opacity-80 font-normal pl-6">
                    {cardOverflow
                      ? `La reserva de tarjeta (${formatCurrency(monthlyReserved, selectedAcc?.currency)}) supera tu presupuesto global. Aumenta el presupuesto o reduce la reserva.`
                      : `Las categorías asignadas superan tu presupuesto global. Reduce límites o aumenta el presupuesto.`
                    }
                  </p>
                </div>
              );
            })()}
            {isCard ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex justify-between">
                  <span>Estado de Tarjeta</span>
                  <span className="text-xs uppercase bg-white/20 px-2 py-1 rounded-full">{selectedCard?.type === 'CREDIT' ? 'Crédito' : 'Débito'}</span>
                </h3>
                <div className="text-4xl font-bold bg-clip-text">
                  {formatCurrency(totalSpent, selectedCard?.currency)}
                </div>
                {selectedCard?.type === 'CREDIT' && selectedCard?.credit_limit && (
                  <>
                    <div className="w-full bg-white/20 rounded-full h-2 mt-4">
                      <div className={`h-2 rounded-full transition-all duration-500 ${(totalSpent / selectedCard.credit_limit) > 0.9 ? 'bg-rose-300' : 'bg-white'}`} style={{ width: `${Math.min(100, (totalSpent / selectedCard.credit_limit) * 100)}%` }}></div>
                    </div>
                    <div className="flex justify-between pt-4 border-t border-white/20 mt-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-black opacity-70 tracking-wider">Límite</span>
                        <span className="text-sm font-bold">{formatCurrency(selectedCard.credit_limit, selectedCard.currency)}</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] uppercase font-black opacity-70 tracking-wider">Disponible</span>
                        <span className="text-sm font-bold">{formatCurrency(selectedCard.credit_limit - totalSpent, selectedCard.currency)}</span>
                      </div>
                    </div>
                  </>
                )}
                <p className="text-[10px] opacity-70 mt-2 italic">Refleja consumo acumulado en el periodo seleccionado.</p>
              </div>
            ) : (
              <>
                {globalBudget ? (
                  <>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-medium opacity-90">Presupuesto mensual</h3>
                      <button onClick={toggleEditGlobal} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                    </div>
                    {isEditingGlobal ? (
                      <form onSubmit={updateGlobalBudget} className="space-y-3 mt-2">
                        <input type="number" step="0.01" className="w-full rounded-xl bg-white text-gray-900 p-2 outline-none" value={editGlobalAmt} onChange={e => setEditGlobalAmt(e.target.value)} required autoFocus />
                        <div className="flex gap-2">
                          <button type="submit" className="flex-1 bg-white text-indigo-600 rounded-xl py-2 flex justify-center items-center hover:bg-indigo-50 transition-all shadow-sm" title="Guardar">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                          </button>
                          <button type="button" onClick={() => setIsEditingGlobal(false)} className="px-4 py-2 bg-white/10 border border-white/30 rounded-xl text-white hover:bg-white/20 transition-all flex justify-center items-center" title="Cancelar">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="text-4xl font-bold mb-6 tracking-tight">
                          {formatCurrency(globalBudget.total_amount, selectedAcc?.currency || 'PEN')}
                        </div>

                        <div className="space-y-4 pt-4 border-t border-white/20">
                          <div className="flex justify-between items-baseline">
                            <span className="text-sm font-medium opacity-80 uppercase tracking-tight">Gasto Total</span>
                            <span className="text-xl font-black text-white">{formatCurrency(totalSpentGlobal, selectedAcc?.currency)}</span>
                          </div>

                          <div className="flex justify-between items-baseline pt-2 border-t border-white/10">
                            <span className="text-sm font-medium opacity-80 uppercase tracking-tight">Disponible</span>
                            <span className={`text-xl font-black ${remainingGlobal < 0 ? 'text-rose-200' : 'text-white'}`}>
                              {formatCurrency(remainingGlobal, selectedAcc?.currency)}
                            </span>
                          </div>
                        </div>

                        {cardExcess > 0 && (
                          <div className="mt-3 text-[10px] text-rose-200 font-bold italic flex items-center gap-1 bg-white/5 p-2 rounded-lg border border-white/10">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            Sobre-consumo en tarjetas: {formatCurrency(cardExcess, selectedAcc?.currency)}
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <form onSubmit={addGlobalBudget} className="space-y-4">
                    <h3 className="text-lg font-semibold mb-2">Definir Presupuesto Global</h3>
                    <p className="text-sm opacity-90 mb-4">Establece un límite total para este mes antes de asignar límites por categoría.</p>
                    <input type="number" step="0.01" className="w-full rounded-xl bg-white/20 text-white placeholder-white/70 border border-white/30 p-3 outline-none" placeholder={`Monto Total`} value={newGlobalAmt} onChange={e => setNewGlobalAmt(e.target.value)} required />
                    <button type="submit" className="w-full bg-white text-indigo-600 font-semibold py-3 rounded-xl hover:bg-indigo-50 transition-colors">
                      Guardar Global
                    </button>
                  </form>
                )}
              </>
            )}
          </div>

          {/* Arquitectura del Plan Card */}
          {globalBudget && (
            <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800">Planificación Global</h3>
              </div>

              <div className="space-y-5">
                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg group-hover:scale-110 transition-transform">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Servicios y Pagos</p>
                      <p className="font-bold text-gray-700">{formatCurrency(totalServicesPlan, selectedAcc?.currency || selectedCard?.currency)}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                    {Math.round((totalServicesPlan / globalBudget.total_amount) * 100)}%
                  </span>
                </div>

                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:scale-110 transition-transform">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Reservas Tarjeta</p>
                      <p className="font-bold text-gray-700">{formatCurrency(totalCardsPlan, selectedAcc?.currency || selectedCard?.currency)}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                    {Math.round((totalCardsPlan / globalBudget.total_amount) * 100)}%
                  </span>
                </div>

                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Límites en categorías</p>
                      <p className="font-bold text-gray-700">{formatCurrency(totalVariableLimitsPlan, selectedAcc?.currency || selectedCard?.currency)}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                    {Math.round((totalVariableLimitsPlan / globalBudget.total_amount) * 100)}%
                  </span>
                </div>

                <div className={`mt-6 p-4 rounded-xl border transition-all ${isOverPlannedArchitecture ? 'bg-rose-50 border-rose-100' : 'bg-indigo-50 border-indigo-100'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Saldo Libre del Plan</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOverPlannedArchitecture ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                      {Math.round((theoreticalFreeBalance / globalBudget.total_amount) * 100)}%
                    </span>
                  </div>
                  <p className={`text-2xl font-black ${isOverPlannedArchitecture ? 'text-rose-600' : 'text-indigo-600'}`}>
                    {formatCurrency(theoreticalFreeBalance, selectedAcc?.currency || selectedCard?.currency)}
                  </p>
                  <p className="text-[9px] text-gray-400 mt-1 italic leading-tight">
                    *Monto total disponible tras cubrir todos tus límites y obligaciones proyectadas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isCard && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex-1">
              <h3 className="text-lg font-semibold mb-4">Asignar limites por categoría</h3>
              <form onSubmit={addBudget} className="space-y-4">
                <select className="w-full rounded-xl border border-gray-200 p-3 shadow-sm" value={newBgtCatId} onChange={e => setNewBgtCatId(e.target.value)} required>
                  <option value="" disabled>Seleccionar Categoría</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="number" step="0.01" className="w-full rounded-xl border border-gray-200 p-3 shadow-sm" placeholder={`Monto en ${selectedAcc?.currency || ''}`} value={newBgtAmt} onChange={e => setNewBgtAmt(e.target.value)} required />
                <button
                  type="submit"
                  disabled={!globalBudget || remainingGlobal <= 0}
                  className="w-full bg-indigo-600 text-white font-medium py-3 rounded-xl hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!globalBudget ? 'Define Presupuesto Global Primero' : (remainingGlobal <= 0 ? 'Presupuesto Agotado' : 'Asignar Límite')}
                </button>
              </form>

              {!isCard && (budgets.length === 0 || budgetObligations.length === 0 || !globalBudget) && (
                <button
                  onClick={initializeBudget}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-emerald-200 text-emerald-600 font-bold hover:bg-emerald-50 hover:border-emerald-300 transition-all text-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Inicializar Mes
                </button>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Category Details Modal */}
      {selectedCatDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-white/20">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-xl font-black text-gray-800 tracking-tight">{selectedCatDetail.name}</h3>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-0.5">Desglose de movimientos</p>
              </div>
              <button 
                onClick={() => setSelectedCatDetail(null)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-300 hover:text-gray-600 active:scale-90"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto custom-scrollbar">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="text-left pb-4">Fecha</th>
                    <th className="text-left pb-4">Descripción</th>
                    <th className="text-left pb-4">Origen</th>
                    <th className="text-right pb-4">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {scopedTransactions
                    .filter((t: any) => t.category_id === selectedCatDetail.id)
                    .map((t: any) => (
                      <tr key={t.id} className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="py-4 text-gray-400 font-medium">{new Date(t.date).toLocaleDateString()}</td>
                        <td className="py-4 font-bold text-gray-800">{t.description}</td>
                        <td className="py-4 text-gray-400">
                          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200">
                            {t.account?.name || t.card?.name}
                          </span>
                        </td>
                        <td className="py-4 text-right font-black text-gray-900 text-base">
                          {formatCurrency(t.amount, t.account?.currency || t.card?.currency)}
                        </td>
                      </tr>
                    ))}
                  {scopedTransactions.filter((t: any) => t.category_id === selectedCatDetail.id).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-gray-400 font-medium bg-gray-50/50 rounded-2xl">
                        No se encontraron movimientos registrados en esta categoría para el periodo seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total acumulado</p>
                    <p className="text-sm font-bold text-gray-500">{selectedCatDetail.name}</p>
                 </div>
                 <span className="text-2xl font-black text-gray-900">
                    {formatCurrency(
                        scopedTransactions
                            .filter((t: any) => t.category_id === selectedCatDetail.id)
                            .reduce((sum: number, t: any) => sum + t.amount, 0),
                        selectedAcc?.currency || selectedCard?.currency
                    )}
                 </span>
            </div>
          </div>
        </div>
      )}

      {/* Obligation Details Modal */}
      {selectedObligationDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-white/20">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-2xl font-black text-gray-800 tracking-tight">{selectedObligationDetail.name}</h3>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Detalle de obligación mensual</p>
              </div>
              <button 
                onClick={() => setSelectedObligationDetail(null)}
                className="p-3 hover:bg-gray-200 rounded-2xl transition-all font-bold text-gray-500 bg-gray-100 active:scale-90"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Monto Estimado</p>
                  <p className="text-xl font-black text-indigo-600">{formatCurrency(selectedObligationDetail.amount, selectedObligationDetail.itemCurrencyCode)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Día de pago</p>
                  <p className="text-xl font-black text-gray-800">Día {selectedObligationDetail.due_day}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Categoría</p>
                  <p className="text-sm font-bold text-gray-700">{selectedObligationDetail.category?.name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Medio de Pago</p>
                  <p className="text-sm font-bold text-gray-700">
                    {selectedObligationDetail.account?.name || selectedObligationDetail.card?.name || 'No definido'}
                  </p>
                </div>
              </div>

              {selectedObligationDetail.notes && (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100/50">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Observaciones / Notas</p>
                  <p className="text-sm text-amber-900/80 font-medium italic leading-relaxed">
                    {selectedObligationDetail.notes}
                  </p>
                </div>
              )}
              
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <div className={`p-2 rounded-lg ${selectedObligationDetail.isPaid ? 'bg-emerald-500' : 'bg-rose-500'} text-white`}>
                  {selectedObligationDetail.isPaid ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                  )}
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-500">
                  Estado: <span className={selectedObligationDetail.isPaid ? 'text-emerald-600' : 'text-rose-600'}>
                    {selectedObligationDetail.isPaid ? 'Pagado este mes' : 'Pendiente de pago'}
                  </span>
                </p>
              </div>
            </div>

            <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setSelectedObligationDetail(null)}
                className="px-8 py-3 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-all active:scale-95 shadow-lg shadow-gray-200"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
