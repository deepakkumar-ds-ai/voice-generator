import { useCallback, useEffect, useRef, useState } from 'react'
import { splitIntoSpeechChunks } from '../utils/text'

export type SpeechStatus = 'idle' | 'speaking' | 'paused'

interface UseSpeechOptions {
  voice: SpeechSynthesisVoice | null
  rate: number
  pitch: number
  volume: number
  onComplete?: () => void
}

export function useSpeech({ voice, rate, pitch, volume, onComplete }: UseSpeechOptions) {
  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [error, setError] = useState('')
  const chunksRef = useRef<string[]>([])
  const indexRef = useRef(0)
  const generationRef = useRef(0)
  const optionsRef = useRef({ voice, rate, pitch, volume, onComplete })

  useEffect(() => {
    optionsRef.current = { voice, rate, pitch, volume, onComplete }
  }, [voice, rate, pitch, volume, onComplete])

  const stop = useCallback(() => {
    generationRef.current += 1
    chunksRef.current = []
    indexRef.current = 0
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setStatus('idle')
  }, [])

  const speakNext = useCallback((generation: number) => {
    if (generation !== generationRef.current || indexRef.current >= chunksRef.current.length) {
      if (generation === generationRef.current) {
        setStatus('idle')
        optionsRef.current.onComplete?.()
      }
      return
    }

    const utterance = new SpeechSynthesisUtterance(chunksRef.current[indexRef.current])
    const currentOptions = optionsRef.current
    utterance.voice = currentOptions.voice
    utterance.rate = currentOptions.rate
    utterance.pitch = currentOptions.pitch
    utterance.volume = currentOptions.volume
    utterance.onend = () => {
      if (generation !== generationRef.current) return
      indexRef.current += 1
      speakNext(generation)
    }
    utterance.onerror = (event) => {
      if (generation !== generationRef.current || event.error === 'canceled' || event.error === 'interrupted') return
      setError(`Speech stopped: ${event.error.replace(/-/g, ' ')}. Try another voice or browser.`)
      setStatus('idle')
      chunksRef.current = []
    }
    window.speechSynthesis.speak(utterance)
  }, [])

  const start = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      setError('Speech synthesis is not supported in this browser. Try a current version of Chrome, Edge, Safari, or Firefox.')
      return
    }
    const chunks = splitIntoSpeechChunks(text)
    if (!chunks.length) {
      setError('Add some text before you listen.')
      return
    }

    setError('')
    generationRef.current += 1
    const generation = generationRef.current
    window.speechSynthesis.cancel()
    chunksRef.current = chunks
    indexRef.current = 0
    setStatus('speaking')
    speakNext(generation)
  }, [speakNext])

  const pause = useCallback(() => {
    if (status === 'speaking') {
      window.speechSynthesis.pause()
      setStatus('paused')
    }
  }, [status])

  const resume = useCallback(() => {
    if (status === 'paused') {
      window.speechSynthesis.resume()
      setStatus('speaking')
    }
  }, [status])

  useEffect(() => () => {
    generationRef.current += 1
    window.speechSynthesis?.cancel()
  }, [])

  return { status, error, setError, start, stop, pause, resume }
}
