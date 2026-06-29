import { X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useSwipeDismiss } from '../hooks/useSwipeDismiss'
import guide from '../content/bruksanvisning.md?raw'

interface Props { onClose: () => void }

export default function InfoPanel({ onClose }: Props) {
  const swipe = useSwipeDismiss(onClose)
  return (
    <div className="settings-sheet">
      <div className="settings-head" {...swipe}>
        <span className="settings-title">Bruksanvisning og forbehold</span>
        <button className="settings-close" onClick={onClose}><X size={20} /></button>
      </div>

      <div className="settings-body info-body">
        <div className="info-md">
          <ReactMarkdown
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener">{children}</a>
              ),
            }}
          >
            {guide}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
