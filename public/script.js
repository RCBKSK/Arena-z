// Contract details
const CONTRACT_ADDRESS = '0x241B47bDE91B7d1843cA34Fc694D4e6926f3B83e';
const CHAIN_ID = 7897;
const RPC_URL = 'https://rpc.arena-z.gg';
const EXPLORER_URL = 'https://explorer.arena-z.gg';

// Each user deploys their own BatchFactory instance
let USER_BATCH_FACTORY_ADDRESS = null; // Will be set after user deploys their factory

// Cache for user's personal batch contract
let userBatchContract = null;

/*
 * BATCH TRANSFER METHOD PRIORITY:
 * 1. Batch Proxy Contract (if deployed) - BEST: Single transaction for unlimited NFTs
 * 2. safeBatchTransferFrom - GOOD: Native batch support if contract has it
 * 3. ERC1155 batch - GOOD: For hybrid contracts
 * 4. Multicall - OK: Multiple calls in one transaction
 * 5. Individual transfers - FALLBACK: Separate transactions (requires multiple signatures)
 */

// Enhanced ERC721 ABI with additional functions
const ERC721_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "from", "type": "address"},
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "uint256", "name": "tokenId", "type": "uint256"}
    ],
    "name": "safeTransferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "ownerOf",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "owner", "type": "address"},
      {"internalType": "uint256", "name": "index", "type": "uint256"}
    ],
    "name": "tokenOfOwnerByIndex",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "tokenURI",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "getApproved",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "owner", "type": "address"},
      {"internalType": "address", "name": "operator", "type": "address"}
    ],
    "name": "isApprovedForAll",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "operator", "type": "address"},
      {"internalType": "bool", "name": "approved", "type": "bool"}
    ],
    "name": "setApprovalForAll",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "from", "type": "address"},
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "uint256[]", "name": "tokenIds", "type": "uint256[]"}
    ],
    "name": "safeBatchTransferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes[]", "name": "data", "type": "bytes[]"}
    ],
    "name": "multicall",
    "outputs": [{"internalType": "bytes[]", "name": "results", "type": "bytes[]"}],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// BatchFactory ABI
const BATCH_FACTORY_ABI = [
    {
        "inputs": [{"internalType": "uint256", "name": "salt", "type": "uint256"}],
        "name": "deployBatch",
        "outputs": [{"internalType": "address", "name": "batchContract", "type": "address"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "deployer", "type": "address"},
            {"internalType": "uint256", "name": "salt", "type": "uint256"}
        ],
        "name": "getBatchAddress",
        "outputs": [{"internalType": "address", "name": "predicted", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "deployer", "type": "address"},
            {"internalType": "uint256", "name": "salt", "type": "uint256"}
        ],
        "name": "batchExists",
        "outputs": [{"internalType": "bool", "name": "exists", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    }
];

// BatchNFTTransfer ABI
const BATCH_TRANSFER_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "nftContract", "type": "address"},
            {"internalType": "address[]", "name": "recipients", "type": "address[]"},
            {"internalType": "uint256[]", "name": "tokenIds", "type": "uint256[]"}
        ],
        "name": "batchTransfer",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "nftContract", "type": "address"},
            {"internalType": "address", "name": "recipient", "type": "address"},
            {"internalType": "uint256[]", "name": "tokenIds", "type": "uint256[]"}
        ],
        "name": "batchTransferToSingle",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// Simplified BatchNFTTransfer ABI
const SIMPLE_BATCH_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "nftContract", "type": "address"},
            {"internalType": "address[]", "name": "recipients", "type": "address[]"},
            {"internalType": "uint256[]", "name": "tokenIds", "type": "uint256[]"}
        ],
        "name": "batchTransfer",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// Function to check if user has a batch contract
async function checkUserBatchContract() {
    if (!USER_BATCH_FACTORY_ADDRESS) {
        updateBatchStatus('BatchFactory not deployed yet. Deploy BatchFactory first.', 'error');
        return null;
    }

    if (!web3) {
        updateBatchStatus('Please connect wallet first', 'error');
        return null;
    }

    try {
        const userAddress = accounts[0];
        const salt = 1; // User-specific salt

        const factoryContract = new web3.eth.Contract(BATCH_FACTORY_ABI, USER_BATCH_FACTORY_ADDRESS);

        // Check if user already has a batch contract
        const batchExists = await factoryContract.methods.batchExists(userAddress, salt).call();

        if (batchExists) {
            // Get existing contract address
            const batchAddress = await factoryContract.methods.getBatchAddress(userAddress, salt).call();
            userBatchContract = batchAddress;
            updateBatchStatus(`✅ Your batch contract: ${batchAddress}`, 'success');
            document.getElementById('deployBatchBtn').disabled = true;
            document.getElementById('checkBatchBtn').disabled = false;
            return batchAddress;
        } else {
            updateBatchStatus('❌ No batch contract found. Deploy one to enable efficient batch transfers!', 'info');
            document.getElementById('deployBatchBtn').disabled = false;
            document.getElementById('checkBatchBtn').disabled = false;
            return null;
        }
    } catch (error) {
        console.error('Error checking batch contract:', error);
        updateBatchStatus(`Error checking batch contract: ${error.message}`, 'error');
        return null;
    }
}

