import { Component, type ErrorInfo, type ReactNode } from 'react'

// MERK: ErrorBoundary må være en klasse — React har ingen hook for dette ennå.
// Eneste tillatte unntak fra "kun funksjonelle komponenter". Fanger render-feil
// så appen viser en redningsskjerm i stedet for hvit skjerm midt på sjøen.

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message }
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('App-krasj fanget av ErrorBoundary:', err, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="crash-screen">
        <div className="crash-card">
          <div className="crash-title">⚠ Noe gikk galt</div>
          <p className="crash-text">
            Appen støtte på en uventet feil. Posisjon, spor og merker er trygt lagret.
          </p>
          <button className="crash-btn" onClick={() => window.location.reload()}>
            Start appen på nytt
          </button>
          {this.state.message && <p className="crash-detail">{this.state.message}</p>}
        </div>
      </div>
    )
  }
}
