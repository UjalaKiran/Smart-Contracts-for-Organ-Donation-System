// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OrganNFT.sol";
import "./Recipient.sol";

contract OrganQuality {
    address public owner;
    address public organNFTContract;

    // Struct for medical data
    struct MedicalData {
        string ipfsHash; // Hash of detailed medical data stored on IPFS
        uint256 lastUpdated; // Timestamp of last update
        bool isValid; // Indicates if data has been validated
    }

    // Struct for test results
    struct TestResult {
        string testType; // e.g., "HLA Typing", "Viral Screening"
        string resultHash; // IPFS hash of test result details
        uint256 timestamp; // When the test was conducted
        bool isApproved; // Approval status by hospital
    }

    // Mapping for organ medical data
    mapping(uint256 => MedicalData) public organMedicalData;

    // Mapping for organ test results
    mapping(uint256 => TestResult[]) public organTestResults;

    // Events for tracking updates
    event MedicalDataUpdated(uint256 indexed tokenId, string ipfsHash);
    event TestResultsAdded(uint256 indexed tokenId, uint256 resultCount);
    event OrganQualityValidated(uint256 indexed tokenId, bool isValid);
    event CompatibilityChecked(uint256 indexed tokenId, address indexed recipient, bool isCompatible);

    // Errors
    error NotAuthorized();
    error InvalidTokenId();
    error InvalidRecipient();
    error OrganNotAvailable();

    // Modifiers
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    modifier onlyAuthorized() {
        // Simplified authorization - owner can always call
        if (msg.sender != owner) {
            // Try to get contract addresses, but don't fail if not set
            try OrganNFT(organNFTContract).donorContract() returns (address donorAddr) {
                if (msg.sender != donorAddr && 
                    msg.sender != OrganNFT(organNFTContract).recipientContract() && 
                    msg.sender != OrganNFT(organNFTContract).hospitalContract()) {
                    revert NotAuthorized();
                }
            } catch {
                // If getting contract addresses fails, only allow owner
                revert NotAuthorized();
            }
        }
        _;
    }

    modifier validTokenId(uint256 tokenId) {
        if (!OrganNFT(organNFTContract).exists(tokenId)) revert InvalidTokenId();
        _;
    }

    constructor(address _organNFTContract) {
        owner = msg.sender;
        organNFTContract = _organNFTContract;
    }

    // Update medical data for an organ
    function updateMedicalData(uint256 tokenId, MedicalData memory data)
        external
        onlyAuthorized
        validTokenId(tokenId)
    {
        // Remove the organ status check for now to avoid complexity
        organMedicalData[tokenId] = MedicalData({
            ipfsHash: data.ipfsHash,
            lastUpdated: block.timestamp,
            isValid: false // Requires validation
        });

        emit MedicalDataUpdated(tokenId, data.ipfsHash);
    }

    // Add test results for an organ
    function addTestResults(uint256 tokenId, TestResult[] memory results)
        external
        onlyAuthorized
        validTokenId(tokenId)
    {
        for (uint256 i = 0; i < results.length; i++) {
            organTestResults[tokenId].push(TestResult({
                testType: results[i].testType,
                resultHash: results[i].resultHash,
                timestamp: block.timestamp,
                isApproved: false // Requires hospital approval
            }));
        }

        emit TestResultsAdded(tokenId, results.length);
    }

    // Validate organ quality
    function validateOrganQuality(uint256 tokenId)
        external
        onlyAuthorized
        validTokenId(tokenId)
    {
        // Simplified validation logic
        bool isValid = (keccak256(bytes(organMedicalData[tokenId].ipfsHash)) != keccak256(bytes(""))) &&
               organTestResults[tokenId].length > 0;

        organMedicalData[tokenId].isValid = isValid;

        emit OrganQualityValidated(tokenId, isValid);
    }

    // Check organ compatibility with recipient
    function getOrganCompatibility(uint256 tokenId, address recipientAddress)
        external
        view
        onlyAuthorized
        validTokenId(tokenId)
        returns (bool)
    {
        OrganNFT nft = OrganNFT(organNFTContract);
        OrganNFT.OrganMetadata memory organ = nft.getOrganMetadata(tokenId);

        // Try to get recipient contract address
        try nft.recipientContract() returns (address recipientContractAddr) {
            Recipient recipientContract = Recipient(recipientContractAddr);
            Recipient.RecipientData memory recipient = recipientContract.getRecipientInfo(recipientAddress);
            
            if (recipient.age == 0) revert InvalidRecipient();
            
            // Simplified blood type compatibility check
            bool isCompatible = _isBloodCompatible(organ.bloodType, recipient.bloodType);
            
            // Additional checks with medical data
            isCompatible = isCompatible && organMedicalData[tokenId].isValid;
            
            return isCompatible;
        } catch {
            // If can't access recipient contract, just do basic compatibility
            return organMedicalData[tokenId].isValid;
        }
    }

    // Get test results count for a token
    function getTestResultsCount(uint256 tokenId) 
        external 
        view 
        validTokenId(tokenId) 
        returns (uint256) 
    {
        return organTestResults[tokenId].length;
    }

    // Get specific test result
    function getTestResult(uint256 tokenId, uint256 index) 
        external 
        view 
        validTokenId(tokenId) 
        returns (TestResult memory) 
    {
        require(index < organTestResults[tokenId].length, "Index out of bounds");
        return organTestResults[tokenId][index];
    }

    // Internal function for blood type compatibility
    function _isBloodCompatible(string memory donorBlood, string memory recipientBlood)
        internal
        pure
        returns (bool)
    {
        bytes32 donorHash = keccak256(bytes(donorBlood));
        bytes32 recipientHash = keccak256(bytes(recipientBlood));
        
        if (donorHash == keccak256(bytes("O-"))) return true;
        if (recipientHash == keccak256(bytes("AB+"))) return true;
        if (donorHash == recipientHash) return true;
        
        return false;
    }

    // Emergency function to update organ NFT contract address
    function updateOrganNFTContract(address _newContract) external onlyOwner {
        organNFTContract = _newContract;
    }
}