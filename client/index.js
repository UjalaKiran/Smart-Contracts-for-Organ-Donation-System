import Web3 from 'web3';
import donorConfiguration from '../build/contracts/Donor.json';
import recipientConfiguration from '../build/contracts/Recipient.json';
import hospitalConfiguration from '../build/contracts/Hospital.json';
import organNFTConfiguration from '../build/contracts/OrganNFT.json';
import organQualityConfiguration from '../build/contracts/OrganQuality.json';

// Contract configurations - Update these addresses after deployment
const DONOR_CONTRACT_ADDRESS = donorConfiguration.networks['5777']?.address || 'YOUR_DONOR_CONTRACT_ADDRESS';
const RECIPIENT_CONTRACT_ADDRESS = recipientConfiguration.networks['5777']?.address || 'YOUR_RECIPIENT_CONTRACT_ADDRESS';
const HOSPITAL_CONTRACT_ADDRESS = hospitalConfiguration.networks['5777']?.address || 'YOUR_HOSPITAL_CONTRACT_ADDRESS';
const ORGAN_NFT_CONTRACT_ADDRESS = organNFTConfiguration.networks['5777']?.address || 'YOUR_ORGAN_NFT_CONTRACT_ADDRESS';
const ORGAN_QUALITY_CONTRACT_ADDRESS = organQualityConfiguration.networks['5777']?.address || 'YOUR_ORGAN_QUALITY_CONTRACT_ADDRESS';

const DONOR_CONTRACT_ABI = donorConfiguration.abi;
const RECIPIENT_CONTRACT_ABI = recipientConfiguration.abi;
const HOSPITAL_CONTRACT_ABI = hospitalConfiguration.abi;
const ORGAN_NFT_CONTRACT_ABI = organNFTConfiguration.abi;
const ORGAN_QUALITY_CONTRACT_ABI = organQualityConfiguration.abi;

let web3;
let donorContract;
let recipientContract;
let hospitalContract;
let organNFTContract;
let organQualityContract;
let account;

// DOM elements
const accountEl = document.getElementById('account');
const statusEl = document.getElementById('status');
const donorInfoEl = document.getElementById('donorInfo');
const donorInfoContentEl = document.getElementById('donorInfoContent');
const recipientInfoEl = document.getElementById('recipientInfo');
const recipientInfoContentEl = document.getElementById('recipientInfoContent');
const hospitalInfoEl = document.getElementById('hospitalInfo');
const hospitalInfoContentEl = document.getElementById('hospitalInfoContent');
const organNFTInfoEl = document.getElementById('organNFTInfo');
const organNFTInfoContentEl = document.getElementById('organNFTInfoContent');
const queryResultsEl = document.getElementById('queryResults');
const queryResultsContentEl = document.getElementById('queryResultsContent');
const qualityInfoEl = document.getElementById('qualityInfo');
const qualityInfoContentEl = document.getElementById('qualityInfoContent');

// Utility functions
const updateStatus = (message, type = 'info') => {
  statusEl.className = `alert alert-${type}`;
  statusEl.textContent = message;
};

const showError = (message) => {
  updateStatus(`Error: ${message}`, 'danger');
  console.error(message);
};

const showSuccess = (message) => {
  updateStatus(message, 'success');
};

// Initialize Web3
const initWeb3 = async () => {
  if (typeof window.ethereum === 'undefined') {
    showError('MetaMask is not installed. Please install MetaMask to use this dApp.');
    return false;
  }

  web3 = new Web3(window.ethereum);
  
  // Initialize contracts
  donorContract = new web3.eth.Contract(DONOR_CONTRACT_ABI, DONOR_CONTRACT_ADDRESS);
  recipientContract = new web3.eth.Contract(RECIPIENT_CONTRACT_ABI, RECIPIENT_CONTRACT_ADDRESS);
  hospitalContract = new web3.eth.Contract(HOSPITAL_CONTRACT_ABI, HOSPITAL_CONTRACT_ADDRESS);
  organNFTContract = new web3.eth.Contract(ORGAN_NFT_CONTRACT_ABI, ORGAN_NFT_CONTRACT_ADDRESS);
  organQualityContract = new web3.eth.Contract(ORGAN_QUALITY_CONTRACT_ABI, ORGAN_QUALITY_CONTRACT_ADDRESS);
  
  return true;
};

// Connect to MetaMask
const connectWallet = async () => {
  try {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });
    
    if (accounts.length === 0) {
      showError('No accounts found. Please connect your wallet.');
      return false;
    }
    
    account = accounts[0];
    accountEl.innerText = `Connected: ${account.substring(0, 6)}...${account.substring(38)}`;
    showSuccess('Wallet connected successfully!');
    
    // Check network
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    console.log('Current chain ID:', chainId);
    
    return true;
  } catch (error) {
    showError(`Failed to connect wallet: ${error.message}`);
    return false;
  }
};

// Donor Functions (keeping existing functions)
const registerDonor = async (event) => {
  event.preventDefault();
  
  if (!account) {
    showError('Please connect your wallet first.');
    return;
  }

  try {
    const form = event.target;
    const donorAddress = form.donorAddress.value;
    const name = form.donorName.value;
    const age = parseInt(form.donorAge.value);
    const bloodType = form.donorBloodType.value;
    const medicalHistory = form.donorMedicalHistory.value || '';
    
    const preferences = {
      heart: form.donorHeart.checked,
      liver: form.donorLiver.checked,
      kidneys: form.donorKidneys.checked
    };

    updateStatus('Registering donor... Please confirm the transaction in MetaMask.');

    const transaction = await donorContract.methods
      .registerDonor(donorAddress, name, age, bloodType, medicalHistory, preferences)
      .send({ 
        from: account,
        gas: 500000
      });
    
    showSuccess(`Donor registered successfully! Transaction: ${transaction.transactionHash}`);
    form.reset();
  } catch (error) {
    showError(`Failed to register donor: ${error.message}`);
  }
};

