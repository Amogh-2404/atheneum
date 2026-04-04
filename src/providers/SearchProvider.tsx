import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import SearchPanel from '@/components/search/SearchPanel'

interface SearchContextValue {
  isSearchOpen: boolean
  openSearch: () => void
  closeSearch: () => void
}

const SearchContext = createContext<SearchContextValue>({
  isSearchOpen: false,
  openSearch: () => {},
  closeSearch: () => {},
})

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const openSearch = useCallback(() => setIsSearchOpen(true), [])
  const closeSearch = useCallback(() => setIsSearchOpen(false), [])

  // Global Cmd+K shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <SearchContext.Provider value={{ isSearchOpen, openSearch, closeSearch }}>
      {children}
      <SearchPanel isOpen={isSearchOpen} onClose={closeSearch} />
    </SearchContext.Provider>
  )
}

export function useSearchContext() {
  return useContext(SearchContext)
}
