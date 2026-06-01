// src/contexts/MerchantContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AxiosResponse } from 'axios';
import { merchantApi } from '../services/merchantApi';
import { secureStorage } from '../services/secureStorage';

// ============ TYPES ============

export interface MerchantProfile {
  id: string;
  businessName: string;
  businessType: string;
  registrationNumber: string;
  isActive: boolean;
  balance: number;
  storeCount: number;
  verifiedAt?: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  taxId?: string;
  bankName?: string;
  accountNumber?: string;
  qrCode?: string;
}

export interface MerchantStats {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalTransactions: number;
  pendingRefunds: number;
  activeCustomers: number;
  averageTransactionValue: number;
}

export interface MerchantTransaction {
  id: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed' | 'refunded' | 'cancelled';
  customerName?: string;
  customerPhone?: string;
  createdAt: string;
  paymentMethod: string;
  transactionId: string;
  storeId?: string;
  storeName?: string;
}

export interface MerchantStore {
  id: string;
  name: string;
  address: string;
  phone: string;
  qrCode?: string;
  isActive: boolean;
  createdAt: string;
}

export interface MerchantCoupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchase?: number;
  validFrom: string;
  validUntil: string;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
  description?: string;
}

export interface MerchantRefund {
  id: string;
  transactionId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'completed' | 'rejected';
  createdAt: string;
  processedAt?: string;
}

export interface MerchantNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
  data?: any;
}

// ============ CONTEXT TYPE ============

interface MerchantContextType {
  // État
  profile: MerchantProfile | null;
  stats: MerchantStats | null;
  transactions: MerchantTransaction[];
  stores: MerchantStore[];
  coupons: MerchantCoupon[];
  refunds: MerchantRefund[];
  notifications: MerchantNotification[];
  loading: boolean;
  refreshing: boolean;
  hasMerchantAccount: boolean;
  upgradeStatus: 'none' | 'pending' | 'approved' | 'rejected';
  
  // Actions
  loadMerchantData: () => Promise<void>;
  refreshData: () => Promise<void>;
  checkStatus: () => Promise<void>;
  requestUpgrade: (data: FormData) => Promise<AxiosResponse<any>>;
  updateProfile: (data: Partial<MerchantProfile>) => Promise<void>;
  
  // Transactions
  fetchTransactions: (page?: number, limit?: number, filters?: any) => Promise<any>;
  getTransactionDetails: (id: string) => Promise<MerchantTransaction | null>;
  
  // Paiements
  scanPayment: (qrData: string, amount: number, storeId?: string) => Promise<any>;
  generateQRCode: (amount?: number, storeId?: string) => Promise<string | null>;
  getStaticQRCode: () => Promise<string | null>;
  
  // Remboursements
  createRefund: (transactionId: string, amount: number, reason: string) => Promise<void>;
  
  // Boutiques
  getStores: () => Promise<MerchantStore[]>;
  createStore: (data: { name: string; address: string; phone: string }) => Promise<MerchantStore>;
  updateStore: (id: string, data: Partial<MerchantStore>) => Promise<void>;
  deleteStore: (id: string) => Promise<void>;
  
  // Coupons
  getCoupons: () => Promise<MerchantCoupon[]>;
  createCoupon: (data: any) => Promise<MerchantCoupon>;
  updateCoupon: (id: string, data: any) => Promise<void>;
  deleteCoupon: (id: string) => Promise<void>;
  toggleCoupon: (id: string, isActive: boolean) => Promise<void>;
  
  // Finances
  getBalance: () => Promise<{ balance: number; pendingBalance: number; totalReceived: number }>;
  withdraw: (amount: number, bankAccountId: string) => Promise<void>;
  
  // Notifications
  fetchNotifications: () => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  
  // Utilitaires
  clearMerchantData: () => void;
  setMerchantMode: (enabled: boolean) => Promise<void>;
  isMerchantMode: boolean;
}

// ============ CONTEXT ============

const MerchantContext = createContext<MerchantContextType | undefined>(undefined);

export const useMerchant = () => {
  const context = useContext(MerchantContext);
  if (!context) {
    throw new Error('useMerchant must be used within a MerchantProvider');
  }
  return context;
};

interface MerchantProviderProps {
  children: React.ReactNode;
}

// ============ PROVIDER ============

