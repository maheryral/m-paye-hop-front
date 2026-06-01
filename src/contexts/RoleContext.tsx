// src/contexts/RoleContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AxiosResponse } from 'axios';
import { merchantApi, MerchantRole } from '../services/merchantApi';
import { useAuth } from './AuthContext';
import { roleHasCapability, MerchantCapability } from '../utils/merchantCaps';

export type Role = 'user' | 'merchant';

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
  iban?: string;
  bic?: string;
  website?: string;
  city?: string;
  logo?: string;
  coverImage?: string;
}

interface MerchantStatusResponse {
  hasMerchant: boolean;
  merchant?: MerchantProfile;
  role?: MerchantRole | null;
  isActive?: boolean;
  status?: string;
  upgradeRequested?: boolean;
}

interface RoleContextType {
  currentRole: Role;
  merchantProfile: MerchantProfile | null;
  merchantRole: MerchantRole | null;
  hasMerchantCapability: (cap: MerchantCapability) => boolean;
  hasMerchantAccess: boolean;
  switchRole: (role: Role) => Promise<void>;
  isMerchant: boolean;
  isUser: boolean;
  loading: boolean;
  refreshMerchantProfile: () => Promise<void>;
  requestUpgrade: (data: FormData) => Promise<AxiosResponse<any>>;
  canSwitchToMerchant: boolean;
  upgradeStatus: 'none' | 'pending' | 'approved' | 'rejected';
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};

interface RoleProviderProps {
  children: React.ReactNode;
}

export const RoleProvider: React.FC<RoleProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [currentRole, setCurrentRole] = useState<Role>('user');
  const [merchantProfile, setMerchantProfile] = useState<MerchantProfile | null>(null);
  const [merchantRole, setMerchantRole] = useState<MerchantRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeStatus, setUpgradeStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');

  const loadStoredRole = useCallback(async () => {
    try {
      const savedRole = await AsyncStorage.getItem('@current_role');
      if (savedRole === 'user' || savedRole === 'merchant') {
        setCurrentRole(savedRole);
      }
    } catch (error) {
      // Silently fail
    }
  }, []);

  const checkMerchantStatus = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setMerchantProfile(null);
      setMerchantRole(null);
      setUpgradeStatus('none');
      return;
    }

    try {
      const response = await merchantApi.getStatus();
      const statusData = response.data as MerchantStatusResponse;

      if (statusData?.hasMerchant && statusData?.merchant) {
        const merchant = statusData.merchant;
        setMerchantRole(statusData.role ?? 'OWNER');
        setMerchantProfile({
          id: merchant.id || '',
          businessName: merchant.businessName || '',
          businessType: merchant.businessType || '',
          registrationNumber: merchant.registrationNumber || '',
          isActive: merchant.isActive || false,
          balance: merchant.balance || 0,
          storeCount: merchant.storeCount || 0,
          verifiedAt: merchant.verifiedAt,
          address: merchant.address,
          phone: merchant.phone,
          email: merchant.email,
          description: merchant.description,
          taxId: (merchant as any).taxId,
          bankName: (merchant as any).bankName,
          accountNumber: (merchant as any).accountNumber,
          iban: (merchant as any).iban,
          bic: (merchant as any).bic,
          website: (merchant as any).website,
          city: (merchant as any).city,
          logo: (merchant as any).logo,
          coverImage: (merchant as any).coverImage,
        });
        
        if (merchant.isActive) {
          setUpgradeStatus('approved');
        } else if (statusData.upgradeRequested) {
          setUpgradeStatus('pending');
        } else {
          setUpgradeStatus('none');
        }
      } else {
        setMerchantProfile(null);
        setMerchantRole(null);
        setUpgradeStatus('none');
      }
    } catch (error) {
      setMerchantProfile(null);
      setMerchantRole(null);
      setUpgradeStatus('none');
    }
  }, [isAuthenticated, user]);

  const refreshMerchantProfile = useCallback(async () => {
    setLoading(true);
    await checkMerchantStatus();
    setLoading(false);
  }, [checkMerchantStatus]);

  const requestUpgrade = useCallback(async (data: FormData): Promise<AxiosResponse<any>> => {
    const response = await merchantApi.upgradeRequest(data);
    setUpgradeStatus('pending');
    await checkMerchantStatus();
    return response;
  }, [checkMerchantStatus]);

  const switchRole = useCallback(async (role: Role) => {
    if (role === 'merchant' && !merchantProfile?.isActive) {
      return;
    }
    setCurrentRole(role);
    await AsyncStorage.setItem('@current_role', role);
  }, [merchantProfile]);

  const canSwitchToMerchant = merchantProfile?.isActive === true;
  const hasMerchantAccess = merchantProfile?.isActive === true;

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await loadStoredRole();
      await checkMerchantStatus();
      setLoading(false);
    };
    initialize();
  }, []);

  useEffect(() => {
    if (currentRole === 'merchant' && !canSwitchToMerchant) {
      switchRole('user');
    }
  }, [canSwitchToMerchant, currentRole, switchRole]);

  const hasMerchantCapability = useCallback(
    (cap: MerchantCapability) => roleHasCapability(merchantRole, cap),
    [merchantRole],
  );

  const value: RoleContextType = {
    currentRole,
    merchantProfile,
    merchantRole,
    hasMerchantCapability,
    hasMerchantAccess,
    switchRole,
    isMerchant: currentRole === 'merchant' && canSwitchToMerchant,
    isUser: currentRole === 'user',
    loading,
    refreshMerchantProfile,
    requestUpgrade,
    canSwitchToMerchant,
    upgradeStatus,
  };

  return React.createElement(RoleContext.Provider, { value }, children);
};

export default RoleProvider;