/**
 * "Nytt i Hundra" visas en gång efter en uppdatering med nyheter. Vad man sett sparas under en
 * egen nyckel, skild från `hundra-v1`, eftersom det bara gäller den här telefonen och inte ska
 * med i backupen. Höj `NEWS_ID` när nästa ark med nyheter läggs till.
 */
export const NEWS_ID = '2026-11-naring-skanna'

const NEWS_KEY = 'hundra-nyheter'

export function hasSeenNews(): boolean {
  try {
    return localStorage.getItem(NEWS_KEY) === NEWS_ID
  } catch {
    // Går lagringen inte att läsa visas inget, hellre det än samma ark vid varje start.
    return true
  }
}

export function markNewsSeen() {
  try {
    localStorage.setItem(NEWS_KEY, NEWS_ID)
  } catch {
    // ignoreras
  }
}
