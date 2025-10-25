import type { Abi } from 'viem'
import BeamDAOArtifact from './BeamDAO.json'

// Replace with your deployed contract address
export const BEAM_DAO_ADDRESS = '0x151DC9F0Bd4487d895a012040a951fA239ff5aBF'

// Export for easy importing
export const beamDAOContract = {
  address: BEAM_DAO_ADDRESS as `0x${string}`,
  abi: BeamDAOArtifact.abi as Abi,
}