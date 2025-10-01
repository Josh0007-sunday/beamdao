import { useState } from 'react'
import Header from '../components/header'

const sections = {
  introduction: {
    title: 'Introduction',
    content: (
      <div>
        <p className="text-lg">
          Welcome to the BeamDAO documentation. Here you will find everything you need to know about how our DAO operates, from creating projects to voting on proposals.
        </p>
        <h2>What is BeamDAO?</h2>
        <p>
          BeamDAO is a decentralized autonomous organization (DAO) that allows communities to govern their own projects in a decentralized way. It provides a platform for creating projects, proposing changes, and voting on those changes using governance tokens.
        </p>
      </div>
    ),
  },
  projects: {
    title: 'Projects',
    content: (
      <div>
        <p>
          Projects are the core of BeamDAO. Anyone can create a project, which represents a community or a goal. Each project has its own set of governance tokens that are used for staking and voting.
        </p>
      </div>
    ),
  },
  staking: {
    title: 'Staking',
    content: (
      <div>
        <p>
          Staking is the process of locking up your governance tokens in a project to gain voting power. The more tokens you stake, the more voting power you have. Staking is essential for participating in the governance of a project.
        </p>
        <p>
          To stake your tokens, go to the project page and use the "Stake Tokens" card. You will need to approve the spending of your tokens before you can stake them.
        </p>
      </div>
    ),
  },
  governance: {
    title: 'Governance',
    content: (
      <div>
        <p>
          Governance in BeamDAO is done through proposals. A proposal is a suggestion for a change in a project. Only the creator of a project can create a proposal. This is to ensure that the project's vision is maintained and to prevent spam proposals.
        </p>
      </div>
    ),
  },
  quorum: {
    title: 'Quorum',
    content: (
      <div>
        <p>
          Quorum is the minimum number of votes required for a proposal to be considered valid. It is set by the creator of the proposal. If a proposal does not reach quorum, it will be defeated, even if it has more 'yes' votes than 'no' votes.
        </p>
        <p>
          For example, let's say a project has a total of 1,000,000 tokens staked. The creator of a proposal sets the quorum to 10%, which means at least 100,000 votes are required for the proposal to be considered.
        </p>
        <p>
          If the proposal gets 60,000 'yes' votes and 10,000 'no' votes, the total number of votes is 70,000. Since 70,000 is less than the 100,000 quorum, the proposal is defeated, even though it had more 'yes' votes.
        </p>
      </div>
    ),
  },
  voting: {
    title: 'Voting',
    content: (
      <div>
        <p>
          Once a proposal is created, it enters a voting period. During this period, anyone who has staked tokens in the project can vote "yes" or "no" on the proposal. Your voting power is proportional to the amount of tokens you have staked.
        </p>
      </div>
    ),
  },
  executing: {
    title: 'Executing Proposals',
    content: (
      <div>
        <p>
          If a proposal reaches quorum and has more "yes" votes than "no" votes at the end of the voting period, it can be executed. Executing a proposal means that the proposed change is implemented. In the context of BeamDAO, this is currently a symbolic action, but it can be used to trigger off-chain events or smart contract interactions in the future.
        </p>
      </div>
    ),
  },
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('introduction')

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-3">
            <div className="sticky top-24">
              <ul className="space-y-2">
                {Object.entries(sections).map(([key, { title }]) => (
                  <li key={key}>
                    <button
                      onClick={() => setActiveSection(key)}
                      className={`w-full text-left px-4 py-2 rounded-lg transition-colors duration-200 ${activeSection === key ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-100'}`}>
                      {title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="col-span-9">
            <div className="prose prose-lg">
              <h1>{sections[activeSection].title}</h1>
              {sections[activeSection].content}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
