import { useEffect, useRef } from 'react'
import './App.css'

type Player = {
  x: number
  y: number
  vx: number
  vy: number
}

type GameState = {
  viewWidth: number
  viewHeight: number
  cellSize: number
  gridWidth: number
  gridHeight: number
  walls: Uint8Array
  player: Player
  source: { x: number; y: number }
  volume: number
  radius: number
}

type AudioState = {
  ctx: AudioContext
  gain: GainNode
  source: AudioBufferSourceNode
}

const CELL_SIZE = 32
const MAX_SPEED = 6
const ACCEL = 28
const DRAG = 12
const VOLUME_RADIUS = 12

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function createRadioBuffer(ctx: AudioContext) {
  const seconds = 4
  const length = ctx.sampleRate * seconds
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < length; i += 1) {
    const t = i / ctx.sampleRate
    const isFirst = t < seconds / 2
    const chord = isFirst
      ? [261.63, 329.63, 392.0]
      : [196.0, 246.94, 392.0]
    const tone =
      Math.sin(2 * Math.PI * chord[0] * t) +
      Math.sin(2 * Math.PI * chord[1] * t) +
      Math.sin(2 * Math.PI * chord[2] * t)
    const wobble = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.35 * t)
    const noise = (Math.random() * 2 - 1) * 0.02
    data[i] = (tone / 3) * 0.35 * wobble + noise
  }

  return buffer
}

function generateWalls(
  gridWidth: number,
  gridHeight: number,
  spawn: { x: number; y: number },
  source: { x: number; y: number }
) {
  const walls = new Uint8Array(gridWidth * gridHeight)

  const setCell = (x: number, y: number, value: 0 | 1) => {
    if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) return
    walls[y * gridWidth + x] = value
  }

  for (let x = 0; x < gridWidth; x += 1) {
    setCell(x, 0, 1)
    setCell(x, gridHeight - 1, 1)
  }
  for (let y = 0; y < gridHeight; y += 1) {
    setCell(0, y, 1)
    setCell(gridWidth - 1, y, 1)
  }

  const rectCount = Math.max(6, Math.floor((gridWidth * gridHeight) / 350))
  for (let i = 0; i < rectCount; i += 1) {
    const w = randInt(2, Math.min(10, gridWidth - 3))
    const h = randInt(2, Math.min(8, gridHeight - 3))
    const x = randInt(1, gridWidth - w - 1)
    const y = randInt(1, gridHeight - h - 1)
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) {
        setCell(xx, yy, 1)
      }
    }
  }

  const clearArea = (cx: number, cy: number) => {
    for (let yy = cy - 1; yy <= cy + 1; yy += 1) {
      for (let xx = cx - 1; xx <= cx + 1; xx += 1) {
        setCell(xx, yy, 0)
      }
    }
  }

  clearArea(Math.floor(spawn.x), Math.floor(spawn.y))
  clearArea(Math.floor(source.x), Math.floor(source.y))

  return walls
}

