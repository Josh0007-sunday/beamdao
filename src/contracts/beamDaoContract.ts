import type { Abi } from 'viem'
import BeamDAOArtifact from './BeamDAO.json'

// Replace with your deployed contract address
export const BEAM_DAO_ADDRESS = '0x7076bBC4ade3533577dBD5631Dd7589F03B43658'

// Export for easy importing
export const beamDAOContract = {
  address: BEAM_DAO_ADDRESS as `0x${string}`,
  abi: BeamDAOArtifact.abi as Abi,
}