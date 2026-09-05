import { createContext, useContext, useState, useEffect } from 'react'

const PresupuestoContext = createContext(null)

export function PresupuestoProvider({ children }) {
  // Estado de los ítems en el carrito de presupuesto
  // Objeto indexado por id: { [id]: { id, descripcion, obsUnidad, cantidad } }
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem('deposito_bombal_presupuesto')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  // Estado del drawer/panel lateral del carrito
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Persistir en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('deposito_bombal_presupuesto', JSON.stringify(items))
    } catch (e) {
      console.error('Error guardando carrito en storage:', e)
    }
  }, [items])

  // Agregar o alternar producto
  const toggleItem = (producto, cantidad = 1) => {
    if (!producto || !producto.id) return

    setItems((prev) => {
      const copy = { ...prev }
      if (copy[producto.id]) {
        delete copy[producto.id]
      } else {
        const cant = Math.max(1, parseInt(cantidad, 10) || 1)
        copy[producto.id] = {
          id: producto.id, // Código interno de Firestore (solo para el email)
          descripcion: producto.descripcion || 'Sin descripción',
          obsUnidad: producto.obsUnidad || '',
          cantidad: cant,
        }
      }
      return copy
    })
  }

  // Modificar cantidad (mínimo 1)
  const updateCantidad = (id, cantidad) => {
    const cant = Math.max(1, parseInt(cantidad, 10) || 1)
    setItems((prev) => {
      if (!prev[id]) return prev
      return {
        ...prev,
        [id]: {
          ...prev[id],
          cantidad: cant,
        },
      }
    })
  }

  // Quitar ítem
  const removeItem = (id) => {
    setItems((prev) => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
  }

  // Vaciar carrito
  const clearCart = () => {
    setItems({})
  }

  // Comprobar si está seleccionado
  const isInCart = (id) => {
    return Boolean(items[id])
  }

  // Obtener cantidad actual de un producto
  const getItemCantidad = (id) => {
    return items[id]?.cantidad || 1
  }

  const itemsList = Object.values(items)
  const totalProducts = itemsList.length
  const totalUnidades = itemsList.reduce((acc, curr) => acc + (curr.cantidad || 1), 0)

  const openDrawer = () => setIsDrawerOpen(true)
  const closeDrawer = () => setIsDrawerOpen(false)

  return (
    <PresupuestoContext.Provider
      value={{
        items,
        itemsList,
        totalProducts,
        totalUnidades,
        isDrawerOpen,
        setIsDrawerOpen,
        openDrawer,
        closeDrawer,
        toggleItem,
        updateCantidad,
        removeItem,
        clearCart,
        isInCart,
        getItemCantidad,
      }}
    >
      {children}
    </PresupuestoContext.Provider>
  )
}

export function usePresupuesto() {
  const context = useContext(PresupuestoContext)
  if (!context) {
    throw new Error('usePresupuesto debe ser usado dentro de PresupuestoProvider')
  }
  return context
}
