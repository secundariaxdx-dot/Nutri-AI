import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Evita la pantalla en blanco ante un error inesperado. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunk = /Loading chunk|dynamically imported module|Importing a module script failed/i.test(this.state.error.message);
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold">Algo ha salido mal</h1>
          <p className="mt-2 text-sm text-ink-600">
            {chunk ? 'Hay una nueva versión de la app o falta conexión para cargar esta pantalla.' : 'Se ha producido un error inesperado. Tus datos están a salvo.'}
          </p>
          <p className="mt-2 break-words text-xs text-ink-400">{this.state.error.message}</p>
          <button className="btn-primary mt-5 w-full" onClick={() => location.reload()}>
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
