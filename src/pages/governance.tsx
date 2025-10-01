import { useState, useEffect } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { beamDAOContract } from '../contracts/beamDaoContract'
import Header from '../components/header'
import type { Project } from '../types'
import { formatUnits } from 'viem'
import homeHeaderLeft from '../assets/homeHeaderLeft.svg'
import homeHeaderRight from '../assets/homeHeaderRight.svg'

function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate()
  
  return (
    <div 
      className="bg-white rounded-lg border border-gray-200 shadow-md transition-shadow cursor-pointer overflow-hidden hover:shadow-lg"
      onClick={() => navigate(`/project/${project.id}`)}
    >
      <div className="h-24 bg-cover bg-center" style={{ backgroundImage: `url(${project.backdropURI})` }}></div>
      <div className="p-4">
        <div className="flex items-center">
          <img className="h-12 w-12 rounded-full -mt-8 border-4 border-white" src={project.logoURI} alt="" />
          <div className="ml-4">
            <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
          </div>
        </div>
        <p className="text-gray-600 text-sm mt-2">Creator: {project.creator ? `${project.creator.slice(0, 6)}...${project.creator.slice(-4)}` : 'Unknown'}</p>
        <p className="text-gray-600 text-sm">Total Staked: {formatUnits(project.totalStaked, 18)} tokens</p>
      </div>
    </div>
  )
}

function ProjectCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-md overflow-hidden animate-pulse">
      <div className="h-24 bg-gray-200"></div>
      <div className="p-4">
        <div className="flex items-center">
          <div className="h-12 w-12 rounded-full -mt-8 border-4 border-white bg-gray-200"></div>
          <div className="ml-4">
            <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
        <div className="h-3 bg-gray-200 rounded w-full mt-2"></div>
        <div className="h-3 bg-gray-200 rounded w-3/4 mt-2"></div>
      </div>
    </div>
  )
}

export default function Governance() {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  const { data: projectCountData } = useReadContract({
    ...beamDAOContract,
    functionName: 'getProjectCount',
  })

  const projectCount = Number(projectCountData || 0)

  // Create contracts for each project
  const projectsContracts = Array.from({ length: projectCount }, (_, i) => ({
    ...beamDAOContract,
    functionName: 'getProject',
    args: [BigInt(i + 1)],
  }))

  const { data: projectsData } = useReadContracts({
    contracts: projectsContracts,
    query: { 
      enabled: projectCount > 0 && projectsContracts.length > 0,
    },
  })

  useEffect(() => {
    if (projectsData) {
      const fetchedProjects = projectsData
        .map((project: any, i: number) => {
          if (!project.result) return null
          
          // The getProject function returns a tuple with specific fields
          const [
            id,
            name,
            logoURI,
            backdropURI,
            bio,
            creator,
            totalStaked,
            proposalCount,
            createdAt,
            active,
            governanceTokens
          ] = project.result

          return {
            id: Number(id),
            name: name || `Project ${i + 1}`,
            logoURI,
            backdropURI,
            bio,
            creator,
            totalStaked: BigInt(totalStaked || 0),
            proposalCount: Number(proposalCount || 0),
            createdAt: Number(createdAt || 0),
            active: Boolean(active),
            governanceTokens
          }
        })
        .filter(Boolean) as Project[] // Remove null values

      setProjects(fetchedProjects)
      setIsLoading(false)
    } else if (projectCount === 0) {
      // If there are no projects, set loading to false immediately
      setIsLoading(false)
    }
  }, [projectsData, projectCount])

  // Show loading state while data is being fetched
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white relative">
        <Header />
        <img src={homeHeaderLeft} alt="" className="hidden md:block w-80 h-80 absolute left-0 top-10" />
        <img src={homeHeaderRight} alt="" className="hidden md:block w-80 h-80 absolute right-0 top-10" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">The governance hub of push chain</h1>
          </div>
          <p className="text-gray-500 text-center">Vote on your favorite community, via the governance token.</p>
          <div className="mb-25 flex justify-center">
            <div className="w-full max-w-md mb-8">
              <div className="w-full h-10 bg-gray-200 rounded-lg animate-pulse"></div>
            </div>
          </div>
          <div className="flex justify-between items-center mb-8">
            <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
            <div className="h-10 bg-gray-200 rounded w-40 animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <ProjectCardSkeleton key={index} />
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white relative">
      <Header />
      <img src={homeHeaderLeft} alt="" className="hidden md:block w-80 h-80 absolute left-0 top-10" />
      <img src={homeHeaderRight} alt="" className="hidden md:block w-80 h-80 absolute right-0 top-10" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">The governance hub of push chain</h1>
        </div>
        <p className="text-gray-500 text-center">Vote on your favorite community, via the governance token.</p>
        <div className="mb-25 flex justify-center">
          <div className="w-full max-w-md mb-8">
            <input 
              type="text" 
              placeholder="Search projects..." 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
            />
          </div>
        </div>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <button 
            className="text-white px-4 py-2 rounded-lg font-medium transition-colors hover:opacity-90"
            style={{ backgroundColor: '#d947f2' }}
            onClick={() => navigate('/create-project')}
          >
            Create Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-lg mb-4">No projects created yet.</p>
            <p className="text-gray-400 text-sm">
              Be the first to create a project and start governing with BeamDAO.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}