// app/(app)/(tabs)/merchant/employees.tsx
// 👥 Gestion équipe : ajouter / lister / changer rôles / retirer
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import GradientHeader from '../../../../src/components/GradientHeader';
import { merchantApi } from '../../../../src/services/merchantApi';

type Role = 'OWNER' | 'MANAGER' | 'CASHIER' | 'ACCOUNTANT';

interface Employee {
  id: string;
  role: Role;
  displayName?: string;
  internalCode?: string;
  isActive: boolean;
  joinedAt: string;
  leftAt?: string | null;
  user?: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
    telephone?: string;
  } | null;
}

const ROLE_META: Record<Role, { label: string; color: string; icon: any; desc: string }> = {
  OWNER:      { label: 'Propriétaire', color: '#1e40af', icon: 'star',           desc: 'Tous les droits' },
  MANAGER:    { label: 'Manager',      color: '#3b82f6', icon: 'shield',         desc: 'Gère équipe + produits + voit analytics' },
  CASHIER:    { label: 'Caissier',     color: '#10b981', icon: 'card',           desc: 'Encaisse uniquement' },
  ACCOUNTANT: { label: 'Comptable',    color: '#f59e0b', icon: 'document-text',  desc: 'Lecture analytics + export compta' },
};

export default function MerchantEmployees() {
  const { colors } = useTheme();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [newRole, setNewRole] = useState<Role>('CASHIER');
  const [displayName, setDisplayName] = useState('');
  const [adding, setAdding] = useState(false);

  const [showRoleModal, setShowRoleModal] = useState<Employee | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, role] = await Promise.all([
        merchantApi.listEmployees(),
        merchantApi.myRole(),
      ]);
      setEmployees(list.data || []);
      setMyRole(role.data?.role || null);
      setIsOwner(!!role.data?.isOwner);
    } catch (e: any) {
      console.error('Erreur employés:', e?.response?.data || e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = isOwner || myRole === 'MANAGER' || myRole === 'OWNER';

  const handleAdd = async () => {
    if (!identifier.trim()) {
      Alert.alert('Erreur', 'Email ou téléphone requis');
      return;
    }
    setAdding(true);
    try {
      await merchantApi.addEmployee({
        identifier: identifier.trim(),
        role: newRole,
        displayName: displayName.trim() || undefined,
      });
      setShowAdd(false);
      setIdentifier('');
      setDisplayName('');
      setNewRole('CASHIER');
      load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Impossible d\'ajouter');
    } finally {
      setAdding(false);
    }
  };

  const changeRole = async (emp: Employee, role: Role) => {
    try {
      await merchantApi.updateEmployeeRole(emp.id, role);
      setShowRoleModal(null);
      load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Échec');
    }
  };

  const removeEmployee = (emp: Employee) => {
    Alert.alert(
      'Retirer cet employé ?',
      `${emp.displayName || emp.user?.prenom} sera désactivé.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              await merchantApi.removeEmployee(emp.id);
              load();
            } catch (e: any) {
              Alert.alert('Erreur', e?.response?.data?.message || 'Échec');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item: emp }: { item: Employee }) => {
    const meta = ROLE_META[emp.role];
    const name =
      emp.displayName ||
      (emp.user ? `${emp.user.prenom} ${emp.user.nom || ''}`.trim() : 'Employé');
    const initials = (name[0] || '?').toUpperCase();

    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
          !emp.isActive && { opacity: 0.5 },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: meta.color }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.cardTopRow}>
            <Text style={[styles.empName, { color: colors.text }]} numberOfLines={1}>
              {name}
            </Text>
            <View style={[styles.roleBadge, { backgroundColor: meta.color + '20' }]}>
              <Ionicons name={meta.icon} size={11} color={meta.color} />
              <Text style={[styles.roleBadgeText, { color: meta.color }]}>
                {meta.label}
              </Text>
            </View>
          </View>
          {emp.user?.email && (
            <Text style={[styles.empContact, { color: colors.textSecondary }]} numberOfLines={1}>
              {emp.user.email}
            </Text>
          )}
          {emp.user?.telephone && (
            <Text style={[styles.empContact, { color: colors.textSecondary }]} numberOfLines={1}>
              📞 {emp.user.telephone}
            </Text>
          )}
          {!emp.isActive && (
            <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '700', marginTop: 4 }}>
              Inactif depuis {emp.leftAt ? new Date(emp.leftAt).toLocaleDateString('fr-FR') : '—'}
            </Text>
          )}
        </View>

        {canManage && emp.isActive && emp.role !== 'OWNER' && (
          <View style={{ gap: 6 }}>
            <TouchableOpacity
              style={styles.iconAction}
              onPress={() => setShowRoleModal(emp)}
            >
              <Ionicons name="create-outline" size={18} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconAction}
              onPress={() => removeEmployee(emp)}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title="Équipe"
        subtitle={`${employees.filter((e) => e.isActive).length} actif${employees.filter((e) => e.isActive).length > 1 ? 's' : ''}`}
        {...(canManage ? { rightIcon: 'person-add' as any, onRightPress: () => setShowAdd(true) } : {})}
      />

      {/* Mon rôle */}
      <LinearGradient
        colors={['#0f172a', '#1e40af']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.myRoleCard}
      >
        <Ionicons name="person-circle" size={28} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={styles.myRoleLabel}>Votre rôle actuel</Text>
          <Text style={styles.myRoleValue}>
            {isOwner ? 'PROPRIÉTAIRE' : myRole || '—'}
          </Text>
        </View>
        {!canManage && (
          <View style={styles.viewOnlyBadge}>
            <Ionicons name="eye-outline" size={11} color="#fff" />
            <Text style={styles.viewOnlyText}>Lecture seule</Text>
          </View>
        )}
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1e40af" />
        </View>
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(e) => e.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor="#1e40af"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                Aucun employé
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', paddingHorizontal: 24 }}>
                Ajoute des caissiers ou managers à ton équipe pour partager la gestion.
              </Text>
              {canManage && (
                <TouchableOpacity
                  style={styles.emptyCta}
                  onPress={() => setShowAdd(true)}
                >
                  <Ionicons name="person-add" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    Ajouter un employé
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Modal Add */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Ajouter un employé
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 14 }}>
              La personne doit déjà avoir un compte M'Paye.
            </Text>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              EMAIL OU TÉLÉPHONE
            </Text>
            <TextInput
              style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="exemple@email.com ou 034 12 345 67"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 14 }]}>
              NOM AFFICHÉ (OPTIONNEL)
            </Text>
            <TextInput
              style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Ex: Marie (caisse 2)"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 14 }]}>
              RÔLE
            </Text>
            <View style={{ gap: 8 }}>
              {(['MANAGER', 'CASHIER', 'ACCOUNTANT'] as const).map((r) => {
                const meta = ROLE_META[r];
                const selected = newRole === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.roleOption,
                      { borderColor: selected ? meta.color : colors.border, borderWidth: selected ? 2 : 1 },
                    ]}
                    onPress={() => setNewRole(r)}
                  >
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{meta.label}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{meta.desc}</Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={18} color={meta.color} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.border + '60' }]}
                onPress={() => setShowAdd(false)}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#1e40af' }]}
                onPress={handleAdd}
                disabled={adding}
              >
                {adding ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Ajouter</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Change Role */}
      <Modal visible={!!showRoleModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Changer le rôle
            </Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 14 }}>
              {showRoleModal?.displayName || showRoleModal?.user?.prenom}
            </Text>

            <View style={{ gap: 8 }}>
              {(['MANAGER', 'CASHIER', 'ACCOUNTANT'] as const).map((r) => {
                const meta = ROLE_META[r];
                const current = showRoleModal?.role === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.roleOption,
                      { borderColor: current ? meta.color : colors.border, borderWidth: current ? 2 : 1 },
                    ]}
                    onPress={() => showRoleModal && changeRole(showRoleModal, r)}
                    disabled={current}
                  >
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{meta.label}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{meta.desc}</Text>
                    </View>
                    {current && <Text style={{ color: meta.color, fontSize: 11, fontWeight: '700' }}>actuel</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.border + '60', marginTop: 14 }]}
              onPress={() => setShowRoleModal(null)}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  myRoleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: 12,
    padding: 14,
    borderRadius: 14,
  },
  myRoleLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  myRoleValue: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  viewOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  viewOnlyText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empName: { flex: 1, fontSize: 14, fontWeight: '700' },
  empContact: { fontSize: 11, marginTop: 2 },

  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700' },

  iconAction: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.1)',
  },

  empty: { alignItems: 'center', padding: 40, gap: 10 },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e40af',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    marginTop: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: { padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#9ca3af', borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, marginBottom: 4 },
  fieldInput: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  modalBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12,
  },
});
