import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

// Load environment variables BEFORE accessing process.env
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    "push-donut": {
      url: "https://evm.rpc-testnet-donut-node1.push.org/",
      chainId: 42101,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gas: "auto",
      gasPrice: "auto",
    },
  },
  etherscan: {
    apiKey: {
      "push-donut": process.env.ETHERSCAN_API_KEY || "abc"
    },
    customChains: [
      {
        network: "push-donut",
        chainId: 42101,
        urls: {
          apiURL: "https://donut.push.network/api",
          browserURL: "https://donut.push.network"
        }
      }
    ]
  },
  paths: {
    tests: "./test"
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};

export default config;