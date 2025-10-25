import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { PushUniversalWalletProvider, PushUI } from '@pushchain/ui-kit'
import { config } from './config/wagmi'
import Governance from './pages/governance'
import CreateProject from './pages/CreateProject'
import CreateProposalPage from './pages/CreateProposalPage'
import ProjectDetailsPage from './pages/ProjectDetailsPage'
import DocsPage from './pages/docs'
import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Push Universal Wallet configuration
const walletConfig = {
  network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
}

function App() {
  return (
    <PushUniversalWalletProvider config={walletConfig}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <Toaster />
          <Router>
            <Routes>
              <Route path="/" element={<Governance />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route path="/create-project" element={<CreateProject />} />
              <Route path="/project/:projectId" element={<ProjectDetailsPage />} />
              <Route path="/project/:projectId/create-proposal" element={<CreateProposalPage />} />
            </Routes>
          </Router>
        </QueryClientProvider>
      </WagmiProvider>
    </PushUniversalWalletProvider>
  )
}

export default App