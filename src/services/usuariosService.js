import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore'
import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as authSignOut,
  updatePassword as authUpdatePassword,
} from 'firebase/auth'
import { app as mainApp, db, isFirebaseConfigured } from '../lib/firebase.js'

// Configuración de Firebase para la instancia secundaria de Auth
const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || (typeof process !== 'undefined' ? process.env.VITE_FIREBASE_API_KEY : ''),
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || (typeof process !== 'undefined' ? process.env.VITE_FIREBASE_AUTH_DOMAIN : ''),
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || (typeof process !== 'undefined' ? process.env.VITE_FIREBASE_PROJECT_ID : ''),
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || (typeof process !== 'undefined' ? process.env.VITE_FIREBASE_STORAGE_BUCKET : ''),
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || (typeof process !== 'undefined' ? process.env.VITE_FIREBASE_MESSAGING_SENDER_ID : ''),
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || (typeof process !== 'undefined' ? process.env.VITE_FIREBASE_APP_ID : ''),
}

/**
 * Obtener todos los usuarios de la colección 'usuarios' (y 'users' si aplica)
 */
export async function getUsuarios() {
  if (!isFirebaseConfigured || !db) {
    return []
  }
  try {
    const querySnapshot = await getDocs(collection(db, 'usuarios'))
    const usuarios = []
    querySnapshot.forEach((docSnap) => {
      usuarios.push({
        id: docSnap.id,
        uid: docSnap.id,
        ...docSnap.data(),
      })
    })

    // Si la colección 'usuarios' estaba vacía, intentar con 'users'
    if (usuarios.length === 0) {
      try {
        const usersSnap = await getDocs(collection(db, 'users'))
        usersSnap.forEach((docSnap) => {
          usuarios.push({
            id: docSnap.id,
            uid: docSnap.id,
            ...docSnap.data(),
          })
        })
      } catch (e) {
        // Ignorar
      }
    }

    return usuarios
  } catch (error) {
    console.warn('[usuariosService] Advertencia al obtener lista de usuarios de Firestore:', error)
    // Fallback: retornar al menos el usuario autenticado actual si no se puede listar la colección completa por reglas
    try {
      const auth = getAuth(mainApp)
      if (auth.currentUser) {
        const currentProfile = await getUsuarioByUid(auth.currentUser.uid)
        if (currentProfile) {
          return [currentProfile]
        }
      }
    } catch (e) {
      // Ignorar
    }
    return []
  }
}

/**
 * Obtener perfil de un usuario específico por su UID
 */
export async function getUsuarioByUid(uid) {
  if (!isFirebaseConfigured || !db || !uid) {
    return null
  }
  try {
    const docRef = doc(db, 'usuarios', uid)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      return { id: docSnap.id, uid: docSnap.id, ...docSnap.data() }
    }
    // Probar colección alternativa 'users'
    const userDocRef = doc(db, 'users', uid)
    const userDocSnap = await getDoc(userDocRef)
    if (userDocSnap.exists()) {
      return { id: userDocSnap.id, uid: userDocSnap.id, ...userDocSnap.data() }
    }
    return null
  } catch (error) {
    console.warn(`[usuariosService] Advertencia al obtener usuario ${uid}:`, error)
    return null
  }
}

/**
 * Verificar si un email ya existe en la colección de usuarios
 */
export async function checkEmailExists(email) {
  if (!isFirebaseConfigured || !db || !email) return false
  const cleanEmail = email.trim().toLowerCase()
  try {
    const q1 = query(collection(db, 'usuarios'), where('email', '==', cleanEmail))
    const snap1 = await getDocs(q1)
    if (!snap1.empty) return true

    const q2 = query(collection(db, 'users'), where('email', '==', cleanEmail))
    const snap2 = await getDocs(q2)
    return !snap2.empty
  } catch (err) {
    console.warn('[usuariosService] Advertencia al verificar existencia de email:', err)
    return false
  }
}

/**
 * Cambiar el estado de un usuario (activo <-> deshabilitado)
 */
export async function toggleUsuarioStatus(uid, currentStatus) {
  if (!isFirebaseConfigured || !db || !uid) {
    throw new Error('Firebase no está configurado o UID inválido')
  }
  const newStatus = currentStatus === 'deshabilitado' ? 'activo' : 'deshabilitado'
  const updatedAt = new Date().toISOString()

  try {
    const userRef = doc(db, 'usuarios', uid)
    await setDoc(userRef, { status: newStatus, updatedAt }, { merge: true })

    try {
      const usersRef = doc(db, 'users', uid)
      await setDoc(usersRef, { status: newStatus, updatedAt }, { merge: true })
    } catch (e) {
      // Ignorar si no existe la colección espejo
    }

    return newStatus
  } catch (error) {
    console.error(`[usuariosService] Error al actualizar estado de ${uid}:`, error)
    throw error
  }
}

