import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRight,
  faArrowTrendUp,
  faUsersSlash,
  faSackDollar,
  faClock,
  faFaceAngry,
  faTriangleExclamation,
  faPersonCircleExclamation,
  faMobileScreenButton,
  faQrcode,
  faCirclePlus,
  faListCheck,
  faDesktop,
  faPrint,
  faTv,
  faTrophy,
  faRankingStar,
  faRobot,
  faBullseye,
  faEye,
  faCheck,
  faPlus,
  faMinus,
  faPhone,
  faStore,
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import './hello.css';

const LOGIN_URL = 'https://srservi2.srautomatic.com/login';
const IMG = '/Hogar_files/';
const PHONE = '+56996876043';
const WHATSAPP = 'https://wa.me/56996876043';

const stats = [
  { value: '24%', label: 'Aumenta las ventas', icon: faArrowTrendUp },
  { value: '55%', label: 'Disminuye las filas', icon: faUsersSlash },
  { value: '25%', label: 'Reduce costos operacionales', icon: faSackDollar },
];

const problems = [
  { icon: faClock, text: 'Filas eternas que enloquecen al personal' },
  { icon: faFaceAngry, text: 'Clientes enojados' },
  { icon: faTriangleExclamation, text: 'Pedidos mal ingresados' },
  { icon: faPersonCircleExclamation, text: 'Personal saturado' },
];

const solutions = [
  'Facilita que los clientes compren mediante un tótem o directamente desde el celular con un QR.',
  'Los clientes pueden esperar tranquilamente después de efectuar el pago.',
  'Los pedidos los crea directamente el cliente, seleccionando exactamente lo que desea y agregando extras sin presiones.',
  'El personal de caja ahora se convierte en un productor más, descongestionando y volviendo dinámico el proceso.',
];

const clientSteps = [
  { n: '01', title: 'Selecciona productos', img: `${IMG}Proyecto-nuevo-93-.jpg` },
  { n: '02', title: 'Elige los tipos', img: `${IMG}Proyecto-nuevo-92--1-.jpg` },
  { n: '03', title: 'Selecciona agregados', img: `${IMG}Proyecto-nuevo-94--1-.jpg` },
  { n: '04', title: 'Verifica y paga', img: `${IMG}Proyecto-nuevo-96--1-.jpg` },
];

const vendorSteps = [
  { icon: faDesktop, title: 'Pantalla de pedidos', desc: 'El detalle completo del pedido llega al panel del vendedor en tiempo real.', img: `${IMG}Proyecto-nuevo-31-.png` },
  { icon: faPrint, title: 'Mini impresora', desc: 'Se imprime automáticamente el pedido en una impresora bluetooth básica.', img: `${IMG}Proyecto-nuevo-30-.png` },
  { icon: faTv, title: 'TV de pedidos', desc: 'El número de orden aparece en pantalla para que el cliente siga su estado.', img: `${IMG}Proyecto-nuevo-32-.png` },
];

const purpose = [
  { icon: faTrophy, title: 'Ayudar a ser mejor', img: `${IMG}Proyecto-nuevo-28-.png` },
  { icon: faRankingStar, title: 'Ayudar a liderar', img: `${IMG}Proyecto-nuevo-27-.png` },
  { icon: faRobot, title: 'Ayudar en la automatización', img: `${IMG}Proyecto-nuevo-29-.png` },
];

const partners = [
  { name: 'SERCOTEC', img: `${IMG}Proyecto-nuevo---2026-01-18T194759-968.jpg` },
  { name: 'SR Digital', img: `${IMG}Proyecto-nuevo---2026-01-18T195058-512.jpg` },
  { name: 'Frut', img: `${IMG}Proyecto-nuevo---2026-01-18T195156-232.jpg` },
];

