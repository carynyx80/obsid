'use client';
import { createContext, useContext, useEffect, useState } from 'react';
export type Role = 'host' | 'buyer' | null;
const Ctx = createContext<{ role: Role; setRole: (r: Role) => void }>({ role: null, setRole: () => {} });
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>(null);
  useEffect(() => { try { const r = localStorage.getItem('obsid.role') as Role; if (r) setRoleState(r); } catch {} }, []);
  const setRole = (r: Role) => { setRoleState(r); try { r ? localStorage.setItem('obsid.role', r) : localStorage.removeItem('obsid.role'); } catch {} };
  return <Ctx.Provider value={{ role, setRole }}>{children}</Ctx.Provider>;
}
export const useRole = () => useContext(Ctx);
