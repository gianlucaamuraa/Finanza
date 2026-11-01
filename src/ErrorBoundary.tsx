import { Component, type ReactNode } from "react";

/** Mostra un messaggio invece della pagina vuota se qualcosa va storto. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 20 }}>
        <div className="card" style={{ maxWidth: 460, borderColor: "#fecaca", background: "#fef2f2" }}>
          <div className="card-title" style={{ color: "var(--neg)" }}>Si è verificato un errore</div>
          <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#fff", padding: 10, borderRadius: 8, marginBottom: 12 }}>
            {this.state.error.message}
          </pre>
          <button type="button" className="btn" style={{ marginBottom: 0 }} onClick={() => location.reload()}>Ricarica</button>
        </div>
      </main>
    );
  }
}
