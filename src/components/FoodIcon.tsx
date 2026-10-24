import { ICON_IDS } from '../icons/riso/ids'

type Props = { id: string; emoji: string; size?: number }

const base = `${import.meta.env.BASE_URL}icons/riso`

/** Varans handritade ikon, eller emojin om det inte finns någon (t.ex. egna varor). */
export function FoodIcon({ id, emoji, size = 30 }: Props) {
  if (!ICON_IDS.has(id)) return <>{emoji}</>
  // Förrenderade i 4x storlek så att de blir skarpa på Retina, med ljust bläck i mörkt läge.
  return (
    <picture className="food-icon">
      <source srcSet={`${base}/dark/${id}.webp`} media="(prefers-color-scheme: dark)" />
      <img src={`${base}/light/${id}.webp`} width={size} height={size} alt="" draggable={false} decoding="async" />
    </picture>
  )
}
