from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

from web3 import Web3
from app.config import PROJECT_ROOT

logger = logging.getLogger(__name__)

# Default Ganache settings
GANACHE_URL = "http://127.0.0.1:7545"
CONTRACT_PATH = PROJECT_ROOT / "contracts" / "EvidenceRegistry.sol"

class BlockchainService:
    """Service to interact with the Ethereum forensic evidence registry."""

    def __init__(self, rpc_url: str = GANACHE_URL) -> None:
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.contract_address: Optional[str] = None
        self.contract_abi: Optional[list] = None
        self.account = None

        if self.w3.is_connected():
            logger.info(f"Connected to blockchain at {rpc_url}")
            self.account = self.w3.eth.accounts[0]  # Use first account from Ganache
        else:
            logger.warning(f"Could not connect to blockchain at {rpc_url}. Using mock mode.")

    def record_evidence(self, evidence_hash: str, verdict: str, version: str = "1.0.0") -> Optional[str]:
        """Record a SHA256 evidence hash on the blockchain."""
        if not self.w3.is_connected() or not self.contract_address:
            logger.warning("Blockchain not connected or contract not deployed. Skipping.")
            return None

        try:
            contract = self.w3.eth.contract(address=self.contract_address, abi=self.contract_abi)
            tx_hash = contract.functions.recordEvidence(
                evidence_hash, 
                verdict, 
                version
            ).transact({'from': self.account})
            
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            return receipt.transactionHash.hex()
        except Exception as e:
            logger.error(f"Failed to record evidence on blockchain: {e}")
            return None

    def deploy_contract(self) -> Optional[str]:
        """Deploys the EvidenceRegistry contract to the local testnet."""
        if not self.w3.is_connected():
            return None

        # Simple mock ABI/Bytecode for demonstration if solc isn't available
        # In a real scenario, we'd compile EvidenceRegistry.sol
        # For now, we'll implement a fallback or assume the user has a deployed address
        try:
            from solcx import compile_standard, install_solc
            install_solc("0.8.0")
            
            with open(CONTRACT_PATH, "r") as f:
                contract_source = f.read()

            compiled_sol = compile_standard({
                "language": "Solidity",
                "sources": {"EvidenceRegistry.sol": {"content": contract_source}},
                "settings": {"outputSelection": {"*": {"*": ["abi", "metadata", "evm.bytecode", "evm.sourceMap"]}}}
            }, solc_version="0.8.0")

            bytecode = compiled_sol['contracts']['EvidenceRegistry.sol']['EvidenceRegistry']['evm']['bytecode']['object']
            abi = compiled_sol['contracts']['EvidenceRegistry.sol']['EvidenceRegistry']['abi']

            EvidenceRegistry = self.w3.eth.contract(abi=abi, bytecode=bytecode)
            tx_hash = EvidenceRegistry.constructor().transact({'from': self.account})
            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

            self.contract_address = tx_receipt.contractAddress
            self.contract_abi = abi
            
            logger.info(f"Contract deployed at {self.contract_address}")
            return self.contract_address
        except Exception as e:
            logger.error(f"Contract deployment failed: {e}")
            return None
