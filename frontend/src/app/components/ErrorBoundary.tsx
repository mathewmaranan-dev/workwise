import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application error boundary captured an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
          <div className="max-w-xl w-full rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Application error</p>
            <h1 className="mt-3 text-3xl font-bold">Something went wrong</h1>
            <p className="mt-3 text-slate-300">
              The dashboard hit an unexpected error while rendering. You can refresh to try again, or continue using the rest of the app.
            </p>
            <div className="mt-5 rounded-xl bg-slate-800 px-4 py-3 text-sm text-slate-200">
              <p className="font-semibold text-white">Error details</p>
              <p className="mt-1 wrap-break-word">{this.state.error?.message ?? 'Unknown rendering error'}</p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={this.handleReload}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
              >
                Refresh page
              </button>
              <a
                href="/dashboard"
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Go to dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
