// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Recipient {
    address public owner;

    // Enum for medical status
    enum MedicalStatus { Waiting, Transplanted, Critical, Stable, Rejected }

    // Enum for organ type
    enum OrganType { Heart, Liver, Kidneys }

    // Struct for location
    struct Location {
        string city;
        string country;
        string additionalInfo; // e.g., hospital name or coordinates
    }

    // Struct for recipient data
    struct RecipientData {
        string name;
        uint256 age;
        string bloodType;
        string medicalHistoryHash; // Can store IPFS hash for privacy
        MedicalStatus medicalStatus;
        Location location;
    }

    // Struct for waiting list entry
    struct WaitingEntry {
        uint256 urgencyLevel; // Higher number means higher urgency
        uint256 timestamp; // When added to the list
    }

    // Mapping recipient address → RecipientData
    mapping(address => RecipientData) public recipients;

    // Mapping recipient address → (OrganType → WaitingEntry)
    mapping(address => mapping(OrganType => WaitingEntry)) public waitingLists;

    // Events for frontend and logs
    event RecipientRegistered(address indexed recipient, string name, string bloodType);
    event RecipientMedicalStatusUpdated(address indexed recipient, MedicalStatus status);
    event AddedToWaitingList(address indexed recipient, OrganType organType, uint256 urgencyLevel);
    event RemovedFromWaitingList(address indexed recipient, OrganType organType);
    event RecipientLocationUpdated(address indexed recipient);

    // Constructor sets contract owner
    constructor() {
        owner = msg.sender;
    }

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    modifier onlyRegisteredRecipient(address recipientAddress) {
        require(recipients[recipientAddress].age > 0, "Recipient not registered");
        _;
    }

    // Register a new recipient
    function registerRecipient(
        address recipientAddress,
        string memory name,
        uint256 age,
        string memory bloodType,
        string memory medicalHistoryHash,
        Location memory location
    ) external {
        require(recipientAddress != address(0), "Invalid address");
        require(recipients[recipientAddress].age == 0, "Recipient already registered"); // ✅ Fixed typo
        require(age > 0, "Invalid age"); // ✅ Added safety check

        recipients[recipientAddress] = RecipientData({
            name: name,
            age: age,
            bloodType: bloodType,
            medicalHistoryHash: medicalHistoryHash,
            medicalStatus: MedicalStatus.Waiting, // Default status
            location: location
        });

        emit RecipientRegistered(recipientAddress, name, bloodType);
    }

    // Update recipient medical status (admin only)
    function updateRecipientMedicalStatus(address recipientAddress, MedicalStatus status)
        external
        onlyOwner
        onlyRegisteredRecipient(recipientAddress)
    {
        recipients[recipientAddress].medicalStatus = status;
        emit RecipientMedicalStatusUpdated(recipientAddress, status);
    }

    // Get recipient information
    function getRecipientInfo(address recipientAddress)
        external
        view
        onlyRegisteredRecipient(recipientAddress)
        returns (RecipientData memory)
    {
        return recipients[recipientAddress];
    }

    // Add recipient to waiting list for a specific organ
    function addToWaitingList(address recipientAddress, OrganType organType, uint256 urgencyLevel)
        external
        onlyOwner
        onlyRegisteredRecipient(recipientAddress)
    {
        require(urgencyLevel > 0, "Urgency level must be positive");
        require(waitingLists[recipientAddress][organType].urgencyLevel == 0, "Already on waiting list for this organ");

        waitingLists[recipientAddress][organType] = WaitingEntry({
            urgencyLevel: urgencyLevel,
            timestamp: block.timestamp
        });

        emit AddedToWaitingList(recipientAddress, organType, urgencyLevel);
    }

    // Remove recipient from waiting list for a specific organ
    function removeFromWaitingList(address recipientAddress, OrganType organType)
        external
        onlyOwner
        onlyRegisteredRecipient(recipientAddress)
    {
        require(waitingLists[recipientAddress][organType].urgencyLevel > 0, "Not on waiting list for this organ");

        delete waitingLists[recipientAddress][organType];

        emit RemovedFromWaitingList(recipientAddress, organType);
    }

    // Update recipient location (recipient or owner)
    function updateRecipientLocation(address recipientAddress, Location memory location)
        external
        onlyRegisteredRecipient(recipientAddress)
    {
        require(msg.sender == recipientAddress || msg.sender == owner, "Unauthorized");
        recipients[recipientAddress].location = location;
        emit RecipientLocationUpdated(recipientAddress);
    }
}
