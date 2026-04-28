import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { RouteErrorBoundary } from './components/RouteErrorBoundary'
import { initAnalytics } from './app/analytics'
import { createAppQueryClient } from './app/queryClient'
import { fetchMe } from './features/auth/api'
import { ThemeProvider, initializeThemeOnBoot } from './app/providers/ThemeProvider'
import { ToastProvider } from './app/providers/ToastProvider'

const queryClient = createAppQueryClient()
void queryClient.prefetchQuery({ queryKey: ['auth', 'me'], queryFn: fetchMe }).catch(() => {
  // Logged out, 401, or transient network — ProtectedRoute / shell will fetch again.
})
initAnalytics()
initializeThemeOnBoot()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <RouteErrorBoundary>
            <App />
          </RouteErrorBoundary>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
