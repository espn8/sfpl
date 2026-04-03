import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { initAnalytics } from './app/analytics'
import { ThemeProvider, initializeThemeOnBoot } from './app/providers/ThemeProvider'

const queryClient = new QueryClient()
initAnalytics()
initializeThemeOnBoot()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