export const MerchantProvider: React.FC<MerchantProviderProps> = ({ children }) => {
  // États
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [transactions, setTransactions] = useState<MerchantTransaction[]>([]);
  const [stores, setStores] = useState<MerchantStore[]>([]);
  const [coupons, setCoupons] = useState<MerchantCoupon[]>([]);
  const [refunds, setRefunds] = useState<MerchantRefund[]>([]);
  const [notifications, setNotifications] = useState<MerchantNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [upgradeStatus, setUpgradeStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [isMerchantMode, setIsMerchantMode] = useState(false);

  // Vérifier le statut marchand
  const checkStatus = useCallback(async () => {
    const token = await secureStorage.getItem('accessToken');
    if (!token) {
      setProfile(null);
      setUpgradeStatus('none');
      return;
    }

    try {
      const response = await merchantApi.getStatus();
      if (response.data.hasMerchant && response.data.merchant) {
        setProfile(response.data.merchant);
        setUpgradeStatus(response.data.merchant.isActive ? 'approved' : 'pending');
      } else {
        setProfile(null);
        setUpgradeStatus('none');
      }
    } catch (error) {
      console.error('Error checking merchant status:', error);
      setProfile(null);
      setUpgradeStatus('none');
    }
  }, []);

  // Charger toutes les données marchand
  const loadMerchantData = useCallback(async () => {
    if (!profile?.isActive) return;

    setLoading(true);
    try {
      const [statsRes, transactionsRes, storesRes, couponsRes, refundsRes, balanceRes] = await Promise.all([
        merchantApi.getDashboardStats(),
        merchantApi.getTransactions(1, 20),
        merchantApi.getStores(),
        merchantApi.getCoupons(),
        merchantApi.getRefunds(),
        merchantApi.getBalance(),
      ]);

      setStats(statsRes.data);
      setTransactions(transactionsRes.data.transactions);
      setStores(storesRes.data);
      setCoupons(couponsRes.data);
      setRefunds(refundsRes.data.refunds);
      
      // Mettre à jour le profil avec le solde
      if (profile) {
        setProfile({
          ...profile,
          balance: balanceRes.data.balance,
        });
      }
    } catch (error) {
      console.error('Error loading merchant data:', error);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  // Rafraîchir les données
  const refreshData = useCallback(async () => {
    setRefreshing(true);
    await checkStatus();
    await loadMerchantData();
    setRefreshing(false);
  }, [checkStatus, loadMerchantData]);

  // Demander l'upgrade
  const requestUpgrade = useCallback(async (data: FormData): Promise<AxiosResponse<any>> => {
    try {
      const response = await merchantApi.upgradeRequest(data);
      setUpgradeStatus('pending');
      await checkStatus();
      return response;
    } catch (error) {
      console.error('Error requesting upgrade:', error);
      throw error;
    }
  }, [checkStatus]);

  // Mettre à jour le profil
  const updateProfile = useCallback(async (data: Partial<MerchantProfile>) => {
    try {
      const response = await merchantApi.updateProfile(data);
      setProfile(prev => prev ? { ...prev, ...response.data } : null);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }, []);

  // Transactions
  const fetchTransactions = useCallback(async (page = 1, limit = 20, filters?: any) => {
    try {
      const response = await merchantApi.getTransactions(page, limit, filters);
      if (page === 1) {
        setTransactions(response.data.transactions);
      } else {
        setTransactions(prev => [...prev, ...response.data.transactions]);
      }
      return response.data;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }, []);

  const getTransactionDetails = useCallback(async (id: string) => {
    try {
      const response = await merchantApi.getTransactionDetails(id);
      return response.data;
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      return null;
    }
  }, []);

  // Paiements
  const scanPayment = useCallback(async (qrData: string, amount: number, storeId?: string) => {
    try {
      const response = await merchantApi.scanPayment(qrData, amount, storeId);
      await refreshData();
      return response.data;
    } catch (error) {
      console.error('Error scanning payment:', error);
      throw error;
    }
  }, [refreshData]);

  const generateQRCode = useCallback(async (amount?: number, storeId?: string) => {
    try {
      const response = await merchantApi.generateQRCode(amount, storeId);
      return response.data.qrCodeData;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return null;
    }
  }, []);

  const getStaticQRCode = useCallback(async () => {
    try {
      const response = await merchantApi.getStaticQRCode();
      return response.data.qrCodeData;
    } catch (error) {
      console.error('Error getting static QR code:', error);
      return null;
    }
  }, []);

  // Remboursements
  const createRefund = useCallback(async (transactionId: string, amount: number, reason: string) => {
    try {
      await merchantApi.createRefund(transactionId, amount, reason);
      await refreshData();
    } catch (error) {
      console.error('Error creating refund:', error);
      throw error;
    }
  }, [refreshData]);

  // Boutiques
  const getStores = useCallback(async () => {
    try {
      const response = await merchantApi.getStores();
      setStores(response.data);
      return response.data;
    } catch (error) {
      console.error('Error getting stores:', error);
      return [];
    }
  }, []);

  const createStore = useCallback(async (data: { name: string; address: string; phone: string }) => {
    try {
      const response = await merchantApi.createStore(data);
      setStores(prev => [...prev, response.data]);
      return response.data;
    } catch (error) {
      console.error('Error creating store:', error);
      throw error;
    }
  }, []);

  const updateStore = useCallback(async (id: string, data: Partial<MerchantStore>) => {
    try {
      await merchantApi.updateStore(id, data);
      setStores(prev => prev.map(store => store.id === id ? { ...store, ...data } : store));
    } catch (error) {
      console.error('Error updating store:', error);
      throw error;
    }
  }, []);

  const deleteStore = useCallback(async (id: string) => {
    try {
      await merchantApi.deleteStore(id);
      setStores(prev => prev.filter(store => store.id !== id));
    } catch (error) {
      console.error('Error deleting store:', error);
      throw error;
    }
  }, []);

  // Coupons
  const getCoupons = useCallback(async () => {
    try {
      const response = await merchantApi.getCoupons();
      setCoupons(response.data);
      return response.data;
    } catch (error) {
      console.error('Error getting coupons:', error);
      return [];
    }
  }, []);

  const createCoupon = useCallback(async (data: any) => {
    try {
      const response = await merchantApi.createCoupon(data);
      setCoupons(prev => [...prev, response.data]);
      return response.data;
    } catch (error) {
      console.error('Error creating coupon:', error);
      throw error;
    }
  }, []);

  const updateCoupon = useCallback(async (id: string, data: any) => {
    try {
      await merchantApi.updateCoupon(id, data);
      setCoupons(prev => prev.map(coupon => coupon.id === id ? { ...coupon, ...data } : coupon));
    } catch (error) {
      console.error('Error updating coupon:', error);
      throw error;
    }
  }, []);

  const deleteCoupon = useCallback(async (id: string) => {
    try {
      await merchantApi.deleteCoupon(id);
      setCoupons(prev => prev.filter(coupon => coupon.id !== id));
    } catch (error) {
      console.error('Error deleting coupon:', error);
      throw error;
    }
  }, []);

  const toggleCoupon = useCallback(async (id: string, isActive: boolean) => {
    try {
      await merchantApi.toggleCoupon(id, isActive);
      setCoupons(prev => prev.map(coupon => coupon.id === id ? { ...coupon, isActive } : coupon));
    } catch (error) {
      console.error('Error toggling coupon:', error);
      throw error;
    }
  }, []);

  // Finances
  const getBalance = useCallback(async () => {
    try {
      const response = await merchantApi.getBalance();
      if (profile) {
        setProfile({ ...profile, balance: response.data.balance });
      }
      return response.data;
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    }
  }, [profile]);

  const withdraw = useCallback(async (amount: number, bankAccountId: string) => {
    try {
      await merchantApi.withdraw(amount, { bankAccountId });
      await getBalance();
    } catch (error) {
      console.error('Error withdrawing:', error);
      throw error;
    }
  }, [getBalance]);

  // Notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await merchantApi.getNotifications();
      setNotifications(response.data.notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    try {
      await merchantApi.markNotificationAsRead(notificationId);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      await merchantApi.markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, []);

  // Utilitaires
  const clearMerchantData = useCallback(() => {
    setProfile(null);
    setStats(null);
    setTransactions([]);
    setStores([]);
    setCoupons([]);
    setRefunds([]);
    setNotifications([]);
    setUpgradeStatus('none');
    setIsMerchantMode(false);
  }, []);

  const setMerchantMode = useCallback(async (enabled: boolean) => {
    setIsMerchantMode(enabled);
    await AsyncStorage.setItem('@merchant_mode', enabled ? 'true' : 'false');
    if (enabled && profile?.isActive) {
      await loadMerchantData();
    }
  }, [profile, loadMerchantData]);

  // Initialisation
  useEffect(() => {
    const init = async () => {
      await checkStatus();
      const savedMode = await AsyncStorage.getItem('@merchant_mode');
      setIsMerchantMode(savedMode === 'true');
      if (savedMode === 'true' && profile?.isActive) {
        await loadMerchantData();
      }
      setLoading(false);
    };
    init();
  }, [checkStatus, loadMerchantData, profile?.isActive]);

  const hasMerchantAccount = profile?.isActive === true;

  const value: MerchantContextType = {
    // État
    profile,
    stats,
    transactions,
    stores,
    coupons,
    refunds,
    notifications,
    loading,
    refreshing,
    hasMerchantAccount,
    upgradeStatus,
    
    // Actions
    loadMerchantData,
    refreshData,
    checkStatus,
    requestUpgrade,
    updateProfile,
    
    // Transactions
    fetchTransactions,
    getTransactionDetails,
    
    // Paiements
    scanPayment,
    generateQRCode,
    getStaticQRCode,
    
    // Remboursements
    createRefund,
    
    // Boutiques
    getStores,
    createStore,
    updateStore,
    deleteStore,
    
    // Coupons
    getCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    toggleCoupon,
    
    // Finances
    getBalance,
    withdraw,
    
    // Notifications
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    
    // Utilitaires
    clearMerchantData,
    setMerchantMode,
    isMerchantMode,
  };

  return (
    <MerchantContext.Provider value={value}>
      {children}
    </MerchantContext.Provider>
  );
};