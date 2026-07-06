import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Check, ListChecks, Plus, ChevronRight } from 'lucide-react'

export const Route = createFileRoute('/lists')({
  component: ListsScreen,
})

/**
 * MOCK shopping lists — held in component state for the UI phase. Phase 1
 * persists lists to Supabase and links items to catalog products.
 */
interface ListItem {
  id: string
  name: string
  checked: boolean
}

interface ShoppingList {
  id: string
  name: string
  items: ListItem[]
}

const SEED_LISTS: ShoppingList[] = [
  {
    id: 'weekly',
    name: 'Weekly shop',
    items: [
      { id: 'w1', name: 'Spaghetti', checked: true },
      { id: 'w2', name: 'Tomato ketchup', checked: false },
      { id: 'w3', name: 'Oat milk', checked: false },
      { id: 'w4', name: 'Bananas', checked: false },
    ],
  },
  {
    id: 'party',
    name: 'Birthday party',
    items: [
      { id: 'p1', name: 'Cola', checked: false },
      { id: 'p2', name: 'Biscuits', checked: false },
    ],
  },
]

function ListsScreen() {
  const [lists, setLists] = useState<ShoppingList[]>(SEED_LISTS)
  const [openId, setOpenId] = useState<string | null>(null)
  const [newItem, setNewItem] = useState('')

  const openList = lists.find((l) => l.id === openId)

  function toggleItem(listId: string, itemId: string) {
    setLists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === itemId ? { ...item, checked: !item.checked } : item,
              ),
            }
          : list,
      ),
    )
  }

  function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newItem.trim()
    if (!name || !openList) return
    setLists((prev) =>
      prev.map((list) =>
        list.id === openList.id
          ? {
              ...list,
              items: [
                ...list.items,
                { id: `${list.id}-${Date.now()}`, name, checked: false },
              ],
            }
          : list,
      ),
    )
    setNewItem('')
  }

  if (openList) {
    const remaining = openList.items.filter((i) => !i.checked).length
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))]">
        <header className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Back to all lists"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink transition-colors hover:bg-surface active:scale-[0.98]"
            onClick={() => setOpenId(null)}
          >
            <ArrowLeft aria-hidden="true" size={24} strokeWidth={2} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-ink">{openList.name}</h1>
            <p className="text-sm text-ink-muted">
              {remaining === 0 ? 'All done' : `${remaining} to get`}
            </p>
          </div>
        </header>

        <form onSubmit={addItem} className="flex gap-2">
          <label className="sr-only" htmlFor="new-item">
            Add an item
          </label>
          <input
            id="new-item"
            type="text"
            placeholder="Add an item…"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            className="min-h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-base text-ink placeholder:text-ink-muted focus:border-brand-400 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Add item"
            className="flex min-h-12 min-w-12 items-center justify-center rounded-xl bg-brand-700 text-on-brand transition-transform active:scale-[0.98]"
          >
            <Plus aria-hidden="true" size={24} strokeWidth={2} />
          </button>
        </form>

        <ul className="flex flex-col rounded-2xl bg-surface p-2 shadow-[0_8px_32px_rgba(23,29,20,0.08)]">
          {openList.items.map((item) => (
            <li key={item.id}>
              {/* ListItemRow (component canon): 44px target, 24px checkbox */}
              <button
                type="button"
                role="checkbox"
                aria-checked={item.checked}
                onClick={() => toggleItem(openList.id, item.id)}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-surface-muted active:scale-[0.98]"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                    item.checked
                      ? 'border-brand-700 bg-brand-700 text-on-brand'
                      : 'border-ink/30 bg-surface'
                  }`}
                >
                  {item.checked && <Check size={16} strokeWidth={3} />}
                </span>
                <span
                  className={`text-[15px] ${item.checked ? 'text-ink-muted line-through' : 'text-ink'}`}
                >
                  {item.name}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <p className="px-1 text-xs text-ink-muted">
          Sample list — lists sync to your account in a later phase.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))]">
      <header>
        <h1 className="text-2xl font-bold text-ink">Lists</h1>
        <p className="mt-0.5 text-sm text-ink-muted">Plan your shop around your verdicts.</p>
      </header>

      {lists.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl bg-surface p-8 text-center shadow-[0_8px_32px_rgba(23,29,20,0.08)]">
          <ListChecks aria-hidden="true" size={40} strokeWidth={2} className="text-ink-muted" />
          <h2 className="text-base font-bold text-ink">No lists yet</h2>
          <p className="text-sm text-ink-muted">Create a list to plan your next shop.</p>
          <button
            type="button"
            className="mt-1 flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-5 font-semibold text-on-brand transition-transform active:scale-[0.98]"
            onClick={() =>
              setLists([{ id: `list-${Date.now()}`, name: 'New list', items: [] }])
            }
          >
            <Plus aria-hidden="true" size={20} strokeWidth={2} />
            New list
          </button>
        </section>
      ) : (
        <ul className="flex flex-col gap-2">
          {lists.map((list) => {
            const remaining = list.items.filter((i) => !i.checked).length
            return (
              <li key={list.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(list.id)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl bg-surface p-4 text-left shadow-[0_8px_32px_rgba(23,29,20,0.08)] transition-transform active:scale-[0.98]"
                >
                  <span>
                    <span className="block text-sm font-semibold text-ink">{list.name}</span>
                    <span className="block text-xs text-ink-muted">
                      {list.items.length} items · {remaining} to get
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" size={20} strokeWidth={2} className="text-ink-muted" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <p className="px-1 text-xs text-ink-muted">
        Sample data — lists sync to your account in a later phase.
      </p>
    </div>
  )
}
