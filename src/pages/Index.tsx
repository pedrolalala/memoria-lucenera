import { useEffect } from 'react'

export default function Index() {
  useEffect(() => {
    document.title = 'Memoria Lucenera'
  }, [])

  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-6 select-none"
      style={{ backgroundColor: '#F7F3EC' }}
    >
      {/* Elemento centralizado */}
      <main className="flex flex-col items-center text-center animate-fade-in-up">
        <h1
          className="font-serif font-semibold tracking-[0.18em] text-[#3E3A36] text-3xl sm:text-5xl md:text-6xl lg:text-7xl transition-all duration-700"
          style={{ letterSpacing: '0.18em' }}
        >
          Memoria Lucenera
        </h1>

        {/* Divisor delicado */}
        <div
          className="mt-6 sm:mt-8 h-[1px] w-16 sm:w-20 bg-[#C9A96A] opacity-75"
          aria-hidden="true"
        />

        {/* Subtítulo sutil opcional conforme especificação */}
        <p className="mt-4 font-serif text-xs sm:text-sm tracking-[0.25em] text-[#8A8378] uppercase">
          Nossa história começa aqui
        </p>
      </main>

      {/* Rodapé discreto */}
      <footer className="absolute bottom-6 text-center">
        <span className="font-serif text-[11px] tracking-[0.15em] text-[#8A8378]/70">
          © {new Date().getFullYear()} Memoria Lucenera
        </span>
      </footer>
    </div>
  )
}
