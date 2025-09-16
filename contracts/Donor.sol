// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Donor {
    address public owner;

    // Enum for donor status
    enum DonorStatus { Active, Deactivated, Matched, Deceased }

    // Struct for organ preferences
    struct DonationPreferences {
        bool heart;
        bool liver;
        bool kidneys;
    }

    // Struct for donor data
    struct DonorData {
        string name;
        uint256 age;
        string bloodType;
        string medicalHistoryHash; // Can store IPFS hash for privacy
        DonationPreferences preferences;
        DonorStatus status;
    }

    // Mapping donor address → DonorData
    mapping(address => DonorData) public donors;

    // Events for frontend and logs
    event DonorRegistered(address indexed donor, string name, string bloodType);
    event DonorStatusUpdated(address indexed donor, DonorStatus status);
    event PreferencesUpdated(address indexed donor);

    // Constructor sets contract owner
    constructor() {
        owner = msg.sender;
    }

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    modifier onlyRegisteredDonor(address donorAddress) {
        require(donors[donorAddress].age > 0, "Donor not registered");
        _;
    }

    // Register a new donor
    function registerDonor(
        address donorAddress,
        string memory name,
        uint256 age,
        string memory bloodType,
        string memory medicalHistoryHash,
        DonationPreferences memory prefs
    ) external {
        require(donors[donorAddress].age == 0, "Donor already registered");
        donors[donorAddress] = DonorData({
            name: name,
            age: age,
            bloodType: bloodType,
            medicalHistoryHash: medicalHistoryHash,
            preferences: prefs,
            status: DonorStatus.Active
        });

        emit DonorRegistered(donorAddress, name, bloodType);
    }
  

  
    // Update donor status (admin only)
    function updateDonorStatus(address donorAddress, DonorStatus status)
        external
        onlyOwner
        onlyRegisteredDonor(donorAddress)
    {
        donors[donorAddress].status = status;
        emit DonorStatusUpdated(donorAddress, status);
    }

    // Get donor information
    function getDonorInfo(address donorAddress)
        external
        view
        onlyRegisteredDonor(donorAddress)
        returns (DonorData memory)
    {
        return donors[donorAddress];
    }

    // Deactivate donor (donor or owner)
    function deactivateDonor(address donorAddress)
        external
        onlyRegisteredDonor(donorAddress)
    {
        require(msg.sender == donorAddress || msg.sender == owner, "Unauthorized");
        donors[donorAddress].status = DonorStatus.Deactivated;
        emit DonorStatusUpdated(donorAddress, DonorStatus.Deactivated);
    }

    // Update preferences (only donor)
    function updateDonorPreferences(address donorAddress, DonationPreferences memory prefs)
        external
        onlyRegisteredDonor(donorAddress)
    {
        require(msg.sender == donorAddress, "Only donor can update preferences");
        donors[donorAddress].preferences = prefs;
        emit PreferencesUpdated(donorAddress);
    }
}