const faqs = [
  {
    q: '¿Para quién va dirigido nuestro software de autoatención?',
    a: 'SRservi está desarrollado para el segmento gastronómico, en especial para restaurantes de comida rápida, cafeterías, heladerías y comedores que tienen como canal principal su local físico.',
  },
  {
    q: '¿Cómo llega la orden a la cocina y se imprime la boleta?',
    a: 'Cuando se realiza el pago, el sistema emite inmediatamente una boleta, envía al vendedor el detalle del pedido, lo imprime en una impresora bluetooth básica y muestra el número de orden en pantalla para que el cliente vea en qué proceso está su pedido.',
  },
  {
    q: '¿Debo pagar una suscripción mensual?',
    a: 'Solo si compras la tablet con todos los aparatos. Si quieres usar solo el sistema y encargarte tú del resto, es completamente gratis.',
  },
  {
    q: '¿Qué necesitas para activar nuestro tótem de autoatención?',
    a: 'Necesitas una tablet básica, un POS y, opcionalmente, una impresora bluetooth básica.',
  },
  {
    q: '¿SRservi funciona con mi sistema de ventas o puede operar de forma independiente?',
    a: 'El sistema SRservi es un sistema de ventas completamente independiente.',
  },
  {
    q: '¿Qué tamaño de tótem necesito para mi local?',
    a: 'Se adapta a cualquier pantalla de Android o Windows.',
  },
  {
    q: '¿Se puede pagar con efectivo en los tótems?',
    a: 'Sí. Existe la opción de registrar efectivo: al momento de pagar en efectivo, al cliente le saldrá una etiqueta con un código que deberá entregar al vendedor para recibir el dinero.',
  },
  {
    q: '¿Cuáles son los requisitos para implementar SRservi en mi restaurante?',
    a: 'Principalmente un enchufe cerca, internet WiFi y un lugar visible donde colocar el tótem. Los equipos los puedes comprar con nosotros o donde prefieras; adaptamos el sistema a las tablets más básicas del mercado para reducir al máximo los costos.',
  },
  {
    q: '¿Los equipos vienen con la máquina de pago?',
    a: 'Puedes comprar con nosotros los POS de pago o utilizar los que ya tienes, siempre que sean de las empresas que ya hemos vinculado.',
  },
  {
    q: '¿Cuántos productos se pueden cargar en la plataforma?',
    a: 'Puedes adaptarlo a la cantidad que quieras.',
  },
  {
    q: '¿SRservi se encarga de tomar las fotos del menú?',
    a: 'Actualmente no realizamos ese servicio, pero puedes cargar las fotos que estimes conveniente. Es muy simple.',
  },
];

function CTAButton({ className = '', children = 'Comenzar ahora' }) {
  return (
    <a
      href={LOGIN_URL}
      className={`group inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-gold to-gold-dark px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-ink shadow-lg shadow-gold/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gold/30 ${className}`}
    >
      {children}
      <FontAwesomeIcon icon={faArrowRight} className="transition-transform group-hover:translate-x-1" />
    </a>
  );
}

