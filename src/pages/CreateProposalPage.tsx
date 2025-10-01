import { useState } from 'react'
import { useAccount, useWriteContract, useReadContract } from 'wagmi'
import { useParams, useNavigate } from 'react-router-dom'
import { beamDAOContract } from '../contracts/beamDaoContract'
import Header from '../components/header'

export default function CreateProposalPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { address } = useAccount()
  const { writeContract } = useWriteContract()
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [quorum, setQuorum] = useState('')

  const numericProjectId = projectId ? BigInt(projectId) : BigInt(0)

  const { data: totalStaked = 0 } = useReadContract({
    ...beamDAOContract,
    functionName: 'getProjectStake',
    args: [numericProjectId],
  })

  const minQuorum = totalStaked ? (Number(totalStaked) * 1000) / 10000 : 0 // 10% of total staked

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!address || !projectId) return

    const quorumValue = BigInt(quorum)
    if (quorumValue < BigInt(minQuorum)) {
      alert(`Quorum must be at least ${minQuorum}`)
      return
    }

    writeContract({
      ...beamDAOContract,
      functionName: 'createProposal',
      args: [
        BigInt(projectId),
        title,
        description,
        quorumValue
      ],
    })

    navigate(`/`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Create New Proposal</h1>
          <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-lg border border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quorum (Minimum: {minQuorum.toLocaleString()})
              </label>
              <input
                type="number"
                value={quorum}
                onChange={(e) => setQuorum(e.target.value)}
                min={minQuorum}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={() => navigate(`/`)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Create Proposal
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
