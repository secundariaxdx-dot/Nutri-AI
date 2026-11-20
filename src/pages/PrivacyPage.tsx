import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';

const ITEMS: [string, string][] = [
  ['Tus datos se quedan en tu dispositivo', 'Comidas, fotos, perfil y objetivos se guardan en el almacenamiento local del navegador (IndexedDB). Nutri AI no tiene servidores propios ni cuentas obligatorias.'],
  ['Fotos y proveedor de IA', 'Con el modelo local o el modo manual, la foto no sale de tu dispositivo. Si eliges Google Gemini (o Azure), la foto se envía a ese proveedor solo cuando pulsas «Analizar con IA». En el nivel gratuito de Gemini, Google puede usar las fotos y respuestas para mejorar sus productos y personas revisoras pueden verlas: no fotografíes caras, documentos ni datos personales. Nutri AI nunca envía la foto sin que tú lo pidas.'],
  ['Tu clave de API', 'La clave de Gemini o Azure se guarda solo en este navegador. No se incluye en las copias de seguridad, no se sincroniza, no se escribe en registros y se oculta en los mensajes de error. Puedes borrarla en Ajustes › Inteligencia artificial.'],
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
