import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ViewErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface ViewErrorBoundaryState {
  error: Error | null;
}

export class ViewErrorBoundary extends Component<ViewErrorBoundaryProps, ViewErrorBoundaryState> {
  state: ViewErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ViewErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(previousProps: ViewErrorBoundaryProps): void {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error renderizando la vista activa', error, info);
  }

  handleRetry = (): void => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <section className="empty-state workspace-empty" role="alert">
          <h2>No se ha podido mostrar esta vista</h2>
          <p>
            La vista encontro un valor inesperado al renderizar. Puedes reintentar o cambiar los filtros.
          </p>
          <div className="empty-actions">
            <button className="primary-button" type="button" onClick={this.handleRetry}>
              Reintentar vista
            </button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