// Function to deploy user's batch contract
async function deployUserBatchContract() {
    if (!USER_BATCH_FACTORY_ADDRESS) {
        updateBatchStatus('BatchFactory not deployed yet. Deploy BatchFactory first.', 'error');
        return;
    }

    if (!web3) {
        updateBatchStatus('Please connect wallet first', 'error');
        return;
    }

    try {
        updateBatchStatus('Deploying your personal batch contract...', 'info');
        document.getElementById('deployBatchBtn').disabled = true;

        const userAddress = accounts[0];
        const salt = 1; // User-specific salt

        const factoryContract = new web3.eth.Contract(BATCH_FACTORY_ABI, USER_BATCH_FACTORY_ADDRESS);

        // Check if user already has a batch contract
        const batchExists = await factoryContract.methods.batchExists(userAddress, salt).call();

        if (batchExists) {
            const batchAddress = await factoryContract.methods.getBatchAddress(userAddress, salt).call();
            userBatchContract = batchAddress;
            updateBatchStatus(`✅ You already have a batch contract: ${batchAddress}`, 'success');
            return;
        }

        // Deploy new batch contract
        const gasEstimate = await factoryContract.methods.deployBatch(salt).estimateGas({ from: userAddress });

        const tx = await factoryContract.methods.deployBatch(salt).send({ 
            from: userAddress,
            gas: Math.ceil(gasEstimate * 1.2)
        });

        // Get deployed address
        const batchAddress = await factoryContract.methods.getBatchAddress(userAddress, salt).call();
        userBatchContract = batchAddress;

        updateBatchStatus(`✅ Successfully deployed your batch contract: ${batchAddress}`, 'success');
        console.log('Deployed batch contract:', batchAddress);

    } catch (error) {
        console.error('Error deploying batch contract:', error);
        updateBatchStatus(`Error deploying batch contract: ${error.message}`, 'error');
    } finally {
        document.getElementById('deployBatchBtn').disabled = false;
    }
}

// Function to update batch contract status
function updateBatchStatus(message, type) {
    const statusDiv = document.getElementById('batchContractStatus');
    statusDiv.textContent = message;
    statusDiv.className = `batch-status ${type}`;
}

// Function to get or deploy user's batch contract
async function getUserBatchContract() {
    if (userBatchContract) {
        return userBatchContract;
    }

    const existingContract = await checkUserBatchContract();
    if (existingContract) {
        return existingContract;
    }

    // If no contract exists, user needs to deploy one manually
    updateBatchStatus('⚠️ No batch contract found. Click "Deploy New Batch Contract" to create one!', 'info');
    return null;
}
const BATCH_PROXY_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_nftContract",
        "type": "address"
      },
      {
        "internalType": "address[]",
        "name": "_recipients",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "_tokenIds",
        "type": "uint256[]"
      }
    ],
    "name": "batchTransfer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

let web3;
let accounts = [];
let contract;
let selectedNFTs = new Set();
let userNFTs = [];
let currency = {};
let batchProxy; // Batch proxy contract instance

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('connectWallet').addEventListener('click', connectWallet);
  document.getElementById('loadNFTs').addEventListener('click', loadUserNFTs);
  document.getElementById('transferBtn').addEventListener('click', transferNFTs);
  document.getElementById('optimizeGas').addEventListener('click', optimizeGasSettings);
  document.getElementById('toggleSelectAll').addEventListener('click', toggleSelectAll);
  document.getElementById('sortBtn').addEventListener('click', sortNFTs);
  document.getElementById('deployBatchFactoryBtn').addEventListener('click', deployBatchFactory);
  document.getElementById('deployBatchBtn').addEventListener('click', deployUserBatchContract);
  document.getElementById('checkBatchBtn').addEventListener('click', checkUserBatchContract);
});

