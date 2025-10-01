import { useAccount, useWriteContract, useReadContract } from 'wagmi'
import { beamDAOContract } from '../contracts/beamDaoContract'
import type { Proposal } from '../types'
import { formatUnits } from 'viem'

interface ProposalCardProps {
  proposal: Proposal
  userStake: bigint | undefined
}

export function ProposalCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-16"></div>
        </div>
        <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
      </div>
      <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      <div className="mt-4">
        <div className="h-2 bg-gray-200 rounded-full w-full mb-2"></div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <div className="h-3 bg-gray-200 rounded w-24"></div>
          <div className="h-3 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
      <div className="flex justify-between items-center mt-4">
        <div className="h-4 bg-gray-200 rounded w-32"></div>
      </div>
      <div className="flex space-x-3 mt-4">
        <div className="flex-1 h-8 bg-gray-200 rounded-lg"></div>
        <div className="flex-1 h-8 bg-gray-200 rounded-lg"></div>
      </div>
    </div>
  )
}

export default function ProposalCard({ proposal, userStake }: ProposalCardProps) {
  const { address } = useAccount()
  const { writeContract } = useWriteContract()

  const { data: hasVotedData } = useReadContract({
    ...beamDAOContract,
    functionName: 'hasVoted',
    args: address ? [BigInt(proposal.id), address] : undefined,
    query: {
      enabled: !!address
    }
  })
  const hasVoted: boolean = typeof hasVotedData === 'boolean' ? hasVotedData : false;

  const handleVote = (support: boolean) => {
    if (!address) return

    writeContract({
      ...beamDAOContract,
      functionName: 'vote',
      args: [BigInt(proposal.id), support],
    })
  }

  const handleExecute = () => {
    writeContract({
      ...beamDAOContract,
      functionName: 'executeProposal',
      args: [BigInt(proposal.id)],
    })
  }

  const getStatus = () => {
    const now = Math.floor(Date.now() / 1000)
    if (proposal.executed) return 'Executed'
    if (now < proposal.startTime) return 'Pending'
    if (now <= proposal.endTime) return 'Active'
    if (proposal.totalVoted >= proposal.quorum) return 'Completed'
    return 'Defeated'
  }

  const status = getStatus()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'Active':
        return 'bg-green-100 text-green-800'
      case 'Executed':
        return 'bg-blue-100 text-blue-800'
      case 'Completed':
        return 'bg-purple-100 text-purple-800'
      case 'Defeated':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const yesVotes = proposal.yesVotes
  const noVotes = proposal.noVotes
  const totalVoted = proposal.totalVoted
  const quorum = proposal.quorum

  const votePercentage = totalVoted > 0n 
    ? Number(yesVotes * 100n / totalVoted)
    : 0

  // Fix date issues
  const startTime = isNaN(proposal.startTime) ? 0 : proposal.startTime
  const endTime = isNaN(proposal.endTime) ? 0 : proposal.endTime

  const proposalId = `PT-TX${proposal.id.toString().padStart(4, '0')}`
  const date = startTime > 0 ? new Date(startTime * 1000).toLocaleDateString() : 'Invalid Date'
  const deadline = endTime > 0 ? new Date(endTime * 1000).toLocaleDateString() : 'Invalid Date'

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="text-sm font-medium text-gray-500">{proposalId}</span>
          <p className="text-xs text-gray-400">{date}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
          {status}
        </span>
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{proposal.title}</h3>
      <p className="text-gray-600 text-sm mb-2 line-clamp-2">{proposal.description}</p>
      
      {/* Voting Progress */}
      <div className="mb-2">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>For: {formatUnits(yesVotes, 18)}</span>
          <span>Against: {formatUnits(noVotes, 18)}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${votePercentage}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Total Votes: {formatUnits(totalVoted, 18)}</span>
          <span>Quorum: {formatUnits(quorum, 18)}</span>
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-gray-500">
          Deadline: <span className="font-medium">{deadline}</span>
        </div>
      </div>
  
      {status === 'Active' && address && !hasVoted && userStake !== undefined && userStake > 0n && (
        <div className="flex space-x-3">
          <button
            onClick={() => handleVote(true)}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1 px-2 rounded-lg text-sm font-medium transition-colors"
          >
            Vote For
          </button>
          <button
            onClick={() => handleVote(false)}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded-lg text-sm font-medium transition-colors"
          >
            Vote Against
          </button>
        </div>
      )}

      {status === 'Active' && address && !hasVoted && userStake !== undefined && userStake === 0n && (
        <div className="text-center text-sm text-gray-500 py-1">
          Stake to be able to vote
        </div>
      )}

      {status === 'Active' && hasVoted && (
        <div className="text-center text-sm text-green-600 py-1">
          You have already voted on this proposal
        </div>
      )}

      {status === 'Completed' && (
        <button
          onClick={handleExecute}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded-lg text-sm font-medium transition-colors"
        >
          Execute Proposal
        </button>
      )}

      {!address && status === 'Active' && (
        <div className="text-center text-sm text-gray-500 py-1">
          Connect wallet to vote
        </div>
      )}
    </div>
  )
}