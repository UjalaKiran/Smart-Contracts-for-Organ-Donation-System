// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Hospital / Institution Management for Global NFT-Based Organ Donation System
/// @notice Follows the same owner/modifier/event-driven pattern as Donor.sol and Recipient.sol
/// @dev Designed for Truffle + MetaMask deployments; no external dependencies.
contract Hospital {
    /*//////////////////////////////////////////////////////////////
                              OWNER & ERRORS
    //////////////////////////////////////////////////////////////*/

    address public owner;

    error NotOwner();
    error ZeroAddress();
    error AlreadyRegistered();
    error NotRegistered();
    error NotVerified();
    error Unauthorized();

    /*//////////////////////////////////////////////////////////////
                                  ENUMS
    //////////////////////////////////////////////////////////////*/

    /// @dev Keep OrganType consistent with Donor/Recipient contracts
    enum OrganType { Heart, Liver, Kidneys }

    /// @dev Roles available for hospital staff
    enum Role { Admin, Surgeon, Coordinator, None }

    /*//////////////////////////////////////////////////////////////
                                 STRUCTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Lightweight info struct (returnable) for a hospital
    /// @dev Avoid mappings in the returned struct for ABI-compatibility
    struct HospitalData {
        string name;
        string location; // free-form: city/country or geo-hash
        string licenseId; // registration/license identifier issued by an authority
        bool isVerified;  // flipped true after credentials verification
    }

    /// @notice Optional location struct for future extensibility
    /// @dev Included to mirror patterns used in Recipient.sol (if any)
    struct Location {
        string country;
        string region;
        string city;
        string coordinates; // e.g., "lat,long" or a what3words tag
    }

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    // Primary registry
    mapping(address => HospitalData) private hospitals;               // hospital => data
    mapping(address => bool) private isHospitalRegistered;             // quick existence check

    // Capacity per organ (kept separate so HospitalData remains returnable)
    mapping(address => mapping(uint8 => uint256)) private capacities;  // hospital => organType => capacity

    // Staff authorization
    mapping(address => mapping(address => Role)) private staffRoles;   // hospital => staff => role

    // Verification artifact (hash of credentials)
    mapping(address => bytes32) private credentialHash;                // hospital => keccak256(credentials)

    /*//////////////////////////////////////////////////////////////
                                  EVENTS
    //////////////////////////////////////////////////////////////*/

    event HospitalRegistered(address indexed hospital);
    event HospitalVerified(address indexed hospital);
    event HospitalInfoUpdated(address indexed hospital);
    event HospitalCapacityUpdated(address indexed hospital, OrganType organ, uint256 capacity);
    event StaffAuthorized(address indexed hospital, address indexed staff, Role role);

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRegisteredHospital(address hospitalAddress) {
        if (!isHospitalRegistered[hospitalAddress]) revert NotRegistered();
        _;
    }

    /// @notice Restrict to staff with any role except None for a given hospital
    modifier onlyAuthorizedHospitalStaff(address hospitalAddress) {
        if (staffRoles[hospitalAddress][msg.sender] == Role.None && msg.sender != owner) {
            revert Unauthorized();
        }
        _;
    }

    /// @notice Restrict to Admin for a given hospital (or contract owner)
    modifier onlyHospitalAdmin(address hospitalAddress) {
        Role r = staffRoles[hospitalAddress][msg.sender];
        if (msg.sender != owner && r != Role.Admin) revert Unauthorized();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                                CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor() {
        owner = msg.sender;
    }

    /*//////////////////////////////////////////////////////////////
                       3. HOSPITAL / INSTITUTION MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /// @notice Register a hospital/institution into the registry.
    /// @dev Only owner can register to keep the registry curated & sybil-resistant.
    /// @param hospitalAddress EOA or contract representing the institution.
    /// @param hospitalInfo Basic info (name/location/licenseId). isVerified is forced false at registration.
    function registerHospital(address hospitalAddress, HospitalData memory hospitalInfo) external onlyOwner {
        if (hospitalAddress == address(0)) revert ZeroAddress();
        if (isHospitalRegistered[hospitalAddress]) revert AlreadyRegistered();

        hospitals[hospitalAddress] = HospitalData({
            name: hospitalInfo.name,
            location: hospitalInfo.location,
            licenseId: hospitalInfo.licenseId,
            isVerified: false
        });

        isHospitalRegistered[hospitalAddress] = true;

        // Bootstrap: owner is implicitly Admin for all hospitals; additionally, allow hospitalAddress to assign admins
        // The hospitalAddress itself is given Admin to manage its own staff.
        staffRoles[hospitalAddress][hospitalAddress] = Role.Admin;

        emit HospitalRegistered(hospitalAddress);
    }

    /// @notice Verify hospital credentials; stores a hash and flips isVerified.
    /// @dev Only owner can verify. Credentials can be any byte payload; we store keccak256.
    function verifyHospitalCredentials(address hospitalAddress, bytes memory credentials)
        external
        onlyOwner
        onlyRegisteredHospital(hospitalAddress)
    {
        credentialHash[hospitalAddress] = keccak256(credentials);
        hospitals[hospitalAddress].isVerified = true;
        emit HospitalVerified(hospitalAddress);
    }

    /// @notice Get hospital info (name, location, licenseId, isVerified)
    function getHospitalInfo(address hospitalAddress)
        external
        view
        onlyRegisteredHospital(hospitalAddress)
        returns (HospitalData memory)
    {
        return hospitals[hospitalAddress];
    }

    /// @notice Update organ capacity for a hospital
    /// @dev Allowed for Admin or Coordinator of that hospital, or the contract owner.
    function updateHospitalCapacity(address hospitalAddress, OrganType organType, uint256 capacity)
        external
        onlyRegisteredHospital(hospitalAddress)
        onlyAuthorizedHospitalStaff(hospitalAddress)
    {
        capacities[hospitalAddress][uint8(organType)] = capacity;
        emit HospitalCapacityUpdated(hospitalAddress, organType, capacity);
    }

    /// @notice Authorize a new staff member or change role for existing staff.
    /// @dev Only a Hospital Admin (or contract owner) can call. Setting Role.None removes permissions.
    function authorizeHospitalStaff(address hospitalAddress, address staffAddress, Role role)
        external
        onlyRegisteredHospital(hospitalAddress)
        onlyHospitalAdmin(hospitalAddress)
    {
        if (staffAddress == address(0)) revert ZeroAddress();
        staffRoles[hospitalAddress][staffAddress] = role;
        emit StaffAuthorized(hospitalAddress, staffAddress, role);
    }

    /*//////////////////////////////////////////////////////////////
                              ADDITIONAL HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Convenience getter for a staff member's role at a hospital
    function getStaffRole(address hospitalAddress, address staffAddress)
        external
        view
        onlyRegisteredHospital(hospitalAddress)
        returns (Role)
    {
        return staffRoles[hospitalAddress][staffAddress];
    }

    /// @notice Read capacity for a given organ at a hospital
    function getHospitalCapacity(address hospitalAddress, OrganType organType)
        external
        view
        onlyRegisteredHospital(hospitalAddress)
        returns (uint256)
    {
        return capacities[hospitalAddress][uint8(organType)];
    }

    /// @notice Optional: owner can update core info fields (e.g., name/location/license changes)
    function updateHospitalCoreInfo(
        address hospitalAddress,
        string calldata name,
        string calldata location_,
        string calldata licenseId
    ) external onlyOwner onlyRegisteredHospital(hospitalAddress) {
        HospitalData storage d = hospitals[hospitalAddress];
        d.name = name;
        d.location = location_;
        d.licenseId = licenseId;
        emit HospitalInfoUpdated(hospitalAddress);
    }

    /*//////////////////////////////////////////////////////////////
                          OWNER MAINTENANCE / ESCAPE HATCHES
    //////////////////////////////////////////////////////////////*/

    /// @notice Transfer contract ownership
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }
}