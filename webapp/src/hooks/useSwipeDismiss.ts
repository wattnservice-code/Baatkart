import { useRef } from 'react'

export function useSwipeDismiss(onDismiss: () => void, threshold = 80) {
  const startY = useRef<number | null>(null)
  return {
    onTouchStart: (e: React.TouchEvent) => { startY.current = e.touches[0].clientY },
    onTouchEnd:   (e: React.TouchEvent) => {
      if (startY.current === null) return
      if (e.changedTouches[0].clientY - startY.current > threshold) onDismiss()
      startY.current = null
    },
  }
}
