import { useRef } from 'react'

export function useSwipeDismiss(onDismiss: () => void, threshold = 80) {
  const startY = useRef<number | null>(null)
  const startX = useRef<number | null>(null)
  return {
    onTouchStart: (e: React.TouchEvent) => {
      startY.current = e.touches[0].clientY
      startX.current = e.touches[0].clientX
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (startY.current === null || startX.current === null) return
      const dy = e.changedTouches[0].clientY - startY.current
      const dx = Math.abs(e.changedTouches[0].clientX - startX.current)
      // Only dismiss on a predominantly downward vertical swipe
      if (dy > threshold && dy > dx * 1.5) onDismiss()
      startY.current = null
      startX.current = null
    },
  }
}
