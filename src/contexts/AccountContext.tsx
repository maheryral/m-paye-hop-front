// src/contexts/AccountContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Account {
  id: string;
  name: string;
  type: 'personal' | 'merchant';
  color?: string;
  avatar?: string;
  followers?: number;
}

interface AccountContextType {
  currentAccount: Account | null;
  accounts: Account[];
  merchantAccounts: Account[];
  switchAccount: (account: Account) => void;
  loading: boolean;
}

const mockAccounts: Account[] = [
  { id: 'personal-1', name: 'Rabe Doe', type: 'personal', color: '#3b82f6', avatar: 'R' },
  { id: 'merchant-1', name: 'Goliath Pâtisserie', type: 'merchant', color: '#3b82f6', avatar: 'G', followers: 12500 },
  { id: 'merchant-2', name: 'T&S Distribution', type: 'merchant', color: '#f59e0b', avatar: 'T', followers: 3400 },
];

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentAccount();
  }, []);

  const loadCurrentAccount = async () => {
    try {
      const savedId = await AsyncStorage.getItem('currentAccountId');
      const account = mockAccounts.find(a => a.id === savedId) || mockAccounts[0];
      setCurrentAccount(account);
    } catch (error) {
      console.error('Erreur chargement compte:', error);
      setCurrentAccount(mockAccounts[0]);
    } finally {
      setLoading(false);
    }
  };

  const switchAccount = async (account: Account) => {
    setCurrentAccount(account);
    await AsyncStorage.setItem('currentAccountId', account.id);
  };

  const merchantAccounts = mockAccounts.filter(a => a.type === 'merchant');

  return (
    <AccountContext.Provider
      value={{
        currentAccount,
        accounts: mockAccounts,
        merchantAccounts,
        switchAccount,
        loading,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
};