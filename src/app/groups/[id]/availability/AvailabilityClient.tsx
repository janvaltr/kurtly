'use client'

import { useState } from 'react'
import WeeklyGrid from '@/components/availability/WeeklyGrid'
import { saveAvailability } from './actions'

export default function AvailabilityClient({
  groupId,
  initialData
}: {
  groupId: string,
  initialData: any[]
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (data: any[]) => {
    setIsSaving(true)
    setError(null)
    try {
      await saveAvailability(groupId, 'recurring', data)
      alert('Dostupnost uložena!')
    } catch (err: any) {
      setError(err.message || 'Nepodařilo se uložit dostupnost')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive border border-destructive/50">
          {error}
        </div>
      )}
      
      <WeeklyGrid 
        initialData={initialData} 
        onSave={handleSave} 
        isSaving={isSaving} 
      />
    </div>
  )
}
