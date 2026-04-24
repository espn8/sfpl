import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { initAnalytics } from './app/analytics'
import { createAppQueryClient } from './app/queryClient'
import { ThemeProvider, initializeThemeOnBoot } from './app/providers/ThemeProvider'
import { ToastProvider } from './app/providers/ToastProvider'

const queryClient = createAppQueryClient()
initAnalytics()
initializeThemeOnBoot()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
