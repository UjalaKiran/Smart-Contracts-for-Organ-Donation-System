// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OrganNFT.sol";
import "./Recipient.sol";
import "./Donor.sol";
import "./Hospital.sol";
import "./OrganQuality.sol";

/// @title Smart Matching Algorithm for Global NFT-Based Organ Donation System
/// @notice Implements intelligent organ-recipient matching with scoring and prioritization
/// @dev Integrates with existing Donor, Recipient, Hospital, OrganNFT, and OrganQuality contracts
contract OrganMatching {
    /*//////////////////////////////////////////////////////////////
                              OWNER & CONTRACTS
    //////////////////////////////////////////////////////////////*/

    address public owner;
    address public organNFTContract;
    address public recipientContract;
    address public donorContract;
    address public hospitalContract;
    address public organQualityContract;

    /*//////////////////////////////////////////////////////////////
                              ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotOwner();
    error NotAuthorized();
    error ZeroAddress();
    error InvalidTokenId();
    error OrganNotAvailable();
    error RecipientNotEligible();
    error InsufficientMatchScore();
    error AlreadyMatched();
    error InvalidUrgencyLevel();
    error EmptyWaitingList();

    /*//////////////////////////////////////////////////////////////
                                  ENUMS
    //////////////////////////////////////////////////////////////*/

    enum OrganType { Heart, Liver, Kidneys }
    enum MatchStatus { Pending, Matched, Confirmed, Rejected, Expired }
    enum Priority { Low, Medium, High, Critical, Emergency }

    /*//////////////////////////////////////////////////////////////
                                 STRUCTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Comprehensive match score breakdown
    struct MatchScore {
        uint256 totalScore;           // Overall compatibility score (0-100)
        uint256 bloodCompatibility;   // Blood type compatibility (0-30)
        uint256 urgencyScore;         // Medical urgency (0-25)
        uint256 waitingTimeScore;     // Time on waiting list (0-20)
        uint256 geographicScore;      // Geographic proximity (0-15)
        uint256 medicalScore;         // Medical compatibility (0-10)
        bool isCompatible;            // Final compatibility decision
    }

    /// @notice Match proposal between organ and recipient
    struct MatchProposal {
        uint256 organTokenId;
        address recipientAddress;
        address proposingHospital;
        MatchScore score;
        MatchStatus status;
        uint256 proposalTimestamp;
        uint256 expiryTimestamp;
        string notes;
    }

    /// @notice Waiting list entry with enhanced data
    struct WaitingListEntry {
        address recipientAddress;
        uint256 urgencyLevel;         // 1-10 scale
        uint256 addedTimestamp;
        string region;
        Priority priority;
        bool isActive;
        uint256 lastUpdated;
    }

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    // Core matching data
    mapping(uint256 => MatchProposal[]) public organMatchProposals;     // organTokenId => proposals
    mapping(address => uint256[]) public recipientMatches;              // recipient => organTokenIds
    
    // Waiting lists by organ type and region
    mapping(OrganType => mapping(string => WaitingListEntry[])) public waitingLists;
    mapping(address => mapping(OrganType => uint256)) public recipientWaitingIndex; // recipient => organType => index
    
    // Match scoring parameters (adjustable)
    mapping(string => uint256) public scoringWeights;                   // parameter => weight
    
    // Emergency matching
    mapping(uint256 => bool) public emergencyOrgans;                    // organTokenId => isEmergency
    mapping(address => Priority) public recipientPriority;              // recipient => priority level

    // Match history and analytics
    mapping(uint256 => address[]) public organMatchHistory;             // organTokenId => matched recipients
    mapping(address => uint256) public recipientMatchCount;             // recipient => total matches

    /*//////////////////////////////////////////////////////////////
                                  EVENTS
    //////////////////////////////////////////////////////////////*/

    event MatchProposalCreated(uint256 indexed organTokenId, address indexed recipient, uint256 score);
    event OrganAllocated(uint256 indexed organTokenId, address indexed recipient, address indexed hospital);
    event MatchScoreCalculated(uint256 indexed organTokenId, address indexed recipient, uint256 totalScore);
    event WaitingListUpdated(address indexed recipient, OrganType organType, string region);
    event EmergencyMatchTriggered(uint256 indexed organTokenId, address indexed recipient);
    event MatchProposalExpired(uint256 indexed organTokenId, address indexed recipient);
    event ScoringParametersUpdated(string parameter, uint256 newWeight);

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAuthorized() {
        if (msg.sender != owner && 
            msg.sender != hospitalContract && 
            msg.sender != organNFTContract) revert NotAuthorized();
        _;
    }

    modifier validOrganToken(uint256 tokenId) {
        if (!OrganNFT(organNFTContract).exists(tokenId)) revert InvalidTokenId();
        _;
    }

    modifier onlyAvailableOrgan(uint256 tokenId) {
        OrganNFT.OrganMetadata memory organ = OrganNFT(organNFTContract).getOrganMetadata(tokenId);
        if (organ.status != OrganNFT.OrganStatus.Available) revert OrganNotAvailable();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                                CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address _organNFTContract,
        address _recipientContract,
        address _donorContract,
        address _hospitalContract,
        address _organQualityContract
    ) {
        if (_organNFTContract == address(0) || 
            _recipientContract == address(0) || 
            _donorContract == address(0) || 
            _hospitalContract == address(0) || 
            _organQualityContract == address(0)) revert ZeroAddress();

        owner = msg.sender;
        organNFTContract = _organNFTContract;
        recipientContract = _recipientContract;
        donorContract = _donorContract;
        hospitalContract = _hospitalContract;
        organQualityContract = _organQualityContract;

        // Initialize default scoring weights
        _initializeScoringWeights();
    }

    /*//////////////////////////////////////////////////////////////
                        CORE MATCHING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Find all compatible recipients for a given organ
    /// @param organTokenId The NFT token ID of the organ
    /// @return compatibleRecipients Array of recipient addresses with match scores
    function findCompatibleRecipients(uint256 organTokenId) 
        external 
        view 
        validOrganToken(organTokenId) 
        onlyAvailableOrgan(organTokenId)
        returns (address[] memory compatibleRecipients) 
    {
        OrganNFT.OrganMetadata memory organ = OrganNFT(organNFTContract).getOrganMetadata(organTokenId);
        OrganType organType = OrganType(uint8(organ.organType));
        
        // Get donor location for geographic matching
        string memory donorRegion = _getDonorRegion(organ.donorAddress);
        
        // Get waiting list for this organ type and region
        WaitingListEntry[] memory waitingList = waitingLists[organType][donorRegion];
        
        // Dynamic array to store compatible recipients
        address[] memory tempRecipients = new address[](waitingList.length);
        uint256 compatibleCount = 0;
        
        for (uint256 i = 0; i < waitingList.length; i++) {
            if (!waitingList[i].isActive) continue;
            
            MatchScore memory score = _calculateDetailedMatchScore(organTokenId, waitingList[i].recipientAddress);
            
            if (score.isCompatible && score.totalScore >= scoringWeights["minimumScore"]) {
                tempRecipients[compatibleCount] = waitingList[i].recipientAddress;
                compatibleCount++;
            }
        }
        
        // Resize array to actual compatible count
        compatibleRecipients = new address[](compatibleCount);
        for (uint256 i = 0; i < compatibleCount; i++) {
            compatibleRecipients[i] = tempRecipients[i];
        }
        
        return compatibleRecipients;
    }

    /// @notice Calculate comprehensive match score between organ and recipient
    /// @param organTokenId The NFT token ID of the organ
    /// @param recipientAddress Address of the potential recipient
    /// @return score Detailed match score breakdown
    function calculateMatchScore(uint256 organTokenId, address recipientAddress)
        external
        view
        validOrganToken(organTokenId)
        returns (MatchScore memory score)
    {
        return _calculateDetailedMatchScore(organTokenId, recipientAddress);
    }

    /// @notice Allocate organ to the best matching recipient
    /// @param organTokenId The NFT token ID of the organ
    /// @param recipientAddress Address of the chosen recipient
    function allocateOrgan(uint256 organTokenId, address recipientAddress)
        external
        onlyAuthorized
        validOrganToken(organTokenId)
        onlyAvailableOrgan(organTokenId)
    {
        // Verify recipient eligibility
        MatchScore memory score = _calculateDetailedMatchScore(organTokenId, recipientAddress);
        if (!score.isCompatible || score.totalScore < scoringWeights["minimumScore"]) {
            revert RecipientNotEligible();
        }

        // Get hospital from the caller or organ metadata
        address assignedHospital = msg.sender == hospitalContract ? msg.sender : address(0);
        OrganNFT.OrganMetadata memory organ = OrganNFT(organNFTContract).getOrganMetadata(organTokenId);
        
        if (assignedHospital == address(0)) {
            assignedHospital = organ.assignedHospital;
        }

        // Create match proposal
        MatchProposal memory proposal = MatchProposal({
            organTokenId: organTokenId,
            recipientAddress: recipientAddress,
            proposingHospital: assignedHospital,
            score: score,
            status: MatchStatus.Matched,
            proposalTimestamp: block.timestamp,
            expiryTimestamp: block.timestamp + 24 hours, // 24-hour confirmation window
            notes: "Automated matching allocation"
        });

        organMatchProposals[organTokenId].push(proposal);
        recipientMatches[recipientAddress].push(organTokenId);

        // Update organ status in NFT contract
        OrganNFT(organNFTContract).matchOrgan(organTokenId, recipientAddress, assignedHospital);

        // Remove recipient from waiting list
        OrganType matchingOrganType = OrganType(uint8(organ.organType));
        _removeFromWaitingList(recipientAddress, matchingOrganType);

        // Update match history
        organMatchHistory[organTokenId].push(recipientAddress);
        recipientMatchCount[recipientAddress]++;

        emit OrganAllocated(organTokenId, recipientAddress, assignedHospital);
    }

    /// @notice Get waiting list for specific organ type and region
    /// @param organType Type of organ (Heart, Liver, Kidneys)
    /// @param region Geographic region
    /// @return waitingList Array of waiting list entries
    function getWaitingListByOrgan(OrganType organType, string memory region)
        external
        view
        returns (WaitingListEntry[] memory waitingList)
    {
        return waitingLists[organType][region];
    }

    /// @notice Get prioritized waiting list sorted by urgency and waiting time
    /// @param organType Type of organ (Heart, Liver, Kidneys)
    /// @param region Geographic region
    /// @return prioritizedList Sorted array of waiting list entries
    function prioritizeByUrgency(OrganType organType, string memory region)
        external
        view
        returns (WaitingListEntry[] memory prioritizedList)
    {
        WaitingListEntry[] memory originalList = waitingLists[organType][region];
        if (originalList.length == 0) revert EmptyWaitingList();

        // Create a copy for sorting
        prioritizedList = new WaitingListEntry[](originalList.length);
        uint256 activeCount = 0;

        // Filter active entries
        for (uint256 i = 0; i < originalList.length; i++) {
            if (originalList[i].isActive) {
                prioritizedList[activeCount] = originalList[i];
                activeCount++;
            }
        }

        // Resize to active count
        if (activeCount < originalList.length) {
            WaitingListEntry[] memory filteredList = new WaitingListEntry[](activeCount);
            for (uint256 i = 0; i < activeCount; i++) {
                filteredList[i] = prioritizedList[i];
            }
            prioritizedList = filteredList;
        }

        // Sort by priority (emergency > critical > high > medium > low)
        // Then by urgency level (10 > 9 > ... > 1)
        // Then by waiting time (longer wait = higher priority)
        _quickSortWaitingList(prioritizedList, 0, int256(prioritizedList.length - 1));

        return prioritizedList;
    }

    /*//////////////////////////////////////////////////////////////
                        WAITING LIST MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /// @notice Add recipient to waiting list
    /// @param recipientAddress Address of the recipient
    /// @param organType Type of organ needed
    /// @param urgencyLevel Urgency level (1-10)
    /// @param region Geographic region
    /// @param priority Priority level
    function addToWaitingList(
        address recipientAddress,
        OrganType organType,
        uint256 urgencyLevel,
        string memory region,
        Priority priority
    ) external onlyAuthorized {
        if (urgencyLevel < 1 || urgencyLevel > 10) revert InvalidUrgencyLevel();
        
        WaitingListEntry memory entry = WaitingListEntry({
            recipientAddress: recipientAddress,
            urgencyLevel: urgencyLevel,
            addedTimestamp: block.timestamp,
            region: region,
            priority: priority,
            isActive: true,
            lastUpdated: block.timestamp
        });

        waitingLists[organType][region].push(entry);
        recipientWaitingIndex[recipientAddress][organType] = waitingLists[organType][region].length - 1;
        recipientPriority[recipientAddress] = priority;

        emit WaitingListUpdated(recipientAddress, organType, region);
    }

    /// @notice Update recipient priority on waiting list
    /// @param recipientAddress Address of the recipient
    /// @param organType Type of organ
    /// @param newUrgencyLevel New urgency level (1-10)
    /// @param newPriority New priority level
    function updateWaitingListPriority(
        address recipientAddress,
        OrganType organType,
        uint256 newUrgencyLevel,
        Priority newPriority,
        string memory region
    ) external onlyAuthorized {
        if (newUrgencyLevel < 1 || newUrgencyLevel > 10) revert InvalidUrgencyLevel();

        uint256 index = recipientWaitingIndex[recipientAddress][organType];
        WaitingListEntry storage entry = waitingLists[organType][region][index];
        
        if (entry.recipientAddress != recipientAddress) revert RecipientNotEligible();

        entry.urgencyLevel = newUrgencyLevel;
        entry.priority = newPriority;
        entry.lastUpdated = block.timestamp;
        
        recipientPriority[recipientAddress] = newPriority;

        emit WaitingListUpdated(recipientAddress, organType, region);
    }

    /*//////////////////////////////////////////////////////////////
                        EMERGENCY MATCHING
    //////////////////////////////////////////////////////////////*/

    /// @notice Trigger emergency matching for critical organs
    /// @param organTokenId The NFT token ID of the organ
    /// @param maxDistance Maximum geographic distance for matching
    function triggerEmergencyMatch(uint256 organTokenId, uint256 maxDistance)
        external
        onlyAuthorized
        validOrganToken(organTokenId)
    {
        emergencyOrgans[organTokenId] = true;
        
        OrganNFT.OrganMetadata memory organ = OrganNFT(organNFTContract).getOrganMetadata(organTokenId);
        OrganType organType = OrganType(uint8(organ.organType));
        
        // Find best emergency match across all regions
        address bestRecipient = _findEmergencyMatch(organTokenId, organType, maxDistance);
        
        if (bestRecipient != address(0)) {
            emit EmergencyMatchTriggered(organTokenId, bestRecipient);
        }
    }

    /*//////////////////////////////////////////////////////////////
                        CONFIGURATION & ADMIN
    //////////////////////////////////////////////////////////////*/

    /// @notice Update scoring parameters
    /// @param parameter Name of the parameter
    /// @param weight New weight value
    function updateScoringWeight(string memory parameter, uint256 weight) 
        external 
        onlyOwner 
    {
        scoringWeights[parameter] = weight;
        emit ScoringParametersUpdated(parameter, weight);
    }

    /// @notice Update contract addresses
    function updateContractAddresses(
        address _organNFT,
        address _recipient,
        address _donor,
        address _hospital,
        address _organQuality
    ) external onlyOwner {
        if (_organNFT != address(0)) organNFTContract = _organNFT;
        if (_recipient != address(0)) recipientContract = _recipient;
        if (_donor != address(0)) donorContract = _donor;
        if (_hospital != address(0)) hospitalContract = _hospital;
        if (_organQuality != address(0)) organQualityContract = _organQuality;
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Calculate detailed match score with all parameters
    function _calculateDetailedMatchScore(uint256 organTokenId, address recipientAddress)
        internal
        view
        returns (MatchScore memory score)
    {
        OrganNFT.OrganMetadata memory organ = OrganNFT(organNFTContract).getOrganMetadata(organTokenId);
        
        // Try to get recipient data
        try Recipient(recipientContract).getRecipientInfo(recipientAddress) returns (Recipient.RecipientData memory recipient) {
            // Blood compatibility (0-30 points)
            score.bloodCompatibility = _calculateBloodCompatibility(organ.bloodType, recipient.bloodType);
            
            // Medical urgency (0-25 points)
            score.urgencyScore = _calculateUrgencyScore(recipientAddress, OrganType(uint8(organ.organType)));
            
            // Waiting time (0-20 points)
            score.waitingTimeScore = _calculateWaitingTimeScore(recipientAddress, OrganType(uint8(organ.organType)));
            
            // Geographic proximity (0-15 points)
            score.geographicScore = _calculateGeographicScore(organ.donorAddress, recipient.location.city);
            
            // Medical compatibility (0-10 points)
            score.medicalScore = _calculateMedicalCompatibility(organTokenId, recipientAddress);
            
            // Calculate total score
            score.totalScore = score.bloodCompatibility + score.urgencyScore + 
                             score.waitingTimeScore + score.geographicScore + score.medicalScore;
            
            // Determine compatibility
            score.isCompatible = score.bloodCompatibility > 0 && 
                               score.totalScore >= scoringWeights["minimumScore"];
            
        } catch {
            // If recipient data cannot be retrieved, return zero score
            score.isCompatible = false;
        }

        return score;
    }

    /// @notice Calculate blood type compatibility score
    function _calculateBloodCompatibility(string memory donorBlood, string memory recipientBlood)
        internal
        pure
        returns (uint256)
    {
        bytes32 donorHash = keccak256(bytes(donorBlood));
        bytes32 recipientHash = keccak256(bytes(recipientBlood));
        
        // Perfect match
        if (donorHash == recipientHash) return 30;
        
        // Universal donor O-
        if (donorHash == keccak256(bytes("O-"))) return 25;
        
        // Universal recipient AB+
        if (recipientHash == keccak256(bytes("AB+"))) return 25;
        
        // Partial compatibility rules
        if (donorHash == keccak256(bytes("O+"))) {
            if (recipientHash == keccak256(bytes("A+")) || 
                recipientHash == keccak256(bytes("B+")) || 
                recipientHash == keccak256(bytes("AB+"))) return 20;
        }
        
        return 0; // Incompatible
    }

    /// @notice Calculate urgency score based on recipient priority
    function _calculateUrgencyScore(address recipientAddress, OrganType /* organType */)
        internal
        view
        returns (uint256)
    {
        Priority priority = recipientPriority[recipientAddress];
        
        if (priority == Priority.Emergency) return 25;
        if (priority == Priority.Critical) return 20;
        if (priority == Priority.High) return 15;
        if (priority == Priority.Medium) return 10;
        return 5; // Low priority
    }

    /// @notice Calculate waiting time score based on recipient's time on waiting list
    function _calculateWaitingTimeScore(address recipientAddress, OrganType /* organType */)
        internal
        view
        returns (uint256)
    {
        // Simplified waiting time calculation
        // In reality, you'd get the actual timestamp from waiting list
        Priority priority = recipientPriority[recipientAddress];
        
        // Higher priority gets higher base score
        if (priority == Priority.Emergency) return 20;
        if (priority == Priority.Critical) return 15;
        return 10; // Default score
    }

    /// @notice Calculate geographic proximity score
    function _calculateGeographicScore(address /* donorAddress */, string memory /* recipientCity */)
        internal
        pure
        returns (uint256)
    {
        // Simplified geographic scoring
        // In reality, you'd use actual geographic data
        return 10; // Placeholder - same region assumed
    }

    /// @notice Calculate medical compatibility score
    function _calculateMedicalCompatibility(uint256 organTokenId, address recipientAddress)
        internal
        view
        returns (uint256)
    {
        // Try to use OrganQuality contract for compatibility check
        try OrganQuality(organQualityContract).getOrganCompatibility(organTokenId, recipientAddress) returns (bool isCompatible) {
            return isCompatible ? 10 : 0;
        } catch {
            return 5; // Default score if quality check fails
        }
    }

    /// @notice Remove recipient from waiting list
    function _removeFromWaitingList(address recipientAddress, OrganType /* organType */)
        internal
    {
        // Mark recipient as inactive by resetting their priority
        recipientPriority[recipientAddress] = Priority.Low;
    }

    /// @notice Get donor's region
    function _getDonorRegion(address /* donorAddress */)
        internal
        pure
        returns (string memory)
    {
        // Simplified - return default region
        return "default";
    }

    /// @notice Find best emergency match
    function _findEmergencyMatch(uint256 /* organTokenId */, OrganType /* organType */, uint256 /* maxDistance */)
        internal
        pure
        returns (address)
    {
        // Simplified emergency matching logic
        return address(0); // Placeholder
    }

    /// @notice Quick sort implementation for waiting list
    function _quickSortWaitingList(WaitingListEntry[] memory arr, int256 left, int256 right)
        internal
        pure
    {
        if (left < right) {
            int256 pivotIndex = _partition(arr, left, right);
            _quickSortWaitingList(arr, left, pivotIndex - 1);
            _quickSortWaitingList(arr, pivotIndex + 1, right);
        }
    }

    /// @notice Partition function for quick sort
    function _partition(WaitingListEntry[] memory arr, int256 left, int256 right)
        internal
        pure
        returns (int256)
    {
        uint256 pivotPriority = uint256(arr[uint256(right)].priority);
        int256 i = left - 1;

        for (int256 j = left; j < right; j++) {
            if (uint256(arr[uint256(j)].priority) >= pivotPriority) {
                i++;
                // Swap elements
                WaitingListEntry memory tempElement = arr[uint256(i)];
                arr[uint256(i)] = arr[uint256(j)];
                arr[uint256(j)] = tempElement;
            }
        }

        // Swap pivot
        WaitingListEntry memory pivotTemp = arr[uint256(i + 1)];
        arr[uint256(i + 1)] = arr[uint256(right)];
        arr[uint256(right)] = pivotTemp;

        return i + 1;
    }

    /// @notice Initialize default scoring weights
    function _initializeScoringWeights() internal {
        scoringWeights["minimumScore"] = 40;
        scoringWeights["bloodWeight"] = 30;
        scoringWeights["urgencyWeight"] = 25;
        scoringWeights["waitingWeight"] = 20;
        scoringWeights["geographicWeight"] = 15;
        scoringWeights["medicalWeight"] = 10;
    }

    /*//////////////////////////////////////////////////////////////
                        VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get match proposals for an organ
    function getOrganMatchProposals(uint256 organTokenId)
        external
        view
        returns (MatchProposal[] memory)
    {
        return organMatchProposals[organTokenId];
    }

    /// @notice Get recipient's matched organs
    function getRecipientMatches(address recipientAddress)
        external
        view
        returns (uint256[] memory)
    {
        return recipientMatches[recipientAddress];
    }

    /// @notice Get scoring weight for a parameter
    function getScoringWeight(string memory parameter)
        external
        view
        returns (uint256)
    {
        return scoringWeights[parameter];
    }
}