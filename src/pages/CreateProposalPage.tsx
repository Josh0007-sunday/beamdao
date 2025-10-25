import { useState } from 'react'
import { usePushWalletContext, usePushChainClient, PushUI } from '@pushchain/ui-kit'
import { PushChain } from '@pushchain/core'
import { useParams, useNavigate } from 'react-router-dom'
import { beamDAOContract } from '../contracts/beamDaoContract'
import Header from '../components/header'
import toast from 'react-hot-toast'

export default function CreateProposalPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { connectionStatus } = usePushWalletContext()
  const { pushChainClient } = usePushChainClient()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isConnected || !projectId || !pushChainClient) {
      toast.error('Please connect your wallet')
      return
    }

    setIsSubmitting(true)

    try {
      // Encode the contract function call (no quorum parameter)
      const data = PushChain.utils.helpers.encodeTxData({
        abi: JSON.parse(JSON.stringify(beamDAOContract.abi)),
        functionName: 'createProposal',
        args: [BigInt(projectId), title, description],
      })

      // Send transaction via Push Chain Client
      const txPromise = pushChainClient.universal.sendTransaction({
        to: beamDAOContract.address as `0x${string}`,
        value: BigInt('0'),
        data: data,
      })

      toast.promise(txPromise, {
        loading: 'Creating proposal...',
        success: 'Proposal created successfully!',
        error: 'Failed to create proposal',
      })

      await txPromise
      navigate(`/`)
    } catch (error) {
      console.error('Error creating proposal:', error)
    } finally {
      setIsSubmitting(false)
    }
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

            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> Voting will last for 7 days. After the voting period ends,
                the proposal will automatically complete and results will be visible to everyone.
              </p>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={() => navigate(`/`)}
                disabled={isSubmitting}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isConnected}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Proposal'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