/**
 * Generar contraseña temporal aleatoria (10 caracteres)
 */
export function generateRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&'
  let password = ''
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

/**
 * Dar de alta un usuario utilizando el patrón de instancia secundaria de Firebase Auth
 */
export async function crearUsuarioSecundario({ email, rol }) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase no está configurado.')
  }

  const cleanEmail = email.trim().toLowerCase()
  const tempPassword = generateRandomPassword()

  // Nombre único para la app secundaria
  const appName = `secondary_app_${Date.now()}`
  let secondaryApp = null

  try {
    secondaryApp = initializeApp(firebaseConfig, appName)
    const secondaryAuth = getAuth(secondaryApp)

    // 1. Crear usuario en Auth con la contraseña temporal
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, tempPassword)
    const newUid = userCredential.user.uid

    // 2. Crear documento en la colección 'usuarios' (y 'users')
    const userDocData = {
      email: cleanEmail,
      rol: rol || 'admin',
      status: 'activo',
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await setDoc(doc(db, 'usuarios', newUid), userDocData)
    try {
      await setDoc(doc(db, 'users', newUid), userDocData)
    } catch (err) {
      // Espejo
    }

    // 3. Enviar correo de restablecimiento de contraseña vía Firebase Auth
    try {
      await sendPasswordResetEmail(secondaryAuth, cleanEmail)
    } catch (resetErr) {
      console.warn('[usuariosService] Advertencia al enviar sendPasswordResetEmail:', resetErr)
    }

    // 4. Cerrar sesión en la instancia secundaria
    await authSignOut(secondaryAuth)

    return {
      uid: newUid,
      email: cleanEmail,
      rol,
      tempPassword,
    }
  } catch (error) {
    console.error('[usuariosService] Error al crear usuario secundario:', error)
    throw error
  } finally {
    if (secondaryApp) {
      try {
        await deleteApp(secondaryApp)
      } catch (delErr) {
        // Ignorar
      }
    }
  }
}

/**
 * Actualizar contraseña obligatoria en el primer ingreso
 */
export async function cambiarPasswordPrimerIngreso(newPassword) {
  const auth = getAuth(mainApp)
  if (!auth.currentUser) {
    throw new Error('No hay una sesión activa para cambiar la contraseña.')
  }

  // 1. Actualizar contraseña en Firebase Auth
  await authUpdatePassword(auth.currentUser, newPassword)

  // 2. Actualizar mustChangePassword = false en Firestore
  const uid = auth.currentUser.uid
  const updatedAt = new Date().toISOString()

  try {
    await setDoc(doc(db, 'usuarios', uid), { mustChangePassword: false, updatedAt }, { merge: true })
    try {
      await setDoc(doc(db, 'users', uid), { mustChangePassword: false, updatedAt }, { merge: true })
    } catch (e) {
      // Ignorar
    }
  } catch (err) {
    console.error('[usuariosService] Error al actualizar flag mustChangePassword en Firestore:', err)
  }
}

/**
 * Seed o asignación de rol 'superadmin' / 'SADMIN' a un usuario por su email o UID
 */
export async function seedSuperAdmin(emailOrUid, email = '') {
  if (!isFirebaseConfigured || !db) return

  let uid = emailOrUid
  let targetEmail = email || emailOrUid

  // Si se pasó email, intentar buscar el UID si no es un UID de Firebase (los UIDs suelen tener 28 caracteres)
  if (targetEmail.includes('@') && !uid.match(/^[a-zA-Z0-9]{28}$/)) {
    try {
      const q = query(collection(db, 'usuarios'), where('email', '==', targetEmail.trim().toLowerCase()))
      const snap = await getDocs(q)
      if (!snap.empty) {
        uid = snap.docs[0].id
      }
    } catch (e) {
      // Ignorar error de búsqueda en seed
    }
  }

  const userDocData = {
    email: targetEmail.trim().toLowerCase(),
    rol: 'SADMIN',
    status: 'activo',
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  }

  if (uid) {
    try {
      await setDoc(doc(db, 'usuarios', uid), userDocData, { merge: true })
      try {
        await setDoc(doc(db, 'users', uid), userDocData, { merge: true })
      } catch (e) {}
      console.info(`[usuariosService] Asignado rol SADMIN a usuario ${targetEmail} (UID: ${uid})`)
    } catch (err) {
      console.warn(`[usuariosService] No se pudo guardar el doc SADMIN en Firestore:`, err)
    }
  }
}
