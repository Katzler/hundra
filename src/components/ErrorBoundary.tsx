import { STORAGE_KEY } from '../store/useStore'
import { Component, type ReactNode } from 'react'

type State = { error: Error | null }

/** Om något kraschar ska man aldrig fastna på en vit skärm – och alltid kunna rädda sin data. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  saveBackup = () => {
    // Läser lagringen direkt, så att det fungerar även om appens egen kod är det som kraschat.
    const raw = localStorage.getItem(STORAGE_KEY) ?? '{}'
    let data: unknown = {}
    try {
      data = JSON.parse(raw).state
    } catch {
      data = { raw }
    }
    const text = JSON.stringify({ app: 'hundra', version: 1, exportedAt: new Date().toISOString(), data }, null, 2)
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'hundra-backup.json'
    a.click()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="screen crash">
        <h1 className="step-title">Något gick fel</h1>
        <p className="step-text">Din data finns kvar på telefonen. Spara en backup för säkerhets skull och försök sedan igen.</p>
        <button type="button" className="primary-btn" onClick={this.saveBackup}>
          Spara backup
        </button>
        <button type="button" className="secondary-btn" onClick={() => location.reload()}>
          Försök igen
        </button>
        <p className="hint-text">{this.state.error.message}</p>
      </main>
    )
  }
}
