export interface Proposal {
  id: number
  projectId: number
  title: string
  description: string
  yesVotes: bigint
  noVotes: bigint
  totalVoted: bigint
  startTime: number
  endTime: number
  completed: boolean
  creator: string
}

export interface Project {
  id: number
  name: string
  logoURI: string
  backdropURI: string
  bio: string
  creator: string
  totalStaked: bigint
  proposalCount: number
  createdAt: number
  active: boolean
  governanceTokens: string[]
}

export interface ProposalResult {
  yesVotes: bigint
  noVotes: bigint
  totalVoted: bigint
  yesPercentage: number
  noPercentage: number
  isCompleted: boolean
  timeRemaining: bigint
}

export interface Activity {
  user: string
  activityType: number // 0=ProjectCreated, 1=ProposalCreated, 2=Staked, 3=Voted, 4=ProposalCompleted
  timestamp: bigint
  amount: bigint
}

export type HasVotedResponse = boolean