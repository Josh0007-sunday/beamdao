export interface Proposal {
  id: number
  projectId: number
  title: string
  description: string
  yesVotes: bigint
  noVotes: bigint
  totalVoted: bigint
  quorum: bigint
  startTime: number
  endTime: number
  executed: boolean
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

export type HasVotedResponse = boolean