const getDonorInfo = async () => {
  try {
    const address = document.getElementById('getDonorAddress').value;
    if (!address) {
      showError('Please enter a donor address.');
      return;
    }

    updateStatus('Fetching donor information...');

    const donorData = await donorContract.methods.getDonorInfo(address).call();
    
    const statusNames = ['Active', 'Deactivated', 'Matched', 'Deceased'];
    
    donorInfoContentEl.innerHTML = `
      <div class="row">
        <div class="col-md-6">
          <p><strong>Name:</strong> ${donorData.name}</p>
          <p><strong>Age:</strong> ${donorData.age}</p>
          <p><strong>Blood Type:</strong> ${donorData.bloodType}</p>
          <p><strong>Status:</strong> <span class="badge bg-primary">${statusNames[donorData.status]}</span></p>
        </div>
        <div class="col-md-6">
          <p><strong>Medical History Hash:</strong> ${donorData.medicalHistoryHash}</p>
          <p><strong>Donation Preferences:</strong></p>
          <ul>
            <li>Heart: ${donorData.preferences.heart ? '✅' : '❌'}</li>
            <li>Liver: ${donorData.preferences.liver ? '✅' : '❌'}</li>
            <li>Kidneys: ${donorData.preferences.kidneys ? '✅' : '❌'}</li>
          </ul>
        </div>
      </div>
    `;
    
    donorInfoEl.style.display = 'block';
    showSuccess('Donor information retrieved successfully!');
  } catch (error) {
    showError(`Failed to get donor info: ${error.message}`);
    donorInfoEl.style.display = 'none';
  }
};

const updateDonorStatus = async () => {
  try {
    const address = document.getElementById('updateDonorAddress').value;
    const status = document.getElementById('donorStatusSelect').value;
    
    if (!address) {
      showError('Please enter a donor address.');
      return;
    }

    updateStatus('Updating donor status... Please confirm the transaction in MetaMask.');

    const transaction = await donorContract.methods
      .updateDonorStatus(address, parseInt(status))
      .send({ 
        from: account,
        gas: 300000
      });
    
    showSuccess(`Donor status updated successfully! Transaction: ${transaction.transactionHash}`);
    document.getElementById('updateDonorAddress').value = '';
  } catch (error) {
    showError(`Failed to update donor status: ${error.message}`);
  }
};

const deactivateDonor = async () => {
  try {
    const address = document.getElementById('deactivateDonorAddress').value;
    
    if (!address) {
      showError('Please enter a donor address.');
      return;
    }

    updateStatus('Deactivating donor... Please confirm the transaction in MetaMask.');

    const transaction = await donorContract.methods
      .deactivateDonor(address)
      .send({ 
        from: account,
        gas: 300000
      });
    
    showSuccess(`Donor deactivated successfully! Transaction: ${transaction.transactionHash}`);
    document.getElementById('deactivateDonorAddress').value = '';
  } catch (error) {
    showError(`Failed to deactivate donor: ${error.message}`);
  }
};

// Recipient Functions (keeping existing functions)
const registerRecipient = async (event) => {
  event.preventDefault();
  
  if (!account) {
    showError('Please connect your wallet first.');
    return;
  }

  try {
    const form = event.target;
    const recipientAddress = form.recipientAddress.value;
    const name = form.recipientName.value;
    const age = parseInt(form.recipientAge.value);
    const bloodType = form.recipientBloodType.value;
    const medicalHistory = form.recipientMedicalHistory.value || '';
    
    const location = {
      city: form.recipientCity.value,
      country: form.recipientCountry.value,
      additionalInfo: form.recipientAdditionalInfo.value || ''
    };

    updateStatus('Registering recipient... Please confirm the transaction in MetaMask.');

    const transaction = await recipientContract.methods
      .registerRecipient(recipientAddress, name, age, bloodType, medicalHistory, location)
      .send({ 
        from: account,
        gas: 500000
      });
    
    showSuccess(`Recipient registered successfully! Transaction: ${transaction.transactionHash}`);
    form.reset();
  } catch (error) {
    showError(`Failed to register recipient: ${error.message}`);
  }
};

const getRecipientInfo = async () => {
  try {
    const address = document.getElementById('getRecipientAddress').value;
    if (!address) {
      showError('Please enter a recipient address.');
      return;
    }

    updateStatus('Fetching recipient information...');

    const recipientData = await recipientContract.methods.getRecipientInfo(address).call();
    
    const statusNames = ['Waiting', 'Transplanted', 'Critical', 'Stable', 'Rejected'];
    
    recipientInfoContentEl.innerHTML = `
      <div class="row">
        <div class="col-md-6">
          <p><strong>Name:</strong> ${recipientData.name}</p>
          <p><strong>Age:</strong> ${recipientData.age}</p>
          <p><strong>Blood Type:</strong> ${recipientData.bloodType}</p>
          <p><strong>Medical Status:</strong> <span class="badge bg-warning">${statusNames[recipientData.medicalStatus]}</span></p>
        </div>
        <div class="col-md-6">
          <p><strong>Medical History Hash:</strong> ${recipientData.medicalHistoryHash}</p>
          <p><strong>Location:</strong></p>
          <ul>
            <li>City: ${recipientData.location.city}</li>
            <li>Country: ${recipientData.location.country}</li>
            <li>Additional Info: ${recipientData.location.additionalInfo}</li>
          </ul>
        </div>
      </div>
    `;
    
    recipientInfoEl.style.display = 'block';
    showSuccess('Recipient information retrieved successfully!');
  } catch (error) {
    showError(`Failed to get recipient info: ${error.message}`);
    recipientInfoEl.style.display = 'none';
  }
};

const addToWaitingList = async () => {
  try {
    const address = document.getElementById('waitingListAddress').value;
    const organType = document.getElementById('organTypeSelect').value;
    const urgency = document.getElementById('urgencyLevel').value;
    
    if (!address || !urgency) {
      showError('Please fill in all fields.');
      return;
    }

    updateStatus('Adding to waiting list... Please confirm the transaction in MetaMask.');

    const transaction = await recipientContract.methods
      .addToWaitingList(address, parseInt(organType), parseInt(urgency))
      .send({ 
        from: account,
        gas: 300000
      });
    
    showSuccess(`Added to waiting list successfully! Transaction: ${transaction.transactionHash}`);
    document.getElementById('waitingListAddress').value = '';
    document.getElementById('urgencyLevel').value = '';
  } catch (error) {
    showError(`Failed to add to waiting list: ${error.message}`);
  }
};

const updateMedicalStatus = async () => {
  try {
    const address = document.getElementById('updateRecipientAddress').value;
    const status = document.getElementById('medicalStatusSelect').value;
    
    if (!address) {
      showError('Please enter a recipient address.');
      return;
    }

    updateStatus('Updating medical status... Please confirm the transaction in MetaMask.');

    const transaction = await recipientContract.methods
      .updateRecipientMedicalStatus(address, parseInt(status))
      .send({ 
        from: account,
        gas: 300000
      });
    
    showSuccess(`Medical status updated successfully! Transaction: ${transaction.transactionHash}`);
    document.getElementById('updateRecipientAddress').value = '';
  } catch (error) {
    showError(`Failed to update medical status: ${error.message}`);
  }
};

