import { useEffect } from 'react'
import { useAccount, useDisconnect, useConnect } from 'wagmi'
import { usePushWalletContext } from '@pushchain/ui-kit'
import { PushUI } from '@pushchain/ui-kit'

/**
 * Custom hook to sync PushUI wallet state with Wagmi
 * This ensures that when you disconnect/connect wallets through PushUI,
 * Wagmi's useAccount hook properly reflects the change
 */
export function useWalletSync() {
  const { connectionStatus, account } = usePushWalletContext()
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { connect, connectors } = useConnect()

  useEffect(() => {
    const isPushConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED
    const pushAddress = account?.address

    // If PushUI is disconnected but Wagmi thinks it's connected, disconnect Wagmi
    if (!isPushConnected && wagmiConnected) {
      disconnect()
      return
    }

    // If PushUI is connected but Wagmi address doesn't match, reconnect Wagmi
    if (isPushConnected && pushAddress && pushAddress !== wagmiAddress) {
      // Disconnect first if already connected to wrong address
      if (wagmiConnected) {
        disconnect()
      }

      // Try to connect with the injected connector
      const injectedConnector = connectors.find(c => c.id === 'injected')
      if (injectedConnector) {
        connect({ connector: injectedConnector })
      }
    }
  }, [connectionStatus, account, wagmiAddress, wagmiConnected, disconnect, connect, connectors])
}
