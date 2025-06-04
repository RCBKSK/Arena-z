// Contract details
const CONTRACT_ADDRESS = '0x241B47bDE91B7d1843cA34Fc694D4e6926f3B83e';
const CHAIN_ID = 7897;
const RPC_URL = 'https://rpc.arena-z.gg';

// Standard ERC721 ABI
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
  }
];

let web3;
let accounts = [];
let contract;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('connectWallet').addEventListener('click', connectWallet);
  document.getElementById('transferBtn').addEventListener('click', transferNFTs);
});

async function connectWallet() {
  if (window.ethereum) {
    try {
      // Request account access
      accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Check if connected to Arena-Z Chain
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (parseInt(chainId, 16) !== CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
          });
        } catch (switchError) {
          // If the chain doesn't exist in MetaMask
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
                rpcUrls: [RPC_URL]
              }]
            });
          }
        }
      }

      web3 = new Web3(window.ethereum);
      contract = new web3.eth.Contract(ERC721_ABI, CONTRACT_ADDRESS);

      document.getElementById('walletAddress').textContent = accounts[0];
      document.getElementById('transferBtn').disabled = false;
      updateStatus('Wallet connected successfully');
    } catch (error) {
      console.error('Error connecting wallet:', error);
      updateStatus(`Error: ${error.message}`);
    }
  } else {
    updateStatus('Please install MetaMask!');
  }
}

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

  updateStatus(`Starting transfer of ${tokenIds.length} NFTs...`);

  try {
    const results = [];
    
    for (const tokenId of tokenIds) {
      try {
        // Check ownership
        const owner = await contract.methods.ownerOf(tokenId).call();
        if (owner.toLowerCase() !== accounts[0].toLowerCase()) {
          results.push({ tokenId, status: 'Skipped', message: 'Not owned by you' });
          continue;
        }

        // Execute transfer
        const tx = await contract.methods.safeTransferFrom(
          accounts[0],
          recipient,
          tokenId
        ).send({ from: accounts[0] });

        results.push({ 
          tokenId, 
          status: 'Transferred', 
          txHash: tx.transactionHash 
        });
        
        updateStatus(`Transferred token ${tokenId}...`);
      } catch (err) {
        results.push({ 
          tokenId, 
          status: 'Failed', 
          message: err.message 
        });
        console.error(`Error transferring token ${tokenId}:`, err);
      }
    }

    displayResults(results);
    updateStatus('Transfer process completed');
  } catch (error) {
    console.error('Error in transfer process:', error);
    updateStatus(`Error: ${error.message}`);
  }
}

function updateStatus(message) {
  document.getElementById('status').textContent = message;
}

function displayResults(results) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '<h4>Transfer Results:</h4>';
  
  const table = document.createElement('table');
  table.innerHTML = `
    <tr>
      <th>Token ID</th>
      <th>Status</th>
      <th>Details</th>
    </tr>
  `;
  
  results.forEach(result => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${result.tokenId}</td>
      <td>${result.status}</td>
      <td>${result.txHash ? `<a href="https://explorer.arena-z.gg/tx/${result.txHash}" target="_blank">View TX</a>` : result.message || ''}</td>
    `;
    table.appendChild(row);
  });
  
  resultsDiv.appendChild(table);
}