// Hospital Functions (keeping existing functions)
const registerHospital = async (event) => {
  event.preventDefault();
  
  if (!account) {
    showError('Please connect your wallet first.');
    return;
  }

  try {
    const form = event.target;
    const hospitalAddress = form.hospitalAddress.value;
    const name = form.hospitalName.value;
    const location = form.hospitalLocation.value;
    const licenseId = form.hospitalLicenseId.value;
    
    const hospitalInfo = {
      name: name,
      location: location,
      licenseId: licenseId,
      isVerified: false
    };

    updateStatus('Registering hospital... Please confirm the transaction in MetaMask.');

    const transaction = await hospitalContract.methods
      .registerHospital(hospitalAddress, hospitalInfo)
      .send({ 
        from: account,
        gas: 500000
      });
    
    showSuccess(`Hospital registered successfully! Transaction: ${transaction.transactionHash}`);
    form.reset();
  } catch (error) {
    showError(`Failed to register hospital: ${error.message}`);
  }
};

const getHospitalInfo = async () => {
  try {
    const address = document.getElementById('getHospitalAddress').value;
    if (!address) {
      showError('Please enter a hospital address.');
      return;
    }

    updateStatus('Fetching hospital information...');

    const hospitalData = await hospitalContract.methods.getHospitalInfo(address).call();
    
    hospitalInfoContentEl.innerHTML = `
      <div class="row">
        <div class="col-md-6">
          <p><strong>Name:</strong> ${hospitalData.name}</p>
          <p><strong>Location:</strong> ${hospitalData.location}</p>
          <p><strong>License ID:</strong> ${hospitalData.licenseId}</p>
          <p><strong>Verification Status:</strong> 
            <span class="badge ${hospitalData.isVerified ? 'bg-success' : 'bg-warning'}">
              ${hospitalData.isVerified ? 'Verified' : 'Not Verified'}
            </span>
          </p>
        </div>
        <div class="col-md-6">
          <div id="hospitalCapacities">
            <p><strong>Organ Capacities:</strong></p>
            <div id="capacityList">Loading capacities...</div>
          </div>
        </div>
      </div>
    `;
    
    try {
      const heartCapacity = await hospitalContract.methods.getHospitalCapacity(address, 0).call();
      const liverCapacity = await hospitalContract.methods.getHospitalCapacity(address, 1).call();
      const kidneysCapacity = await hospitalContract.methods.getHospitalCapacity(address, 2).call();
      
      document.getElementById('capacityList').innerHTML = `
        <ul>
          <li>Heart: ${heartCapacity}</li>
          <li>Liver: ${liverCapacity}</li>
          <li>Kidneys: ${kidneysCapacity}</li>
        </ul>
      `;
    } catch (error) {
      document.getElementById('capacityList').innerHTML = 'Could not load capacities.';
    }
    
    hospitalInfoEl.style.display = 'block';
    showSuccess('Hospital information retrieved successfully!');
  } catch (error) {
    showError(`Failed to get hospital info: ${error.message}`);
    hospitalInfoEl.style.display = 'none';
  }
};

const verifyHospital = async () => {
  try {
    const address = document.getElementById('verifyHospitalAddress').value;
    const credentials = document.getElementById('hospitalCredentials').value;
    
    if (!address || !credentials) {
      showError('Please fill in all fields.');
      return;
    }

    updateStatus('Verifying hospital... Please confirm the transaction in MetaMask.');

    const credentialsBytes = web3.utils.asciiToHex(credentials);

    const transaction = await hospitalContract.methods
      .verifyHospitalCredentials(address, credentialsBytes)
      .send({ 
        from: account,
        gas: 300000
      });
    
    showSuccess(`Hospital verified successfully! Transaction: ${transaction.transactionHash}`);
    document.getElementById('verifyHospitalAddress').value = '';
    document.getElementById('hospitalCredentials').value = '';
  } catch (error) {
    showError(`Failed to verify hospital: ${error.message}`);
  }
};

const authorizeStaff = async () => {
  try {
    const hospitalAddress = document.getElementById('staffHospitalAddress').value;
    const staffAddress = document.getElementById('staffAddress').value;
    const role = document.getElementById('staffRoleSelect').value;
    
    if (!hospitalAddress || !staffAddress) {
      showError('Please fill in all fields.');
      return;
    }

    updateStatus('Authorizing staff... Please confirm the transaction in MetaMask.');

    const transaction = await hospitalContract.methods
      .authorizeHospitalStaff(hospitalAddress, staffAddress, parseInt(role))
      .send({ 
        from: account,
        gas: 300000
      });
    
    showSuccess(`Staff authorized successfully! Transaction: ${transaction.transactionHash}`);
    document.getElementById('staffHospitalAddress').value = '';
    document.getElementById('staffAddress').value = '';
  } catch (error) {
    showError(`Failed to authorize staff: ${error.message}`);
  }
};

const updateHospitalCapacity = async () => {
  try {
    const hospitalAddress = document.getElementById('capacityHospitalAddress').value;
    const organType = document.getElementById('capacityOrganType').value;
    const capacity = document.getElementById('capacityAmount').value;
    
    if (!hospitalAddress || !capacity) {
      showError('Please fill in all fields.');
      return;
    }

    updateStatus('Updating hospital capacity... Please confirm the transaction in MetaMask.');

    const transaction = await hospitalContract.methods
      .updateHospitalCapacity(hospitalAddress, parseInt(organType), parseInt(capacity))
      .send({ 
        from: account,
        gas: 300000
      });
    
    showSuccess(`Hospital capacity updated successfully! Transaction: ${transaction.transactionHash}`);
    document.getElementById('capacityHospitalAddress').value = '';
    document.getElementById('capacityAmount').value = '';
  } catch (error) {
    showError(`Failed to update hospital capacity: ${error.message}`);
  }
};

const getStaffRole = async () => {
  try {
    const hospitalAddress = document.getElementById('roleHospitalAddress').value;
    const staffAddress = document.getElementById('roleStaffAddress').value;
    
    if (!hospitalAddress || !staffAddress) {
      showError('Please fill in all fields.');
      return;
    }

    updateStatus('Fetching staff role...');

    const role = await hospitalContract.methods.getStaffRole(hospitalAddress, staffAddress).call();
    
    const roleNames = ['Admin', 'Surgeon', 'Coordinator', 'None'];
    const resultEl = document.getElementById('staffRoleResult');
    
    resultEl.innerHTML = `
      <div class="alert alert-info">
        <strong>Staff Role:</strong> <span class="badge bg-primary">${roleNames[role]}</span>
      </div>
    `;
    
    resultEl.style.display = 'block';
    showSuccess('Staff role retrieved successfully!');
  } catch (error) {
    showError(`Failed to get staff role: ${error.message}`);
    document.getElementById('staffRoleResult').style.display = 'none';
  }
};

