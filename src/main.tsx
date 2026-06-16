import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { WebSocketProvider } from '@/providers/WebSocketProvider'
import { SearchProvider } from '@/providers/SearchProvider'
import { AppMotionConfig } from '@/components/AppMotionConfig'
import './index.css'
import './styles/accessibility.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <WebSocketProvider>
        <SearchProvider>
          <AppMotionConfig>
            <App />
          </AppMotionConfig>
        </SearchProvider>
      </WebSocketProvider>
    </BrowserRouter>
  </StrictMode>,
)
