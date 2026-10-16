import { createContext, useContext } from 'react'

export const AdminAuthContext = createContext(null)

export const useAdminAuth = () => {
  const auth = useContext(AdminAuthContext)
  if (!auth) throw new Error('useAdminAuth debe usarse dentro de AdminAccess')
  return auth
}