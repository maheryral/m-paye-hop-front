// src/contexts/WalletContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { accountService } from '../services/api';

interface WalletContextType {
  balance: number;
  loading: boolean;
  error: string | null;
  fetchBalance: () => Promise<void>;
  credit: (amount: number, description?: string) => Promise<void>;
  debit: (amount: number, description?: string) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      
      setLoading(true);
      setError(null);
      const response = await accountService.getBalance();
      setBalance(response.balance || 0.0);
    } catch (err: any) {
      setError(err.message || 'Erreur chargement solde');
    } finally {
      setLoading(false);
    }
  }, []);

  const credit = async (amount: number, description?: string) => {
    try {
      await accountService.deposit({ amount, description });
      setBalance(prev => prev + amount);
    } catch (error) {
      console.error('Erreur crédit:', error);
      throw error;
    }
  };

  const debit = async (amount: number, description?: string) => {
    try {
      await accountService.withdraw({ amount, description });
      setBalance(prev => prev - amount);
    } catch (error) {
      console.error('Erreur débit:', error);
      throw error;
    }
  };

  return (
    <WalletContext.Provider
      value={{
        balance,
        loading,
        error,
        fetchBalance,
        credit,
        debit,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};