// Native token and gas optimization functions
async function getNativeTokenInfo() {
  try {
    const provider = web3;
    const network = await provider.eth.net.getId();
    const chainId = network;

    const res = await fetch("https://chainlist.org/rpcs.json");
    const chains = await res.json();

    const currentChain = chains.find((c) => c.chainId === chainId);

    if (!currentChain) {
      console.warn(`⚠️ Network info not found for Chain ID: ${chainId}`);
      return {
        chainId,
        chainName: 'Arena-Z Chain',
        symbol: 'ETH',
        name: 'Ether',
        decimals: 18,
        usdPrice: null
      };
    }

    const token = currentChain.nativeCurrency;
    const symbol = token.symbol.toLowerCase();

    const coingeckoIds = {
      eth: "ethereum",
      matic: "polygon",
      bnb: "binancecoin",
      avax: "avalanche-2",
      ftm: "fantom",
      op: "optimism",
      arb: "arbitrum",
      cro: "crypto-com-chain",
      ada: "cardano",
      etc: "ethereum-classic",
    };

    const cgId = coingeckoIds[symbol];
    let usdPrice = null;

    if (cgId) {
      try {
        const priceRes = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`
        );
        const priceData = await priceRes.json();
        usdPrice = priceData[cgId]?.usd ?? null;
      } catch (err) {
        console.warn("Unable to fetch USD price from CoinGecko", err);
      }
    }

    currency = {
      chainId,
      chainName: currentChain.name || 'Arena-Z Chain',
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      usdPrice,
    };

    return currency;
  } catch (error) {
    console.error("Error getting native token info:", error);
    return {
      chainId: CHAIN_ID,
      chainName: 'Arena-Z Chain',
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
      usdPrice: null
    };
  }
}

async function getGasPrice() {
  try {
    const gasPrice = await web3.eth.getGasPrice();
    const currentPriceGwei = web3.utils.fromWei(gasPrice, 'gwei');
    return {
      gasPrice,
      currentPriceGwei,
      suggestedPrice: Math.max(1, parseFloat(currentPriceGwei) * 0.8) // 20% lower than current
    };
  } catch (error) {
    console.error("Error getting gas price:", error);
    return {
      gasPrice: web3.utils.toWei('5', 'gwei'),
      currentPriceGwei: '5',
      suggestedPrice: '4'
    };
  }
}

async function optimizeGasSettings() {
  if (!web3) {
    updateStatus("Please connect wallet first");
    return;
  }

  updateStatus("Optimizing gas settings...");
  const gasInfo = await getGasPrice();
  const tokenInfo = await getNativeTokenInfo();

  document.getElementById('currentGas').textContent = gasInfo.currentPriceGwei;
  document.getElementById('suggestedGas').textContent = gasInfo.suggestedPrice.toFixed(2);
  document.getElementById('nativeToken').textContent = tokenInfo.symbol;
  document.getElementById('usdPrice').textContent = tokenInfo.usdPrice ? tokenInfo.usdPrice.toFixed(2) : '-';

  updateStatus(`Recommended gas price: ${gasInfo.suggestedPrice.toFixed(2)} Gwei (Current: ${gasInfo.currentPriceGwei} Gwei)`);
}

// Wallet connection
async function connectWallet() {
  if (window.ethereum) {
    try {
      updateStatus("Connecting to MetaMask...");
      accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (parseInt(chainId, 16) !== CHAIN_ID) {
        await switchToArenaZChain();
      }

      web3 = new Web3(window.ethereum);
      contract = new web3.eth.Contract(ERC721_ABI, CONTRACT_ADDRESS);

      // Note: Batch proxy will be created when user deploys their personal batch contract

      document.getElementById('walletAddress').textContent = accounts[0];
      document.getElementById('transferBtn').disabled = false;
      document.getElementById('optimizeGas').disabled = false;
      document.getElementById('loadNFTs').disabled = false;
      document.getElementById('deployBatchFactoryBtn').disabled = false;
      updateStatus('Wallet connected successfully');

      // Initialize gas optimization
      await optimizeGasSettings();

      // Check if user has a batch contract
      await checkUserBatchContract();
    } catch (error) {
      console.error('Error connecting wallet:', error);
      updateStatus(`Error: ${error.message}`);
    }
  } else {
    updateStatus('Please install MetaMask!');
  }
}

async function switchToArenaZChain() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${CHAIN_ID.toString(16)}`,
          chainName: 'Arena-Z Chain',
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18
          },
          rpcUrls: [RPC_URL],
          blockExplorerUrls: [EXPLORER_URL]
        }]
      });
    }
  }
}

