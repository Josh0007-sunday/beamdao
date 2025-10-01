import { useParams } from 'react-router-dom'
import { useAccount, useReadContract, useReadContracts, useWriteContract } from 'wagmi'
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

function StakeCard({ projectId, onStakeSuccess }: { projectId: bigint, onStakeSuccess: () => void }) {
  const { address } = useAccount()
  const { writeContractAsync, isPending } = useWriteContract()
  const [amount, setAmount] = useState('')
  const [tokenAddress, setTokenAddress] = useState('')
  const [tokensInfo, setTokensInfo] = useState<TokenInfo[]>([])
  const [allowance, setAllowance] = useState<bigint>(BigInt(0))

  const { data: governanceTokens } = useReadContract({
    ...beamDAOContract,
    functionName: 'getProjectGovernanceTokens',
    args: [projectId],
  })

  const governanceTokensArray = (governanceTokens as string[]) || []

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

  const selectedToken = tokensInfo.find(token => token.address === tokenAddress)
  const userBalance = selectedToken?.formattedBalance || '0'

  const handleStakeFlow = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address || !amount || !tokenAddress) {
      alert('Please fill all fields and connect wallet')
      return
    }

    const decimals = selectedToken?.decimals || 18
    const amountToStake = parseUnits(amount, decimals)

    try {
      const needsApproval = allowance < amountToStake

      if (needsApproval) {
        const approvePromise = writeContractAsync({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [beamDAOContract.address, amountToStake],
        })

        toast.promise(approvePromise, {
          loading: 'Approving...',
          success: 'Approved!',
          error: 'Approval failed',
        })

        await approvePromise
        refetchAllowance()
      }

      const stakePromise = writeContractAsync({
        ...beamDAOContract,
        functionName: 'stake',
        args: [projectId, tokenAddress as `0x${string}`, amountToStake],
      })

      toast.promise(stakePromise, {
        loading: 'Staking...',
        success: 'Staked!',
        error: 'Staking failed',
      })

      await stakePromise
      onStakeSuccess()

      setAmount('')
      setTokenAddress('')
    } catch (error) {
      console.error(error)
    }
  }

  const handleMax = () => {
    if (selectedToken && selectedToken.balance && selectedToken.decimals) {
      const maxAmount = Number(selectedToken.balance) / Math.pow(10, selectedToken.decimals)
      setAmount(maxAmount.toString())
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Stake Tokens</h3>
      
      {!address ? (
        <div className="text-center py-4">
          <p className="text-gray-500">Please connect your wallet to stake tokens</p>
        </div>
      ) : governanceTokensArray.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-gray-500">No governance tokens available for this project</p>
        </div>
      ) : (
        <form onSubmit={handleStakeFlow} className="space-y-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Token</label>
            <select
              value={tokenAddress}
              onChange={(e) => {
                setTokenAddress(e.target.value)
                setAmount('')
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              required
            >
              <option value="">Select a token</option>
              {tokensInfo.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol} - {token.name} (Balance: {token.formattedBalance})
                </option>
              ))}
            </select>
          </div>

          {tokenAddress && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">Amount</label>
                <div className="text-sm text-gray-500">
                  Balance: {userBalance} {selectedToken?.symbol}
                  <button
                    type="button"
                    onClick={handleMax}
                    className="ml-2 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    MAX
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                required
                placeholder="0.00"
                inputMode="decimal"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter amount to stake. Minimum: 0.000001
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={!amount || !tokenAddress || parseFloat(amount) <= 0 || isPending}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium transition-all duration-200 transform hover:scale-[1.02] shadow-md"
          >
            {isPending ? 'Processing...' : 'Stake Tokens'}
          </button>

          {selectedToken && (
            <div className="mt-2 p-2 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-1">Token Details:</h4>
              <div className="text-xs text-blue-700 space-y-1">
                <p><span className="font-medium">Symbol:</span> {selectedToken.symbol}</p>
                <p><span className="font-medium">Name:</span> {selectedToken.name}</p>
                <p><span className="font-medium">Your Balance:</span> {userBalance} {selectedToken.symbol}</p>
                <p><span className="font-medium">Decimals:</span> {selectedToken.decimals}</p>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  )
}


// ... rest of your ProjectDetailsPage component remains the same
export default function ProjectDetailsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { address } = useAccount()
  const [proposals, setProposals] = useState<Proposal[]>([])

  const numericProjectId = projectId ? BigInt(projectId) : BigInt(0)

  const { data: projectData, refetch: refetchProjectData } = useReadContract({
    ...beamDAOContract,
    functionName: 'getProject',
    args: [numericProjectId],
    query: { enabled: !!numericProjectId },
  })

  const { data: proposalIds } = useReadContract({
    ...beamDAOContract,
    functionName: 'getProjectProposals',
    args: [numericProjectId],
    query: { enabled: !!numericProjectId },
  })

  const proposalContracts = (proposalIds as bigint[] || []).map(id => ({
    ...beamDAOContract,
    functionName: 'getProposalDetails',
    args: [id],
  }))

  const { data: proposalsData, isLoading: areProposalsLoading } = useReadContracts({
    contracts: proposalContracts,
    query: { enabled: proposalContracts.length > 0 },
  })

  const { data: userStake, refetch: refetchUserStake } = useReadContract({
    ...beamDAOContract,
    functionName: 'getUserStake',
    args: [address!, numericProjectId],
    query: {
      enabled: !!address,
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
          quorum,
          startTime,
          endTime,
          executed,
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
          quorum: BigInt(quorum || 0),
          startTime: Number(startTime || 0),
          endTime: Number(endTime || 0),
          executed: executed || false,
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
      <div className="relative bg-gradient-to-r from-blue-600 to-purple-700">
        {project.backdropURI && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${project.backdropURI})` }}
          />
        )}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center md:items-center space-y-6 md:space-y-0 md:space-x-8">
            {project.logoURI && (
              <div className="flex-shrink-0">
                <img
                  src={project.logoURI}
                  alt={project.name}
                  className="w-24 h-24 md:w-32 md:h-32 rounded-2xl object-cover border-4 border-white shadow-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
            )}
            <div className="flex-1 text-white">
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-bold">{project.name}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${project.active ? 'bg-green-400 text-green-900' : 'bg-red-400 text-red-900'}`}>
                  {project.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-blue-100 text-lg mb-4 max-w-3xl">{project.bio}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <span className="font-semibold">Total Staked:</span> {project ? formatUnits(project.totalStaked, 18) : '0'} {tokenSymbol}
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <span className="font-semibold">Proposals:</span> {project.proposalCount}
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <span className="font-semibold">Created:</span> {new Date(project.createdAt * 1000).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Proposals Section */}
          <div className="lg:col-span-2">
            <div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-3 sm:space-y-0">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Proposals</h2>
                  <p className="text-gray-600 mt-1">Manage and vote on project proposals</p>
                </div>
                {address === project.creator && (
                  <button
                    onClick={() => window.location.href = `/project/${projectId}/create-proposal`}
                    className="text-white px-4 py-2 rounded-lg font-medium transition-colors hover:opacity-90"
                    style={{ backgroundColor: '#d947f2' }}
                  >
                    + Create Proposal
                  </button>
                )}
              </div>

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
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <StakeCard projectId={numericProjectId} onStakeSuccess={handleStakeSuccess} />

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