// Organ NFT Functions (keeping existing functions)
const mintOrganNFT = async (event) => {
  event.preventDefault();
  
  if (!account) {
    showError('Please connect your wallet first.');
    return;
  }

  try {
    const form = event.target;
    const donorAddress = form.nftDonorAddress.value;
    const organType = parseInt(form.nftOrganType.value);
    const bloodType = form.nftBloodType.value;
    const medicalDataHash = form.nftMedicalDataHash.value;
    const tokenUri = form.nftTokenUri.value;

    updateStatus('Minting Organ NFT... Please confirm the transaction in MetaMask.');

    const transaction = await organNFTContract.methods
      .mintOrganNFT(donorAddress, organType, bloodType, medicalDataHash, tokenUri)
      .send({ 
        from: account,
        gas: 800000
      });
    
    showSuccess(`Organ NFT minted successfully! Transaction: ${transaction.transactionHash}`);
    form.reset();
  } catch (error) {
    showError(`Failed to mint Organ NFT: ${error.message}`);
  }
};

const getOrganMetadata = async () => {
  try {
    const tokenId = document.getElementById('getTokenId').value;
    if (!tokenId) {
      showError('Please enter a token ID.');
      return;
    }

    updateStatus('Fetching organ metadata...');

    const exists = await organNFTContract.methods.exists(tokenId).call();
    if (!exists) {
      showError('Token ID does not exist.');
      return;
    }

    const metadata = await organNFTContract.methods.getOrganMetadata(tokenId).call();
    
    const organTypes = ['Heart', 'Liver', 'Kidneys'];
    const statusNames = ['Available', 'Matched', 'Transplanted', 'Expired', 'Rejected'];
    
    const donationTimestamp = typeof metadata.donationTimestamp === 'bigint' 
      ? Number(metadata.donationTimestamp) 
      : parseInt(metadata.donationTimestamp);
    
    const expiryTimestamp = typeof metadata.expiryTimestamp === 'bigint'
      ? Number(metadata.expiryTimestamp)
      : parseInt(metadata.expiryTimestamp);

    const urgencyLevel = typeof metadata.urgencyLevel === 'bigint'
      ? Number(metadata.urgencyLevel)
      : parseInt(metadata.urgencyLevel);

    const organType = typeof metadata.organType === 'bigint'
      ? Number(metadata.organType)
      : parseInt(metadata.organType);

    const status = typeof metadata.status === 'bigint'
      ? Number(metadata.status)
      : parseInt(metadata.status);
    
    const donationDate = donationTimestamp > 0 ? new Date(donationTimestamp * 1000).toLocaleString() : 'Not set';
    const expiryDate = expiryTimestamp > 0 ? new Date(expiryTimestamp * 1000).toLocaleString() : 'Not set';
    
    organNFTInfoContentEl.innerHTML = `
      <div class="row">
        <div class="col-md-6">
          <p><strong>Token ID:</strong> ${tokenId}</p>
          <p><strong>Donor Address:</strong> ${metadata.donorAddress}</p>
          <p><strong>Organ Type:</strong> ${organTypes[organType] || 'Unknown'}</p>
          <p><strong>Blood Type:</strong> ${metadata.bloodType}</p>
          <p><strong>Status:</strong> <span class="badge bg-primary">${statusNames[status] || 'Unknown'}</span></p>
          <p><strong>Emergency:</strong> <span class="badge ${metadata.isEmergency ? 'bg-danger' : 'bg-success'}">${metadata.isEmergency ? 'Yes' : 'No'}</span></p>
          <p><strong>Urgency Level:</strong> ${urgencyLevel}/10</p>
        </div>
        <div class="col-md-6">
          <p><strong>Medical Data Hash:</strong> ${metadata.medicalDataHash}</p>
          <p><strong>Donation Date:</strong> ${donationDate}</p>
          <p><strong>Expiry Date:</strong> ${expiryDate}</p>
          <p><strong>Assigned Recipient:</strong> ${metadata.assignedRecipient === '0x0000000000000000000000000000000000000000' ? 'None' : metadata.assignedRecipient}</p>
          <p><strong>Assigned Hospital:</strong> ${metadata.assignedHospital === '0x0000000000000000000000000000000000000000' ? 'None' : metadata.assignedHospital}</p>
        </div>
      </div>
    `;
    
    organNFTInfoEl.style.display = 'block';
    showSuccess('Organ metadata retrieved successfully!');
  } catch (error) {
    console.error('Detailed error:', error);
    showError(`Failed to get organ metadata: ${error.message}`);
    organNFTInfoEl.style.display = 'none';
  }
};

const matchOrgan = async () => {
  try {
    const tokenId = document.getElementById('matchTokenId').value;
    const recipientAddress = document.getElementById('matchRecipientAddress').value;
    const hospitalAddress = document.getElementById('matchHospitalAddress').value;
    
    if (!tokenId || !recipientAddress || !hospitalAddress) {
      showError('Please fill in all fields.');
      return;
    }

    if (!web3.utils.isAddress(recipientAddress)) {
      showError('Invalid recipient address.');
      return;
    }

    if (!web3.utils.isAddress(hospitalAddress)) {
      showError('Invalid hospital address.');
      return;
    }

    const exists = await organNFTContract.methods.exists(tokenId).call();
    if (!exists) {
      showError('Token ID does not exist.');
      return;
    }

    updateStatus('Matching organ... Please confirm the transaction in MetaMask.');

    const transaction = await organNFTContract.methods
      .matchOrgan(tokenId, recipientAddress, hospitalAddress)
      .send({ 
        from: account,
        gas: 500000
      });
    
    showSuccess(`Organ matched successfully! Transaction: ${transaction.transactionHash}`);
    document.getElementById('matchTokenId').value = '';
    document.getElementById('matchRecipientAddress').value = '';
    document.getElementById('matchHospitalAddress').value = '';
  } catch (error) {
    console.error('Match organ error:', error);
    showError(`Failed to match organ: ${error.message}`);
  }
};

const markTransplanted = async () => {
  try {
    const tokenId = document.getElementById('transplantTokenId').value;
    
    if (!tokenId) {
      showError('Please enter a token ID.');
      return;
    }

    const exists = await organNFTContract.methods.exists(tokenId).call();
    if (!exists) {
      showError('Token ID does not exist.');
      return;
    }

    const metadata = await organNFTContract.methods.getOrganMetadata(tokenId).call();
    const status = typeof metadata.status === 'bigint' ? Number(metadata.status) : parseInt(metadata.status);
    
    if (status !== 1) {
      showError('Organ must be matched before it can be marked as transplanted.');
      return;
    }

    updateStatus('Marking organ as transplanted... Please confirm the transaction in MetaMask.');

    const transaction = await organNFTContract.methods
      .markTransplanted(tokenId)
      .send({ 
        from: account,
        gas: 300000
      });
    
    showSuccess(`Organ marked as transplanted successfully! Transaction: ${transaction.transactionHash}`);
    document.getElementById('transplantTokenId').value = '';
  } catch (error) {
    console.error('Mark transplanted error:', error);
    showError(`Failed to mark organ as transplanted: ${error.message}`);
  }
};