// NFT loading and management
async function loadUserNFTs() {
  if (!contract || !accounts[0]) {
    updateStatus("Please connect wallet first");
    return;
  }

  document.getElementById('nftLoader').style.display = 'block';
  updateStatus("Loading your NFTs...");

  try {
    const balance = await contract.methods.balanceOf(accounts[0]).call();
    const balanceNum = parseInt(balance);

    if (balanceNum === 0) {
      updateStatus("No NFTs found in your wallet for this contract");
      document.getElementById('nftLoader').style.display = 'none';
      return;
    }

    userNFTs = [];
    updateStatus(`Found ${balanceNum} NFTs, loading details...`);

    // Method 1: Try tokenOfOwnerByIndex (ERC721Enumerable)
    let useEnumerable = true;
    try {
      await contract.methods.tokenOfOwnerByIndex(accounts[0], 0).call();
    } catch (error) {
      console.log("Contract doesn't support ERC721Enumerable, using alternative method");
      useEnumerable = false;
    }

    if (useEnumerable) {
      // Load token IDs using enumeration
      for (let i = 0; i < balanceNum; i++) {
        try {
          const tokenId = await contract.methods.tokenOfOwnerByIndex(accounts[0], i).call();
          userNFTs.push({ tokenId: tokenId.toString(), metadata: null });
          updateStatus(`Loading NFT ${i + 1}/${balanceNum}...`);
        } catch (error) {
          console.warn(`Error getting token at index ${i}:`, error);
        }
      }
    } else {
      // Alternative method: Check common token ID ranges
      // This is a fallback when enumeration isn't supported
      updateStatus("Scanning for your NFTs (this may take a moment)...");

      const maxTokenId = 10000; // Adjust based on your collection size
      const batchSize = 50;

      for (let start = 1; start <= maxTokenId; start += batchSize) {
        const promises = [];
        const end = Math.min(start + batchSize - 1, maxTokenId);

        for (let tokenId = start; tokenId <= end; tokenId++) {
          promises.push(
            contract.methods.ownerOf(tokenId).call()
              .then(owner => ({ tokenId: tokenId.toString(), owner }))
              .catch(() => null)
          );
        }

        const results = await Promise.all(promises);
        results.forEach(result => {
          if (result && result.owner.toLowerCase() === accounts[0].toLowerCase()) {
            userNFTs.push({ tokenId: result.tokenId, metadata: null });
          }
        });

        updateStatus(`Scanned tokens ${start}-${end}, found ${userNFTs.length} NFTs...`);

        if (userNFTs.length >= balanceNum) break;
      }
    }

    if (userNFTs.length === 0) {
      updateStatus("No NFTs found. Make sure you're connected to the right wallet.");
      document.getElementById('nftLoader').style.display = 'none';
      return;
    }

    updateStatus(`Loading metadata for ${userNFTs.length} NFTs...`);

    // Load metadata for each NFT with better error handling
    const metadataPromises = userNFTs.map(async (nft, index) => {
      try {
        const tokenURI = await contract.methods.tokenURI(nft.tokenId).call();
        if (tokenURI) {
          // Handle IPFS URLs
          let metadataUrl = tokenURI;
          if (tokenURI.startsWith('ipfs://')) {
            metadataUrl = tokenURI.replace('ipfs://', 'https://ipfs.io/ipfs/');
          }

          const response = await fetch(metadataUrl);
          if (response.ok) {
            const metadata = await response.json();
            nft.metadata = metadata;

            // Handle IPFS image URLs
            if (metadata.image && metadata.image.startsWith('ipfs://')) {
              metadata.image = metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/');
            }
          }
        }

        if ((index + 1) % 10 === 0) {
          updateStatus(`Loaded metadata for ${index + 1}/${userNFTs.length} NFTs...`);
        }
      } catch (error) {
        console.warn(`Error loading metadata for token ${nft.tokenId}:`, error);
      }
    });

    await Promise.all(metadataPromises);

    displayNFTs();
    document.querySelector('.nft-controls').style.display = 'block';
    updateStatus(`Successfully loaded ${userNFTs.length} NFTs`);
  } catch (error) {
    console.error("Error loading NFTs:", error);
    updateStatus(`Error loading NFTs: ${error.message}`);
  } finally {
    document.getElementById('nftLoader').style.display = 'none';
  }
}

function displayNFTs() {
  const grid = document.getElementById('nftGrid');
  grid.innerHTML = '';

  userNFTs.forEach(nft => {
    const nftElement = document.createElement('div');
    nftElement.className = 'nft-item';
    nftElement.dataset.tokenId = nft.tokenId;

    const imageUrl = nft.metadata?.image || '';
    const name = nft.metadata?.name || `Token #${nft.tokenId}`;

    nftElement.innerHTML = `
      ${imageUrl ? 
        `<img src="${imageUrl}" alt="${name}" class="nft-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
         <div class="nft-placeholder" style="display: none;">No Image</div>` :
        `<div class="nft-placeholder">No Image</div>`
      }
      <div class="nft-id">ID: ${nft.tokenId}</div>
      <div class="nft-name">${name}</div>
    `;

    nftElement.addEventListener('click', () => toggleNFTSelection(nft.tokenId));
    grid.appendChild(nftElement);
  });
}

function toggleNFTSelection(tokenId) {
  const element = document.querySelector(`[data-token-id="${tokenId}"]`);

  if (selectedNFTs.has(tokenId)) {
    selectedNFTs.delete(tokenId);
    element.classList.remove('selected');
  } else {
    selectedNFTs.add(tokenId);
    element.classList.add('selected');
  }

  updateSelectedCount();
  updateTokenIdsInput();
}

function toggleSelectAll() {
  const button = document.getElementById('toggleSelectAll');

  if (selectedNFTs.size === userNFTs.length) {
    // Deselect all
    selectedNFTs.clear();
    document.querySelectorAll('.nft-item').forEach(el => el.classList.remove('selected'));
    button.textContent = 'Select All';
  } else {
    // Select all
    selectedNFTs.clear();
    userNFTs.forEach(nft => selectedNFTs.add(nft.tokenId));
    document.querySelectorAll('.nft-item').forEach(el => el.classList.add('selected'));
    button.textContent = 'Deselect All';
  }

  updateSelectedCount();
  updateTokenIdsInput();
}

function sortNFTs() {
  userNFTs.sort((a, b) => parseInt(a.tokenId) - parseInt(b.tokenId));
  displayNFTs();

  // Restore selection state
  selectedNFTs.forEach(tokenId => {
    const element = document.querySelector(`[data-token-id="${tokenId}"]`);
    if (element) element.classList.add('selected');
  });
}

