import { http, createConfig } from 'wagmi'
import { metaMask } from 'wagmi/connectors'

export const pushDonut = {
  id: 42101,
  name: 'Push Chain Donut Testnet',
  network: 'push-donut',
  nativeCurrency: {
    decimals: 18,
    name: 'PUSH',
    symbol: 'PUSH',
  },
  rpcUrls: {
    default: {
      http: ['https://evm.rpc-testnet-donut-node1.push.org/'],
    },
    public: {
      http: ['https://evm.rpc-testnet-donut-node1.push.org/'],
    },
  },
  blockExplorers: {
    default: { 
      name: 'Push Explorer', 
      url: 'https://donut.push.network' 
    },
  },
  testnet: true,
} as const

export const config = createConfig({
  chains: [pushDonut],
  connectors: [metaMask()],
  transports: {
    [pushDonut.id]: http(),
  },
})