const setEmergencyStatus = async () => {
  try {
    const tokenId = document.getElementById('emergencyTokenId').value;
    const isEmergency = document.getElementById('isEmergency').value === 'true';
    const urgencyLevel = document.getElementById('urgencyLevelNFT').value;
    
    if (!tokenId || !urgencyLevel) {
      showError('Please fill in all fields.');
      return;
    }

    const urgency = parseInt(urgencyLevel);
    if (urgency < 1 || urgency > 10) {
      showError('Urgency level must be between 1 and 10.');
      return;
    }

    const exists = await organNFTContract.methods.exists(tokenId).call();
    if (!exists) {
      showError('Token ID does not exist.');
      return;
    }

    updateStatus('Setting emergency status... Please confirm the transaction in MetaMask.');

    const transaction = await organNFTContract.methods
      .setEmergencyStatus(tokenId, isEmergency, urgency)
      .send({ 
        from: account,
        gas: 300000
      });
    
    showSuccess(`Emergency status set successfully! Transaction: ${transaction.transactionHash}`);
    document.getElementById('emergencyTokenId').value = '';
    document.getElementById('urgencyLevelNFT').value = '';
  } catch (error) {
    console.error('Set emergency status error:', error);
    showError(`Failed to set emergency status: ${error.message}`);
  }
};

const getDonorOrgans = async () => {
  try {
    const address = document.getElementById('donorOrgansAddress').value;
    if (!address) {
      showError('Please enter a donor address.');
      return;
    }

    if (!web3.utils.isAddress(address)) {
      showError('Invalid address format.');
      return;
    }

    updateStatus('Fetching donor organs...');

    const organs = await organNFTContract.methods.getDonorOrgans(address).call();
    
    const organIds = organs.map(id => typeof id === 'bigint' ? Number(id) : parseInt(id));
    
    if (organIds.length === 0) {
      queryResultsContentEl.innerHTML = '<p>No organs found for this donor.</p>';
    } else {
      let organsHtml = '<h6>Donor Organs:</h6><ul>';
      organIds.forEach(tokenId => {
        organsHtml += `<li>Token ID: ${tokenId}</li>`;
      });
      organsHtml += '</ul>';
      queryResultsContentEl.innerHTML = organsHtml;
    }
    
    queryResultsEl.style.display = 'block';
    showSuccess(`Found ${organIds.length} organs for this donor.`);
  } catch (error) {
    console.error('Get donor organs error:', error);
    showError(`Failed to get donor organs: ${error.message}`);
    queryResultsEl.style.display = 'none';
  }
};

const getAvailableOrgans = async () => {
  try {
    const organType = document.getElementById('availableOrganType').value;
    const bloodType = document.getElementById('availableBloodType').value;

    if (!organType || !bloodType) {
      showError('Please select both organ type and blood type.');
      return;
    }

    updateStatus('Fetching available organs...');

    const organs = await organNFTContract.methods.getAvailableOrgans(parseInt(organType), bloodType).call();
    
    const organIds = organs.map(id => typeof id === 'bigint' ? Number(id) : parseInt(id));
    
    if (organIds.length === 0) {
      queryResultsContentEl.innerHTML = '<p>No available organs found for this criteria.</p>';
    } else {
      let organsHtml = '<h6>Available Organs:</h6><ul>';
      organIds.forEach(tokenId => {
        organsHtml += `<li>Token ID: ${tokenId}</li>`;
      });
      organsHtml += '</ul>';
      queryResultsContentEl.innerHTML = organsHtml;
    }
    
    queryResultsEl.style.display = 'block';
    showSuccess(`Found ${organIds.length} available organs.`);
  } catch (error) {
    console.error('Get available organs error:', error);
    showError(`Failed to get available organs: ${error.message}`);
    queryResultsEl.style.display = 'none';
  }
};

const getTotalOrgans = async () => {
  try {
    updateStatus('Fetching total organs count...');

    const totalOrgans = await organNFTContract.methods.getTotalOrgans().call();
    const total = typeof totalOrgans === 'bigint' ? Number(totalOrgans) : parseInt(totalOrgans);
    
    queryResultsContentEl.innerHTML = `<h6>Total Organs: ${total}</h6>`;
    queryResultsEl.style.display = 'block';
    showSuccess('Total organs count retrieved successfully!');
  } catch (error) {
    console.error('Get total organs error:', error);
    showError(`Failed to get total organs: ${error.message}`);
    queryResultsEl.style.display = 'none';
  }
};

const markExpired = async () => {
  try {
    const tokenId = document.getElementById('expiredTokenId').value;
    
    if (!tokenId) {
      showError('Please enter a token ID.');
      return;
    }

    const exists = await organNFTContract.methods.exists(tokenId).call();
    if (!exists) {
      showError('Token ID does not exist.');
      return;
    }

    updateStatus('Marking organ as expired... Please confirm the transaction in MetaMask.');

    const transaction = await organNFTContract.methods
      .markExpired(tokenId)
      .send({ 
        from: account,
        gas: 300000
      });
    
    showSuccess(`Organ marked as expired successfully! Transaction: ${transaction.transactionHash}`);
    document.getElementById('expiredTokenId').value = '';
  } catch (error) {
    console.error('Mark expired error:', error);
    showError(`Failed to mark organ as expired: ${error.message}`);
  }
};

const setContractAddresses = async () => {
  try {
    updateStatus('Setting contract addresses... Please confirm the transaction in MetaMask.');

    const transaction = await organNFTContract.methods
      .setContractAddresses(DONOR_CONTRACT_ADDRESS, RECIPIENT_CONTRACT_ADDRESS, HOSPITAL_CONTRACT_ADDRESS)
      .send({ 
        from: account,
        gas: 300000
      });
    
    showSuccess(`Contract addresses set successfully! Transaction: ${transaction.transactionHash}`);
  } catch (error) {
    console.error('Set contract addresses error:', error);
    showError(`Failed to set contract addresses: ${error.message}`);
  }
};

