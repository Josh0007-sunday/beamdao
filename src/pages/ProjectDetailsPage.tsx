import { useParams } from 'react-router-dom'
import { useReadContract, useReadContracts, useAccount } from 'wagmi'
import { usePushWalletContext, usePushChainClient, PushUI } from '@pushchain/ui-kit'
import { PushChain } from '@pushchain/core'
import { parseUnits, formatUnits } from 'viem'
import { beamDAOContract } from '../contracts/beamDaoContract'
import Header from '../components/header'
import ProposalCard, { ProposalCardSkeleton } from '../components/proposalCard'
import type {  Proposal } from '../types'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

// Define the tuple type for project data
type ProjectDataTuple = [
  bigint,
  string,
  string,
  string,
  string,
  string,
  bigint,
  bigint,
  bigint,
  boolean,
  string[]
]

// ERC20 ABI for balance checking
const erc20Abi = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

interface TokenInfo {
  address: string
  symbol?: string
  name?: string
  decimals?: number
  balance?: bigint
  formattedBalance?: string
}

function StakingCard({ projectId, onStakeSuccess }: { projectId: bigint, onStakeSuccess: () => void }) {
  const { connectionStatus } = usePushWalletContext()
  const { pushChainClient } = usePushChainClient()
  const { address } = useAccount()
  const [activeStakeTab, setActiveStakeTab] = useState<'stake' | 'unstake'>('stake')
  const [stakeAmount, setStakeAmount] = useState('')
  const [unstakeAmount, setUnstakeAmount] = useState('')
  const [tokensInfo, setTokensInfo] = useState<TokenInfo[]>([])
  const [allowance, setAllowance] = useState<bigint>(BigInt(0))
  const [isStaking, setIsStaking] = useState(false)
  const [isUnstaking, setIsUnstaking] = useState(false)

  const isConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED

  const { data: governanceTokens } = useReadContract({
    ...beamDAOContract,
    functionName: 'getProjectGovernanceTokens',
    args: [projectId],
  })

  const governanceTokensArray = (governanceTokens as string[]) || []
  const tokenAddress = governanceTokensArray[0] || '' // Use first governance token

  const { data: tokensData } = useReadContracts({
    contracts: governanceTokensArray.flatMap(token => [
      {
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: 'symbol',
      },
      {
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: 'name',
      },
      {
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      },
      {
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address!],
      },
    ]),
    query: {
      enabled: !!address && governanceTokensArray.length > 0,
    },
  })

  const { data: stakingInfo } = useReadContract({
    ...beamDAOContract,
    functionName: 'getUserStakingInfo',
    args: [projectId, address!, tokenAddress as `0x${string}`],
    query: {
      enabled: !!address && !!tokenAddress,
    },
  })

  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address!, beamDAOContract.address as `0x${string}`],
    query: {
      enabled: !!address && !!tokenAddress,
    },
  })

  useEffect(() => {
    if (currentAllowance) {
      setAllowance(currentAllowance as bigint)
    }
  }, [currentAllowance])

  useEffect(() => {
    if (tokensData && governanceTokensArray.length > 0) {
      const newTokensInfo: TokenInfo[] = []
      for (let i = 0; i < governanceTokensArray.length; i++) {
        const tokenAddress = governanceTokensArray[i]
        const baseIndex = i * 4

        const symbol = tokensData[baseIndex]?.result as string | undefined
        const name = tokensData[baseIndex + 1]?.result as string | undefined
        const decimals = tokensData[baseIndex + 2]?.result as number | undefined

        const balanceResult = tokensData[baseIndex + 3]?.result
        let balance: bigint = BigInt(0)

        if (balanceResult !== undefined && balanceResult !== null) {
          if (typeof balanceResult === 'bigint') {
            balance = balanceResult
          } else if (typeof balanceResult === 'string') {
            balance = BigInt(balanceResult)
          } else if (typeof balanceResult === 'number') {
            balance = BigInt(Math.floor(balanceResult))
          }
        }

        let formattedBalance = '0'
        if (balance && decimals) {
          formattedBalance = (Number(balance) / Math.pow(10, decimals)).toFixed(4)
        }

        newTokensInfo.push({
          address: tokenAddress,
          symbol: symbol || 'Unknown',
          name: name || 'Unknown Token',
          decimals: decimals || 18,
          balance: balance,
          formattedBalance,
        })
      }

      setTokensInfo(newTokensInfo)
    }
  }, [tokensData, governanceTokensArray, address])

  const selectedToken = tokensInfo[0]
  const userBalance = selectedToken?.formattedBalance || '0'

  // Get staking info from contract (stakedAmount, unstakingAmount, unstakingStartTime)
  const stakedAmount = stakingInfo ? formatUnits((stakingInfo as any[])[0], selectedToken?.decimals || 18) : '0'
  const unstakingAmountRaw = stakingInfo ? formatUnits((stakingInfo as any[])[1], selectedToken?.decimals || 18) : '0'
  const unstakingStartTime = stakingInfo ? Number((stakingInfo as any[])[2]) : 0

  // Calculate time remaining for unstaking (5 days = 432000 seconds)
  const UNSTAKING_PERIOD = 5 * 24 * 60 * 60 // 5 days in seconds
  const canCompleteUnstake = unstakingStartTime > 0 && (Date.now() / 1000) >= (unstakingStartTime + UNSTAKING_PERIOD)
  const timeRemainingSeconds = unstakingStartTime > 0 ? Math.max(0, (unstakingStartTime + UNSTAKING_PERIOD) - (Date.now() / 1000)) : 0
  const daysRemaining = Math.floor(timeRemainingSeconds / (24 * 60 * 60))
  const hoursRemaining = Math.floor((timeRemainingSeconds % (24 * 60 * 60)) / (60 * 60))

  const handleCompleteUnstake = async () => {
    if (!isConnected || !pushChainClient) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      const completeUnstakeData = PushChain.utils.helpers.encodeTxData({
        abi: JSON.parse(JSON.stringify(beamDAOContract.abi)),
        functionName: 'completeUnstake',
        args: [projectId, tokenAddress as `0x${string}`],
      })

      const completePromise = pushChainClient.universal.sendTransaction({
        to: beamDAOContract.address as `0x${string}`,
        value: BigInt('0'),
        data: completeUnstakeData,
      })

      toast.promise(completePromise, {
        loading: 'Completing unstake...',
        success: 'Unstake completed!',
        error: 'Failed to complete unstake',
      })

      await completePromise
      onStakeSuccess()
    } catch (error) {
      console.error(error)
    }
  }

  const handleStake = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isConnected || !pushChainClient) {
      toast.error('Please connect your wallet')
      return
    }

    if (!stakeAmount || !tokenAddress) {
      toast.error('Please enter an amount')
      return
    }

    const decimals = selectedToken?.decimals || 18
    const amountToStake = parseUnits(stakeAmount, decimals)

    setIsStaking(true)

    try {
      const needsApproval = allowance < amountToStake

      if (needsApproval) {
        const approvalData = PushChain.utils.helpers.encodeTxData({
          abi: JSON.parse(JSON.stringify(erc20Abi)),
          functionName: 'approve',
          args: [beamDAOContract.address, amountToStake],
        })

        const approvePromise = pushChainClient.universal.sendTransaction({
          to: tokenAddress as `0x${string}`,
          value: BigInt('0'),
          data: approvalData,
        })

        toast.promise(approvePromise, {
          loading: 'Approving...',
          success: 'Approved!',
          error: 'Approval failed',
        })

        await approvePromise
        refetchAllowance()
      }

      const stakeData = PushChain.utils.helpers.encodeTxData({
        abi: JSON.parse(JSON.stringify(beamDAOContract.abi)),
        functionName: 'stake',
        args: [projectId, tokenAddress as `0x${string}`, amountToStake],
      })

      const stakePromise = pushChainClient.universal.sendTransaction({
        to: beamDAOContract.address as `0x${string}`,
        value: BigInt('0'),
        data: stakeData,
      })

      toast.promise(stakePromise, {
        loading: 'Staking...',
        success: 'Staked!',
        error: 'Staking failed',
      })

      await stakePromise
      onStakeSuccess()
      setStakeAmount('')
    } catch (error) {
      console.error(error)
    } finally {
      setIsStaking(false)
    }
  }

  const handleUnstake = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isConnected || !pushChainClient) {
      toast.error('Please connect your wallet')
      return
    }

    if (!unstakeAmount || !tokenAddress) {
      toast.error('Please enter an amount')
      return
    }

    const decimals = selectedToken?.decimals || 18
    const amountToUnstake = parseUnits(unstakeAmount, decimals)

    setIsUnstaking(true)

    try {
      const unstakeData = PushChain.utils.helpers.encodeTxData({
        abi: JSON.parse(JSON.stringify(beamDAOContract.abi)),
        functionName: 'unstake',
        args: [projectId, tokenAddress as `0x${string}`, amountToUnstake],
      })

      const unstakePromise = pushChainClient.universal.sendTransaction({
        to: beamDAOContract.address as `0x${string}`,
        value: BigInt('0'),
        data: unstakeData,
      })

      toast.promise(unstakePromise, {
        loading: 'Unstaking...',
        success: 'Unstaked! Complete unstake after 5 days.',
        error: 'Unstaking failed',
      })

      await unstakePromise
      onStakeSuccess()
      setUnstakeAmount('')
    } catch (error) {
      console.error(error)
    } finally {
      setIsUnstaking(false)
    }
  }

  const handleMaxStake = () => {
    if (selectedToken && selectedToken.balance && selectedToken.decimals) {
      const maxAmount = Number(selectedToken.balance) / Math.pow(10, selectedToken.decimals)
      setStakeAmount(maxAmount.toString())
    }
  }

  const handleMaxUnstake = () => {
    setUnstakeAmount(stakedAmount)
  }

  const handleStakeAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setStakeAmount(value)
    }
  }

  const handleUnstakeAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setUnstakeAmount(value)
    }
  }

  if (!address) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
        <p className="text-gray-500">Please connect your wallet to stake tokens</p>
      </div>
    )
  }

  if (governanceTokensArray.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
        <p className="text-gray-500">No governance tokens available for this project</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Manage Stake</h3>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex space-x-4">
          <button
            onClick={() => setActiveStakeTab('stake')}
            className={`${
              activeStakeTab === 'stake'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Stake
          </button>
          <button
            onClick={() => setActiveStakeTab('unstake')}
            className={`${
              activeStakeTab === 'unstake'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Unstake
          </button>
        </nav>
      </div>

      {/* Stake Tab Content */}
      {activeStakeTab === 'stake' && (
        <form onSubmit={handleStake} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
            <input
              type="text"
              value={stakeAmount}
              onChange={handleStakeAmountChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="0.00"
              inputMode="decimal"
            />
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Balance: <span className="font-medium text-gray-900">{userBalance} {selectedToken?.symbol}</span>
              </span>
              <button
                type="button"
                onClick={handleMaxStake}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                MAX
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!stakeAmount || parseFloat(stakeAmount) <= 0 || isStaking}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2.5 px-4 rounded-lg font-medium transition-all"
          >
            {isStaking ? 'Staking...' : 'Stake'}
          </button>
        </form>
      )}

      {/* Unstake Tab Content */}
      {activeStakeTab === 'unstake' && (
        <form onSubmit={handleUnstake} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
            <input
              type="text"
              value={unstakeAmount}
              onChange={handleUnstakeAmountChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="0.00"
              inputMode="decimal"
            />
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Staked: <span className="font-medium text-gray-900">{stakedAmount} {selectedToken?.symbol}</span>
              </span>
              <button
                type="button"
                onClick={handleMaxUnstake}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                MAX
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!unstakeAmount || parseFloat(unstakeAmount) <= 0 || isUnstaking}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2.5 px-4 rounded-lg font-medium transition-all"
          >
            {isUnstaking ? 'Unstaking...' : 'Unstake'}
          </button>
        </form>
      )}

      {/* Unstaking Activity Section */}
      {parseFloat(unstakingAmountRaw) > 0 && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-yellow-900 mb-1">Unstaking in Progress</h4>
              <p className="text-xs text-yellow-800 mb-2">
                Amount: <span className="font-medium">{unstakingAmountRaw} {selectedToken?.symbol}</span>
              </p>
              {canCompleteUnstake ? (
                <button
                  onClick={handleCompleteUnstake}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-3 rounded-md text-sm font-medium transition-colors"
                >
                  Complete Unstake
                </button>
              ) : (
                <div className="text-xs text-yellow-700">
                  <p className="font-medium">Time remaining: {daysRemaining}d {hoursRemaining}h</p>
                  <p className="mt-1 text-yellow-600">You can complete the unstake after the waiting period</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Main ProjectDetailsPage component
export default function ProjectDetailsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { address } = useAccount()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'proposals' | 'activity' | 'stats'>('overview')

  const numericProjectId = projectId ? BigInt(projectId) : BigInt(0)

  const { data: projectData, refetch: refetchProjectData } = useReadContract({
    ...beamDAOContract,
    functionName: 'getProject',
    args: [numericProjectId],
    query: {
      enabled: !!numericProjectId,
      refetchInterval: 10000, // Auto-reload every 10 seconds
    },
  })

  const { data: proposalIds } = useReadContract({
    ...beamDAOContract,
    functionName: 'getProjectProposals',
    args: [numericProjectId],
    query: {
      enabled: !!numericProjectId,
      refetchInterval: 10000, // Auto-reload every 10 seconds
    },
  })

  const proposalContracts = (proposalIds as bigint[] || []).map(id => ({
    ...beamDAOContract,
    functionName: 'getProposalDetails',
    args: [id],
  }))

  const { data: proposalsData, isLoading: areProposalsLoading } = useReadContracts({
    contracts: proposalContracts,
    query: {
      enabled: proposalContracts.length > 0,
      refetchInterval: 10000, // Auto-reload every 10 seconds
    },
  })

  const { data: userStake, refetch: refetchUserStake } = useReadContract({
    ...beamDAOContract,
    functionName: 'getUserStake',
    args: [address!, numericProjectId],
    query: {
      enabled: !!address,
      refetchInterval: 10000, // Auto-reload every 10 seconds
    },
  });

  const { data: projectActivities } = useReadContract({
    ...beamDAOContract,
    functionName: 'getProjectActivities',
    args: [numericProjectId],
    query: {
      enabled: !!numericProjectId,
      refetchInterval: 10000, // Auto-reload every 10 seconds
    },
  });

  const { data: projectStakers } = useReadContract({
    ...beamDAOContract,
    functionName: 'getProjectStakers',
    args: [numericProjectId],
    query: {
      enabled: !!numericProjectId,
      refetchInterval: 10000, // Auto-reload every 10 seconds
    },
  });

  const { data: stakerCount } = useReadContract({
    ...beamDAOContract,
    functionName: 'getProjectStakerCount',
    args: [numericProjectId],
    query: {
      enabled: !!numericProjectId,
      refetchInterval: 10000, // Auto-reload every 10 seconds
    },
  });

  useEffect(() => {
    if (proposalsData) {
      console.log('Raw proposals data:', proposalsData) // Debug log

      const fetchedProposals = proposalsData.map((proposal: any) => {
        // Check if proposal.result exists and is an array (tuple)
        if (!proposal.result || !Array.isArray(proposal.result)) {
          console.warn('Invalid proposal data:', proposal)
          return null
        }

        // Extract data from tuple based on contract ABI order
        const [
          id,
          projectId,
          title,
          description,
          yesVotes,
          noVotes,
          totalVoted,
          startTime,
          endTime,
          completed,
          creator
        ] = proposal.result

        return {
          id: Number(id || 0),
          projectId: Number(projectId || 0),
          title: title || 'Untitled Proposal',
          description: description || 'No description',
          yesVotes: BigInt(yesVotes || 0),
          noVotes: BigInt(noVotes || 0),
          totalVoted: BigInt(totalVoted || 0),
          startTime: Number(startTime || 0),
          endTime: Number(endTime || 0),
          completed: completed || false,
          creator: creator || 'Unknown'
        }
      }).filter(Boolean) as Proposal[] // Remove null values

      setProposals(fetchedProposals)
    }
  }, [proposalsData, proposalIds])

  // Safe project data extraction with type checking
  const project = projectData ? (() => {
    const data = projectData as unknown as ProjectDataTuple
    return {
      id: Number(data[0]),
      name: data[1],
      logoURI: data[2],
      backdropURI: data[3],
      bio: data[4],
      creator: data[5],
      totalStaked: data[6],
      proposalCount: Number(data[7]),
      createdAt: Number(data[8]),
      active: data[9],
      governanceTokens: data[10]
    }
  })() : null

  const { data: tokenSymbol } = useReadContract({
    address: project?.governanceTokens[0] as `0x${string}`,
    abi: erc20Abi,
    functionName: 'symbol',
    query: {
      enabled: !!project && project.governanceTokens.length > 0,
    },
  })

  const handleStakeSuccess = () => {
    refetchProjectData()
    refetchUserStake()
  }


  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading project...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section with Backdrop */}
      <div className="relative">
        {/* Backdrop Image */}
        {project.backdropURI && (
          <div className="w-full h-48 md:h-64 bg-gray-900">
            <img
              src={project.backdropURI}
              alt="Project backdrop"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
        )}

        {/* Project Details - Below Backdrop */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
              {/* Logo */}
              {project.logoURI && (
                <div className="flex-shrink-0">
                  <img
                    src={project.logoURI}
                    alt={project.name}
                    className="w-20 h-20 md:w-24 md:h-24 rounded-xl object-cover border-2 border-gray-200 shadow-md"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              )}

              {/* Project Info */}
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{project.name}</h1>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${project.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {project.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-gray-700 text-base mb-3 max-w-3xl">{project.bio}</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                    <span className="font-medium text-gray-900">Total Staked:</span> <span className="text-gray-700">{project ? formatUnits(project.totalStaked, 18) : '0'} {tokenSymbol}</span>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                    <span className="font-medium text-gray-900">Proposals:</span> <span className="text-gray-700">{project.proposalCount}</span>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                    <span className="font-medium text-gray-900">Created:</span> <span className="text-gray-700">{new Date(project.createdAt * 1000).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content with Tabs */}
          <div className="lg:col-span-2">
            <div>
              {/* Tab Navigation */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-3 sm:space-y-0">
                <div className="border-b border-gray-200 w-full sm:w-auto">
                  <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button
                      onClick={() => setActiveTab('overview')}
                      className={`${
                        activeTab === 'overview'
                          ? 'border-purple-500 text-purple-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setActiveTab('proposals')}
                      className={`${
                        activeTab === 'proposals'
                          ? 'border-purple-500 text-purple-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                    >
                      Proposals
                    </button>
                    <button
                      onClick={() => setActiveTab('activity')}
                      className={`${
                        activeTab === 'activity'
                          ? 'border-purple-500 text-purple-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                    >
                      Activity
                    </button>
                    <button
                      onClick={() => setActiveTab('stats')}
                      className={`${
                        activeTab === 'stats'
                          ? 'border-purple-500 text-purple-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                    >
                      Vote Stats
                    </button>
                  </nav>
                </div>
                {activeTab === 'proposals' && address === project.creator && (
                  <button
                    onClick={() => window.location.href = `/project/${projectId}/create-proposal`}
                    className="text-white px-4 py-2 rounded-lg font-medium transition-colors hover:opacity-90 flex-shrink-0"
                    style={{ backgroundColor: '#d947f2' }}
                  >
                    + Create Proposal
                  </button>
                )}
              </div>

              {/* Tab Content */}
              <div className="mt-6">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Project Creator - Simplified */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-500">Project Creator</p>
                          <p className="text-sm font-mono text-gray-900">{project.creator.slice(0, 8)}...{project.creator.slice(-6)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Recent Activity Table */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Activity</h3>
                      {projectActivities && Array.isArray(projectActivities) && (projectActivities as any[]).length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {(projectActivities as any[]).slice().reverse().slice(0, 10).map((activity: any, index: number) => {
                                const activityTypes = ['Project created', 'Proposal created', 'Token staked to the DAO', 'Voted', 'Proposal completed'];
                                const activityType = activityTypes[Number(activity.activityType)] || 'Unknown';

                                // Calculate relative time
                                const activityTime = Number(activity.timestamp) * 1000;
                                const now = Date.now();
                                const diffMs = now - activityTime;
                                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                                const diffMinutes = Math.floor(diffMs / (1000 * 60));

                                let timeAgo;
                                if (diffDays > 0) {
                                  timeAgo = `${diffDays}d ago`;
                                } else if (diffHours > 0) {
                                  timeAgo = `${diffHours}h ago`;
                                } else if (diffMinutes > 0) {
                                  timeAgo = `${diffMinutes}m ago`;
                                } else {
                                  timeAgo = 'Just now';
                                }

                                return (
                                  <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 whitespace-nowrap">
                                      <span className="text-xs font-medium text-gray-900">
                                        {activityType}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-gray-600">
                                      {activity.user.slice(0, 6)}...{activity.user.slice(-4)}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                                      {activity.amount && BigInt(activity.amount) > 0n ? formatUnits(BigInt(activity.amount), 18) : '-'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                                      {timeAgo}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-500">
                          <p className="text-sm">No activity yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Proposals Tab */}
                {activeTab === 'proposals' && (
                  <div>
                    {areProposalsLoading ? (
                      <div className="space-y-4">
                        <ProposalCardSkeleton />
                        <ProposalCardSkeleton />
                        <ProposalCardSkeleton />
                      </div>
                    ) : proposals.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">No proposals yet</h3>
                        <p className="text-gray-500 max-w-md mx-auto">
                          Be the first to create a proposal and help shape the future of this project.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {proposals.map(proposal => (
                          <ProposalCard key={proposal.id} proposal={proposal} userStake={userStake as bigint | undefined} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Activity Tab */}
                {activeTab === 'activity' && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">All Project Activity</h3>
                    {projectActivities && Array.isArray(projectActivities) && (projectActivities as any[]).length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {(projectActivities as any[]).slice().reverse().map((activity: any, index: number) => {
                              const activityTypes = ['Project created', 'Proposal created', 'Token staked to the DAO', 'Voted', 'Proposal completed'];
                              const activityType = activityTypes[Number(activity.activityType)] || 'Unknown';

                              // Calculate relative time
                              const activityTime = Number(activity.timestamp) * 1000;
                              const now = Date.now();
                              const diffMs = now - activityTime;
                              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                              const diffMinutes = Math.floor(diffMs / (1000 * 60));

                              let timeAgo;
                              if (diffDays > 0) {
                                timeAgo = `${diffDays}d ago`;
                              } else if (diffHours > 0) {
                                timeAgo = `${diffHours}h ago`;
                              } else if (diffMinutes > 0) {
                                timeAgo = `${diffMinutes}m ago`;
                              } else {
                                timeAgo = 'Just now';
                              }

                              return (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {index + 1}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                      {activityType}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                                    {activity.user.slice(0, 6)}...{activity.user.slice(-4)}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    {activity.amount && BigInt(activity.amount) > 0n ? formatUnits(BigInt(activity.amount), 18) : '-'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {timeAgo}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No activity yet</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Vote Stats Tab */}
                {activeTab === 'stats' && (
                  <div className="space-y-6">
                    {/* Overview Stats - All in one line */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                        <p className="text-xs font-medium text-green-800">Total Staked</p>
                        <p className="text-lg font-bold text-green-900 mt-1">
                          {formatUnits(project.totalStaked, 18)}
                        </p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                        <p className="text-xs font-medium text-purple-800">Total Stakers</p>
                        <p className="text-lg font-bold text-purple-900 mt-1">
                          {stakerCount ? Number(stakerCount) : 0}
                        </p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                        <p className="text-xs font-medium text-blue-800">Total Proposals</p>
                        <p className="text-lg font-bold text-blue-900 mt-1">{proposals.length}</p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
                        <p className="text-xs font-medium text-emerald-800">Active Proposals</p>
                        <p className="text-lg font-bold text-emerald-900 mt-1">
                          {proposals.filter(p => !p.completed && new Date().getTime() / 1000 <= p.endTime).length}
                        </p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                        <p className="text-xs font-medium text-gray-800">Ended Proposals</p>
                        <p className="text-lg font-bold text-gray-900 mt-1">
                          {proposals.filter(p => p.completed || new Date().getTime() / 1000 > p.endTime).length}
                        </p>
                      </div>
                    </div>

                    {/* Stakers Table */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Stakers</h4>
                      {projectStakers && Array.isArray(projectStakers) && (projectStakers as string[]).length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {(projectStakers as string[]).map((staker: string, index: number) => (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {index + 1}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                                    {staker.slice(0, 10)}...{staker.slice(-8)}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                      Active
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>No stakers yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <StakingCard projectId={numericProjectId} onStakeSuccess={handleStakeSuccess} />

            {/* Project Info Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Project Details
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    <span className="text-sm font-medium text-gray-600">Creator</span>
                  </div>
                  <span className="text-sm font-mono text-gray-900 bg-white px-2 py-1 rounded border">
                    {project.creator.slice(0, 6)}...{project.creator.slice(-4)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <span className="text-sm font-medium text-gray-600">Created</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(project.createdAt * 1000).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 6v-1m0 1H9.5M12 14a2 2 0 100-4 2 2 0 000 4zm0 0v1m0-1H9.5m10.5-11l-1.5 1.5M4.5 4.5l1.5 1.5M19.5 19.5l-1.5-1.5M4.5 19.5l1.5-1.5"></path></svg>
                    <span className="text-sm font-medium text-gray-600">Governance Tokens</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {project.governanceTokens?.length || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}