import { useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { beamDAOContract } from '../contracts/beamDaoContract'
import Header from '../components/header'

interface ProjectPreviewCardProps {
  name: string;
  logoURI: string;
  backdropURI: string;
  bio: string;
  creator: string | undefined;
}

function ProjectPreviewCard({ name, logoURI, backdropURI, bio, creator }: ProjectPreviewCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-md overflow-hidden">
      <div className="h-24 bg-cover bg-center" style={{ backgroundImage: `url(${backdropURI || 'https://via.placeholder.com/400x150'})` }}></div>
      <div className="p-4">
        <div className="flex items-center">
          <img className="h-12 w-12 rounded-full -mt-8 border-4 border-white" src={logoURI || 'https://via.placeholder.com/150'} alt="" />
          <div className="ml-4">
            <h3 className="text-lg font-semibold text-gray-900">{name || 'Project Name'}</h3>
          </div>
        </div>
        <p className="text-gray-600 text-sm mt-2">Creator: {creator ? `${creator.slice(0, 6)}...${creator.slice(-4)}` : ''}</p>
        <p className="text-gray-600 text-sm truncate">{bio || 'Project bio will be shown here.'}</p>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>Total Staked: 0 tokens</span>
          <span>Proposals: 0</span>
        </div>
      </div>
    </div>
  )
}

export default function CreateProject() {
  const { address } = useAccount()
  const { writeContract } = useWriteContract()
  
  const [name, setName] = useState('')
  const [logoURI, setLogoURI] = useState('')
  const [backdropURI, setBackdropURI] = useState('')
  const [bio, setBio] = useState('')
  const [governanceTokens, setGovernanceTokens] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!address) return

    const tokens = governanceTokens.split(',').map(token => token.trim())

    writeContract({
      ...beamDAOContract,
      functionName: 'createProject',
      args: [
        name,
        logoURI,
        backdropURI,
        bio,
        tokens
      ],
    })

    // Reset form
    setName('')
    setLogoURI('')
    setBackdropURI('')
    setBio('')
    setGovernanceTokens('')
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Create New Project</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-lg border border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Logo URL
              </label>
              <input
                type="text"
                value={logoURI}
                onChange={(e) => setLogoURI(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Backdrop URL
              </label>
              <input
                type="text"
                value={backdropURI}
                onChange={(e) => setBackdropURI(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Governance Tokens (comma-separated addresses)
              </label>
              <input
                type="text"
                value={governanceTokens}
                onChange={(e) => setGovernanceTokens(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="w-full text-white py-2 px-4 rounded-lg font-medium transition-colors"
                style={{ backgroundColor: '#d947f2' }}
              >
                Create Project
              </button>
            </div>
          </form>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Project Preview</h2>
            <ProjectPreviewCard name={name} logoURI={logoURI} backdropURI={backdropURI} bio={bio} creator={address} />
          </div>
        </div>
      </main>
    </div>
  )
}
