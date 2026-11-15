import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';
import { PageLoader } from '@/components/ui/Spinner';
import { ToastProvider } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { SyncProvider } from '@/hooks/useSync';
import DashboardPage from '@/pages/DashboardPage';

// Las pantallas secundarias se cargan bajo demanda para que el inicio sea rápido.
const AddHubPage = lazy(() => import('@/pages/AddHubPage'));
const PhotoPage = lazy(() => import('@/pages/PhotoPage'));
const ManualAddPage = lazy(() => import('@/pages/ManualAddPage'));
const BarcodePage = lazy(() => import('@/pages/BarcodePage'));
const MealEditPage = lazy(() => import('@/pages/MealEditPage'));
const CustomFoodPage = lazy(() => import('@/pages/CustomFoodPage'));
const DiaryPage = lazy(() => import('@/pages/DiaryPage'));
const StatsPage = lazy(() => import('@/pages/StatsPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const InstallPage = lazy(() => import('@/pages/InstallPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

/**
 * Se usa HashRouter (#/ruta) para que funcione en GitHub Pages sin
 * configuración de servidor y al recargar cualquier pantalla.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <SyncProvider>
            <HashRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route element={<AppShell />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="anadir" element={<AddHubPage />} />
                    <Route path="foto" element={<PhotoPage />} />
                    <Route path="registrar" element={<ManualAddPage />} />
                    <Route path="escaner" element={<BarcodePage />} />
                    <Route path="comida/:id" element={<MealEditPage />} />
                    <Route path="alimento/nuevo" element={<CustomFoodPage />} />
                    <Route path="diario" element={<DiaryPage />} />
                    <Route path="estadisticas" element={<StatsPage />} />
                    <Route path="perfil" element={<ProfilePage />} />
                    <Route path="ajustes" element={<SettingsPage />} />
                    <Route path="instalar" element={<InstallPage />} />
                    <Route path="privacidad" element={<PrivacyPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Routes>
              </Suspense>
            </HashRouter>
          </SyncProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
