'use client'

import React, { useState } from 'react'
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Venue {
  id: string
  name: string
  address: string | null
}

function SortableItem({ id, venue, index }: { id: string, venue: Venue, index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center space-x-4 p-4 bg-surface border border-border rounded-lg cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors shadow-sm"
    >
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-muted border border-border">
        {index + 1}
      </div>
      <div className="flex-grow">
        <h4 className="font-display font-semibold text-text leading-tight">{venue.name}</h4>
        <p className="text-xs text-muted mt-1">{venue.address || 'Adresa neuvedena'}</p>
      </div>
      <div className="text-muted/30 text-xl">⠿</div>
    </div>
  )
}

export default function VenueSortableList({ 
  items,
  onSave 
}: { 
  items: Venue[],
  onSave: (ids: string[]) => Promise<void>
}) {
  const [venues, setVenues] = useState(items)
  const [isSaving, setIsSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setVenues((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id)
        const newIndex = items.findIndex(i => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(venues.map(v => v.id))
      alert('Pořadí hal uloženo!')
    } catch (err: any) {
      alert('Chyba při ukládání: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (venues.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed border-border rounded-xl">
        <p className="text-muted text-sm">V tomto městě nejsou zatím žádné haly k dispozici.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-2">
          <SortableContext 
            items={venues.map(v => v.id)}
            strategy={verticalListSortingStrategy}
          >
            {venues.map((venue, index) => (
              <SortableItem key={venue.id} id={venue.id} venue={venue} index={index} />
            ))}
          </SortableContext>
        </div>
      </DndContext>

      <div className="pt-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-primary text-bg font-display font-bold py-4 rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/10 disabled:opacity-50"
        >
          {isSaving ? 'Ukládám...' : 'Uložit preference →'}
        </button>
      </div>
    </div>
  )
}
