import React, { useState, useEffect } from 'react';

export default function TransactionForm({ fetchTransactions }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetch('http://192.168.0.172:8000/api/accounts').then(res => res.json()).then(setAccounts);
    fetch('http://192.168.0.172:8000/api/categories').then(res => res.json()).then(setCategories);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description || !amount || !accountId || !categoryId) return;

    await fetch('http://192:8000/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        amount: parseFloat(amount),
        account_id: parseInt(accountId),
        category_id: parseInt(categoryId)
      })
    });
    
    setDescription('');
    setAmount('');
    fetchTransactions();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Amount</label>
        <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Account</label>
          <select value={accountId} onChange={e => setAccountId(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
            <option value="">Select...</option>
            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Category</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
            <option value="">Select...</option>
            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
        </div>
      </div>
      <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-xl transition-colors shadow-sm">
        Save Transaction
      </button>
    </form>
  );
}
