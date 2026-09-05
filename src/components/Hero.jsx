import { Sparkles, MessageCircle, ArrowUpRight } from 'lucide-react'

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative w-full overflow-hidden bg-neutral-100 flex items-center justify-start"
      style={{
        minHeight: 'calc(100vh - var(--header-height))',
        height: 'calc(100dvh - var(--header-height))',
      }}
    >
      {/* Imagen de fondo LCP: hero-mob.webp en mobile y hero.webp en desktop con prioridad máxima */}
      <img
        src="/hero.webp"
        srcSet="/hero-mob.webp 768w, /hero.webp 1920w"
        sizes="100vw"
        alt="Depósito Bombal — Instalaciones y logística"
        className="absolute inset-0 w-full h-full object-cover object-top z-0 pointer-events-none"
        fetchPriority="high"
        decoding="sync"
      />

      {/* Contenido alineado a la izquierda */}
      <div className="relative z-10 w-full px-4 sm:px-8 md:px-12 lg:px-16 xl:px-20 py-6 sm:py-10 flex flex-col justify-center items-start max-w-5xl text-left">
        {/* Cuadro bajo el texto en traslúcido */}
        <div className="w-full max-w-2xl bg-white/40 sm:bg-white/45 backdrop-blur-md border border-white/60 rounded-2xl p-6 sm:p-8 md:p-10 shadow-xl flex flex-col items-start text-left">
          {/* Insignia */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/60 text-[var(--primary)] border border-white/70 mb-4 sm:mb-5 shadow-2xs backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>Plataforma Catálogo Online</span>
          </div>

          {/* Título principal */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-950 mb-3 sm:mb-4 leading-tight text-left">
            Depósito <span className="text-[var(--primary)]">Bombal</span>
          </h1>

          {/* Bajada descriptiva */}
          <p className="text-sm sm:text-base md:text-lg text-gray-900 font-medium leading-relaxed mb-6 sm:mb-8 text-left">
            Venta y distribución mayorista y minorista en Mendoza. Armá tu lista y solicitá tu presupuesto personalizado sin compromiso.
          </p>

          {/* CTA 'Consultar por WhatsApp' - Botón Verde WhatsApp */}
          <div className="text-left">
            <a
              href="https://wa.me/5492612430105?text=Hola%2C%20quisiera%20solicitar%20un%20presupuesto"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp shadow-xl hover:shadow-2xl"
            >
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Consultar por WhatsApp</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