function updateSelectedCount() {
  document.getElementById('selectedCount').textContent = `${selectedNFTs.size} selected`;
}

function updateTokenIdsInput() {
  const tokenIdsArray = Array.from(selectedNFTs);
  document.getElementById('tokenIds').value = tokenIdsArray.join(',');
}

// Transfer functions
async function transferNFTs() {
  const recipient = document.getElementById('recipient').value.trim();
  let tokenIdsInput = document.getElementById('tokenIds').value.trim();

  // Use selected NFTs if manual input is empty
  if (!tokenIdsInput && selectedNFTs.size > 0) {
    tokenIdsInput = Array.from(selectedNFTs).join(',');
  }

  if (!recipient || !tokenIdsInput) {
    updateStatus('Please fill recipient address and select NFTs or enter token IDs');
    return;
  }

  if (!web3.utils.isAddress(recipient)) {
    updateStatus('Invalid recipient address');
    return;
  }

  const tokenIds = tokenIdsInput.split(',').map(id => id.trim()).filter(id => id);
  if (tokenIds.length === 0) {
    updateStatus('Please select NFTs or enter at least one token ID');
    return;
  }

  updateStatus(`Preparing to transfer ${tokenIds.length} NFTs...`);
  document.getElementById('transferBtn').disabled = true;

  try {
    const results = [];

    // Check if recipient is valid (not zero address)
    if (recipient.toLowerCase() === '0x0000000000000000000000000000000000000000') {
      updateStatus('Invalid recipient (zero address)');
      return;
    }

    // Validate ownership for all tokens first
    const validTokenIds = [];
    const invalidTokens = [];

    updateStatus('Validating token ownership...');

    for (const tokenId of tokenIds) {
      try {
        const owner = await contract.methods.ownerOf(tokenId).call();
        if (owner.toLowerCase() === accounts[0].toLowerCase()) {
          validTokenIds.push(tokenId);
        } else {
          invalidTokens.push({ tokenId, message: 'Not owned by you' });
        }
      } catch (error) {
        invalidTokens.push({ tokenId, message: 'Token does not exist' });
      }
    }

    // Add invalid tokens to results
    invalidTokens.forEach(item => {
      results.push({ tokenId: item.tokenId, status: 'Skipped', message: item.message });
    });

    if (validTokenIds.length === 0) {
      updateStatus('No valid tokens to transfer');
      displayResults(results);
      return;
    }

    // Check if contract supports batch transfer
    let supportsBatch = false;
    try {
      await contract.methods.safeBatchTransferFrom(accounts[0], recipient, []).estimateGas({ from: accounts[0] });
      supportsBatch = true;
    } catch (error) {
      console.log('Contract does not support batch transfer, using individual transfers');
    }

    const gasInfo = await getGasPrice();

    // Note: Individual transfers will still require separate MetaMask confirmations
    // This is normal behavior for security - each transaction needs user approval

    // Try different batch transfer methods in order of preference
    if (validTokenIds.length > 1) {
      let batchSuccess = false;

      // Method 1: Use user's personal batch contract if available (MOST EFFICIENT)
        const userBatchAddress = await getUserBatchContract();
        if (userBatchAddress) {
          try {
            updateStatus(`Attempting transfer via your personal batch contract...`);

            const userBatchContract = new web3.eth.Contract(SIMPLE_BATCH_ABI, userBatchAddress);
            const recipients = Array(validTokenIds.length).fill(recipient);

            // Check if contract is approved for transfers
            const isApprovedForAll = await contract.methods.isApprovedForAll(accounts[0], userBatchAddress).call();

            if (!isApprovedForAll) {
              updateStatus('Approving batch contract to transfer your NFTs...');
              await contract.methods.setApprovalForAll(userBatchAddress, true).send({ from: accounts[0] });
              updateStatus('Approval granted! Now transferring NFTs...');
            }

            const estimatedGas = await userBatchContract.methods.batchTransfer(
              CONTRACT_ADDRESS,
              recipients,
              validTokenIds
            ).estimateGas({ from: accounts[0] });

            const gasSettings = {
              gasPrice: web3.utils.toWei(gasInfo.suggestedPrice.toString(), 'gwei'),
              gas: Math.ceil(estimatedGas * 1.3) // Add 30% buffer for batch
            };

            const tx = await userBatchContract.methods.batchTransfer(
              CONTRACT_ADDRESS,
              recipients,
              validTokenIds
            ).send({
              from: accounts[0],
              ...gasSettings
            });

            validTokenIds.forEach(tokenId => {
              results.push({
                tokenId,
                status: 'Batch Transferred via Personal Contract',
                txHash: tx.transactionHash,
                gasUsed: Math.floor(tx.gasUsed / validTokenIds.length)
              });
              selectedNFTs.delete(tokenId);
            });

            updateStatus(`✅ Successfully batch transferred ${validTokenIds.length} NFTs via your personal batch contract in one transaction!`);
            batchSuccess = true;
          } catch (error) {
            console.log('Personal batch contract transfer failed:', error.message);
            updateBatchStatus('❌ Batch transfer failed. Try deploying a new batch contract.', 'error');
          }
        }


      // Method 1: Try ERC1155 batch transfer (if contract supports it)
      if (!batchSuccess) {
        try {
          updateStatus(`Checking ERC1155 batch transfer support...`);

          // Check if contract has ERC1155 safeBatchTransferFrom
          const erc1155Method = contract.methods.safeBatchTransferFrom;
          if (erc1155Method) {
            const data = '0x'; // Empty data for ERC1155

            const estimatedGas = await erc1155Method(
              accounts[0],
              recipient,
              validTokenIds,
              validTokenIds.map(() => 1), // quantities (1 for each NFT)
              data
            ).estimateGas({ from: accounts[0] });

            const gasSettings = {
              gasPrice: web3.utils.toWei(gasInfo.suggestedPrice.toString(), 'gwei'),
              gas: Math.ceil(estimatedGas * 1.3)
            };

            const tx = await erc1155Method(
              accounts[0],
              recipient,
              validTokenIds,
              validTokenIds.map(() => 1),
              data
            ).send({ 
              from: accounts[0],
              ...gasSettings
            });

            validTokenIds.forEach(tokenId => {
              results.push({ 
                tokenId, 
                status: 'ERC1155 Batch Transferred', 
                txHash: tx.transactionHash,
                gasUsed: Math.floor(tx.gasUsed / validTokenIds.length)
              });
              selectedNFTs.delete(tokenId);
            });

            updateStatus(`✅ Successfully ERC1155 batch transferred ${validTokenIds.length} NFTs!`);
            batchSuccess = true;
          }
        } catch (error) {
          console.log('ERC1155 batch transfer failed:', error.message);
        }
      }

      // Method 2: Try safeBatchTransferFrom
      if (!batchSuccess) {
        try {
          updateStatus(`Attempting batch transfer for ${validTokenIds.length} NFTs...`);

          const estimatedGas = await contract.methods.safeBatchTransferFrom(
            accounts[0],
            recipient,
            validTokenIds
          ).estimateGas({ from: accounts[0] });

          const gasSettings = {
            gasPrice: web3.utils.toWei(gasInfo.suggestedPrice.toString(), 'gwei'),
            gas: Math.ceil(estimatedGas * 1.3) // Add 30% buffer for batch
          };

          const tx = await contract.methods.safeBatchTransferFrom(
            accounts[0],
            recipient,
            validTokenIds
          ).send({ 
            from: accounts[0],
            ...gasSettings
          });

          // All tokens transferred successfully in one transaction
          validTokenIds.forEach(tokenId => {
            results.push({ 
              tokenId, 
              status: 'Batch Transferred', 
              txHash: tx.transactionHash,
              gasUsed: Math.floor(tx.gasUsed / validTokenIds.length)
            });
            selectedNFTs.delete(tokenId);
          });

          updateStatus(`✅ Successfully batch transferred ${validTokenIds.length} NFTs in one transaction!`);
          batchSuccess = true;

        } catch (error) {
          console.log('safeBatchTransferFrom failed, trying alternative methods:', error.message);
        }
      }

      // Method 2: Try multicall pattern (if contract supports it)
      if (!batchSuccess) {
        try {
          updateStatus(`Trying multicall batch transfer...`);

          // Create array of transfer call data
          const transferCalls = validTokenIds.map(tokenId => 
            contract.methods.safeTransferFrom(accounts[0], recipient, tokenId).encodeABI()
          );

          // Check if contract has multicall function
          if (contract.methods.multicall) {
            const estimatedGas = await contract.methods.multicall(transferCalls).estimateGas({ from: accounts[0] });

            const gasSettings = {
              gasPrice: web3.utils.toWei(gasInfo.suggestedPrice.toString(), 'gwei'),
              gas: Math.ceil(estimatedGas * 1.3)
            };

            const tx = await contract.methods.multicall(transferCalls).send({ 
              from: accounts[0],
              ...gasSettings
            });

            validTokenIds.forEach(tokenId => {
              results.push({ 
                tokenId, 
                status: 'Multicall Transferred', 
                txHash: tx.transactionHash,
                gasUsed: Math.floor(tx.gasUsed / validTokenIds.length)
              });
              selectedNFTs.delete(tokenId);
            });

            updateStatus(`✅ Successfully multicall transferred ${validTokenIds.length} NFTs in one transaction!`);
            batchSuccess = true;
          }
        } catch (error) {
          console.log('Multicall failed:', error.message);
        }
      }

      // If batch methods failed, fall back to individual transfers
      if (!batchSuccess) {
        updateStatus(`Batch transfer not supported, using individual transfers...`);
      } else {
        return; // Exit if batch was successful
      }
    }

    // Use individual transfers
    if (validTokenIds.length > 0) {
      // Use individual transfers
      updateStatus(`Transferring ${validTokenIds.length} NFTs individually...`);

      const gasSettings = {
        gasPrice: web3.utils.toWei(gasInfo.suggestedPrice.toString(), 'gwei'),
        gas: 150000
      };

      for (const tokenId of validTokenIds) {
        try {
          // Estimate gas for this specific transfer
          const estimatedGas = await contract.methods.safeTransferFrom(
            accounts[0],
            recipient,
            tokenId
          ).estimateGas({ from: accounts[0] });

          gasSettings.gas = Math.ceil(estimatedGas * 1.2); // Add 20% buffer

          updateStatus(`Transferring token ${tokenId}... (${validTokenIds.indexOf(tokenId) + 1}/${validTokenIds.length})`);

          const tx = await contract.methods.safeTransferFrom(
            accounts[0],
            recipient,
            tokenId
          ).send({ 
            from: accounts[0],
            ...gasSettings
          });

          results.push({ 
            tokenId, 
            status: 'Transferred', 
            txHash: tx.transactionHash,
            gasUsed: tx.gasUsed
          });

          selectedNFTs.delete(tokenId);
        } catch (error) {
          let errorMessage = error.message;

          if (error.message.includes('revert')) {
            if (error.message.includes('ERC721: transfer caller is not owner nor approved')) {
              errorMessage = 'Not approved to transfer this token';
            } else if (error.message.includes('ERC721: transfer to non ERC721Receiver implementer')) {
              errorMessage = 'Recipient cannot receive NFTs';
            } else if (error.message.includes('ERC721: transfer of token that is not own')) {
              errorMessage = 'Token ownership changed during transfer';
            } else {
              errorMessage = 'Transaction reverted by contract';
            }
          }

          results.push({ 
            tokenId, 
            status: 'Failed', 
            message: errorMessage 
          });
        }
      }
    }

    displayResults(results);
    updateStatus('Transfer process completed!');
    updateSelectedCount();
    updateTokenIdsInput();

    // Refresh NFT display
    if (userNFTs.length > 0) {
      await loadUserNFTs();
    }
  } catch (error) {
    console.error('Error in transfer process:', error);
    updateStatus(`Error: ${error.message}`);
  } finally {
    document.getElementById('transferBtn').disabled = false;
  }
}

