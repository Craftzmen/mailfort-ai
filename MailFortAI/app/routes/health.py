"""Health-check and runtime diagnostics endpoints."""

from typing import Any

from fastapi import APIRouter, HTTPException

from app.blockchain.service import BlockchainService

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    """Return service health status."""
    return {"status": "ok", "service": "MailFort AI"}


@router.get("/api/health")
def health_api() -> dict[str, str]:
    """Return service health status under /api prefix for dashboard proxy clients."""
    return {"status": "ok", "service": "MailFort AI"}


@router.get("/api/blockchain/status")
def blockchain_status() -> dict[str, Any]:
    """Return live blockchain connectivity and contract readiness state."""
    service = BlockchainService(auto_deploy=False)
    status = service.get_status()
    status["can_record_evidence"] = bool(
        status.get("connected") and status.get("account") and status.get("contract_ready")
    )
    return status


@router.post("/api/blockchain/deploy")
def deploy_blockchain_contract() -> dict[str, Any]:
    """Deploy EvidenceRegistry contract if blockchain is reachable and no contract is active."""
    service = BlockchainService(auto_deploy=False)
    current_status = service.get_status()

    if not current_status.get("connected"):
        raise HTTPException(status_code=503, detail="Blockchain RPC is unreachable.")

    if not current_status.get("account"):
        raise HTTPException(status_code=500, detail="No unlocked blockchain account is available.")

    contract_address = current_status.get("contract_address")
    if current_status.get("contract_ready") and isinstance(contract_address, str) and contract_address.strip():
        return {
            "message": "EvidenceRegistry contract is already deployed.",
            "contract_address": contract_address,
            "status": current_status,
        }

    deployed_address = service.deploy_contract()
    if not deployed_address:
        reason = str(service.get_status().get("reason") or "unknown")
        raise HTTPException(status_code=500, detail=f"Contract deployment failed ({reason}).")

    return {
        "message": "EvidenceRegistry contract deployed successfully.",
        "contract_address": deployed_address,
        "status": service.get_status(),
    }
