// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract OrganNFT is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    enum OrganType { Heart, Liver, Kidneys }
    enum OrganStatus { Available, Matched, Transplanted, Expired, Rejected }

    struct OrganMetadata {
        address donorAddress;
        OrganType organType;
        string bloodType;
        OrganStatus status;
        uint256 donationTimestamp;
        uint256 expiryTimestamp;
        address assignedRecipient;
        address assignedHospital;
        string medicalDataHash;
        bool isEmergency;
        uint256 urgencyLevel;
    }

    mapping(uint256 => OrganMetadata) public organMetadata;
    mapping(address => uint256[]) public donorOrgans;
    mapping(address => uint256[]) public recipientAssignedOrgans;
    mapping(bytes32 => uint256) public organHash;

    address public donorContract;
    address public recipientContract;
    address public hospitalContract;

    event OrganMinted(uint256 indexed tokenId, address indexed donor, OrganType organType);
    event OrganMatched(uint256 indexed tokenId, address indexed recipient, address indexed hospital);
    event OrganTransplanted(uint256 indexed tokenId, address indexed recipient);
    event OrganExpired(uint256 indexed tokenId);
    event OrganStatusUpdated(uint256 indexed tokenId, OrganStatus status);
    event EmergencyStatusUpdated(uint256 indexed tokenId, bool isEmergency);

    // Updated modifier to allow owner access even if contracts aren't set
    modifier onlyAuthorized() {
        require(
            msg.sender == owner() || 
            (donorContract != address(0) && msg.sender == donorContract) || 
            (recipientContract != address(0) && msg.sender == recipientContract) || 
            (hospitalContract != address(0) && msg.sender == hospitalContract),
            "Not authorized"
        );
        _;
    }

    modifier validTokenId(uint256 tokenId) {
        require(_exists(tokenId), "Token does not exist");
        _;
    }

    constructor() ERC721("OrganDonationNFT", "ORGAN") {}

    function setContractAddresses(
        address _donorContract,
        address _recipientContract,
        address _hospitalContract
    ) external onlyOwner {
        donorContract = _donorContract;
        recipientContract = _recipientContract;
        hospitalContract = _hospitalContract;
    }

    function mintOrganNFT(
        address donorAddress,
        OrganType organType,
        string memory bloodType,
        string memory medicalDataHash,
        string memory uri
    ) external onlyAuthorized returns (uint256) {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        bytes32 hash = keccak256(abi.encodePacked(donorAddress, organType));
        require(organHash[hash] == 0, "Organ already exists");

        _safeMint(donorAddress, tokenId);
        _setTokenURI(tokenId, uri);

        organMetadata[tokenId] = OrganMetadata({
            donorAddress: donorAddress,
            organType: organType,
            bloodType: bloodType,
            status: OrganStatus.Available,
            donationTimestamp: block.timestamp,
            expiryTimestamp: 0,
            assignedRecipient: address(0),
            assignedHospital: address(0),
            medicalDataHash: medicalDataHash,
            isEmergency: false,
            urgencyLevel: 1
        });

        donorOrgans[donorAddress].push(tokenId);
        organHash[hash] = tokenId;

        emit OrganMinted(tokenId, donorAddress, organType);
        return tokenId;
    }

    function matchOrgan(
        uint256 tokenId,
        address recipient,
        address hospital
    ) external onlyAuthorized validTokenId(tokenId) {
        OrganMetadata storage organ = organMetadata[tokenId];
        require(organ.status == OrganStatus.Available, "Organ not available");

        organ.status = OrganStatus.Matched;
        organ.assignedRecipient = recipient;
        organ.assignedHospital = hospital;

        recipientAssignedOrgans[recipient].push(tokenId);
        emit OrganMatched(tokenId, recipient, hospital);
    }

    function markTransplanted(uint256 tokenId) 
        external 
        onlyAuthorized 
        validTokenId(tokenId) 
    {
        OrganMetadata storage organ = organMetadata[tokenId];
        require(organ.status == OrganStatus.Matched, "Organ must be matched first");
        organ.status = OrganStatus.Transplanted;
        emit OrganTransplanted(tokenId, organ.assignedRecipient);
    }

    function markExpired(uint256 tokenId) 
        external 
        onlyAuthorized 
        validTokenId(tokenId) 
    {
        OrganMetadata storage organ = organMetadata[tokenId];
        require(
            organ.status == OrganStatus.Available || organ.status == OrganStatus.Matched, 
            "Cannot expire transplanted organ"
        );
        organ.status = OrganStatus.Expired;
        emit OrganExpired(tokenId);
    }

    function setExpiryTimestamp(uint256 tokenId, uint256 expiryTime) 
        external 
        onlyAuthorized 
        validTokenId(tokenId) 
    {
        organMetadata[tokenId].expiryTimestamp = expiryTime;
    }

    function setEmergencyStatus(uint256 tokenId, bool isEmergency, uint256 urgencyLevel) 
        external 
        onlyAuthorized 
        validTokenId(tokenId) 
    {
        require(urgencyLevel >= 1 && urgencyLevel <= 10, "Invalid urgency level");
        organMetadata[tokenId].isEmergency = isEmergency;
        organMetadata[tokenId].urgencyLevel = urgencyLevel;
        emit EmergencyStatusUpdated(tokenId, isEmergency);
    }

    function updateOrganStatus(uint256 tokenId, OrganStatus newStatus) 
        external 
        onlyAuthorized 
        validTokenId(tokenId) 
    {
        organMetadata[tokenId].status = newStatus;
        emit OrganStatusUpdated(tokenId, newStatus);
    }

    function getOrganMetadata(uint256 tokenId) 
        external 
        view 
        validTokenId(tokenId) 
        returns (OrganMetadata memory) 
    {
        return organMetadata[tokenId];
    }

    function getDonorOrgans(address donor) external view returns (uint256[] memory) {
        return donorOrgans[donor];
    }

    function getRecipientOrgans(address recipient) external view returns (uint256[] memory) {
        return recipientAssignedOrgans[recipient];
    }

    function getOrganByDonorAndType(address donor, OrganType organType) 
        external 
        view 
        returns (uint256) 
    {
        bytes32 hash = keccak256(abi.encodePacked(donor, organType));
        return organHash[hash];
    }

    function getAvailableOrgans(OrganType organType, string memory bloodType) 
        external 
        view 
        returns (uint256[] memory) 
    {
        uint256 totalSupply = _tokenIdCounter.current();
        uint256[] memory tempTokens = new uint256[](totalSupply);
        uint256 count = 0;

        for (uint256 i = 0; i < totalSupply; i++) {
            if (_exists(i)) {
                OrganMetadata memory organ = organMetadata[i];
                if (
                    organ.organType == organType && 
                    organ.status == OrganStatus.Available &&
                    _isBloodCompatible(organ.bloodType, bloodType)
                ) {
                    tempTokens[count] = i;
                    count++;
                }
            }
        }

        uint256[] memory availableTokens = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            availableTokens[i] = tempTokens[i];
        }
        return availableTokens;
    }

    function getTotalOrgans() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

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

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) 
        public 
        view 
        override(ERC721, ERC721URIStorage) 
        returns (string memory) 
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override(ERC721, ERC721URIStorage) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }

    function emergencyTransfer(uint256 tokenId, address to) 
        external 
        onlyOwner 
        validTokenId(tokenId) 
    {
        address from = ownerOf(tokenId);
        _transfer(from, to, tokenId);
    }

    function batchUpdateStatus(uint256[] memory tokenIds, OrganStatus newStatus) 
        external 
        onlyOwner 
    {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (_exists(tokenIds[i])) {
                organMetadata[tokenIds[i]].status = newStatus;
                emit OrganStatusUpdated(tokenIds[i], newStatus);
            }
        }
    }
    function exists(uint256 tokenId) external view returns (bool) {
    return _exists(tokenId);
    }
}