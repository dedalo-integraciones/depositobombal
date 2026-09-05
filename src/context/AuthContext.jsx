import { createContext, useContext, useState, useEffect } from 'react'
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
} from 'firebase/auth'
import { app, isFirebaseConfigured } from '../lib/firebase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isFirebaseConfigured || !app) {
      setUser(null)
      setLoading(false)
      return
    }

    const auth = getAuth(app)

    // Configurar persistencia de sesión a nivel navegador/pestaña (se destruye al cerrar la pestaña o ventana)
    try {
      setPersistence(auth, browserSessionPersistence).catch((err) => {
        console.warn('[Auth] No se pudo fijar browserSessionPersistence:', err)
      })
    } catch (e) {
      console.warn('[Auth] Error al inicializar persistencia:', e)
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const login = async (email, password) => {
    if (!isFirebaseConfigured || !app) {
      throw new Error('Firebase no está configurado en este entorno.')
    }
    const auth = getAuth(app)
    // Asegurar que la sesión dure únicamente mientras la pestaña/navegador esté abierto
    try {
      await setPersistence(auth, browserSessionPersistence)
    } catch (persistErr) {
      console.warn('[Auth] Advertencia al aplicar persistencia de sesión:', persistErr)
    }
    return signInWithEmailAndPassword(auth, email.trim(), password)
  }

  const resetPassword = async (email) => {
    if (!isFirebaseConfigured || !app) {
      throw new Error('Firebase no está configurado en este entorno.')
    }
    const auth = getAuth(app)
    return sendPasswordResetEmail(auth, email.trim())
  }

  const logout = async () => {
    if (!app) return
    const auth = getAuth(app)
    return signOut(auth)
  }


  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        resetPassword,
        logout,
        isFirebaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider')
  }
  return context
}
