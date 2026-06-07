import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function useAppUpdate() {
  const [showPrompt, setShowPrompt] = useState(false)

  const { updateServiceWorker } = useRegisterSW({
    onNeedRefresh() {
      setShowPrompt(true)
    },
  })

  return { showPrompt, update: () => updateServiceWorker(true) }
}
