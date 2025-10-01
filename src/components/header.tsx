import { useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Link } from 'react-router-dom'
import beamlogo from '../assets/beamlogo.png'

export default function Header() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const truncatedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''

  return (
    <header className="bg-white shadow-sm">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo - Extreme Left */}
          <div className="flex-shrink-0 flex items-center">
            <img src={beamlogo} alt="BeamDAO" className="h-12" />
            <h1 className="text-2xl font-bold text-gray-900 ml-2">BeamDAO</h1>
          </div>

          {/* Navigation Links - Center */}
          <div className="hidden md:flex flex-1 justify-center">
            <nav className="flex items-center space-x-8">
              <Link 
                to="/" 
                className="text-gray-500 hover:text-gray-700 font-medium transition-colors duration-200"
              >
                Explore
              </Link>
              <Link 
                to="/docs" 
                className="text-gray-500 hover:text-gray-700 font-medium transition-colors duration-200"
              >
                Docs
              </Link>
            </nav>
          </div>

          {/* Connect Button - Extreme Right */}
          <div className="hidden md:flex flex-shrink-0">
            {isConnected ? (
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  {truncatedAddress}
                </div>
                <button
                  onClick={() => disconnect()}
                  className="text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                  style={{ backgroundColor: '#d947f2' }}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => connect({ connector: connectors[0] })}
                className="text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: '#d947f2' }}
              >
                Connect Wallet
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-gray-500 hover:text-gray-700">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link to="/" className="text-gray-500 hover:text-gray-700 block px-3 py-2 rounded-md text-base font-medium">Explore</Link>
            <Link to="/docs" className="text-gray-500 hover:text-gray-700 block px-3 py-2 rounded-md text-base font-medium">Docs</Link>
          </div>
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          {isConnected ? (
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  {truncatedAddress}
                </div>
                <button
                  onClick={() => disconnect()}
                  className="text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                  style={{ backgroundColor: '#d947f2' }}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => connect({ connector: connectors[0] })}
                className="text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: '#d947f2' }}
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  )
}