const updateOrganStatus = async () => {
  try {
    const tokenId = document.getElementById('updateStatusTokenId').value;
    const newStatus = document.getElementById('newOrganStatus').value;
    
    if (!tokenId || newStatus === '') {
      showError('Please fill in all fields.');
      return;
    }

    const exists = await organNFTContract.methods.exists(tokenId).call();
    if (!exists) {
      showError('Token ID does not exist.');
      return;
    }

    updateStatus('Updating organ status... Please confirm the transaction in MetaMask.');

    const transaction = await organNFTContract.methods
      .updateOrganStatus(tokenId, parseInt(newStatus))
      .send({ 
        from: account,
        gas: 300000
      });
    
    showSuccess(`Organ status updated successfully! Transaction: ${transaction.transactionHash}`);
    document.getElementById('updateStatusTokenId').value = '';
  } catch (error) {
    console.error('Update organ status error:', error);
    showError(`Failed to update organ status: ${error.message}`);
  }
};

// NEW: OrganQuality Functions
// NEW: OrganQuality Functions - FIXED VERSIONS
const updateMedicalData = async (event) => {
  event.preventDefault();
  
  if (!account) {
    showError('Please connect your wallet first.');
    return;
  }

  try {
    const form = event.target;
    const tokenId = parseInt(form.medicalTokenId.value);
    const ipfsHash = form.medicalIpfsHash.value.trim();

    if (!tokenId && tokenId !== 0) {
      showError('Please enter a valid token ID.');
      return;
    }

    if (!ipfsHash) {
      showError('Please enter an IPFS hash.');
      return;
    }

    console.log('Updating medical data for token:', tokenId, 'with hash:', ipfsHash);

    // Check if token exists
    const exists = await organNFTContract.methods.exists(tokenId).call();
    if (!exists) {
      showError('Token ID does not exist. Please mint an organ NFT first.');
      return;
    }

    updateStatus('Updating medical data... Please confirm the transaction in MetaMask.');

    // Create medical data object matching the contract struct
    const medicalData = {
      ipfsHash: ipfsHash,
      lastUpdated: Math.floor(Date.now() / 1000), // Will be overwritten by contract
      isValid: false // Will be set by contract
    };

    const transaction = await organQualityContract.methods
      .updateMedicalData(tokenId, medicalData)
      .send({ 
        from: account,
        gas: 500000,
        gasPrice: web3.utils.toWei('20', 'gwei')
      });
    
    showSuccess(`Medical data updated successfully! Transaction: ${transaction.transactionHash}`);
    form.reset();
  } catch (error) {
    console.error('Update medical data error:', error);
    
    // More specific error handling
    if (error.message.includes('Not authorized')) {
      showError('You are not authorized to update medical data. Only contract owner and authorized addresses can perform this action.');
    } else if (error.message.includes('Token does not exist')) {
      showError('Token ID does not exist. Please check the token ID.');
    } else if (error.message.includes('User denied')) {
      showError('Transaction was cancelled by user.');
    } else {
      showError(`Failed to update medical data: ${error.message}`);
    }
  }
};

const addTestResult = async () => {
  try {
    const tokenId = parseInt(document.getElementById('testTokenId').value);
    const testType = document.getElementById('testType').value.trim();
    const resultHash = document.getElementById('testResultHash').value.trim();

    if (!tokenId && tokenId !== 0) {
      showError('Please enter a valid token ID.');
      return;
    }

    if (!testType) {
      showError('Please select a test type.');
      return;
    }

    if (!resultHash) {
      showError('Please enter a test result hash.');
      return;
    }

    console.log('Adding test result for token:', tokenId, 'type:', testType, 'hash:', resultHash);

    // Check if token exists
    const exists = await organNFTContract.methods.exists(tokenId).call();
    if (!exists) {
      showError('Token ID does not exist. Please mint an organ NFT first.');
      return;
    }

    updateStatus('Adding test result... Please confirm the transaction in MetaMask.');

    // Create test result object matching the contract struct
    const testResult = {
      testType: testType,
      resultHash: resultHash,
      timestamp: Math.floor(Date.now() / 1000), // Will be overwritten by contract
      isApproved: false // Will be set by contract
    };

    const transaction = await organQualityContract.methods
      .addTestResults(tokenId, [testResult]) // Pass as array
      .send({ 
        from: account,
        gas: 500000,
        gasPrice: web3.utils.toWei('20', 'gwei')
      });
    
    showSuccess(`Test result added successfully! Transaction: ${transaction.transactionHash}`);
    
    // Clear form
    document.getElementById('testTokenId').value = '';
    document.getElementById('testType').value = '';
    document.getElementById('testResultHash').value = '';
  } catch (error) {
    console.error('Add test result error:', error);
    
    if (error.message.includes('Not authorized')) {
      showError('You are not authorized to add test results. Only contract owner and authorized addresses can perform this action.');
    } else if (error.message.includes('Token does not exist')) {
      showError('Token ID does not exist. Please check the token ID.');
    } else if (error.message.includes('User denied')) {
      showError('Transaction was cancelled by user.');
    } else {
      showError(`Failed to add test result: ${error.message}`);
    }
  }
};

const validateQuality = async () => {
  try {
    const tokenId = parseInt(document.getElementById('validateTokenId').value);
    
    if (!tokenId && tokenId !== 0) {
      showError('Please enter a valid token ID.');
      return;
    }

    console.log('Validating quality for token:', tokenId);

    // Check if token exists
    const exists = await organNFTContract.methods.exists(tokenId).call();
    if (!exists) {
      showError('Token ID does not exist. Please mint an organ NFT first.');
      return;
    }

    updateStatus('Validating organ quality... Please confirm the transaction in MetaMask.');

    const transaction = await organQualityContract.methods
      .validateOrganQuality(tokenId)
      .send({ 
        from: account,
        gas: 300000,
        gasPrice: web3.utils.toWei('20', 'gwei')
      });
    
    showSuccess(`Organ quality validated successfully! Transaction: ${transaction.transactionHash}`);
    document.getElementById('validateTokenId').value = '';
  } catch (error) {
    console.error('Validate quality error:', error);
    
    if (error.message.includes('Not authorized')) {
      showError('You are not authorized to validate organ quality. Only contract owner and authorized addresses can perform this action.');
    } else if (error.message.includes('Token does not exist')) {
      showError('Token ID does not exist. Please check the token ID.');
    } else if (error.message.includes('User denied')) {
      showError('Transaction was cancelled by user.');
    } else {
      showError(`Failed to validate organ quality: ${error.message}`);
    }
  }
};

