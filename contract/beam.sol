// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract BeamDAO is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.UintSet;

    // ============ STRUCTS ============

    struct Project {
        uint256 id;
        string name;
        string logoURI;
        string backdropURI;
        string bio;
        address creator;
        uint256 totalStaked;
        uint256 proposalCount;
        uint256 createdAt;
        bool active;
    }

    struct StakingInfo {
        uint256 stakedAmount;
        uint256 unstakingAmount;
        uint256 unstakingStartTime;
    }

    struct Proposal {
        uint256 id;
        uint256 projectId;
        string title;
        string description;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 totalVoted;
        uint256 quorum;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        address creator;
    }

    // ============ CONSTANTS ============

    uint256 public constant UNSTAKING_PERIOD = 5 days;
    uint256 public constant EMERGENCY_PENALTY = 5000; // 50% in basis points
    uint256 public constant VOTING_DURATION = 7 days;
    uint256 public constant MIN_QUORUM = 1000; // 10% of total staked

    // ============ STATE VARIABLES ============

    uint256 private _projectCounter;
    uint256 private _proposalCounter;
    
    mapping(uint256 => Project) public projects;
    mapping(uint256 => EnumerableSet.AddressSet) private _projectGovernanceTokens;
    mapping(uint256 => mapping(address => uint256)) public totalStakedPerToken;
    mapping(uint256 => mapping(address => mapping(address => StakingInfo))) public stakingInfo;
    
    // Proposal mappings
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => EnumerableSet.UintSet) private _projectProposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => uint256)) public votingPowerSnapshot;

    // ============ EVENTS ============

    event ProjectCreated(uint256 indexed projectId, address indexed creator);
    event ProjectUpdated(uint256 indexed projectId, address indexed updater);
    event Staked(uint256 indexed projectId, address indexed user, address indexed token, uint256 amount);
    event Unstaked(uint256 indexed projectId, address indexed user, address indexed token, uint256 amount);
    event EmergencyUnstaked(uint256 indexed projectId, address indexed user, address indexed token, uint256 amount, uint256 penalty);
    event ProposalCreated(uint256 indexed proposalId, uint256 indexed projectId, address indexed creator);
    event Voted(uint256 indexed proposalId, address indexed voter, bool support, uint256 power);
    event ProposalExecuted(uint256 indexed proposalId, uint256 indexed projectId);

    // ============ MODIFIERS ============

    modifier onlyProjectCreator(uint256 projectId) {
        require(projects[projectId].creator == msg.sender, "Not project creator");
        _;
    }

    modifier projectExists(uint256 projectId) {
        require(projectId > 0 && projectId <= _projectCounter, "Project does not exist");
        require(projects[projectId].active, "Project not active");
        _;
    }

    modifier proposalExists(uint256 proposalId) {
        require(proposalId > 0 && proposalId <= _proposalCounter, "Proposal does not exist");
        _;
    }

    modifier validToken(uint256 projectId, address token) {
        require(_projectGovernanceTokens[projectId].contains(token), "Token not accepted for governance");
        _;
    }

    // ============ PROJECT MANAGEMENT ============

    function createProject(
        string memory name,
        string memory logoURI,
        string memory backdropURI,
        string memory bio,
        address[] memory governanceTokens
    ) external returns (uint256) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(governanceTokens.length > 0, "At least one governance token required");

        _projectCounter++;
        uint256 projectId = _projectCounter;

        projects[projectId] = Project({
            id: projectId,
            name: name,
            logoURI: logoURI,
            backdropURI: backdropURI,
            bio: bio,
            creator: msg.sender,
            totalStaked: 0,
            proposalCount: 0,
            createdAt: block.timestamp,
            active: true
        });

        for (uint256 i = 0; i < governanceTokens.length; i++) {
            require(governanceTokens[i] != address(0), "Invalid token address");
            _projectGovernanceTokens[projectId].add(governanceTokens[i]);
        }

        emit ProjectCreated(projectId, msg.sender);
        return projectId;
    }

    function updateProject(
        uint256 projectId,
        string memory name,
        string memory logoURI,
        string memory backdropURI,
        string memory bio
    ) external projectExists(projectId) onlyProjectCreator(projectId) {
        require(bytes(name).length > 0, "Name cannot be empty");

        projects[projectId].name = name;
        projects[projectId].logoURI = logoURI;
        projects[projectId].backdropURI = backdropURI;
        projects[projectId].bio = bio;

        emit ProjectUpdated(projectId, msg.sender);
    }

    function getProject(uint256 projectId) external view returns (
        uint256 id,
        string memory name,
        string memory logoURI,
        string memory backdropURI,
        string memory bio,
        address creator,
        uint256 totalStaked,
        uint256 proposalCount,
        uint256 createdAt,
        bool active,
        address[] memory governanceTokens
    ) {
        require(projectId > 0 && projectId <= _projectCounter, "Project does not exist");
        
        Project storage project = projects[projectId];
        governanceTokens = _projectGovernanceTokens[projectId].values();
        
        return (
            project.id,
            project.name,
            project.logoURI,
            project.backdropURI,
            project.bio,
            project.creator,
            project.totalStaked,
            project.proposalCount,
            project.createdAt,
            project.active,
            governanceTokens
        );
    }

    // ============ STAKING SYSTEM ============

    function stake(
        uint256 projectId,
        address token,
        uint256 amount
    ) external nonReentrant projectExists(projectId) validToken(projectId, token) {
        require(amount > 0, "Amount must be greater than 0");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        StakingInfo storage userStaking = stakingInfo[projectId][msg.sender][token];
        userStaking.stakedAmount += amount;
        
        totalStakedPerToken[projectId][token] += amount;
        projects[projectId].totalStaked += amount;

        emit Staked(projectId, msg.sender, token, amount);
    }

    function unstake(
        uint256 projectId,
        address token,
        uint256 amount
    ) external nonReentrant projectExists(projectId) validToken(projectId, token) {
        require(amount > 0, "Amount must be greater than 0");
        
        StakingInfo storage userStaking = stakingInfo[projectId][msg.sender][token];
        require(userStaking.stakedAmount >= amount, "Insufficient staked balance");
        require(userStaking.unstakingAmount == 0, "Already unstaking");

        userStaking.stakedAmount -= amount;
        userStaking.unstakingAmount = amount;
        userStaking.unstakingStartTime = block.timestamp;

        totalStakedPerToken[projectId][token] -= amount;
        projects[projectId].totalStaked -= amount;

        emit Unstaked(projectId, msg.sender, token, amount);
    }

    function completeUnstake(
        uint256 projectId,
        address token
    ) external nonReentrant projectExists(projectId) validToken(projectId, token) {
        StakingInfo storage userStaking = stakingInfo[projectId][msg.sender][token];
        require(userStaking.unstakingAmount > 0, "No unstaking in progress");
        require(
            block.timestamp >= userStaking.unstakingStartTime + UNSTAKING_PERIOD,
            "Unstaking period not completed"
        );

        uint256 amount = userStaking.unstakingAmount;
        userStaking.unstakingAmount = 0;
        userStaking.unstakingStartTime = 0;

        IERC20(token).safeTransfer(msg.sender, amount);
    }

    function emergencyUnstake(
        uint256 projectId,
        address token
    ) external nonReentrant projectExists(projectId) validToken(projectId, token) {
        StakingInfo storage userStaking = stakingInfo[projectId][msg.sender][token];
        require(userStaking.stakedAmount > 0, "No staked balance");

        uint256 stakedAmount = userStaking.stakedAmount;
        uint256 penalty = (stakedAmount * EMERGENCY_PENALTY) / 10000;
        uint256 returnAmount = stakedAmount - penalty;

        userStaking.stakedAmount = 0;
        totalStakedPerToken[projectId][token] -= stakedAmount;
        projects[projectId].totalStaked -= stakedAmount;

        IERC20(token).safeTransfer(msg.sender, returnAmount);

        emit EmergencyUnstaked(projectId, msg.sender, token, returnAmount, penalty);
    }

    // ============ PROPOSAL SYSTEM ============

    function createProposal(
        uint256 projectId,
        string memory title,
        string memory description,
        uint256 quorum
    ) external projectExists(projectId) onlyProjectCreator(projectId) returns (uint256) {
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(description).length > 0, "Description cannot be empty");
        
        uint256 minQuorum = (projects[projectId].totalStaked * MIN_QUORUM) / 10000;
        require(quorum >= minQuorum, "Quorum too low");

        _proposalCounter++;
        uint256 proposalId = _proposalCounter;

        Proposal storage newProposal = proposals[proposalId];
        newProposal.id = proposalId;
        newProposal.projectId = projectId;
        newProposal.title = title;
        newProposal.description = description;
        newProposal.quorum = quorum;
        newProposal.startTime = block.timestamp;
        newProposal.endTime = block.timestamp + VOTING_DURATION;
        newProposal.executed = false;
        newProposal.creator = msg.sender;

        projects[projectId].proposalCount++;
        _projectProposals[projectId].add(proposalId);

        emit ProposalCreated(proposalId, projectId, msg.sender);
        return proposalId;
    }

    function vote(uint256 proposalId, bool support) external proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.startTime, "Voting not started");
        require(block.timestamp <= proposal.endTime, "Voting ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");
        require(!proposal.executed, "Proposal already executed");

        uint256 votingPower = getUserVotingPower(msg.sender, proposal.projectId);
        require(votingPower > 0, "No voting power");

        hasVoted[proposalId][msg.sender] = true;
        votingPowerSnapshot[proposalId][msg.sender] = votingPower;

        if (support) {
            proposal.yesVotes += votingPower;
        } else {
            proposal.noVotes += votingPower;
        }
        proposal.totalVoted += votingPower;

        emit Voted(proposalId, msg.sender, support, votingPower);
    }

    function executeProposal(uint256 proposalId) external proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp > proposal.endTime, "Voting not ended");
        require(!proposal.executed, "Proposal already executed");
        require(proposal.totalVoted >= proposal.quorum, "Quorum not reached");

        proposal.executed = true;

        emit ProposalExecuted(proposalId, proposal.projectId);
    }

    // ============ VIEW FUNCTIONS ============

    function getProjectStake(uint256 projectId) external view returns (uint256 totalStaked) {
        return projects[projectId].totalStaked;
    }

    function getUserStake(address user, uint256 projectId) external view returns (uint256 totalStaked) {
        uint256 total = 0;
        address[] memory tokens = _projectGovernanceTokens[projectId].values();
        
        for (uint256 i = 0; i < tokens.length; i++) {
            total += stakingInfo[projectId][user][tokens[i]].stakedAmount;
        }
        return total;
    }

    function getProposalVotes(uint256 proposalId) external view returns (
        uint256 yesVotes,
        uint256 noVotes,
        uint256 totalVoted
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (proposal.yesVotes, proposal.noVotes, proposal.totalVoted);
    }

    function getProjectProposals(uint256 projectId) external view returns (uint256[] memory) {
        return _projectProposals[projectId].values();
    }

    function getUserVotingPower(address user, uint256 projectId) public view returns (uint256 power) {
        uint256 total = 0;
        address[] memory tokens = _projectGovernanceTokens[projectId].values();
        
        for (uint256 i = 0; i < tokens.length; i++) {
            total += stakingInfo[projectId][user][tokens[i]].stakedAmount;
        }
        return total;
    }

    function getProjectGovernanceTokens(uint256 projectId) external view returns (address[] memory) {
        return _projectGovernanceTokens[projectId].values();
    }

    function getUserStakingInfo(
        uint256 projectId,
        address user,
        address token
    ) external view returns (uint256 stakedAmount, uint256 unstakingAmount, uint256 unstakingStartTime) {
        StakingInfo storage info = stakingInfo[projectId][user][token];
        return (info.stakedAmount, info.unstakingAmount, info.unstakingStartTime);
    }

    function getProposalDetails(uint256 proposalId) external view returns (
        uint256 id,
        uint256 projectId,
        string memory title,
        string memory description,
        uint256 yesVotes,
        uint256 noVotes,
        uint256 totalVoted,
        uint256 quorum,
        uint256 startTime,
        uint256 endTime,
        bool executed,
        address creator
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.id,
            proposal.projectId,
            proposal.title,
            proposal.description,
            proposal.yesVotes,
            proposal.noVotes,
            proposal.totalVoted,
            proposal.quorum,
            proposal.startTime,
            proposal.endTime,
            proposal.executed,
            proposal.creator
        );
    }

    // ============ UTILITY FUNCTIONS ============

    function getProjectCount() external view returns (uint256) {
        return _projectCounter;
    }

    function getProposalCount() external view returns (uint256) {
        return _proposalCounter;
    }

    function isTokenAccepted(uint256 projectId, address token) external view returns (bool) {
        return _projectGovernanceTokens[projectId].contains(token);
    }

    function canCompleteUnstake(
        uint256 projectId,
        address user,
        address token
    ) external view returns (bool) {
        StakingInfo storage info = stakingInfo[projectId][user][token];
        return info.unstakingAmount > 0 && 
               block.timestamp >= info.unstakingStartTime + UNSTAKING_PERIOD;
    }
}