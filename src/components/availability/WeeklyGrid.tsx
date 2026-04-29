'use client'

import React, { useState, useEffect, useRef } from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const DAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
const HOURS = Array.from({ length: 16 }, (_, i) => {
  const h = Math.floor(i / 2) + 15
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

// Pomocná funkce pro převod času na index (15:00 -> 0, 15:30 -> 1, ...)
const timeToIndex = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return (h - 15) * 2 + (m === 30 ? 1 : 0)
}

export default function WeeklyGrid({ 
  initialData, 
  onSave,
  isSaving
}: { 
  initialData: { dayOfWeek: number, timeFrom: string, timeTo: string }[], 
  onSave: (data: { dayOfWeek: number, timeFrom: string, timeTo: string }[]) => Promise<void>,
  isSaving?: boolean
}) {
  // Grid reprezentovaný jako Set stringů "day-index"
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select')

  // Inicializace z existujících dat
  useEffect(() => {
    const newSelected = new Set<string>()
    initialData.forEach(item => {
      const startIdx = timeToIndex(item.timeFrom)
      const endIdx = timeToIndex(item.timeTo)
      for (let i = startIdx; i < endIdx; i++) {
        newSelected.add(`${item.dayOfWeek}-${i}`)
      }
    })
    setSelected(newSelected)
  }, [initialData])

  const toggleSlot = (day: number, hourIdx: number, forceMode?: 'select' | 'deselect') => {
    const key = `${day}-${hourIdx}`
    setSelected(prev => {
      const next = new Set(prev)
      const mode = forceMode || (next.has(key) ? 'deselect' : 'select')
      if (mode === 'select') next.add(key)
      else next.delete(key)
      return next
    })
  }

  const handleMouseDown = (day: number, hourIdx: number) => {
    const key = `${day}-${hourIdx}`
    const mode = selected.has(key) ? 'deselect' : 'select'
    setDragMode(mode)
    setIsDragging(true)
    toggleSlot(day, hourIdx, mode)
  }

  const handleMouseEnter = (day: number, hourIdx: number) => {
    if (isDragging) {
      toggleSlot(day, hourIdx, dragMode)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [])

  const handleSaveInternal = () => {
    // Transformace Setu zpět na intervaly
    const intervals: { dayOfWeek: number, timeFrom: string, timeTo: string }[] = []
    
    for (let d = 0; d < 7; d++) {
      let currentStart: number | null = null
      
      for (let h = 0; h <= HOURS.length; h++) {
        const isSel = selected.has(`${d}-${h}`)
        
        if (isSel && currentStart === null) {
          currentStart = h
        } else if (!isSel && currentStart !== null) {
          intervals.push({
            dayOfWeek: d,
            timeFrom: HOURS[currentStart],
            timeTo: HOURS[h] || '23:00' // Pokud končíme na konci gridu
          })
          currentStart = null
        }
      }
    }
    onSave(intervals)
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <div className="min-w-[600px] select-none">
          {/* Header */}
          <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-border">
            <div className="p-3"></div>
            {DAYS.map((day, i) => (
              <div key={day} className="p-3 text-center text-sm font-semibold text-muted border-l border-border">
                {day}
              </div>
            ))}
          </div>

          {/* Grid Rows */}
          {HOURS.map((time, hIdx) => (
            <div key={time} className="grid grid-cols-[80px_repeat(7,1fr)] group">
              <div className="flex items-center justify-end pr-3 text-xs text-muted/50 font-mono">
                {time}
              </div>
              {Array.from({ length: 7 }).map((_, dIdx) => (
                <div
                  key={dIdx}
                  onMouseDown={() => handleMouseDown(dIdx, hIdx)}
                  onMouseEnter={() => handleMouseEnter(dIdx, hIdx)}
                  className={cn(
                    "h-10 border-l border-t border-border transition-colors cursor-pointer",
                    selected.has(`${dIdx}-${hIdx}`) ? "bg-primary/80 hover:bg-primary" : "hover:bg-surface-2"
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          * Klikni a táhni pro označení času, kdy můžeš hrát.
        </p>
        <button
          onClick={handleSaveInternal}
          disabled={isSaving}
          className="rounded-md bg-primary px-8 py-2 font-display font-bold text-bg hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving ? 'Ukládám...' : 'Uložit dostupnost'}
        </button>
      </div>
    </div>
  )
}
