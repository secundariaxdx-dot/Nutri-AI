import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Plus, WifiOff } from 'lucide-react';
import { useOnline } from '@/hooks/useOnline';
import { NAV_ITEMS } from './navItems';
import { Logo } from './Logo';
import { UpdatePrompt } from './UpdatePrompt';
import { SyncStatusBadge } from './SyncStatusBadge';

const MOBILE_NAV = [NAV_ITEMS[0], NAV_ITEMS[1], null, NAV_ITEMS[2], NAV_ITEMS[3]] as const;

export function AppShell() {
  const online = useOnline();
  const navigate = useNavigate();
  const location = useLocation();
  const hideMobileNav = /^\/(foto|escaner|registrar|comida\/)/.test(location.pathname);

  return (
    <div className="min-h-screen lg:flex">
      {/* Navegación lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-100 bg-white/70 px-4 py-6 backdrop-blur lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <button className="btn-primary mt-8 w-full" onClick={() => navigate('/anadir')}>
          <Plus className="h-5 w-5" /> Registrar comida
        </button>
        <nav className="mt-6 flex flex-col gap-1" aria-label="Principal">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-medium transition ${
                  isActive ? 'bg-brand-50 text-brand-900' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                }`
              }
            >
              <Icon className="h-5 w-5" strokeWidth={1.9} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3 px-2">
          <SyncStatusBadge />
          <p className="text-xs leading-relaxed text-ink-400">Tus datos se guardan en este dispositivo. Sin anuncios ni suscripciones.</p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {!online && (
          <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-ink-900 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+8px)] text-xs font-medium text-white">
            <WifiOff className="h-3.5 w-3.5" /> Sin conexión · puedes seguir registrando comidas
          </div>
        )}
        <main className={`mx-auto w-full max-w-3xl px-4 pt-[calc(env(safe-area-inset-top)+12px)] sm:px-6 lg:max-w-5xl lg:px-10 lg:pt-8 ${hideMobileNav ? 'pb-10' : 'pb-32 lg:pb-12'}`}>
          <Outlet />
        </main>
      </div>

      {/* Navegación inferior (móvil) */}
      {!hideMobileNav && (
        <nav
          aria-label="Principal"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-100 bg-white/90 pb-safe backdrop-blur-xl lg:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2">
            {MOBILE_NAV.map((item) =>
              item === null ? (
                <div key="fab" className="flex justify-center">
                  <button
                    aria-label="Registrar comida"
                    onClick={() => navigate('/anadir')}
                    className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-900 text-white shadow-lift ring-4 ring-white transition active:scale-95"
                  >
                    <Plus className="h-7 w-7" strokeWidth={2.4} />
                  </button>
                </div>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${isActive ? 'text-brand-800' : 'text-ink-400'}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className="h-6 w-6" strokeWidth={isActive ? 2.3 : 1.8} />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ),
            )}
          </div>
        </nav>
      )}
      <UpdatePrompt />
    </div>
  );
}
