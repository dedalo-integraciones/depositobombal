import { getRubrosActivos } from './rubrosService.js'
import { getCategoriasActivas } from './categoriasService.js'
import { getProductosActivos } from './productosService.js'

// Cache en memoria para evitar peticiones duplicadas durante la navegación
let catalogoCachePromise = null
let catalogoDataCache = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 60 * 1000 // 1 minuto de cache fresca

/**
 * Obtiene todos los rubros, categorías y productos activos en una sola invocación paralela consolidada.
 * Retorna datos desde memoria si ya se cargaron recientemente.
 */
export async function getCatalogoCompleto(forceRefresh = false) {
  const now = Date.now()

  if (!forceRefresh && catalogoDataCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return catalogoDataCache
  }

  if (catalogoCachePromise && !forceRefresh) {
    return catalogoCachePromise
  }

  catalogoCachePromise = (async () => {
    try {
      const [rubros, categorias, productos] = await Promise.all([
        getRubrosActivos(),
        getCategoriasActivas(),
        getProductosActivos(),
      ])

      const result = {
        rubros: rubros || [],
        categorias: categorias || [],
        productos: productos || [],
      }

      catalogoDataCache = result
      cacheTimestamp = Date.now()
      return result
    } catch (err) {
      console.error('[catalogoService] Error al cargar catálogo completo:', err)
      return {
        rubros: [],
        categorias: [],
        productos: [],
      }
    } finally {
      catalogoCachePromise = null
    }
  })()

  return catalogoCachePromise
}

export function invalidarCatalogoCache() {
  catalogoDataCache = null
  cacheTimestamp = 0
  catalogoCachePromise = null
}
