import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Search,
  Eye,
  Package,
  Layers,
  Tag,
  RotateCcw,
  MessageCircle,
  Plus,
  Minus,
  Grid,
} from 'lucide-react'
import { getCatalogoCompleto } from '../services/catalogoService.js'
import { usePresupuesto } from '../context/PresupuestoContext.jsx'
import ModalProducto from './ModalProducto.jsx'

/**
 * Sección Catálogo de Productos rediseñada:
 * 1. Mapa lateral desplegable: Botón "☰ Rubros" que abre/cierra panel lateral (columna colapsable en desktop, drawer superpuesto en mobile).
 * 2. Navegación: Árbol Rubros → Categorías. Clic en rubro expande categorías y filtra grilla; clic en categoría refina filtro; "Ver todo" limpia selección.
 * 3. Búsqueda: Campo "Buscar producto..." arriba de la grilla que filtra por descripción dentro de la selección activa o en todo el catálogo.
 * 4. Filtros activos: Chips sobre la grilla con botón ✕ para limpiar.
 * 5. Grilla: Fichas de productos que abren ModalProducto al clic. SIN precios ni códigos internos.
 */
export default function SeccionProductos() {
  // Datos maestros
  const [rubros, setRubros] = useState([])
  const [todasCategorias, setTodasCategorias] = useState([])
  const [productos, setProductos] = useState([])

  // Estados de filtro y navegación
  const [selectedRubro, setSelectedRubro] = useState(null)
  const [selectedCategoria, setSelectedCategoria] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Control del árbol lateral (acordeón de rubros expandidos en el panel)
  const [expandedRubros, setExpandedRubros] = useState({})

  // Control de apertura del panel lateral:
  // Desktop (≥768px): inicia visible/abierto por defecto al cargar. Mobile (<768px): inicia cerrado/oculto.
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768
    }
    return true
  })

  // Sincronizar estado al redimensionar la ventana cruzando el breakpoint de 768px
  useEffect(() => {
    let prevWidth = typeof window !== 'undefined' ? window.innerWidth : 768

    const handleResize = () => {
      const currentWidth = window.innerWidth
      // Si cruzó el breakpoint md (768px)
      if (prevWidth < 768 && currentWidth >= 768) {
        setIsSidebarOpen(true)
      } else if (prevWidth >= 768 && currentWidth < 768) {
        setIsSidebarOpen(false)
      }
      prevWidth = currentWidth
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Cantidad de productos a mostrar en vista sin filtros (4 filas = 16 productos en grilla de 4 col, o lotes de 16)
  const PRODUCTOS_POR_LOTE = 16
  const [visibleCount, setVisibleCount] = useState(PRODUCTOS_POR_LOTE)

  // Estados de carga
  const [loading, setLoading] = useState(true)

  // Modal de detalle de producto
  const [modalProducto, setModalProducto] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Carrito de presupuesto
  const { isInCart, toggleItem, updateCantidad, getItemCantidad } = usePresupuesto()
  const [localQuantities, setLocalQuantities] = useState({})

  const sectionRef = useRef(null)

  const getCardQty = (id) => {
    if (isInCart(id)) return getItemCantidad(id)
    return localQuantities[id] || 0
  }

  const handleQtyChange = (prod, newQty) => {
    const qty = Math.max(1, parseInt(newQty, 10) || 1)
    if (isInCart(prod.id)) {
      updateCantidad(prod.id, qty)
    } else {
      setLocalQuantities((prev) => ({ ...prev, [prod.id]: qty }))
    }
  }

  const handleToggleCart = (prod) => {
    if (isInCart(prod.id)) {
      toggleItem(prod)
      setLocalQuantities((prev) => ({ ...prev, [prod.id]: 0 }))
    } else {
      toggleItem(prod, 1)
      setLocalQuantities((prev) => ({ ...prev, [prod.id]: 1 }))
    }
  }

  // Carga inicial única de datos activos compartida con cache en memoria
  useEffect(() => {
    let isMounted = true

    async function inicializarDatos() {
      try {
        setLoading(true)
        const { rubros: rubrosData, categorias: categoriasData, productos: productosData } = await getCatalogoCompleto()

        if (!isMounted) return

        setRubros(rubrosData || [])
        setTodasCategorias(categoriasData || [])
        setProductos(productosData || [])
      } catch (err) {
        console.error('[SeccionProductos] Error en carga de catálogo:', err)
        if (isMounted) {
          setRubros([])
          setTodasCategorias([])
          setProductos([])
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    inicializarDatos()

    return () => {
      isMounted = false
    }
  }, [])

  // Mapeos rápidos para descripciones
  const rubrosMap = useMemo(() => {
    const map = {}
    rubros.forEach((r) => {
      map[r.id] = r
    })
    return map
  }, [rubros])

  const categoriasMap = useMemo(() => {
    const map = {}
    todasCategorias.forEach((c) => {
      map[c.id] = c
    })
    return map
  }, [todasCategorias])

  // Categorías agrupadas por rubro
  const categoriasPorRubroMap = useMemo(() => {
    const map = {}
    rubros.forEach((r) => {
      map[r.id] = []
    })
    todasCategorias.forEach((c) => {
      if (c.idRubro) {
        if (!map[c.idRubro]) map[c.idRubro] = []
        map[c.idRubro].push(c)
      }
    })
    return map
  }, [rubros, todasCategorias])

  // Contador de productos por categoría y por rubro
  const productosCountMap = useMemo(() => {
    const catCount = {}
    const rubroCount = {}

    productos.forEach((p) => {
      if (p.idCategoria) {
        catCount[p.idCategoria] = (catCount[p.idCategoria] || 0) + 1
        const cat = categoriasMap[p.idCategoria]
        if (cat?.idRubro) {
          rubroCount[cat.idRubro] = (rubroCount[cat.idRubro] || 0) + 1
        }
      }
    })

    return { catCount, rubroCount }
  }, [productos, categoriasMap])

  // Acciones de filtro
  const handleSelectRubro = (rubro) => {
    if (selectedRubro?.id === rubro.id && !selectedCategoria) {
      // Toggle expansión si ya está seleccionado
      setExpandedRubros((prev) => ({ ...prev, [rubro.id]: !prev[rubro.id] }))
      return
    }

    setSelectedRubro(rubro)
    setSelectedCategoria(null)
    setExpandedRubros((prev) => ({ ...prev, [rubro.id]: true }))
  }

  const handleToggleExpandRubro = (e, rubroId) => {
    e.stopPropagation()
    setExpandedRubros((prev) => ({ ...prev, [rubroId]: !prev[rubroId] }))
  }

  const handleSelectCategoria = (rubro, categoria) => {
    setSelectedRubro(rubro)
    setSelectedCategoria(categoria)
    setExpandedRubros((prev) => ({ ...prev, [rubro.id]: true }))
    // En mobile (<768px) cerramos el drawer al elegir categoría para ver resultados
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false)
    }
  }

  const handleResetFiltros = () => {
    setSelectedRubro(null)
    setSelectedCategoria(null)
    setSearchTerm('')
    setVisibleCount(PRODUCTOS_POR_LOTE)
    // En mobile (<768px) cerramos el drawer al resetear
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false)
    }
  }

  const handleClearRubro = () => {
    setSelectedRubro(null)
    setSelectedCategoria(null)
    setVisibleCount(PRODUCTOS_POR_LOTE)
  }

  const handleClearCategoria = () => {
    setSelectedCategoria(null)
    setVisibleCount(PRODUCTOS_POR_LOTE)
  }

  // ¿Hay algún filtro activo?
  const hayFiltrosActivos = Boolean(selectedRubro || selectedCategoria || searchTerm.trim())

  // Filtrado de productos en memoria
  const productosFiltrados = useMemo(() => {
    let prods = productos

    // 1. Filtrar por categoría
    if (selectedCategoria) {
      prods = prods.filter((p) => p.idCategoria === selectedCategoria.id)
    }
    // 2. Filtrar por rubro (si no hay categoría específica)
    else if (selectedRubro) {
      const catsDelRubro = categoriasPorRubroMap[selectedRubro.id] || []
      const catIdsSet = new Set(catsDelRubro.map((c) => c.id))
      prods = prods.filter((p) => catIdsSet.has(p.idCategoria))
    }

    // 3. Filtrar por búsqueda de texto (dentro de la selección activa o en todo)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim()
      prods = prods.filter((p) => (p.descripcion || '').toLowerCase().includes(term))
    }

    return prods
  }, [productos, selectedRubro, selectedCategoria, searchTerm, categoriasPorRubroMap])

  // Productos a renderizar en pantalla (paginado solo si no hay filtros activos)
  const productosAMostrar = useMemo(() => {
    if (!hayFiltrosActivos) {
      return productosFiltrados.slice(0, visibleCount)
    }
    return productosFiltrados
  }, [productosFiltrados, hayFiltrosActivos, visibleCount])

  const tieneMasProductos = !hayFiltrosActivos && visibleCount < productosFiltrados.length

  const handleVerMas = () => {
    setVisibleCount((prev) => prev + PRODUCTOS_POR_LOTE)
  }

  const getCategoriaNombre = (idCat) => categoriasMap[idCat]?.descripcion || ''
  const getRubroNombre = (idCat) => {
    const idR = categoriasMap[idCat]?.idRubro
    return rubrosMap[idR]?.descripcion || ''
  }

  const handleOpenModal = (producto) => {
    setModalProducto(producto)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setModalProducto(null)
  }

  // Bloquear scroll del body cuando el drawer móvil está abierto
  useEffect(() => {
    if (isSidebarOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isSidebarOpen])

  return (
    <section
      id="productos"
      ref={sectionRef}
      className="w-full px-4 sm:px-8 md:px-12 lg:px-16 xl:px-20 py-12 md:py-16 bg-white border-b border-gray-200 relative"
    >
      {/* =============================================================
          1. CABECERA PRINCIPAL DE LA SECCIÓN (Misma relevancia que Destacados y Populares)
          ============================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-[var(--primary)] border border-red-200 mb-2">
            <Grid className="w-3.5 h-3.5" />
            <span>Navegación completa</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[var(--text)] tracking-tight">
            Catálogo de <span className="text-[var(--primary)]">Productos</span>
          </h2>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-xl">
            Explorá por rubros y categorías o buscá por descripción.
          </p>
        </div>

        {/* Resumen total de productos */}
        <div className="text-xs font-semibold text-gray-500 bg-gray-50 px-3.5 py-2 rounded-xl border border-gray-200 self-start sm:self-auto">
          {productos.length} productos en catálogo
        </div>
      </div>

      {/* =============================================================
          2. BARRA DE ACCIÓN: BOTÓN "RUBROS"
          ============================================================= */}
      <div className="flex items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-200">
        <button
          type="button"
          id="btn-toggle-sidebar-rubros"
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          aria-expanded={isSidebarOpen}
          aria-label={isSidebarOpen ? 'Ocultar mapa de rubros' : 'Mostrar mapa de rubros'}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-xs cursor-pointer ${
            isSidebarOpen
              ? 'bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white shadow-md ring-2 ring-[var(--primary)]/30'
              : 'bg-gray-100 hover:bg-gray-200 text-[var(--text)] border border-gray-300'
          }`}
        >
          {isSidebarOpen ? (
            <X className="w-4 h-4 text-white" />
          ) : (
            <Menu className="w-4 h-4 text-gray-700" />
          )}
          <span>Rubros</span>
        </button>
      </div>

      {/* =============================================================
          ESTRUCTURA PRINCIPAL: PANEL LATERAL + CONTENIDO DE GRILLA
          ============================================================= */}
      <div className="flex items-start gap-8 relative">
        {/* BACKDROP PARA MOBILE DRAWER */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
            aria-hidden="true"
          />
        )}

        {/* =============================================================
            PANEL LATERAL: Árbol Rubros → Categorías
            (En desktop: columna lateral colapsable | En mobile: Drawer superpuesto)
            ============================================================= */}
        <aside
          className={`
            fixed md:static top-0 left-0 h-full md:h-auto z-50 md:z-10
            w-80 sm:w-88 md:w-72 xl:w-80 shrink-0
            bg-[#EFE5CE] border-r md:border border-[#D8C7A5] md:rounded-2xl p-5
            overflow-y-auto max-h-screen md:max-h-[85vh] shadow-2xl md:shadow-xs
            transition-all duration-300 ease-in-out
            ${
              isSidebarOpen
                ? 'translate-x-0 opacity-100 md:block'
                : '-translate-x-full md:hidden opacity-0 pointer-events-none'
            }
          `}
        >
          {/* Cabecera del Panel */}
          <div className="flex items-center justify-between gap-2 pb-4 mb-4 border-b border-[#D8C7A5]">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--primary)]" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-[var(--text)]">
                Árbol de Rubros
              </h3>
            </div>

            <div className="flex items-center gap-1">
              {(selectedRubro || selectedCategoria) && (
                <button
                  type="button"
                  onClick={handleResetFiltros}
                  className="text-xs font-bold text-[var(--primary)] hover:underline px-2 py-1 cursor-pointer"
                  title="Limpiar selección"
                >
                  Ver todo
                </button>
              )}
              {/* Botón cerrar en mobile */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="md:hidden p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer"
                aria-label="Cerrar panel de rubros"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Opción "Ver todo el catálogo" */}
          <button
            type="button"
            onClick={handleResetFiltros}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all mb-3 cursor-pointer ${
              !selectedRubro && !selectedCategoria
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <Package className="w-3.5 h-3.5" />
              <span>Ver todo el catálogo</span>
            </span>
            <span className="text-[11px] opacity-80">{productos.length}</span>
          </button>

          {/* Árbol de Rubros y Categorías */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-10 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <nav aria-label="Jerarquía de Rubros y Categorías" className="space-y-2">
              {rubros.map((rubro) => {
                const cats = categoriasPorRubroMap[rubro.id] || []
                const isRubroActive = selectedRubro?.id === rubro.id
                const isExpanded = expandedRubros[rubro.id] ?? isRubroActive
                const totalProdsRubro = productosCountMap.rubroCount[rubro.id] || 0

                return (
                  <div
                    key={rubro.id}
                    className="rounded-xl border border-gray-200/80 bg-white overflow-hidden shadow-2xs"
                  >
                    {/* Item de Rubro */}
                    <div
                      onClick={() => handleSelectRubro(rubro)}
                      className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                        isRubroActive && !selectedCategoria
                          ? 'bg-red-50/80 text-[var(--primary)] font-bold border-l-4 border-l-[var(--primary)]'
                          : isRubroActive
                          ? 'bg-gray-50 text-[var(--text)] font-bold'
                          : 'hover:bg-gray-50 text-[var(--text)] font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <Layers
                          className={`w-4 h-4 shrink-0 ${
                            isRubroActive ? 'text-[var(--primary)]' : 'text-gray-400'
                          }`}
                        />
                        <span className="text-xs truncate">{rubro.descripcion}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {totalProdsRubro > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                            {totalProdsRubro}
                          </span>
                        )}

                        {cats.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => handleToggleExpandRubro(e, rubro.id)}
                            aria-label={`Desplegar categorías de ${rubro.descripcion}`}
                            className="p-1 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Categorías del Rubro */}
                    {isExpanded && cats.length > 0 && (
                      <div className="bg-gray-50/70 border-t border-gray-100 py-1.5 px-2 space-y-1">
                        {cats.map((cat) => {
                          const isCatActive = selectedCategoria?.id === cat.id
                          const prodsCat = productosCountMap.catCount[cat.id] || 0

                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => handleSelectCategoria(rubro, cat)}
                              className={`w-full flex items-center justify-between text-left px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                                isCatActive
                                  ? 'bg-[var(--primary)] text-white font-bold shadow-xs'
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-white font-medium'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate pr-2">
                                <Tag
                                  className={`w-3 h-3 shrink-0 ${
                                    isCatActive ? 'text-white' : 'text-gray-400'
                                  }`}
                                />
                                <span className="truncate">{cat.descripcion}</span>
                              </div>
                              {prodsCat > 0 && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                                    isCatActive
                                      ? 'bg-white/20 text-white font-semibold'
                                      : 'bg-gray-200/80 text-gray-600'
                                  }`}
                                >
                                  {prodsCat}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
          )}
        </aside>

        {/* =============================================================
            CONTENIDO CENTRAL: BÚSQUEDA + CHIPS DE FILTROS + GRILLA
            ============================================================= */}
        <div className="flex-1 min-w-0">
          {/* 3. CAMPO DE BÚSQUEDA POR DESCRIPCIÓN */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                selectedCategoria
                  ? `Buscar producto en ${selectedCategoria.descripcion}...`
                  : selectedRubro
                  ? `Buscar producto en ${selectedRubro.descripcion}...`
                  : 'Buscar producto...'
              }
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-sm text-[var(--text)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:bg-white transition-all shadow-xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700 font-bold p-1 cursor-pointer"
                aria-label="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>

          {/* 4. FILTROS ACTIVOS (CHIPS) */}
          {(selectedRubro || selectedCategoria || searchTerm) && (
            <div className="flex items-center flex-wrap gap-2 mb-6">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Filtros:
              </span>

              {/* Chip Rubro / Categoría */}
              {selectedRubro && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-[var(--primary)] border border-red-200 shadow-2xs">
                  <span>
                    {selectedRubro.descripcion}
                    {selectedCategoria && ` ▸ ${selectedCategoria.descripcion}`}
                  </span>
                  <button
                    type="button"
                    onClick={selectedCategoria ? handleClearCategoria : handleClearRubro}
                    className="hover:bg-red-200/60 rounded-full p-0.5 transition-colors cursor-pointer"
                    aria-label="Quitar filtro de categoría o rubro"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Chip de Búsqueda */}
              {searchTerm && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 border border-gray-200 shadow-2xs">
                  <span>Búsqueda: &ldquo;{searchTerm}&rdquo;</span>
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="hover:bg-gray-200 rounded-full p-0.5 transition-colors cursor-pointer"
                    aria-label="Quitar filtro de búsqueda"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Botón limpiar todo - Terciario (acción mínima) */}
              <button
                type="button"
                onClick={handleResetFiltros}
                className="btn-tertiary ml-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar filtros</span>
              </button>
            </div>
          )}

          {/* Encabezado contextual de la grilla */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-base sm:text-lg font-bold text-[var(--text)] truncate">
              {selectedCategoria
                ? selectedCategoria.descripcion
                : selectedRubro
                ? selectedRubro.descripcion
                : 'Todos los Productos'}
            </h3>

            <div className="text-xs font-semibold text-gray-500 shrink-0">
              {productosFiltrados.length}{' '}
              {productosFiltrados.length === 1 ? 'producto' : 'productos'}
            </div>
          </div>

          {/* 5. GRILLA DE PRODUCTOS (SIN PRECIOS NI CÓDIGOS) */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[20px] justify-center">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="w-full h-auto rounded-2xl bg-white border border-gray-200 p-4 animate-pulse"
                >
                  <div className="w-full h-40 bg-gray-200 rounded-xl mb-4" />
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
                  <div className="h-8 bg-gray-100 rounded-lg w-full" />
                </div>
              ))}
            </div>
          ) : productosAMostrar.length > 0 ? (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[20px] justify-center">
              {productosAMostrar.map((prod) => {
                const catNombre = getCategoriaNombre(prod.idCategoria)
                const rubroNombre = getRubroNombre(prod.idCategoria)

                return (
                  <div
                    key={prod.id}
                    onClick={() => handleOpenModal(prod)}
                    className={`w-full h-auto bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col group cursor-pointer ${
                      isInCart(prod.id)
                        ? 'border-red-400 ring-2 ring-red-100 shadow-md'
                        : 'border-gray-200/90 shadow-xs hover:shadow-xl hover:border-red-300'
                    }`}
                  >
                    {/* Imagen o Placeholder */}
                    <div className="h-40 sm:h-44 w-full bg-gray-100 relative overflow-hidden flex items-center justify-center border-b border-gray-100">
                      {prod.imagen ? (
                        <img
                          src={prod.imagen}
                          alt={prod.descripcion}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-400">
                          <Package className="w-12 h-12 stroke-[1.25] text-gray-300 group-hover:text-[var(--primary)] transition-colors" />
                        </div>
                      )}

                      {prod.destacado && (
                        <span className="absolute top-3 left-3 bg-[var(--primary)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                          Destacado
                        </span>
                      )}

                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 text-xs font-bold text-[var(--text)] shadow-md">
                          <Eye className="w-3.5 h-3.5 text-[var(--primary)]" />
                          <span>Ver ficha</span>
                        </span>
                      </div>
                    </div>

                    {/* Detalle del producto (SIN PRECIOS NI CÓDIGOS) */}
                    <div className="p-4 flex flex-col justify-between flex-1">
                      <div>
                        {/* Rubro y Categoría */}
                        {(rubroNombre || catNombre) && (
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)] uppercase tracking-wider mb-1 line-clamp-1">
                            <span>{rubroNombre || 'General'}</span>
                            {catNombre && <span>•</span>}
                            <span>{catNombre}</span>
                          </div>
                        )}

                        <h4 className="font-bold text-sm text-[var(--text)] group-hover:text-[var(--primary)] transition-colors line-clamp-2 leading-snug">
                          {prod.descripcion}
                        </h4>

                        {prod.obsUnidad && (
                          <p className="text-xs text-[var(--muted)] font-medium mt-1 line-clamp-1">
                            Unidad: {prod.obsUnidad}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-100 space-y-2.5">
                        {/* Checkbox de selección + Cantidad */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 min-w-0"
                        >
                          <label className={`btn-secondary flex-1 min-w-0 !px-2.5 sm:!px-3.5 !py-2 cursor-pointer select-none text-xs sm:text-sm transition-all duration-200 ${
                            isInCart(prod.id) ? '!bg-[#FEF2F2] ring-1 ring-[var(--primary)]/30 font-bold' : ''
                          }`}>
                            <input
                              type="checkbox"
                              checked={isInCart(prod.id)}
                              onChange={() => handleToggleCart(prod)}
                              className="w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)] accent-[var(--primary)] cursor-pointer shrink-0"
                            />
                            <span className="truncate">Presupuestar</span>
                          </label>

                          {isInCart(prod.id) && (
                            <div className="flex items-center h-[38px] border border-gray-300 rounded-lg bg-white overflow-hidden shadow-2xs shrink-0 divide-x divide-gray-200 animate-qty-appear">
                              <button
                                type="button"
                                onClick={() =>
                                  handleQtyChange(prod, getCardQty(prod.id) - 1)
                                }
                                disabled={getCardQty(prod.id) <= 1}
                                aria-label="Disminuir cantidad"
                                className="w-7.5 sm:w-8 h-full flex items-center justify-center text-gray-700 hover:text-[var(--primary)] hover:bg-red-50/80 disabled:opacity-30 disabled:hover:bg-transparent disabled:text-gray-400 active:scale-90 transition-all cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                max="9999"
                                value={getCardQty(prod.id)}
                                onChange={(e) =>
                                  handleQtyChange(prod, e.target.value)
                                }
                                className="w-8 sm:w-10 text-center text-xs sm:text-sm font-bold text-gray-900 bg-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleQtyChange(prod, getCardQty(prod.id) + 1)
                                }
                                aria-label="Aumentar cantidad"
                                className="w-7.5 sm:w-8 h-full flex items-center justify-center text-gray-700 hover:text-[var(--primary)] hover:bg-red-50/80 active:scale-90 transition-all cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Botón de acción Secundario para ver detalle */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setSelectedProducto(prod)}
                            className="btn-secondary w-full"
                          >
                            Ver detalle
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Botón Ver más elegante cuando no hay filtros - Terciario (acción mínima) */}
            {tieneMasProductos && (
              <div className="flex flex-col items-center justify-center pt-8 pb-4">
                <button
                  type="button"
                  onClick={handleVerMas}
                  className="btn-tertiary"
                >
                  <span>Ver más...</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-400 mt-2 font-medium">
                  Mostrando {productosAMostrar.length} de {productosFiltrados.length} productos
                </span>
              </div>
            )}
            </>
          ) : (
            /* Estado Vacío */
            <div className="w-full bg-gray-50 rounded-2xl border border-gray-200 p-8 text-center my-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-[var(--primary)] flex items-center justify-center mx-auto mb-3 border border-red-100">
                <Package className="w-6 h-6 stroke-[1.5]" />
              </div>
              <h4 className="text-base font-bold text-[var(--text)] mb-1">
                {searchTerm
                  ? 'No se encontraron productos con ese criterio'
                  : 'No hay productos en esta selección'}
              </h4>
              <p className="text-xs text-[var(--muted)] mb-4 max-w-sm mx-auto">
                {searchTerm
                  ? 'Probá buscando con otros términos o limpiando los filtros.'
                  : 'Consultanos directamente por WhatsApp si buscás un producto específico.'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleResetFiltros}
                  className="btn-tertiary"
                >
                  Ver todo el catálogo
                </button>
                <a
                  href={`https://wa.me/5492612430105?text=${encodeURIComponent(
                    `Hola, quisiera consultar por productos en el catálogo`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Consultar por WhatsApp</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalle de Producto */}
      {modalProducto && (
        <ModalProducto
          producto={modalProducto}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          categoriaNombre={getCategoriaNombre(modalProducto.idCategoria)}
          rubroNombre={getRubroNombre(modalProducto.idCategoria)}
        />
      )}
    </section>
  )
}
