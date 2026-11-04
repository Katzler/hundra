import { beforeEach, expect, it } from 'vitest'
import { STORAGE_KEY } from '../store/useStore'
import { hasSeenNews, markNewsSeen, NEWS_ID } from './news'

beforeEach(() => localStorage.clear())

it('nyheterna visas tills de setts, sedan inte igen', () => {
  expect(hasSeenNews()).toBe(false)
  markNewsSeen()
  expect(hasSeenNews()).toBe(true)
})

it('en äldre omgång nyheter räknas inte som sedd', () => {
  localStorage.setItem('hundra-nyheter', 'gammal')
  expect(hasSeenNews()).toBe(false)
  expect(NEWS_ID).not.toBe('gammal')
})

it('rör aldrig användarens data', () => {
  localStorage.setItem(STORAGE_KEY, 'data')
  markNewsSeen()
  expect(localStorage.getItem(STORAGE_KEY)).toBe('data')
})
