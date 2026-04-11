import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page">
          <h1 className="page-title">Ошибка</h1>
          <div className="card">
            <p style={{ color: 'var(--accent-red)' }}>{this.state.error}</p>
            <button
              className="btn btn-primary mt-16"
              onClick={() => {
                this.setState({ hasError: false, error: '' });
                window.location.href = '/';
              }}
            >
              На главную
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
