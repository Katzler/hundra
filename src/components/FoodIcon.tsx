import { useIconUrl } from '../lib/foodIcons'

type Props = { id: string; emoji: string; size?: number }

/** Varans handritade ikon, eller emojin om det inte finns någon (t.ex. egna varor). */
export function FoodIcon({ id, emoji, size = 30 }: Props) {
  const url = useIconUrl(id)
  if (!url) return <>{emoji}</>
  return <img className="food-icon" src={url} width={size} height={size} alt="" draggable={false} />
}
