import { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-950 text-amber-100 p-4 font-serif"
          role="alert"
          aria-labelledby="error-heading"
        >
          <div className="max-w-md w-full rounded-xl border border-red-900/40 bg-stone-900 p-8 text-center shadow-2xl">
            <h2 id="error-heading" className="text-2xl font-bold mb-4 text-red-400 tracking-wider">
              SOMETHING WENT WRONG
            </h2>
            <p className="text-sm text-stone-300 mb-6 leading-relaxed">
              The game encountered an unexpected error and cannot continue.
              The field has been lost to the void.
            </p>
            <p className="text-xs text-stone-500 mb-8 italic">
              Error: {this.state.error?.message}
            </p>
            <button
              onClick={this.handleReload}
              className="w-full px-6 py-3 bg-amber-600/20 hover:bg-amber-500/30 border-2 border-amber-300/70 rounded-full font-bold tracking-widest text-amber-100 transition-all focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-opacity-50"
            >
              RELOAD GAME
            </button>

            {import.meta.env.DEV && this.state.errorInfo && (
              <details className="mt-8 p-4 bg-black/40 rounded-lg text-left overflow-auto max-h-60 border border-stone-800">
                <summary className="text-xs font-semibold cursor-pointer text-stone-400 uppercase tracking-widest">
                  Technical Details
                </summary>
                <pre className="text-[10px] text-stone-500 mt-2 whitespace-pre-wrap font-mono">
                  {this.state.error?.stack}
                  <br />
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