const getMedicalData = async () => {
  try {
    const tokenId = parseInt(document.getElementById('getMedicalTokenId').value);
    
    if (!tokenId && tokenId !== 0) {
      showError('Please enter a valid token ID.');
      return;
    }

    console.log('Getting medical data for token:', tokenId);

    updateStatus('Fetching medical data...');

    const medicalData = await organQualityContract.methods.organMedicalData(tokenId).call();
    
    const lastUpdated = typeof medicalData.lastUpdated === 'bigint' 
      ? Number(medicalData.lastUpdated) 
      : parseInt(medicalData.lastUpdated);
    
    const updateDate = lastUpdated > 0 ? new Date(lastUpdated * 1000).toLocaleString() : 'Not set';
    
    qualityInfoContentEl.innerHTML = `
      <div class="row">
        <div class="col-12">
          <h6>Medical Data Information</h6>
          <p><strong>Token ID:</strong> ${tokenId}</p>
          <p><strong>IPFS Hash:</strong> ${medicalData.ipfsHash || 'Not set'}</p>
          <p><strong>Last Updated:</strong> ${updateDate}</p>
          <p><strong>Validation Status:</strong> 
            <span class="badge ${medicalData.isValid ? 'bg-success' : 'bg-warning'}">
              ${medicalData.isValid ? 'Valid' : 'Not Validated'}
            </span>
          </p>
        </div>
      </div>
    `;
    
    qualityInfoEl.style.display = 'block';
    showSuccess('Medical data retrieved successfully!');
  } catch (error) {
    console.error('Get medical data error:', error);
    showError(`Failed to get medical data: ${error.message}`);
    qualityInfoEl.style.display = 'none';
  }
};

// Simplified getTestResults function that works with current contract
const getTestResults = async () => {
  try {
    const tokenId = parseInt(document.getElementById('getTestTokenId').value);
    
    if (!tokenId && tokenId !== 0) {
      showError('Please enter a valid token ID.');
      return;
    }

    console.log('Getting test results for token:', tokenId);

    updateStatus('Fetching test results...');

    // Since we can't query the array directly, we'll try to access individual results
    // and show what we can
    let resultsHtml = `
      <div class="row">
        <div class="col-12">
          <h6>Test Results for Token ID: ${tokenId}</h6>
          <p class="text-muted">Test results are stored on-chain but require individual access or events to display.</p>
          <p><strong>Note:</strong> To view detailed test results, you can:</p>
          <ul>
            <li>Check the blockchain explorer for TestResultsAdded events</li>
            <li>Use the contract's organTestResults mapping directly</li>
            <li>Look at transaction logs when test results were added</li>
          </ul>
        </div>
      </div>
    `;
    
    qualityInfoContentEl.innerHTML = resultsHtml;
    qualityInfoEl.style.display = 'block';
    showSuccess('Test results information displayed. Check transaction logs for detailed results.');
  } catch (error) {
    console.error('Get test results error:', error);
    showError(`Failed to get test results: ${error.message}`);
    qualityInfoEl.style.display = 'none';
  }
};

