import { haptic, useUI } from '../store/ui'
import { FAVORITE_GROUPS, FAVORITE_LIMIT, useStore, type FavoriteGroup } from '../store/useStore'
import { FoodIcon } from './FoodIcon'
import { CheckIcon } from './icons'
import { Sheet } from './Sheet'

type ChecksProps = { selected: FavoriteGroup[]; onToggle: (group: FavoriteGroup) => void }

/** De fyra favoritkategorierna som rader med bock. */
export function FavoriteGroupChecks({ selected, onToggle }: ChecksProps) {
  return (
    <div className="group">
      {FAVORITE_GROUPS.map((g) => {
        const on = selected.includes(g.id)
        return (
          <button key={g.id} type="button" className="row nav-row" onClick={() => onToggle(g.id)} aria-pressed={on}>
            <span className="emoji" aria-hidden>
              <FoodIcon id={g.icon} emoji={g.emoji} />
            </span>
            <span className="row-text">
              <span className="row-title">
                <span className="row-name">{g.name}</span>
              </span>
            </span>
            <span className={`check ${on ? 'is-on' : ''}`} aria-hidden>
              {on && <CheckIcon />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

type Props = { item: { id: string; name: string } | null; onClose: () => void }

/** Lägg en vara i en eller flera favoritkategorier, t.ex. efter ett långtryck i Lägg till mat. */
export function FavoritePicker({ item, onClose }: Props) {
  const groups = useStore((s) => s.favoriteGroups)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const showToast = useUI((s) => s.showToast)
  const selected = item ? FAVORITE_GROUPS.filter((g) => groups[g.id].includes(item.id)).map((g) => g.id) : []

  return (
    <Sheet
      open={item !== null}
      onClose={onClose}
      compact
      label="Favorit i"
      title={item?.name ?? ''}
      right={
        <button type="button" className="bar-btn bar-btn-strong" onClick={onClose}>
          Klar
        </button>
      }
    >
      <p className="hint-text picker-hint">Visa bland favoriterna i</p>
      <FavoriteGroupChecks
        selected={selected}
        onToggle={(g) => {
          if (!item) return
          if (!selected.includes(g) && groups[g].length >= FAVORITE_LIMIT) {
            showToast(`${FAVORITE_GROUPS.find((x) => x.id === g)!.name} är full. Ta bort en favorit först.`)
            return
          }
          haptic()
          toggleFavorite(g, item.id)
        }}
      />
    </Sheet>
  )
}
