'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createCategory,
  deleteCategory,
  type Category,
} from '@/features/admin/api/categories'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

interface CategoryManagerProps {
  initialCategories: Category[]
}

export function CategoryManager({ initialCategories }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [newName, setNewName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) {
      setNameError('Ime kategorije je obvezno')
      return
    }
    setNameError(null)
    setIsAdding(true)
    try {
      const slug = toSlug(trimmed)
      const created = await createCategory(trimmed, slug)
      setCategories((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      )
      setNewName('')
      toast.success('Kategorija je bila dodana')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Napaka pri dodajanju kategorije'
      if (
        err instanceof Error &&
        err.message.includes('že obstaja')
      ) {
        setNameError(message)
      } else {
        toast.error(message)
      }
    } finally {
      setIsAdding(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteCategory(id)
      setCategories((prev) => prev.filter((c) => c.id !== id))
      toast.success('Kategorija je bila izbrisana')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Napaka pri brisanju kategorije'
      toast.error(message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Add form */}
      <form onSubmit={handleAdd} noValidate className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold">Dodaj kategorijo</h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category-name" className="text-sm font-medium">
            Ime kategorije
          </label>
          <div className="flex gap-2">
            <Input
              id="category-name"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                if (nameError) setNameError(null)
              }}
              placeholder="npr. #insight"
              disabled={isAdding}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? 'category-name-error' : undefined}
            />
            <Button type="submit" disabled={isAdding} className="shrink-0">
              {isAdding ? <Loader2 className="animate-spin" /> : 'Dodaj'}
            </Button>
          </div>
          {nameError && (
            <p
              id="category-name-error"
              className="text-xs text-destructive"
              role="alert"
            >
              {nameError}
            </p>
          )}
        </div>
      </form>

      {/* Categories list */}
      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Obstoječe kategorije</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ni kategorij</p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Seznam kategorij">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{cat.name}</span>
                  <span className="text-xs text-muted-foreground">
                    slug: {cat.slug}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(cat.id)}
                  disabled={deletingId === cat.id}
                  aria-label={`Izbriši kategorijo ${cat.name}`}
                >
                  {deletingId === cat.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