// UI functions
function updateStatus(message) {
  document.getElementById('status').textContent = message;
  console.log(message);
}

function displayResults(results) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '<h4>Transfer Results:</h4>';

  const table = document.createElement('table');
  table.innerHTML = `
    <tr>
      <th>Token ID</th>
      <th>Status</th>
      <th>Gas Used</th>
      <th>Details</th>
    </tr>
  `;

  let totalGas = 0;

  results.forEach(result => {
    totalGas += result.gasUsed || 0;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${result.tokenId}</td>
      <td>${result.status}</td>
      <td>${result.gasUsed || '-'}</td>
      <td>${
        result.txHash ?`<a href="${EXPLORER_URL}/tx/${result.txHash}" target="_blank">View TX</a>` : 
          result.message || ''
      }</td>
    `;
    table.appendChild(row);
  });

  resultsDiv.appendChild(table);
  if (totalGas > 0) {
    resultsDiv.innerHTML += `<p>Total gas used: ${totalGas}</p>`;
  }
}

// BatchFactory bytecode (from compiled contract)
const BATCH_FACTORY_BYTECODE = "0x608060405234801561001057600080fd5b50610c22806100206000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c80630e6650fc146100465780634e335f761461007a578063f85242ca146100b0575b600080fd5b61005961005436600461054e565b6100d0565b60405173ffffffffffffffffffffffffffffffffffffffff90911681526020015b60405180910390f35b61005961008836600461056f565b73ffffffffffffffffffffffffffffffffffffffff919091166000908152602081905260409020805460ff19166001179055565b6100c36100be36600461056f565b6101c5565b6040516100719190610591565b600080336100dd846101f9565b6040516100e9906102d5565b6100f39190610606565b604051809103906000f08015801561010f573d6000803e3d6000fd5b5090508073ffffffffffffffffffffffffffffffffffffffff16610132336101f9565b7fd38ef0a0253bec7c698626802290d8944456ca156233dbd71a8421f4270849d660405160405180910390a392915050565b73ffffffffffffffffffffffffffffffffffffffff166000908152602081905260409020805460ff1916600117905550565b60405180910390f35b73ffffffffffffffffffffffffffffffffffffffff82166000908152602081905260409020546101c1906101f9565b565b73ffffffffffffffffffffffffffffffffffffffff82166000908152602081905260409020546101c1906101f9565b6000816040516020016102139190610591565b604080517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe08184030181529190528051602090910120905060006102566102e2565b90506000816040516020016102739190610591565b604080517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe081840301815291905280516020909101209050600061ffff84168360405180910390fd5b90506040518060400160405280600881526020017f4261746368466163746f727900000000000000000000000000000000000000008152506040516020016102d39190610606565b604051602081830303815290604052805190602001209050600061ffff841683604051809103906000f5905080156102d557600080fd5b6102d5903d90602001810190610336565b90506040518060400160405280600881526020017f4261746368466163746f727900000000000000000000000000000000000000008152506040516020016102d39190610606565b604051602081830303815290604052805190602001209050600061ffff841683604051809103906000f5905080156102d557600080fd5b5050565b61036081610336565b810190811067ffffffffffffffff8211171561037e5761037e61062a565b604052919050565b600067ffffffffffffffff8211156103a0576103a061062a565b5060051b60200190565b600082601f8301126103bb57600080fd5b813560206103d06103cb83610386565b610350565b82815260059290921b840181019181810190868411156103ef57600080fd5b8286015b8481101561040a57803583529183019183016103f3565b509695505050505050565b6000806040838503121561042857600080fd5b823567ffffffffffffffff8082111561044057600080fd5b818501915085601f83011261045457600080fd5b813560206104646103cb83610386565b82815260059290921b8401810191818101908984111561048357600080fd5b948201945b838610156104aa57853585529482019490820190610488565b965050860135925050808211156104c057600080fd5b506104cd858286016103aa565b9150509250929050565b600080604083850312156104ea57600080fd5b50508035926020909101359150565b600060208284031215610512565b5090565b80356001600160a01b038116811461051257600080fd5b634e487b7160e01b600052604160045260246000fd5b60006020828403121561054e57600080fd5b5035919050565b6000806040838503121561056f57600080fd5b61057883610506565b946020939093013593505050565b8015158114610594577f4e487b7100000000000000000000000000000000000000000000000000000000600052602160045260246000fd5b50565b600082825180855260208086019550808260051b84010186860187805b848110156105f857601f19868403018952815180518452858101518686015260408101516040860152606081015160608601526080810151608086015260a081015160a0860152838101518387015250607f19601f8201168501019450602093840193600192909201910191506105b7565b50909998505050505050505050565b60008251610619818460208701610659565b9190910192915050565b8181038181111561051257634e487b7160e01b600052601160045260246000fd5b60005b8381101561067457818101518382015260200161065c565b50506000910152565b600061069461069f8380610659565b602081840381018352845180835260408501915060408160051b86010192508387016000805b84811015610743577fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff808a88030185528551805189528881015190890152870151878801526060870151606088015260808701516080880152908501516106e49060a08a01906106a7565b601f19601f8501168801019750602095860195600193909301929092016106ba565b509198975050505050505050565b604051601f8201601f1916810167ffffffffffffffff8111828210171561077a5761077a61062a565b604052919050565b600067ffffffffffffffff82111561079c5761079c61062a565b50601f01601f191660200190565b6000826107c757634e487b7160e01b600052601260045260246000fd5b500490565b6000602082840312156107de57600080fd5b813567ffffffffffffffff8111156107f557600080fd5b8201601f8101841361080657600080fd5b803561081461069f82610782565b81815285602083850101111561082957600080fd5b81602084016020830137600091810160200191909152949350505050";

// Function to deploy the BatchFactory contract for the user
async function deployBatchFactory() {
    if (!web3) {
        updateBatchStatus('Please connect wallet first', 'error');
        return;
    }

    try {
        updateBatchStatus('Deploying BatchFactory contract...', 'info');
        document.getElementById('deployBatchFactoryBtn').disabled = true;

        const userAddress = accounts[0];

        // Create contract instance for deployment
        const factoryContract = new web3.eth.Contract(BATCH_FACTORY_ABI);

        // Deploy the contract
        const deploy = factoryContract.deploy({
            data: BATCH_FACTORY_BYTECODE,
        });

        // Estimate gas
        const gasEstimate = await deploy.estimateGas({ from: userAddress });

        // Deploy with MetaMask
        const newContractInstance = await deploy.send({
            from: userAddress,
            gas: Math.ceil(gasEstimate * 1.2),
        });

        const deployedAddress = newContractInstance.options.address;
        USER_BATCH_FACTORY_ADDRESS = deployedAddress;
        localStorage.setItem('USER_BATCH_FACTORY_ADDRESS', deployedAddress);

        updateBatchStatus(`✅ Successfully deployed BatchFactory contract: ${deployedAddress}`, 'success');
        console.log('Deployed BatchFactory contract:', deployedAddress);

        // Now check for existing batch contracts
        await checkUserBatchContract();

    } catch (error) {
        console.error('Error deploying BatchFactory contract:', error);
        updateBatchStatus(`Error deploying BatchFactory contract: ${error.message}`, 'error');
    } finally {
        document.getElementById('deployBatchFactoryBtn').disabled = false;
    }
}

// Initialize function to check if the user already has a BatchFactory deployed
async function initialize() {
    if (window.ethereum) {
        try {
            // Check if the user has already deployed a BatchFactory contract
            const storedAddress = localStorage.getItem('USER_BATCH_FACTORY_ADDRESS');
            if (storedAddress) {
                USER_BATCH_FACTORY_ADDRESS = storedAddress;
                console.log('BatchFactory address found in local storage:', storedAddress);
                updateStatus(`BatchFactory address found in local storage: ${storedAddress}`, 'success');
            }

        } catch (error) {
            console.error('Error initializing BatchFactory:', error);
            updateStatus(`Error initializing BatchFactory: ${error.message}`, 'error');
        }
    }
}

// Call initialize when the page loads
window.addEventListener('load', async () => {
    await initialize();
});