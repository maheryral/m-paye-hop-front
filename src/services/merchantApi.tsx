// src/services/merchantApi.tsx
// Réutilise l'instance Axios partagée (qui a déjà le refresh token + Authorization automatique)
import api from './api';

// ============ TYPES ============

export interface DashboardStats {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalTransactions: number;
  pendingRefunds: number;
  activeCustomers: number;
  averageTransactionValue: number;
}

export interface RevenueChartResponse {
  labels: string[];
  datasets: {
    data: number[];
  };
}

export interface Transaction {
  id: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed' | 'refunded' | 'cancelled';
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  createdAt: string;
  paymentMethod: 'alipay' | 'wechat' | 'card' | 'cash' | 'bank';
  transactionId: string;
  storeId?: string;
  storeName?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

export interface Refund {
  id: string;
  transactionId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'completed' | 'rejected';
  createdAt: string;
  processedAt?: string;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  phone: string;
  qrCode?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Coupon {
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
}

export interface MerchantStatusResponse {
  hasMerchant: boolean;
  merchant: MerchantProfile | null;
}

export interface ScanPaymentResponse {
  success: boolean;
  transactionId: string;
  amount: number;
  customerName?: string;
  timestamp: string;
}

export interface QRCodeResponse {
  qrCode: string;
  qrCodeData: string;
  expiresAt: string;
  amount?: number;
}

// ============ API MARCHAND ============

export const merchantApi = {
  // Statut et profil
  getStatus: () => api.get<MerchantStatusResponse>('/merchant/status'),
  getProfile: () => api.get<MerchantProfile>('/merchant/profile'),
  upgradeRequest: (data: FormData) => api.post('/merchants', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateProfile: (data: Partial<MerchantProfile>) => api.put('/merchant/profile', data),

  // Dashboard
  getDashboardStats: () => api.get<DashboardStats>('/merchant/dashboard/stats'),
  getRevenueChart: (period: 'day' | 'week' | 'month' | 'year' = 'week') => 
    api.get<RevenueChartResponse>('/merchant/revenue/chart', { params: { period } }),
  getSalesByHour: (date?: string) => api.get('/merchant/analytics/sales-by-hour', { params: { date } }),
  getTopProducts: (limit: number = 10) => api.get('/merchant/analytics/top-products', { params: { limit } }),
  getCustomerStats: () => api.get('/merchant/analytics/customers'),
  getFullAnalytics: (period: 'day' | 'week' | 'month' | 'year' = 'week') =>
    api.get('/merchant/analytics', { params: { period } }),

  // Transactions
  getTransactions: (page: number = 1, limit: number = 20, filters?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    storeId?: string;
    search?: string;
  }) => api.get('/merchant/transactions', { params: { page, limit, ...filters } }),
  
  getTransactionDetails: (id: string) => api.get<Transaction>(`/merchant/transactions/${id}`),
  
  exportTransactions: (format: 'csv' | 'excel' | 'pdf', startDate: string, endDate: string) => 
    api.get('/merchant/transactions/export', {
      params: { format, startDate, endDate },
      responseType: 'blob',
    }),

  // Paiements
  scanPayment: (qrData: string, amount: number, storeId?: string) => 
    api.post<ScanPaymentResponse>('/merchant/scan/payment', { qrData, amount, storeId }),
  
  generateQRCode: (amount?: number, storeId?: string) => 
    api.post<QRCodeResponse>('/merchant/qrcode/generate', { amount, storeId }),
  
  getStaticQRCode: (storeId?: string) => 
    api.get<QRCodeResponse>('/merchant/qrcode/static', { params: { storeId } }),
  
  cancelPayment: (transactionId: string) => 
    api.post(`/merchant/payments/${transactionId}/cancel`),

  // Remboursements
  createRefund: (transactionId: string, amount: number, reason: string) => 
    api.post<Refund>('/merchant/refunds', { transactionId, amount, reason }),
  
  getRefunds: (page: number = 1, limit: number = 20) => 
    api.get<{ refunds: Refund[]; total: number }>('/merchant/refunds', { params: { page, limit } }),
  
  getRefundDetails: (id: string) => api.get<Refund>(`/merchant/refunds/${id}`),

  // Boutiques
  getStores: () => api.get<Store[]>('/merchant/stores'),
  createStore: (data: { name: string; address: string; phone: string }) => 
    api.post<Store>('/merchant/stores', data),
  updateStore: (id: string, data: Partial<Store>) => api.put<Store>(`/merchant/stores/${id}`, data),
  deleteStore: (id: string) => api.delete(`/merchant/stores/${id}`),
  generateStoreQRCode: (storeId: string) => api.post<QRCodeResponse>(`/merchant/stores/${storeId}/qrcode`),

  // Coupons
  getCoupons: () => api.get<Coupon[]>('/merchant/coupons'),
  createCoupon: (data: Omit<Coupon, 'id' | 'usedCount' | 'isActive'>) => 
    api.post<Coupon>('/merchant/coupons', data),
  updateCoupon: (id: string, data: Partial<Coupon>) => api.put<Coupon>(`/merchant/coupons/${id}`, data),
  deleteCoupon: (id: string) => api.delete(`/merchant/coupons/${id}`),
  toggleCoupon: (id: string, isActive: boolean) => api.patch(`/merchant/coupons/${id}`, { isActive }),

  // Wallet
  getBalance: () => api.get<{ balance: number; pendingBalance: number; totalReceived: number }>('/merchant/balance'),
  withdraw: (amount: number, bankAccountId: string) => api.post('/merchant/withdraw', { amount, bankAccountId }),
  getWithdrawalHistory: (page: number = 1, limit: number = 20) => 
    api.get('/merchant/withdrawals', { params: { page, limit } }),

  // Rapports
  generateReport: (
    type: 'transactions' | 'refunds' | 'sales' | 'tax',
    startDate: string,
    endDate: string,
    format: 'pdf' | 'excel' | 'csv' = 'pdf'
  ) => api.get('/merchant/reports/generate', {
    params: { type, startDate, endDate, format },
    responseType: 'blob',
  }),
  
  getReports: () => api.get('/merchant/reports'),
  downloadReport: (reportId: string) => api.get(`/merchant/reports/${reportId}/download`, { responseType: 'blob' }),

  // Notifications
  getNotifications: (page: number = 1, limit: number = 20) => 
    api.get('/merchant/notifications', { params: { page, limit } }),
  markNotificationAsRead: (notificationId: string) => api.patch(`/merchant/notifications/${notificationId}/read`),
  markAllNotificationsAsRead: () => api.patch('/merchant/notifications/read-all'),

  // KYC
  submitKYCDocuments: (documents: FormData) => api.post('/merchant/kyc/documents', documents, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getKYCStatus: () => api.get('/merchant/kyc/status'),
  updateBankInfo: (bankInfo: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    iban?: string;
    bic?: string;
  }) => api.put('/merchant/bank-info', bankInfo),

  // ===== CATALOGUE PRODUITS =====
  listProducts: (filter?: { active?: boolean; lowStock?: boolean }) =>
    api.get('/merchant/products', { params: filter }),
  getProduct: (id: string) => api.get(`/merchant/products/${id}`),
  createProduct: (data: {
    name: string;
    sku?: string;
    description?: string;
    category?: string;
    imageUrl?: string;
    price: number;
    currency?: string;
    taxRate?: number;
    trackStock?: boolean;
    stockQuantity?: number;
    lowStockAlert?: number;
    isActive?: boolean;
  }) => api.post('/merchant/products', data),
  updateProduct: (id: string, data: any) =>
    api.patch(`/merchant/products/${id}`, data),
  deleteProduct: (id: string) => api.delete(`/merchant/products/${id}`),
  adjustStock: (id: string, delta: number, reason?: string) =>
    api.patch(`/merchant/products/${id}/adjust-stock`, { delta, reason }),

  // ===== REPORTS PRO =====
  exportCSV: (year?: number, month?: number) =>
    api.get('/merchant/reports/export-csv', { params: { year, month } }),
  taxSummary: (year?: number, month?: number) =>
    api.get('/merchant/reports/tax-summary', { params: { year, month } }),
  receiptHtml: (transactionId: string) =>
    api.get(`/merchant/receipts/${transactionId}/html`),

  // ===== EMPLOYÉS =====
  listEmployees: () => api.get('/merchant/employees'),
  myRole: () => api.get('/merchant/employees/me/role'),
  addEmployee: (data: {
    identifier: string; // email ou téléphone
    role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'ACCOUNTANT';
    displayName?: string;
    internalCode?: string;
  }) => api.post('/merchant/employees', data),
  updateEmployeeRole: (id: string, role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'ACCOUNTANT') =>
    api.patch(`/merchant/employees/${id}/role`, { role }),
  removeEmployee: (id: string) => api.delete(`/merchant/employees/${id}`),
};

export default merchantApi;