// Fixed compatibility check function
const checkCompatibility = async () => {
  try {
    const tokenId = parseInt(document.getElementById('compatTokenId').value);
    const recipientAddress = document.getElementById('compatRecipientAddress').value.trim();
    
    if (!tokenId && tokenId !== 0) {
      showError('Please enter a valid token ID.');
      return;
    }

    if (!recipientAddress) {
      showError('Please enter a recipient address.');
      return;
    }

    if (!web3.utils.isAddress(recipientAddress)) {
      showError('Invalid recipient address format.');
      return;
    }

    console.log('Checking compatibility for token:', tokenId, 'recipient:', recipientAddress);

    // Check if token exists first
    const exists = await organNFTContract.methods.exists(tokenId).call();
    if (!exists) {
      showError('Token ID does not exist. Please check the token ID.');
      return;
    }

    // Check if recipient is registered
    try {
      const recipientData = await recipientContract.methods.getRecipientInfo(recipientAddress).call();
      if (!recipientData.age || recipientData.age === 0) {
        showError('Recipient is not registered in the system. Please register the recipient first.');
        return;
      }
    } catch (error) {
      showError('Recipient is not registered in the system. Please register the recipient first.');
      return;
    }

    updateStatus('Checking compatibility...');

    try {
      const isCompatible = await organQualityContract.methods
        .getOrganCompatibility(tokenId, recipientAddress)
        .call({ from: account });
      
      const resultEl = document.getElementById('compatibilityResult');
      const alertEl = document.getElementById('compatibilityAlert');
      
      alertEl.className = `alert ${isCompatible ? 'alert-success' : 'alert-danger'}`;
      alertEl.innerHTML = `
        <strong>Compatibility Result:</strong> 
        <span class="badge ${isCompatible ? 'bg-success' : 'bg-danger'}">
          ${isCompatible ? 'Compatible' : 'Not Compatible'}
        </span>
        <br>
        <small>Token ID ${tokenId} ${isCompatible ? 'is' : 'is not'} compatible with recipient ${recipientAddress}</small>
      `;
      
      resultEl.style.display = 'block';
      showSuccess('Compatibility check completed.');
    } catch (compatError) {
      console.error('Compatibility check failed:', compatError);
      
      // Try a simpler approach - just check basic info
      try {
        const organMetadata = await organNFTContract.methods.getOrganMetadata(tokenId).call();
        const recipientData = await recipientContract.methods.getRecipientInfo(recipientAddress).call();
        
        // Simple blood type compatibility check
        const isBloodCompatible = checkBloodCompatibility(organMetadata.bloodType, recipientData.bloodType);
        
        const resultEl = document.getElementById('compatibilityResult');
        const alertEl = document.getElementById('compatibilityAlert');
        
        alertEl.className = `alert ${isBloodCompatible ? 'alert-warning' : 'alert-danger'}`;
        alertEl.innerHTML = `
          <strong>Basic Compatibility Check:</strong> 
          <span class="badge ${isBloodCompatible ? 'bg-warning' : 'bg-danger'}">
            Blood Type ${isBloodCompatible ? 'Compatible' : 'Not Compatible'}
          </span>
          <br>
          <small>Donor: ${organMetadata.bloodType} | Recipient: ${recipientData.bloodType}</small>
          <br>
          <small class="text-muted">Full compatibility check failed. This is a basic blood type check only.</small>
        `;
        
        resultEl.style.display = 'block';
        showSuccess('Basic compatibility check completed.');
      } catch (fallbackError) {
        showError('Failed to perform compatibility check. Please ensure both organ and recipient exist.');
        document.getElementById('compatibilityResult').style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Check compatibility error:', error);
    showError(`Failed to check compatibility: ${error.message}`);
    document.getElementById('compatibilityResult').style.display = 'none';
  }
};

// Helper function for blood type compatibility
const checkBloodCompatibility = (donorBlood, recipientBlood) => {
  // Universal donor
  if (donorBlood === 'O-') return true;
  // Universal recipient
  if (recipientBlood === 'AB+') return true;
  // Exact match
  if (donorBlood === recipientBlood) return true;
  
  // More specific compatibility rules
  const compatibilityMap = {
    'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    'O+': ['O+', 'A+', 'B+', 'AB+'],
    'A-': ['A-', 'A+', 'AB-', 'AB+'],
    'A+': ['A+', 'AB+'],
    'B-': ['B-', 'B+', 'AB-', 'AB+'],
    'B+': ['B+', 'AB+'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+']
  };
  
  return compatibilityMap[donorBlood]?.includes(recipientBlood) || false;
};

// Event Listeners
const setupEventListeners = () => {
  // Donor events
  document.getElementById('donorForm').addEventListener('submit', registerDonor);
  document.getElementById('getDonorBtn').addEventListener('click', getDonorInfo);
  document.getElementById('updateDonorStatusBtn').addEventListener('click', updateDonorStatus);
  document.getElementById('deactivateDonorBtn').addEventListener('click', deactivateDonor);

  // Recipient events
  document.getElementById('recipientForm').addEventListener('submit', registerRecipient);
  document.getElementById('getRecipientBtn').addEventListener('click', getRecipientInfo);
  document.getElementById('addToWaitingListBtn').addEventListener('click', addToWaitingList);
  document.getElementById('updateMedicalStatusBtn').addEventListener('click', updateMedicalStatus);

  // Hospital events
  document.getElementById('hospitalForm').addEventListener('submit', registerHospital);
  document.getElementById('getHospitalBtn').addEventListener('click', getHospitalInfo);
  document.getElementById('verifyHospitalBtn').addEventListener('click', verifyHospital);
  document.getElementById('authorizeStaffBtn').addEventListener('click', authorizeStaff);
  document.getElementById('updateCapacityBtn').addEventListener('click', updateHospitalCapacity);
  document.getElementById('getStaffRoleBtn').addEventListener('click', getStaffRole);

  // Organ NFT events
  document.getElementById('mintOrganForm').addEventListener('submit', mintOrganNFT);
  document.getElementById('getOrganMetadataBtn').addEventListener('click', getOrganMetadata);
  document.getElementById('matchOrganBtn').addEventListener('click', matchOrgan);
  document.getElementById('markTransplantedBtn').addEventListener('click', markTransplanted);
  document.getElementById('setEmergencyBtn').addEventListener('click', setEmergencyStatus);
  document.getElementById('getDonorOrgansBtn').addEventListener('click', getDonorOrgans);
  document.getElementById('getAvailableOrgansBtn').addEventListener('click', getAvailableOrgans);
  document.getElementById('getTotalOrgansBtn').addEventListener('click', getTotalOrgans);
  document.getElementById('markExpiredBtn').addEventListener('click', markExpired);
  document.getElementById('setContractAddressesBtn').addEventListener('click', setContractAddresses);
  document.getElementById('updateOrganStatusBtn').addEventListener('click', updateOrganStatus);

  // OrganQuality events
  document.getElementById('updateMedicalDataForm').addEventListener('submit', updateMedicalData);
  document.getElementById('addTestResultBtn').addEventListener('click', addTestResult);
  document.getElementById('validateQualityBtn').addEventListener('click', validateQuality);
  document.getElementById('getMedicalDataBtn').addEventListener('click', getMedicalData);
  document.getElementById('getTestResultsBtn').addEventListener('click', getTestResults);
  document.getElementById('checkCompatibilityBtn').addEventListener('click', checkCompatibility);
};

// Handle account changes
const handleAccountsChanged = (accounts) => {
  if (accounts.length === 0) {
    console.log('Please connect to MetaMask.');
    accountEl.innerText = 'Not connected';
    account = null;
    updateStatus('Please connect your wallet to get started.', 'info');
  } else {
    account = accounts[0];
    accountEl.innerText = `Connected: ${account.substring(0, 6)}...${account.substring(38)}`;
    showSuccess('Account connected successfully!');
  }
};

// Handle network changes
const handleChainChanged = (chainId) => {
  console.log('Network changed to:', chainId);
  window.location.reload();
};

const main = async () => {
  updateStatus('Initializing application...');

  // Initialize Web3
  const web3Initialized = await initWeb3();
  if (!web3Initialized) return;

  // Connect wallet
  const walletConnected = await connectWallet();
  if (!walletConnected) return;

  // Set up event listeners
  setupEventListeners();

  // Set up MetaMask event listeners
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
  }

  showSuccess('Application initialized successfully! You can now interact with all contracts.');
  
  // Log contract information for debugging
  try {
    const donorOwner = await donorContract.methods.owner().call();
    const recipientOwner = await recipientContract.methods.owner().call();
    const hospitalOwner = await hospitalContract.methods.owner().call();
    const organNFTOwner = await organNFTContract.methods.owner().call();
    const organQualityOwner = await organQualityContract.methods.owner().call();
    
    console.log('Contract Owners:');
    console.log('Donor Contract Owner:', donorOwner);
    console.log('Recipient Contract Owner:', recipientOwner);
    console.log('Hospital Contract Owner:', hospitalOwner);
    console.log('Organ NFT Contract Owner:', organNFTOwner);
    console.log('Organ Quality Contract Owner:', organQualityOwner);
    console.log('Current Account:', account);
    console.log('Is Owner (Donor):', donorOwner.toLowerCase() === account.toLowerCase());
    console.log('Is Owner (Recipient):', recipientOwner.toLowerCase() === account.toLowerCase());
    console.log('Is Owner (Hospital):', hospitalOwner.toLowerCase() === account.toLowerCase());
    console.log('Is Owner (Organ NFT):', organNFTOwner.toLowerCase() === account.toLowerCase());
    console.log('Is Owner (Organ Quality):', organQualityOwner.toLowerCase() === account.toLowerCase());

    // Auto-setup contract addresses if user is the owner
    if (organNFTOwner.toLowerCase() === account.toLowerCase()) {
      try {
        console.log('Setting up contract addresses automatically...');
        await organNFTContract.methods
          .setContractAddresses(DONOR_CONTRACT_ADDRESS, RECIPIENT_CONTRACT_ADDRESS, HOSPITAL_CONTRACT_ADDRESS)
          .send({ 
            from: account,
            gas: 300000
          });
        console.log('Contract addresses set successfully');
        showSuccess('Contract addresses configured automatically!');
      } catch (setupError) {
        console.warn('Could not auto-setup contract addresses:', setupError.message);
        updateStatus('Contract addresses may need to be set manually using the "Set Contract Addresses" button.', 'warning');
      }
    }
  } catch (error) {
    console.warn('Could not fetch contract owners:', error.message);
  }
};

// Clean up event listeners when page unloads
window.addEventListener('beforeunload', () => {
  if (window.ethereum) {
    window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    window.ethereum.removeListener('chainChanged', handleChainChanged);
  }
});

// Start the application
main().catch(error => {
  console.error('Failed to initialize application:', error);
  showError(`Failed to initialize application: ${error.message}`);
});