function isBlocked(
  walls: Uint8Array,
  gridWidth: number,
  gridHeight: number,
  x: number,
  y: number
) {
  const cellX = Math.floor(x)
  const cellY = Math.floor(y)
  if (cellX < 0 || cellY < 0 || cellX >= gridWidth || cellY >= gridHeight) {
    return true
  }
  const index = cellY * gridWidth + cellX
  return walls[index] === 1
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState | null>(null)
  const audioRef = useRef<AudioState | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const keys = new Set<string>()

    const updateSize = () => {
      const viewWidth = Math.floor(window.visualViewport?.width ?? window.innerWidth)
      const viewHeight = Math.floor(window.visualViewport?.height ?? window.innerHeight)
      const dpr = window.devicePixelRatio || 1

      canvas.width = Math.floor(viewWidth * dpr)
      canvas.height = Math.floor(viewHeight * dpr)
      canvas.style.width = `${viewWidth}px`
      canvas.style.height = `${viewHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const gridWidth = Math.max(10, Math.ceil(viewWidth / CELL_SIZE))
      const gridHeight = Math.max(8, Math.ceil(viewHeight / CELL_SIZE))

      const previous = stateRef.current
      const player = previous?.player ?? { x: 2.5, y: 2.5, vx: 0, vy: 0 }
      const source = {
        x: Math.floor(gridWidth / 2) + 0.5,
        y: Math.floor(gridHeight / 2) + 0.5,
      }

      const walls = generateWalls(gridWidth, gridHeight, player, source)

      stateRef.current = {
        viewWidth,
        viewHeight,
        cellSize: CELL_SIZE,
        gridWidth,
        gridHeight,
        walls,
        player,
        source,
        volume: previous?.volume ?? 0,
        radius: VOLUME_RADIUS,
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      keys.add(event.key.toLowerCase())
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase())
    }

    const startAudio = async () => {
      if (!audioRef.current) {
        const audioCtx = new AudioContext()
        const gain = audioCtx.createGain()
        gain.gain.value = 0
        const source = audioCtx.createBufferSource()
        source.buffer = createRadioBuffer(audioCtx)
        source.loop = true
        source.connect(gain).connect(audioCtx.destination)
        source.start()
        audioRef.current = { ctx: audioCtx, gain, source }
      }

      if (audioRef.current.ctx.state !== 'running') {
        await audioRef.current.ctx.resume()
      }
    }

    const handlePointerDown = () => {
      void startAudio()
    }

    updateSize()

    window.addEventListener('resize', updateSize)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    canvas.addEventListener('pointerdown', handlePointerDown)

    let lastTime = performance.now()

    const tick = (time: number) => {
      const state = stateRef.current
      if (state) {
        const dt = Math.min(0.05, (time - lastTime) / 1000)
        lastTime = time

        const inputX =
          (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
          (keys.has('a') || keys.has('arrowleft') ? 1 : 0)
        const inputY =
          (keys.has('s') || keys.has('arrowdown') ? 1 : 0) -
          (keys.has('w') || keys.has('arrowup') ? 1 : 0)

        const length = Math.hypot(inputX, inputY)
        const dirX = length > 0 ? inputX / length : 0
        const dirY = length > 0 ? inputY / length : 0

        if (length > 0) {
          state.player.vx += dirX * ACCEL * dt
          state.player.vy += dirY * ACCEL * dt
        } else {
          state.player.vx -= state.player.vx * DRAG * dt
          state.player.vy -= state.player.vy * DRAG * dt
        }

        const speed = Math.hypot(state.player.vx, state.player.vy)
        if (speed > MAX_SPEED) {
          const scale = MAX_SPEED / speed
          state.player.vx *= scale
          state.player.vy *= scale
        }

        const nextX = state.player.x + state.player.vx * dt
        if (
          !isBlocked(
            state.walls,
            state.gridWidth,
            state.gridHeight,
            nextX,
            state.player.y
          )
        ) {
          state.player.x = nextX
        } else {
          state.player.vx = 0
        }

        const nextY = state.player.y + state.player.vy * dt
        if (
          !isBlocked(
            state.walls,
            state.gridWidth,
            state.gridHeight,
            state.player.x,
            nextY
          )
        ) {
          state.player.y = nextY
        } else {
          state.player.vy = 0
        }

        const dist =
          Math.abs(state.player.x - state.source.x) +
          Math.abs(state.player.y - state.source.y)
        state.volume = clamp(1 - dist / state.radius, 0, 1)

        if (audioRef.current && audioRef.current.ctx.state === 'running') {
          audioRef.current.gain.gain.setTargetAtTime(
            state.volume,
            audioRef.current.ctx.currentTime,
            0.05
          )
        }

        ctx.clearRect(0, 0, state.viewWidth, state.viewHeight)
        ctx.fillStyle = '#0b0e1a'
        ctx.fillRect(0, 0, state.viewWidth, state.viewHeight)

        ctx.fillStyle = '#1c2233'
        for (let y = 0; y < state.gridHeight; y += 1) {
          for (let x = 0; x < state.gridWidth; x += 1) {
            if (state.walls[y * state.gridWidth + x] === 1) {
              ctx.fillRect(
                x * state.cellSize,
                y * state.cellSize,
                state.cellSize,
                state.cellSize
              )
            }
          }
        }

        const sourcePx = state.source.x * state.cellSize
        const sourcePy = state.source.y * state.cellSize
        ctx.fillStyle = '#f7d65a'
        ctx.beginPath()
        ctx.arc(sourcePx, sourcePy, state.cellSize * 0.32, 0, Math.PI * 2)
        ctx.fill()

        const playerPx = state.player.x * state.cellSize
        const playerPy = state.player.y * state.cellSize
        ctx.fillStyle = '#61dafb'
        ctx.beginPath()
        ctx.arc(playerPx, playerPy, state.cellSize * 0.28, 0, Math.PI * 2)
        ctx.fill()

        const barX = (state.gridWidth - 1) * state.cellSize
        const barY = 0
        const barH = state.viewHeight
        const barW = state.cellSize
        ctx.fillStyle = '#1c2233'
        ctx.fillRect(barX, barY, barW, barH)
        const fillH = barH * state.volume
        if (fillH > 0) {
          const fillTop = barY + (barH - fillH)
          const fillBottom = barY + barH
          const gradient = ctx.createLinearGradient(0, fillBottom, 0, fillTop)
          gradient.addColorStop(0, '#2fe19a')
          gradient.addColorStop(0.55, '#f7e359')
          gradient.addColorStop(0.8, '#f7941d')
          gradient.addColorStop(1, '#e84855')
          ctx.fillStyle = gradient
          ctx.fillRect(barX, fillTop, barW, fillH)
        }

        if (!audioRef.current || audioRef.current.ctx.state !== 'running') {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
          ctx.fillRect(0, 0, state.viewWidth, state.viewHeight)
          ctx.fillStyle = '#ffffff'
          ctx.font = '16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas'
          ctx.textAlign = 'center'
          ctx.fillText('Click to start the radio', state.viewWidth / 2, 20)
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      window.removeEventListener('resize', updateSize)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      canvas.removeEventListener('pointerdown', handlePointerDown)

      if (audioRef.current) {
        audioRef.current.source.stop()
        void audioRef.current.ctx.close()
      }
    }
  }, [])

  return <canvas ref={canvasRef} className="game-canvas" />
}

export default App