function SectionTitle({ eyebrow, title, subtitle, light = false }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      {eyebrow && (
        <span className="mb-3 inline-block rounded-full border border-gold/40 bg-gold/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-gold">
          {eyebrow}
        </span>
      )}
      <h2 className={`text-3xl font-extrabold leading-tight sm:text-4xl ${light ? 'text-ink' : 'text-white'}`}>
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-4 text-base ${light ? 'text-gray-600' : 'text-white/60'}`}>{subtitle}</p>
      )}
    </div>
  );
}

function Faq({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-panel transition-colors ${
        open ? 'border-gold/50' : 'border-white/10 hover:border-white/25'
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className={`text-base font-semibold ${open ? 'text-gold' : 'text-white'}`}>{q}</span>
        <span
          className={`flex h-8 w-8 flex-none items-center justify-center rounded-full transition-colors ${
            open ? 'bg-gold text-ink' : 'bg-white/10 text-gold'
          }`}
        >
          <FontAwesomeIcon icon={open ? faMinus : faPlus} className="text-sm" />
        </span>
      </button>
      <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <p className="mx-6 mb-6 border-t border-white/10 pt-4 text-sm leading-relaxed text-gray-300">
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Hello() {
  return (
    <div className="hello-page min-h-screen bg-ink text-white antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-ink/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-gold-dark text-ink">
              <FontAwesomeIcon icon={faStore} />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-white">
              SR<span className="text-gold">servi</span>
            </span>
          </div>
          <CTAButton className="px-5 py-2.5 text-xs">Comenzar</CTAButton>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-gold/20 blur-[120px]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-2 md:py-28">
          <div className="animate-fadeup text-center md:text-left">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold">
              <FontAwesomeIcon icon={faQrcode} /> Autoservicio inteligente
            </span>
            <h1 className="text-4xl font-extrabold leading-[1.1] sm:text-5xl lg:text-6xl">
              El sistema de autoservicio más{' '}
              <span className="bg-gradient-to-r from-gold-light to-gold bg-clip-text text-transparent">
                simple, robusto y gratis
              </span>{' '}
              del mercado
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-lg text-white/60 md:mx-0">
              Tótem y menú por QR para restaurantes, cafeterías y heladerías. Menos filas,
              menos errores y más ventas.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row md:justify-start">
              <CTAButton>Comenzar</CTAButton>
              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition-colors hover:text-gold"
              >
                Ver cómo funciona <FontAwesomeIcon icon={faArrowRight} />
              </a>
            </div>
          </div>
          <div className="relative flex justify-center">
            <div className="absolute inset-0 m-auto h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
            <div className="animate-floaty relative flex h-72 w-72 items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur sm:h-80 sm:w-80">
              <img src={`${IMG}Proyecto-nuevo-33-.png`} alt="Tótem de autoservicio SRservi" className="w-full object-contain invert" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-14 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
              <span className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-gold/15 text-2xl text-gold">
                <FontAwesomeIcon icon={s.icon} />
              </span>
              <div>
                <div className="text-3xl font-extrabold text-white">{s.value}</div>
                <div className="text-sm text-white/60">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Problemas + soluciones */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <SectionTitle
          eyebrow="El problema"
          title="Problemas que solucionamos"
          subtitle="La atención tradicional en caja genera cuellos de botella. SRservi los elimina."
        />
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            {problems.map((p) => (
              <div key={p.text} className="flex items-center gap-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-red-500/15 text-red-400">
                  <FontAwesomeIcon icon={p.icon} />
                </span>
                <span className="text-sm font-medium text-white/80">{p.text}</span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/10 to-transparent p-7">
            <h3 className="mb-5 text-lg font-bold text-gold">Cómo lo resolvemos</h3>
            <ul className="space-y-4">
              {solutions.map((s) => (
                <li key={s} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gold text-xs text-ink">
                    <FontAwesomeIcon icon={faCheck} />
                  </span>
                  <span className="text-sm leading-relaxed text-white/75">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Cómo funciona para el cliente */}
      <section id="como-funciona" className="border-y border-white/10 bg-white/[0.02] py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <SectionTitle
            eyebrow="Para el cliente"
            title="Diseñado para pagar en la menor cantidad de clics"
            subtitle="Una experiencia intuitiva que cualquiera puede usar sin ayuda."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {clientSteps.map((step) => (
              <div key={step.n} className="group overflow-hidden rounded-2xl border border-white/10 bg-panel transition-all hover:-translate-y-1 hover:border-gold/40">
                <div className="relative overflow-hidden bg-black">
                  <img src={step.img} alt={step.title} className="h-64 w-full object-cover object-top transition-transform duration-500 group-hover:scale-105" />
                  <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-sm font-extrabold text-ink">
                    {step.n}
                  </span>
                </div>
                <div className="p-5 text-center">
                  <h3 className="text-base font-bold text-white">{step.title}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona para el vendedor */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <SectionTitle
          eyebrow="Para el vendedor"
          title="Cuando el cliente paga, llegan 3 notificaciones"
          subtitle="Todo el equipo se entera al instante, sin margen de error."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {vendorSteps.map((v) => (
            <div key={v.title} className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
              <div className="mb-5 flex h-32 w-32 items-center justify-center rounded-2xl bg-white p-5">
                <img src={v.img} alt={v.title} className="max-h-full object-contain" />
              </div>
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold">
                <FontAwesomeIcon icon={v.icon} />
              </span>
              <h3 className="text-lg font-bold text-white">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Propósito */}
      <section className="relative overflow-hidden border-y border-white/10 bg-white/[0.02] py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <SectionTitle
            eyebrow="Nuestro propósito"
            title="Llevamos más de 10 años emprendiendo"
            subtitle="Sabemos lo difícil que es. Queremos que toda empresa, pequeña o grande, llegue al siguiente nivel."
          />
          <div className="mb-14 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/10 to-transparent p-7">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold">
                <FontAwesomeIcon icon={faBullseye} />
              </span>
              <h3 className="mb-2 text-lg font-bold text-white">Misión</h3>
              <p className="text-sm leading-relaxed text-white/65">
                Automatizar al máximo todos los procesos de una empresa.
              </p>
            </div>
            <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/10 to-transparent p-7">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold">
                <FontAwesomeIcon icon={faEye} />
              </span>
              <h3 className="mb-2 text-lg font-bold text-white">Visión</h3>
              <p className="text-sm leading-relaxed text-white/65">
                Que todo negocio, grande o pequeño, utilice el sistema SRservi en el mundo.
              </p>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {purpose.map((p) => (
              <div key={p.title} className="flex flex-col items-center rounded-2xl border border-white/10 bg-panel p-8 text-center">
                <div className="mb-5 flex h-28 w-28 items-center justify-center rounded-2xl bg-white p-4">
                  <img src={p.img} alt={p.title} className="max-h-full object-contain" />
                </div>
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <FontAwesomeIcon icon={p.icon} />
                </span>
                <h3 className="text-base font-bold text-white">{p.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-20 md:py-28">
        <SectionTitle eyebrow="Dudas" title="Preguntas frecuentes" />
        <div className="space-y-3">
          {faqs.map((f) => (
            <Faq key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* Partners */}
      <section className="border-y border-white/10 bg-white/[0.02] py-16">
        <div className="mx-auto max-w-6xl px-5">
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-white/40">
            Empresas asociadas
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {partners.map((p) => (
              <div key={p.name} className="flex h-20 w-40 items-center justify-center rounded-xl bg-white p-4 grayscale transition-all hover:grayscale-0">
                <img src={p.img} alt={p.name} className="max-h-full max-w-full object-contain" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/15 via-panel to-ink p-10 text-center md:p-16">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl font-extrabold sm:text-4xl">
              Empieza gratis hoy mismo
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/65">
              Crea tu tótem de autoatención en minutos. Sin costos ocultos, sin suscripción obligatoria.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <CTAButton>Comenzar</CTAButton>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-bold text-white transition-colors hover:border-gold/40 hover:text-gold"
              >
                <FontAwesomeIcon icon={faWhatsapp} className="text-lg" /> Contáctanos
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-ink">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 py-10 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-gold-dark text-ink">
              <FontAwesomeIcon icon={faStore} />
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              SR<span className="text-gold">servi</span>
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/60">
            <a href={`tel:${PHONE}`} className="flex items-center gap-2 transition-colors hover:text-gold">
              <FontAwesomeIcon icon={faPhone} /> {PHONE}
            </a>
            <a href={WHATSAPP} target="_blank" rel="noreferrer" className="flex items-center gap-2 transition-colors hover:text-gold">
              <FontAwesomeIcon icon={faWhatsapp} /> WhatsApp
            </a>
          </div>
        </div>
        <div className="border-t border-white/5 py-5 text-center text-xs text-white/30">
          © {new Date().getFullYear()} SRservi · Automatización para tu negocio
        </div>
      </footer>
    </div>
  );
}
