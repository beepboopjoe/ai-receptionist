'use client';
// ============================================================
// ErrorBoundary — top-level catch for unexpected render errors.
// Mounted in (app)/layout.tsx so a thrown error in any page
// surfaces a friendly recovery card instead of a blank screen.
// ============================================================
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message ?? 'Unknown error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to the console so the dev sees the stack; in production this is
    // where you'd ship to Sentry/PostHog.
    console.error('[ErrorBoundary]', error, info);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, message: '' });
  };

  handleReload = (): void => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="card p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-amber-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Something went wrong</h2>
          <p className="text-sm text-gray-500 mb-5">
            We hit an unexpected error rendering this page. Try reloading — if it persists, let us know.
          </p>
          {this.state.message && (
            <pre className="text-xs text-left bg-gray-50 border border-gray-100 rounded-lg p-3 mb-5 overflow-auto max-h-32 text-gray-600">
              {this.state.message}
            </pre>
          )}
          <div className="flex items-center justify-center gap-2">
            <button onClick={this.handleReset} className="btn-secondary text-sm">
              Try again
            </button>
            <button onClick={this.handleReload} className="btn-primary text-sm flex items-center gap-1.5">
              <RotateCcw size={14} /> Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
