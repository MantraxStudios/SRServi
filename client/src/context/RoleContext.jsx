import { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const { user } = useAuth();

  const isSubAccount = user?.is_sub_account === true;
  const permissions  = user?.permissions || {};

  // Returns true if the current user can perform `action` on `section`.
  // Main accounts always can. Sub-accounts check the permissions object.
  function can(section, action = 'view') {
    if (!isSubAccount) return true;
    return permissions[section]?.[action] === true;
  }

  return (
    <RoleContext.Provider value={{ isSubAccount, permissions, can }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}

// Gate component: renders children only if user has permission,
// otherwise renders a blocked message (or nothing if `silent`).
export function PermissionGate({ section, action = 'view', silent = false, children }) {
  const { can } = useRole() || {};
  if (!can || can(section, action)) return children;
  if (silent) return null;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 300, color: '#9ca3af', gap: 12
    }}>
      <div style={{ fontSize: 40 }}>🔒</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#374151' }}>Sin acceso</div>
      <div style={{ fontSize: 13 }}>No tienes permiso para ver esta sección.</div>
    </div>
  );
}
