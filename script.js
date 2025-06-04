// Contract details
const CONTRACT_ADDRESS = '0x241B47bDE91B7d1843cA34Fc694D4e6926f3B83e';
const CHAIN_ID = 7897;
const RPC_URL = 'https://rpc.arena-z.gg';
const EXPLORER_URL = 'https://explorer.arena-z.gg';
const BATCH_SIZE = 5; // Optimal batch size for Arena-Z Chain

// Enhanced ERC721 ABI with batch transfer support
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
    "inputs": [
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "uint256[]", "name": "tokenIds", "type": "uint256[]"}
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
let gasHistory = [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('connectWallet').addEventListener('click', connectWallet);
  document.getElementById('transferBtn').addEventListener('click', transferNFTs);
  document.getElementById('optimizeGas').addEventListener('click', optimizeGasSettings);
});

// Gas optimization functions
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

  document.getElementById('currentGas').textContent = gasInfo.currentPriceGwei;
  document.getElementById('suggestedGas').textContent = gasInfo.suggestedPrice;
  updateStatus(`Recommended gas price: ${gasInfo.suggestedPrice} Gwei (Current: ${gasInfo.currentPriceGwei} Gwei)`);
}

async function getOptimalGasSettings() {
  const gasInfo = await getGasPrice();
  return {
    gasPrice: web3.utils.toWei(gasInfo.suggestedPrice.toString(), 'gwei'),
    gasLimit: 50000 // Adjusted for Arena-Z Chain
  };
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

      document.getElementById('walletAddress').textContent = accounts[0];
      document.getElementById('transferBtn').disabled = false;
      document.getElementById('optimizeGas').disabled = false;
      updateStatus('Wallet connected successfully');

      // Initialize gas optimization
      await optimizeGasSettings();
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

// Transfer functions
async function transferNFTs() {
  const recipient = document.getElementById('recipient').value.trim();
  const tokenIdsInput = document.getElementById('tokenIds').value.trim();

  if (!recipient || !tokenIdsInput) {
    updateStatus('Please fill all fields');
    return;
  }

  if (!web3.utils.isAddress(recipient)) {
    updateStatus('Invalid recipient address');
    return;
  }

  const tokenIds = tokenIdsInput.split(',').map(id => id.trim()).filter(id => id);
  if (tokenIds.length === 0) {
    updateStatus('Please enter at least one token ID');
    return;
  }

  updateStatus(`Preparing to transfer ${tokenIds.length} NFTs...`);
  document.getElementById('transferBtn').disabled = true;

  try {
    const results = [];
    const gasSettings = await getOptimalGasSettings();

    // Check if batch transfer is available
    const hasBatchTransfer = await checkBatchTransferSupport();

    if (hasBatchTransfer && tokenIds.length > 1) {
      updateStatus("Using batch transfer for gas optimization...");
      await batchTransferNFTs(recipient, tokenIds, gasSettings, results);
    } else {
      updateStatus("Using individual transfers...");
      await individualTransfers(recipient, tokenIds, gasSettings, results);
    }

    displayResults(results);
    updateStatus('Transfer process completed!');
    updateGasHistory(results);
  } catch (error) {
    console.error('Error in transfer process:', error);
    updateStatus(`Error: ${error.message}`);
  } finally {
    document.getElementById('transferBtn').disabled = false;
  }
}

async function checkBatchTransferSupport() {
  try {
    const batchTransferAbi = ERC721_ABI.find(item => item.name === "batchTransfer");
    if (!batchTransferAbi) return false;

    // Check if the contract actually implements it
    await contract.methods.batchTransfer(accounts[0], []).call();
    return true;
  } catch {
    return false;
  }
}

async function batchTransferNFTs(recipient, tokenIds, gasSettings, results) {
  const batches = [];
  for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
    batches.push(tokenIds.slice(i, i + BATCH_SIZE));
  }

  for (const batch of batches) {
    try {
      // Verify ownership for all in batch
      const ownershipChecks = await Promise.all(
        batch.map(tokenId => contract.methods.ownerOf(tokenId).call())
      );

      const validBatch = batch.filter((tokenId, index) => 
        ownershipChecks[index].toLowerCase() === accounts[0].toLowerCase()
      );

      if (validBatch.length === 0) {
        batch.forEach(tokenId => {
          results.push({ tokenId, status: 'Skipped', message: 'Not owned by you' });
        });
        continue;
      }

      updateStatus(`Transferring batch of ${validBatch.length} NFTs...`);
      const tx = await contract.methods.batchTransfer(
        recipient,
        validBatch
      ).send({ 
        from: accounts[0],
        ...gasSettings
      });

      validBatch.forEach(tokenId => {
        results.push({ 
          tokenId, 
          status: 'Batch Transferred', 
          txHash: tx.transactionHash,
          gasUsed: tx.gasUsed
        });
      });
    } catch (error) {
      batch.forEach(tokenId => {
        results.push({ 
          tokenId, 
          status: 'Failed', 
          message: error.message 
        });
      });
    }
  }
}

async function individualTransfers(recipient, tokenIds, gasSettings, results) {
  for (const tokenId of tokenIds) {
    try {
      const owner = await contract.methods.ownerOf(tokenId).call();
      if (owner.toLowerCase() !== accounts[0].toLowerCase()) {
        results.push({ tokenId, status: 'Skipped', message: 'Not owned by you' });
        continue;
      }

      updateStatus(`Transferring token ${tokenId}...`);
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
    } catch (error) {
      results.push({ 
        tokenId, 
        status: 'Failed', 
        message: error.message 
      });
    }
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
        result.txHash ? 
          `<a href="${EXPLORER_URL}/tx/${result.txHash}" target="_blank">View TX</a>` : 
          result.message || ''
      }</td>
    `;
    table.appendChild(row);
  });

  resultsDiv.appendChild(table);
  resultsDiv.innerHTML += `<p>Total gas used: ${totalGas} (≈${web3.utils.fromWei(totalGas.toString(), 'gwei')} Gwei)</p>`;
}

function updateGasHistory(results) {
  const successfulTransfers = results.filter(r => r.status.includes('Transferred'));
  if (successfulTransfers.length > 0) {
    const avgGas = successfulTransfers.reduce((sum, r) => sum + (r.gasUsed || 0), 0) / successfulTransfers.length;
    gasHistory.push({
      timestamp: new Date().toISOString(),
      avgGas,
      count: successfulTransfers.length
    });

    // Keep only last 5 entries
    if (gasHistory.length > 5) {
      gasHistory.shift();
    }
  }
}