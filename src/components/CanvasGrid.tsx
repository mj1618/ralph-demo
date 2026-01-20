import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'

type GridSelection = {
  row: number
  col: number
}

const GRID_CONFIG = {
  rows: 1000,
  cols: 200,
  cellWidth: 120,
  cellHeight: 32,
}

const GRID_STYLES = {
  gridLine: '#e2e8f0',
  selectionFill: 'rgba(37, 99, 235, 0.12)',
  selectionBorder: '#2563eb',
  background: '#ffffff',
}

const TEXT_STYLES = {
  color: '#1e293b',
  font: '14px "Inter", system-ui, sans-serif',
  paddingX: 8,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getVisibleRange(
  scrollOffset: number,
  viewportSize: number,
  cellSize: number,
  maxIndex: number,
) {
  const start = clamp(Math.floor(scrollOffset / cellSize), 0, maxIndex)
  const end = clamp(Math.ceil((scrollOffset + viewportSize) / cellSize), 0, maxIndex)
  return { start, end }
}

function getCellKey(row: number, col: number) {
  return `${row}:${col}`
}

export default function CanvasGrid() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<HTMLInputElement | null>(null)
  const selectionRef = useRef<GridSelection>({ row: 0, col: 0 })
  const cellValuesRef = useRef<Map<string, string>>(new Map())
  const frameRef = useRef<number | null>(null)
  const [selection, setSelection] = useState<GridSelection>({ row: 0, col: 0 })
  const [editingCell, setEditingCell] = useState<GridSelection | null>(null)
  const [draftValue, setDraftValue] = useState('')
  const [scrollState, setScrollState] = useState({ left: 0, top: 0 })

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { clientWidth, clientHeight, scrollLeft, scrollTop } = container
    const dpr = window.devicePixelRatio || 1

    const targetWidth = Math.max(clientWidth, 1)
    const targetHeight = Math.max(clientHeight, 1)
    const scaledWidth = Math.floor(targetWidth * dpr)
    const scaledHeight = Math.floor(targetHeight * dpr)

    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
      canvas.width = scaledWidth
      canvas.height = scaledHeight
      canvas.style.width = `${targetWidth}px`
      canvas.style.height = `${targetHeight}px`
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, targetWidth, targetHeight)
    ctx.fillStyle = GRID_STYLES.background
    ctx.fillRect(0, 0, targetWidth, targetHeight)

    const visibleCols = getVisibleRange(
      scrollLeft,
      targetWidth,
      GRID_CONFIG.cellWidth,
      GRID_CONFIG.cols - 1,
    )
    const visibleRows = getVisibleRange(
      scrollTop,
      targetHeight,
      GRID_CONFIG.cellHeight,
      GRID_CONFIG.rows - 1,
    )

    const offsetX = -scrollLeft
    const offsetY = -scrollTop

    ctx.beginPath()
    ctx.strokeStyle = GRID_STYLES.gridLine
    ctx.lineWidth = 1

    for (let col = visibleCols.start; col <= visibleCols.end + 1; col += 1) {
      const x = col * GRID_CONFIG.cellWidth + offsetX
      ctx.moveTo(x, offsetY + visibleRows.start * GRID_CONFIG.cellHeight)
      ctx.lineTo(x, offsetY + (visibleRows.end + 1) * GRID_CONFIG.cellHeight)
    }

    for (let row = visibleRows.start; row <= visibleRows.end + 1; row += 1) {
      const y = row * GRID_CONFIG.cellHeight + offsetY
      ctx.moveTo(offsetX + visibleCols.start * GRID_CONFIG.cellWidth, y)
      ctx.lineTo(offsetX + (visibleCols.end + 1) * GRID_CONFIG.cellWidth, y)
    }

    ctx.stroke()

    const activeSelection = selectionRef.current
    if (activeSelection) {
      const selX = activeSelection.col * GRID_CONFIG.cellWidth + offsetX
      const selY = activeSelection.row * GRID_CONFIG.cellHeight + offsetY

      if (
        selX + GRID_CONFIG.cellWidth >= 0 &&
        selY + GRID_CONFIG.cellHeight >= 0 &&
        selX <= targetWidth &&
        selY <= targetHeight
      ) {
        ctx.fillStyle = GRID_STYLES.selectionFill
        ctx.fillRect(selX, selY, GRID_CONFIG.cellWidth, GRID_CONFIG.cellHeight)
        ctx.strokeStyle = GRID_STYLES.selectionBorder
        ctx.lineWidth = 2
        ctx.strokeRect(selX, selY, GRID_CONFIG.cellWidth, GRID_CONFIG.cellHeight)
      }
    }

    ctx.font = TEXT_STYLES.font
    ctx.fillStyle = TEXT_STYLES.color
    ctx.textBaseline = 'middle'

    for (let row = visibleRows.start; row <= visibleRows.end; row += 1) {
      for (let col = visibleCols.start; col <= visibleCols.end; col += 1) {
        const value = cellValuesRef.current.get(getCellKey(row, col))
        if (!value) continue

        const textX = col * GRID_CONFIG.cellWidth + offsetX + TEXT_STYLES.paddingX
        const textY = row * GRID_CONFIG.cellHeight + offsetY + GRID_CONFIG.cellHeight / 2
        ctx.fillText(value, textX, textY, GRID_CONFIG.cellWidth - TEXT_STYLES.paddingX * 2)
      }
    }
  }, [])

  const scheduleDraw = useCallback(() => {
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      draw()
    })
  }, [draw])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      setScrollState({ left: container.scrollLeft, top: container.scrollTop })
      scheduleDraw()
    }
    const resizeObserver = new ResizeObserver(() => scheduleDraw())

    container.addEventListener('scroll', handleScroll, { passive: true })
    resizeObserver.observe(container)
    setScrollState({ left: container.scrollLeft, top: container.scrollTop })
    scheduleDraw()

    return () => {
      container.removeEventListener('scroll', handleScroll)
      resizeObserver.disconnect()
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [scheduleDraw])

  useEffect(() => {
    selectionRef.current = selection
    scheduleDraw()
  }, [selection, scheduleDraw])

  useEffect(() => {
    if (!editingCell) return
    const handle = window.requestAnimationFrame(() => editorRef.current?.focus())
    return () => window.cancelAnimationFrame(handle)
  }, [editingCell])

  const beginEdit = useCallback((cell: GridSelection) => {
    const currentValue = cellValuesRef.current.get(getCellKey(cell.row, cell.col)) ?? ''
    setEditingCell(cell)
    setDraftValue(currentValue)
  }, [])

  const commitEdit = useCallback(() => {
    if (!editingCell) return
    const key = getCellKey(editingCell.row, editingCell.col)
    if (draftValue === '') {
      cellValuesRef.current.delete(key)
    } else {
      cellValuesRef.current.set(key, draftValue)
    }
    setEditingCell(null)
    scheduleDraw()
  }, [draftValue, editingCell, scheduleDraw])

  const cancelEdit = useCallback(() => {
    setEditingCell(null)
    setDraftValue('')
    scheduleDraw()
  }, [scheduleDraw])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const x = event.clientX - rect.left + container.scrollLeft
    const y = event.clientY - rect.top + container.scrollTop

    const col = clamp(Math.floor(x / GRID_CONFIG.cellWidth), 0, GRID_CONFIG.cols - 1)
    const row = clamp(Math.floor(y / GRID_CONFIG.cellHeight), 0, GRID_CONFIG.rows - 1)

    if (editingCell) {
      commitEdit()
    }

    setSelection({ row, col })
    container.focus()
  }

  const handleDoubleClick = (event: PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const x = event.clientX - rect.left + container.scrollLeft
    const y = event.clientY - rect.top + container.scrollTop

    const col = clamp(Math.floor(x / GRID_CONFIG.cellWidth), 0, GRID_CONFIG.cols - 1)
    const row = clamp(Math.floor(y / GRID_CONFIG.cellHeight), 0, GRID_CONFIG.rows - 1)

    setSelection({ row, col })
    beginEdit({ row, col })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (editingCell) {
        commitEdit()
      } else {
        beginEdit(selection)
      }
    }
    if (event.key === 'Escape' && editingCell) {
      event.preventDefault()
      cancelEdit()
    }
  }

  const totalWidth = GRID_CONFIG.cols * GRID_CONFIG.cellWidth
  const totalHeight = GRID_CONFIG.rows * GRID_CONFIG.cellHeight

  return (
    <div className="grid-shell">
      <div
        className="grid-scroll-container"
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="presentation"
      >
        <div
          className="grid-scroll-spacer"
          style={{ width: totalWidth, height: totalHeight }}
        />
      </div>
      <canvas className="grid-canvas" ref={canvasRef} />
      {editingCell ? (
        <input
          ref={editorRef}
          className="cell-editor"
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          onBlur={commitEdit}
          style={{
            width: GRID_CONFIG.cellWidth,
            height: GRID_CONFIG.cellHeight,
            left: editingCell.col * GRID_CONFIG.cellWidth - scrollState.left,
            top: editingCell.row * GRID_CONFIG.cellHeight - scrollState.top,
          }}
        />
      ) : null}
    </div>
  )
}
