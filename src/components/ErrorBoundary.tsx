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

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 text-white p-4">
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <p className="text-lg mb-2">The game encountered an error and cannot continue.</p>
          <p className="text-sm text-gray-300 mb-4">Error: {this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
          >
            Reload Game
          </button>
          {import.meta.env.DEV && this.state.errorInfo && (
            <details className="mt-4 p-4 bg-gray-800 rounded-lg max-w-md overflow-auto max-h-60">
              <summary className="font-semibold cursor-pointer">Technical Details</summary>
              <pre className="text-xs text-gray-300 mt-2 whitespace-pre-wrap">
                {this.state.error?.stack}
                <br />
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
