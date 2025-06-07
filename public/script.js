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

// BatchFactory contract data - will be loaded from deployed contract
let BATCH_FACTORY_CONTRACT_DATA = {
    abi: [
        {
            "anonymous": false,
            "inputs": [
                {"indexed": true, "internalType": "address", "name": "deployer", "type": "address"},
                {"indexed": false, "internalType": "address", "name": "batchContract", "type": "address"},
                {"indexed": false, "internalType": "uint256", "name": "salt", "type": "uint256"}
            ],
            "name": "BatchContractDeployed",
            "type": "event"
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
        },
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
        }
    ]
};

// Load BatchFactory contract data if available
async function loadBatchFactoryData() {
    try {
        const response = await fetch('./BatchFactory.json');
        if (response.ok) {
            const data = await response.json();
            BATCH_FACTORY_CONTRACT_DATA = {
                abi: data.abi,
                bytecode: data.bytecode || BATCH_FACTORY_BYTECODE
            };
            console.log('BatchFactory contract data loaded from file');
        } else {
            console.log('Using default BatchFactory ABI and bytecode');
        }
    } catch (error) {
        console.log('Using default BatchFactory ABI and bytecode');
    }
}

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

        // First, validate that the BatchFactory contract exists at the stored address
        const code = await web3.eth.getCode(USER_BATCH_FACTORY_ADDRESS);
        if (code === '0x' || code === '0x0') {
            updateBatchStatus('❌ BatchFactory contract not found at stored address. Please deploy a new one.', 'error');
            localStorage.removeItem('USER_BATCH_FACTORY_ADDRESS');
            USER_BATCH_FACTORY_ADDRESS = null;
            return null;
        }

        const factoryContract = new web3.eth.Contract(BATCH_FACTORY_CONTRACT_DATA.abi, USER_BATCH_FACTORY_ADDRESS);

        // Test the contract by making a simple call first
        try {
            await factoryContract.methods.getBatchAddress(userAddress, salt).call();
        } catch (testError) {
            updateBatchStatus('❌ BatchFactory contract interface mismatch. Please deploy a new one.', 'error');
            localStorage.removeItem('USER_BATCH_FACTORY_ADDRESS');
            USER_BATCH_FACTORY_ADDRESS = null;
            return null;
        }

        // Check if user already has a batch contract
        const batchExists = await factoryContract.methods.batchExists(userAddress, salt).call();

        if (batchExists) {
            // Get existing contract address
            const batchAddress = await factoryContract.methods.getBatchAddress(userAddress, salt).call();

            // Validate that the batch contract actually exists
            const batchCode = await web3.eth.getCode(batchAddress);
            if (batchCode === '0x' || batchCode === '0x0') {
                updateBatchStatus('❌ Batch contract address found but contract not deployed. Deploy a new one.', 'error');
                document.getElementById('deployBatchBtn').disabled = false;
                document.getElementById('checkBatchBtn').disabled = false;
                return null;
            }

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

        // If there's a contract interaction error, clear the stored address
        if (error.message.includes('Returned values aren\'t valid') || 
            error.message.includes('revert') || 
            error.message.includes('invalid opcode')) {
            localStorage.removeItem('USER_BATCH_FACTORY_ADDRESS');
            USER_BATCH_FACTORY_ADDRESS = null;
            updateBatchStatus('❌ Invalid BatchFactory contract. Please deploy a new one.', 'error');
        }

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

        // Validate BatchFactory exists first
        const code = await web3.eth.getCode(USER_BATCH_FACTORY_ADDRESS);
        if (code === '0x' || code === '0x0') {
            updateBatchStatus('❌ BatchFactory contract not found. Please deploy a new BatchFactory first.', 'error');
            localStorage.removeItem('USER_BATCH_FACTORY_ADDRESS');
            USER_BATCH_FACTORY_ADDRESS = null;
            return;
        }

        const factoryContract = new web3.eth.Contract(BATCH_FACTORY_CONTRACT_DATA.abi, USER_BATCH_FACTORY_ADDRESS);

        // Check if user already has a batch contract
        const batchExists = await factoryContract.methods.batchExists(userAddress, salt).call();

        if (batchExists) {
            const batchAddress = await factoryContract.methods.getBatchAddress(userAddress, salt).call();

            // Verify the batch contract actually exists
            const batchCode = await web3.eth.getCode(batchAddress);
            if (batchCode !== '0x' && batchCode !== '0x0') {
                userBatchContract = batchAddress;
                updateBatchStatus(`✅ You already have a batch contract: ${batchAddress}`, 'success');
                return;
            }
        }

        // Deploy new batch contract
        const gasEstimate = await factoryContract.methods.deployBatch(salt).estimateGas({ from: userAddress });

        const tx = await factoryContract.methods.deployBatch(salt).send({ 
            from: userAddress,
            gas: Math.ceil(gasEstimate * 1.2)
        });

        // Get deployed address
        const batchAddress = await factoryContract.methods.getBatchAddress(userAddress, salt).call();

        // Verify deployment was successful
        const deployedCode = await web3.eth.getCode(batchAddress);
        if (deployedCode === '0x' || deployedCode === '0x0') {
            updateBatchStatus('❌ Batch contract deployment failed. Please try again.', 'error');
            return;
        }

        userBatchContract = batchAddress;
        updateBatchStatus(`✅ Successfully deployed your batch contract: ${batchAddress}`, 'success');
        console.log('Deployed batch contract:', batchAddress);

        // Update UI
        document.getElementById('deployBatchBtn').disabled = true;

    } catch (error) {
        console.error('Error deploying batch contract:', error);
        updateBatchStatus(`Error deploying batch contract: ${error.message}`, 'error');

        // Clear invalid factory address if deployment fails due to contract issues
        if (error.message.includes('Returned values aren\'t valid') || 
            error.message.includes('revert') || 
            error.message.includes('invalid opcode')) {
            localStorage.removeItem('USER_BATCH_FACTORY_ADDRESS');
            USER_BATCH_FACTORY_ADDRESS = null;
            updateBatchStatus('❌ Invalid BatchFactory contract. Please deploy a new BatchFactory first.', 'error');
        }
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

      // Check if user has deployed their own BatchFactory and batch contract
      await checkUserBatchContract();
      
      // Show deployment guidance if no BatchFactory exists
      if (!USER_BATCH_FACTORY_ADDRESS) {
        updateBatchStatus('⚠️ Deploy your own BatchFactory first to enable efficient batch transfers!', 'info');
      }
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
      await contract.methods.safeBatchTransferFrom(accounts[0], recipient, []).estimateGas({ from: accounts[0] });      supportsBatch = true;
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
const BATCH_FACTORY_BYTECODE = "0x608060405234801561001057600080fd5b506108e9806100206000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c80630e6650fc146100465780634e335f761461007a578063f85242ca146100b0575b600080fd5b610059610054366004610570565b6100d0565b60405173ffffffffffffffffffffffffffffffffffffffff90911681526020015b60405180910390f35b610088610088366004610591565b73ffffffffffffffffffffffffffffffffffffffff909116600090815260208190526040902054610100565b60405190151581526020016100715b600080fd5b73ffffffffffffffffffffffffffffffffffffffff82166000908152602081905260409020546100d0565b6040516020016100d09190600160a01b907f4b61746368466163746f72793a204465706c6f79206661696c65640000000000815260140190565b604051809103902090565b80516103b690610350565b602001516103b690610350565b6040805173ffffffffffffffffffffffffffffffffffffffff86811660248301526044820186905260648201859052608482018490526000929186169082906084016040516020818303038152906040529060005b8381101561019c57610128338585848151811061013257610132610464565b6020026020010151610258565b73ffffffffffffffffffffffffffffffffffffffff8516639dc29fac33868585815181106101625761016261041c565b602002602001015160405160e085901b7fffffffffffff00000000000000000000000000000000000000000000000000001681526004016101a39291906104a5565b50600101610112565b5050505050565b600082511161019c5760405163040739bf60e11b815260040160405180910390fd5b6040516020016101a9919060a01b6073ffffffffffffffffffffffffffffffffffffffff8416907f4261746368466163746f72793a204465706c6f79206661696c65640000000000815260140190565b";

// Function to deploy the BatchFactory contract for the user
async function deployBatchFactory() {
    if (!web3) {
        updateBatchStatus('Please connect wallet first', 'error');
        return;
    }

    // Check if user already has a BatchFactory
    const existingAddress = localStorage.getItem('USER_BATCH_FACTORY_ADDRESS');
    if (existingAddress) {
        const code = await web3.eth.getCode(existingAddress);
        if (code !== '0x' && code !== '0x0') {
            updateBatchStatus('❌ You already have a BatchFactory deployed! Use your existing one.', 'warning');
            return;
        } else {
            // Clear invalid address
            localStorage.removeItem('USER_BATCH_FACTORY_ADDRESS');
            USER_BATCH_FACTORY_ADDRESS = null;
        }
    }

    try {
        updateBatchStatus('🚀 Deploying YOUR personal BatchFactory contract...', 'info');
        document.getElementById('deployBatchFactoryBtn').disabled = true;

        const userAddress = accounts[0];
        
        // Verify MetaMask is still connected and accessible
        if (!window.ethereum) {
            throw new Error('MetaMask not available. Please install or enable MetaMask.');
        }
        
        if (!window.ethereum.isConnected()) {
            throw new Error('MetaMask not connected. Please reconnect your wallet.');
        }
        
        // Test if we can make a simple call to MetaMask
        try {
            await window.ethereum.request({ method: 'eth_accounts' });
        } catch (testError) {
            throw new Error(`MetaMask communication failed: ${testError.message}`);
        }
        
        // Check if we have the correct network
        const chainId = await web3.eth.getChainId();
        if (chainId !== CHAIN_ID) {
            throw new Error(`Wrong network. Expected Chain ID ${CHAIN_ID}, got ${chainId}`);
        }
        
        // Check if user has enough balance for deployment
        const balance = await web3.eth.getBalance(userAddress);
        const balanceEth = web3.utils.fromWei(balance, 'ether');
        console.log(`User balance: ${balanceEth} ETH`);
        
        if (parseFloat(balanceEth) < 0.001) {
            throw new Error(`Insufficient balance for deployment. You have ${balanceEth} ETH, need at least 0.001 ETH`);
        }

        // Validate contract data
        if (!BATCH_FACTORY_CONTRACT_DATA.abi || !Array.isArray(BATCH_FACTORY_CONTRACT_DATA.abi)) {
            throw new Error('BatchFactory ABI not properly loaded');
        }
        
        // Use bytecode from loaded data or fallback to hardcoded
        const bytecode = BATCH_FACTORY_CONTRACT_DATA.bytecode || BATCH_FACTORY_BYTECODE;
        
        if (!bytecode || bytecode === '0x') {
            throw new Error('BatchFactory bytecode not available');
        }
        
        console.log('Using bytecode length:', bytecode.length);
        console.log('Using ABI with', BATCH_FACTORY_CONTRACT_DATA.abi.length, 'functions/events');

        // Create contract instance for deployment
        const factoryContract = new web3.eth.Contract(BATCH_FACTORY_CONTRACT_DATA.abi);

        // Deploy the contract
        const deploy = factoryContract.deploy({
            data: bytecode,
        });

        // Test gas estimation first to catch errors early
        console.log('Testing gas estimation...');
        let gasEstimate;
        try {
            gasEstimate = await deploy.estimateGas({ from: userAddress });
            console.log('Gas estimation successful:', gasEstimate);
        } catch (gasError) {
            console.error('Gas estimation failed:', gasError);
            throw new Error(`Gas estimation failed: ${gasError.message}. This usually means there's an issue with the contract code or network.`);
        }

        // Deploy with MetaMask
        const newContractInstance = await deploy.send({
            from: userAddress,
            gas: Math.ceil(gasEstimate * 1.2),
        });

        const deployedAddress = newContractInstance.options.address;
        USER_BATCH_FACTORY_ADDRESS = deployedAddress;
        localStorage.setItem('USER_BATCH_FACTORY_ADDRESS', deployedAddress);

        updateBatchStatus(`✅ Successfully deployed YOUR BatchFactory: ${deployedAddress}`, 'success');
        console.log('User deployed BatchFactory contract:', deployedAddress);

        // Enable batch contract deployment
        document.getElementById('deployBatchBtn').disabled = false;
        document.getElementById('checkBatchBtn').disabled = false;

        // Check for existing batch contracts
        await checkUserBatchContract();

    } catch (error) {
        console.error('Error deploying BatchFactory contract:', error);
        console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        console.error('Error type:', typeof error);
        console.error('Error constructor:', error.constructor.name);
        
        // Try to extract error details from different possible locations
        const errorDetails = {
            message: error.message || error.reason || 'No message',
            code: error.code || 'No code',
            data: error.data || 'No data',
            stack: error.stack || 'No stack trace',
            name: error.name || 'Unknown error type'
        };
        
        console.error('Extracted error details:', errorDetails);
        
        let errorMessage = 'Unknown deployment error';
        
        // Check if MetaMask is properly connected
        if (!window.ethereum) {
            errorMessage = 'MetaMask not detected. Please install MetaMask.';
        } else if (!web3) {
            errorMessage = 'Web3 not initialized. Please reconnect wallet.';
        } else if (!accounts || accounts.length === 0) {
            errorMessage = 'No wallet accounts found. Please connect wallet.';
        } else if (error.code === 4001) {
            errorMessage = 'Transaction rejected by user';
        } else if (error.code === -32603) {
            errorMessage = 'Internal JSON-RPC error. Check network connection.';
        } else if (error.code === -32602) {
            errorMessage = 'Invalid parameters sent to MetaMask';
        } else if (error.message) {
            if (error.message.includes('insufficient funds')) {
                errorMessage = 'Insufficient funds for gas';
            } else if (error.message.includes('gas required exceeds allowance')) {
                errorMessage = 'Gas limit too low. Try increasing gas limit.';
            } else if (error.message.includes('gas')) {
                errorMessage = 'Gas estimation failed - check network connection';
            } else if (error.message.includes('revert')) {
                errorMessage = `Contract reverted: ${error.message}`;
            } else if (error.message.includes('network')) {
                errorMessage = `Network error: ${error.message}`;
            } else if (error.message.includes('user denied')) {
                errorMessage = 'Transaction denied by user';
            } else if (error.message.includes('MetaMask')) {
                errorMessage = `MetaMask error: ${error.message}`;
            } else {
                errorMessage = error.message;
            }
        } else if (error.data && error.data.message) {
            errorMessage = error.data.message;
        } else if (error.reason) {
            errorMessage = error.reason;
        }
        
        updateBatchStatus(`❌ Error deploying BatchFactory: ${errorMessage}`, 'error');
    } finally {
        document.getElementById('deployBatchFactoryBtn').disabled = false;
    }
}

// Initialize function to check if the user already has a BatchFactory deployed
async function initialize() {
    if (window.ethereum) {
        try {
            // Load BatchFactory contract data first
            await loadBatchFactoryData();
            
            // Check if the user has already deployed a BatchFactory contract
            const storedAddress = localStorage.getItem('USER_BATCH_FACTORY_ADDRESS');
            if (storedAddress) {
                USER_BATCH_FACTORY_ADDRESS = storedAddress;
                console.log('BatchFactory address found in local storage:', storedAddress);
                updateBatchStatus(`✅ Your BatchFactory: ${storedAddress}`, 'success');
            } else {
                updateBatchStatus('⚠️ No BatchFactory found. Please deploy your own BatchFactory first!', 'info');
            }

        } catch (error) {
            console.error('Error initializing BatchFactory:', error);
            updateBatchStatus(`Error initializing BatchFactory: ${error.message}`, 'error');
        }
    }
}

// Call initialize when the page loads
window.addEventListener('load', async () => {
    await initialize();
});