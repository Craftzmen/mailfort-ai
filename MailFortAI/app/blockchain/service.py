from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

from web3 import Web3
from app.config import (
    BLOCKCHAIN_AUTO_DEPLOY,
    BLOCKCHAIN_CONTRACT_ADDRESS,
    BLOCKCHAIN_RPC_URL,
    BLOCKCHAIN_STATE_FILE,
    PROJECT_ROOT,
)

logger = logging.getLogger(__name__)

CONTRACT_PATH = PROJECT_ROOT / "contracts" / "EvidenceRegistry.sol"

# Minimal ABI needed by the analyzer for evidence recording and verification calls.
EVIDENCE_REGISTRY_ABI: list[dict[str, Any]] = [
    {
        "inputs": [
            {"internalType": "string", "name": "_evidenceHash", "type": "string"},
            {"internalType": "string", "name": "_verdict", "type": "string"},
            {"internalType": "string", "name": "_analyzerVersion", "type": "string"},
        ],
        "name": "recordEvidence",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "string", "name": "_evidenceHash", "type": "string"}],
        "name": "getEvidence",
        "outputs": [
            {"internalType": "string", "name": "evidenceHash", "type": "string"},
            {"internalType": "string", "name": "verdict", "type": "string"},
            {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
            {"internalType": "string", "name": "analyzerVersion", "type": "string"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getRecordCount",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

class BlockchainService:
    """Service to interact with the Ethereum forensic evidence registry."""

    def __init__(
        self,
        rpc_url: Optional[str] = None,
        contract_address: Optional[str] = None,
        auto_deploy: Optional[bool] = None,
    ) -> None:
        self.rpc_url = rpc_url or BLOCKCHAIN_RPC_URL
        self.auto_deploy_enabled = BLOCKCHAIN_AUTO_DEPLOY if auto_deploy is None else auto_deploy

        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.contract_address: Optional[str] = None
        self.contract_abi: list[dict[str, Any]] = list(EVIDENCE_REGISTRY_ABI)
        self.account: Optional[str] = None
        self.status_reason = "initializing"

        if self.w3.is_connected():
            logger.info("Connected to blockchain at %s", self.rpc_url)
            self.account = self._resolve_default_account()
            if not self.account:
                self.status_reason = "no_account"
                logger.warning("Blockchain RPC is reachable but no unlocked account is available.")
                return
        else:
            self.status_reason = "rpc_unreachable"
            logger.warning("Could not connect to blockchain at %s. Using mock mode.", self.rpc_url)
            return

        configured_address = (contract_address or BLOCKCHAIN_CONTRACT_ADDRESS).strip()
        if configured_address and self._bind_contract(configured_address):
            self.status_reason = "ready"
            return

        if self._load_contract_from_state_file():
            self.status_reason = "ready"
            return

        if self.auto_deploy_enabled:
            deployed_address = self.deploy_contract()
            if deployed_address:
                self.status_reason = "ready"
                return
            self.status_reason = "deploy_failed"
        else:
            self.status_reason = "contract_not_configured"

        logger.warning(
            "Blockchain connected but contract is unavailable (%s).",
            self.status_reason,
        )

    def _resolve_default_account(self) -> Optional[str]:
        try:
            accounts = self.w3.eth.accounts
        except Exception as exc:
            logger.warning("Unable to fetch blockchain accounts: %s", exc)
            return None

        if not accounts:
            return None

        return str(accounts[0])

    def _bind_contract(self, address: str, abi: Optional[list[dict[str, Any]]] = None) -> bool:
        try:
            checksum_address = Web3.to_checksum_address(address)
        except Exception:
            logger.warning("Ignoring invalid blockchain contract address: %s", address)
            return False

        try:
            contract_code = self.w3.eth.get_code(checksum_address)
        except Exception as exc:
            logger.warning("Unable to verify contract at %s: %s", checksum_address, exc)
            return False

        if not contract_code or contract_code == b"":
            logger.warning("Configured contract address has no bytecode: %s", checksum_address)
            return False

        self.contract_address = checksum_address
        self.contract_abi = abi if isinstance(abi, list) and abi else list(EVIDENCE_REGISTRY_ABI)
        logger.info("Using EvidenceRegistry contract at %s", checksum_address)
        return True

    def _load_contract_from_state_file(self) -> bool:
        state_path = Path(BLOCKCHAIN_STATE_FILE)
        if not state_path.exists():
            return False

        try:
            payload = json.loads(state_path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Failed reading blockchain state file %s: %s", state_path, exc)
            return False

        cached_address = str(payload.get("contract_address") or "").strip()
        cached_abi = payload.get("contract_abi")
        if not cached_address:
            return False

        return self._bind_contract(
            cached_address,
            cached_abi if isinstance(cached_abi, list) else None,
        )

    def _persist_contract_state(self) -> None:
        if not self.contract_address:
            return

        state_path = Path(BLOCKCHAIN_STATE_FILE)
        state_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "rpc_url": self.rpc_url,
            "chain_id": self.w3.eth.chain_id if self.w3.is_connected() else None,
            "contract_address": self.contract_address,
            "contract_abi": self.contract_abi,
        }

        try:
            state_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        except Exception as exc:
            logger.warning("Unable to persist blockchain state to %s: %s", state_path, exc)

    def get_status(self) -> dict[str, Any]:
        contract_ready = bool(self.contract_address and self.contract_abi)
        return {
            "connected": self.w3.is_connected(),
            "rpc_url": self.rpc_url,
            "account": self.account,
            "contract_ready": contract_ready,
            "contract_address": self.contract_address,
            "reason": self.status_reason,
            "auto_deploy_enabled": self.auto_deploy_enabled,
        }

    def record_evidence(self, evidence_hash: str, verdict: str, version: str = "1.0.0") -> Optional[str]:
        """Record a SHA256 evidence hash on the blockchain."""
        if not self.w3.is_connected():
            self.status_reason = "rpc_unreachable"
            logger.warning("Blockchain RPC is not reachable. Skipping evidence recording.")
            return None

        if not self.account:
            self.status_reason = "no_account"
            logger.warning("No unlocked blockchain account available. Skipping evidence recording.")
            return None

        if not self.contract_address or not self.contract_abi:
            self.status_reason = "contract_not_configured"
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
            self.status_reason = "ready"
            return receipt.transactionHash.hex()
        except Exception as e:
            self.status_reason = "record_failed"
            logger.error(f"Failed to record evidence on blockchain: {e}")
            return None

    def deploy_contract(self) -> Optional[str]:
        """Deploys the EvidenceRegistry contract to the local testnet."""
        if not self.w3.is_connected():
            self.status_reason = "rpc_unreachable"
            logger.warning("Cannot deploy contract because blockchain RPC is unreachable.")
            return None

        if not self.account:
            self.status_reason = "no_account"
            logger.warning("Cannot deploy contract because no account is available.")
            return None

        if not CONTRACT_PATH.exists():
            self.status_reason = "contract_source_missing"
            logger.error("Contract source file was not found: %s", CONTRACT_PATH)
            return None

        try:
            from solcx import compile_standard, get_installed_solc_versions, install_solc

            if "0.8.0" not in {str(version) for version in get_installed_solc_versions()}:
                install_solc("0.8.0")
            
            with open(CONTRACT_PATH, "r", encoding="utf-8") as f:
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
            self.contract_abi = abi if isinstance(abi, list) else list(EVIDENCE_REGISTRY_ABI)
            self._persist_contract_state()
            
            logger.info(f"Contract deployed at {self.contract_address}")
            self.status_reason = "ready"
            return self.contract_address
        except Exception as e:
            self.status_reason = "deploy_failed"
            logger.error(f"Contract deployment failed: {e}")
            return None
