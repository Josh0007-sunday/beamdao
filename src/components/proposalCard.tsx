import { useReadContract, useAccount } from 'wagmi'
import { usePushWalletContext, usePushChainClient, PushUI } from '@pushchain/ui-kit'
import { PushChain } from '@pushchain/core'
import { beamDAOContract } from '../contracts/beamDaoContract'
import type { Proposal } from '../types'
import { formatUnits } from 'viem'
import toast from 'react-hot-toast'
import { useState } from 'react'

interface ProposalCardProps {
  proposal: Proposal
  userStake: bigint | undefined
}

export function ProposalCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 animate-pulse">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center space-x-2">
          <div className="h-3 bg-gray-200 rounded w-16"></div>
          <div className="h-3 bg-gray-200 rounded w-1"></div>
          <div className="h-3 bg-gray-200 rounded w-12"></div>
        </div>
        <div className="h-5 w-16 bg-gray-200 rounded-full"></div>
      </div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
      <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
      <div className="h-3 bg-gray-200 rounded w-2/3 mb-3"></div>
      <div className="h-1.5 bg-gray-200 rounded-full w-full mb-1.5"></div>
      <div className="flex justify-between items-center mb-3">
        <div className="h-3 bg-gray-200 rounded w-20"></div>
        <div className="h-3 bg-gray-200 rounded w-16"></div>
      </div>
      <div className="flex space-x-2">
        <div className="flex-1 h-7 bg-gray-200 rounded-md"></div>
        <div className="flex-1 h-7 bg-gray-200 rounded-md"></div>
      </div>
    </div>
  )
}

export default function ProposalCard({ proposal, userStake }: ProposalCardProps) {
  const { connectionStatus } = usePushWalletContext()
  const { pushChainClient } = usePushChainClient()
  const { address } = useAccount()
  const [isVoting, setIsVoting] = useState(false)

  const isConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED

  const { data: hasVotedData } = useReadContract({
    ...beamDAOContract,
    functionName: 'hasVoted',
    args: address ? [BigInt(proposal.id), address] : undefined,
    query: {
      enabled: !!address
    }
  })
  const hasVoted: boolean = typeof hasVotedData === 'boolean' ? hasVotedData : false;

  const handleVote = async (support: boolean) => {
    if (!isConnected || !pushChainClient) {
      toast.error('Please connect your wallet')
      return
    }

    setIsVoting(true)

    try {
      const data = PushChain.utils.helpers.encodeTxData({
        abi: JSON.parse(JSON.stringify(beamDAOContract.abi)),
        functionName: 'vote',
        args: [BigInt(proposal.id), support],
      })

      const txPromise = pushChainClient.universal.sendTransaction({
        to: beamDAOContract.address as `0x${string}`,
        value: BigInt('0'),
        data: data,
      })

      toast.promise(txPromise, {
        loading: 'Submitting vote...',
        success: 'Vote submitted successfully!',
        error: 'Failed to submit vote',
      })

      await txPromise
    } catch (error) {
      console.error('Error voting:', error)
    } finally {
      setIsVoting(false)
    }
  }


  const getStatus = () => {
    const now = Math.floor(Date.now() / 1000)
    if (proposal.completed || now > proposal.endTime) {
      return 'Completed'
    }
    if (now < proposal.startTime) return 'Pending'
    if (now <= proposal.endTime) return 'Active'
    return 'Completed'
  }

  const status = getStatus()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'Active':
        return 'bg-green-100 text-green-800'
      case 'Completed':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const yesVotes = proposal.yesVotes
  const noVotes = proposal.noVotes
  const totalVoted = proposal.totalVoted

  const yesPercentage = totalVoted > 0n
    ? Number(yesVotes * 100n / totalVoted)
    : 0

  const noPercentage = totalVoted > 0n
    ? Number(noVotes * 100n / totalVoted)
    : 0

  // Fix date issues
  const startTime = isNaN(proposal.startTime) ? 0 : proposal.startTime
  const endTime = isNaN(proposal.endTime) ? 0 : proposal.endTime

  const proposalId = `PT-TX${proposal.id.toString().padStart(4, '0')}`
  const date = startTime > 0 ? new Date(startTime * 1000).toLocaleDateString() : 'Invalid Date'
  const deadline = endTime > 0 ? new Date(endTime * 1000).toLocaleDateString() : 'Invalid Date'

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow">
      {/* Header with ID and Status */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-gray-700">{proposalId}</span>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-500">{date}</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
          {status}
        </span>
      </div>

      {/* Title and Description */}
      <h3 className="text-base font-semibold text-gray-900 mb-1 line-clamp-1">{proposal.title}</h3>
      <p className="text-gray-600 text-xs mb-3 line-clamp-2">{proposal.description}</p>

      {/* Voting Progress Bar */}
      <div className="mb-3">
        <div className="w-full bg-gray-200 rounded-full h-1.5 flex overflow-hidden">
          <div
            className="bg-green-500 h-1.5 transition-all duration-300"
            style={{ width: `${yesPercentage}%` }}
          ></div>
          <div
            className="bg-red-500 h-1.5 transition-all duration-300"
            style={{ width: `${noPercentage}%` }}
          ></div>
        </div>
        <div className="flex justify-between items-center mt-1.5">
          <div className="flex items-center space-x-3 text-xs">
            <span className="text-green-600 font-medium">{yesPercentage}% Yes</span>
            <span className="text-red-600 font-medium">{noPercentage}% No</span>
          </div>
          <span className="text-xs text-gray-500">Ends: {deadline}</span>
        </div>
      </div>

      {/* Voting Buttons */}
      {status === 'Active' && address && !hasVoted && userStake !== undefined && userStake > 0n && (
        <div className="flex space-x-2">
          <button
            onClick={() => handleVote(true)}
            disabled={isVoting}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1.5 px-3 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVoting ? 'Voting...' : 'Vote For'}
          </button>
          <button
            onClick={() => handleVote(false)}
            disabled={isVoting}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-1.5 px-3 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVoting ? 'Voting...' : 'Vote Against'}
          </button>
        </div>
      )}

      {status === 'Active' && address && !hasVoted && userStake !== undefined && userStake === 0n && (
        <div className="text-center text-xs text-gray-500 py-1.5 bg-gray-50 rounded-md">
          Stake tokens to vote
        </div>
      )}

      {status === 'Active' && hasVoted && (
        <div className="text-center text-xs text-green-600 py-1.5 bg-green-50 rounded-md font-medium">
          ✓ You voted on this proposal
        </div>
      )}

      {status === 'Completed' && (
        <div className="text-center py-1.5 bg-purple-50 rounded-md">
          <p className="text-xs font-medium text-purple-700">
            Voting Completed
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            {formatUnits(yesVotes, 18)} YES ({yesPercentage}%) • {formatUnits(noVotes, 18)} NO ({noPercentage}%)
          </p>
        </div>
      )}

      {!address && status === 'Active' && (
        <div className="text-center text-xs text-gray-500 py-1.5 bg-gray-50 rounded-md">
          Connect wallet to vote
        </div>
      )}
    </div>
  )
}