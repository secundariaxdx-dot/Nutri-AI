import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';

const ITEMS: [string, string][] = [
  ['Tus datos se quedan en tu dispositivo', 'Comidas, fotos, perfil y objetivos se guardan en el almacenamiento local del navegador (IndexedDB). Nutri AI no tiene servidores propios ni cuentas obligatorias.'],
  ['Las fotos no salen del dispositivo', 'El reconocimiento de alimentos se ejecuta localmente con WebAssembly. Solo se descarga el modelo de IA desde Hugging Face (una vez); tu imagen nunca se envía.'],
  ['Consultas en línea mínimas', 'Al escanear un código o buscar en línea se envía únicamente el código o el texto buscado a Open Food Facts o USDA. No se envían datos personales.'],
  ['Sincronización opcional', 'Solo si la activas, tus comidas, perfil, alimentos personalizados y (si lo eliges) fotos se guardan en TU proyecto de Supabase, protegidos por tu cuenta y por reglas de acceso por usuario.'],
  ['Sin publicidad ni rastreo', 'No hay anuncios, analíticas, cookies de seguimiento ni venta de datos.'],
  ['Datos mínimos', 'Todos los datos del perfil son opcionales. El sexo fisiológico solo se usa para estimar el gasto energético y puedes no indicarlo.'],
  ['Control total', 'Puedes exportar todos tus datos en JSON y borrarlos por completo desde Ajustes en cualquier momento.'],
];

export default function PrivacyPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader title="Privacidad" back />
      <div className="card divide-y divide-ink-100">
        {ITEMS.map(([t, d]) => (
          <section key={t} className="p-5">
            <h2 className="font-semibold">{t}</h2>
            <p className="mt-1 text-sm text-ink-600">{d}</p>
          </section>
        ))}
      </div>
      <p className="mt-5 text-center text-sm">
        <Link to="/ajustes" className="font-medium text-brand-700">
          Ir a Ajustes para exportar o borrar datos
        </Link>
      </p>
    </div>
  );
}
