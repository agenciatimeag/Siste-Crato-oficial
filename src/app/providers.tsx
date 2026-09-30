import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { AuthProvider } from '@/domains/auth/auth-context'
import { WorkspaceProvider } from '@/domains/workspaces/workspace-context'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}