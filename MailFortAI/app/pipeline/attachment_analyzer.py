from __future__ import annotations

import os
from typing import Any, Optional
from app.threat_intel.virustotal import VirusTotalService
from app.ml.attachment_model import AttachmentAnalyzerML
from app.attachments.handler import calculate_hash, extract_attachments
from app.attachments.validator import is_suspicious_file

def analyze_attachments(
    email_record: dict[str, Any],
    virustotal: VirusTotalService,
    ml_analyzer: Optional[AttachmentAnalyzerML] = None
) -> dict[str, Any]:
    """
    Analyze email attachments using VirusTotal and local ML metadata analysis.
    Leverages the handler for physical file processing and ML for metadata analysis.
    """
    ml_service = ml_analyzer or AttachmentAnalyzerML()
    results = []
    
    # 1. Physical file analysis using existing handlers
    try:
        temp_file_paths = extract_attachments(email_record)
        
        for file_path in temp_file_paths:
            filename = os.path.basename(file_path)
            # Remove UUID prefix
            parts = filename.split("_", 1)
            original_filename = parts[1] if len(parts) > 1 else filename
            
            try:
                # Validate file type and calc hash
                is_suspicious = is_suspicious_file(file_path)
                hashes = calculate_hash(file_path)
                sha256_hash = hashes.get("sha256", "")
                
                # Scan with VirusTotal
                vt_result = {}
                if sha256_hash:
                    vt_result = virustotal.scan_file(sha256_hash)
                
                # Metadata analysis via ML
                attachment_metadata = {
                    "filename": original_filename,
                    "content_type": "application/octet-stream", # Default or detect
                    "size": os.path.getsize(file_path),
                    "sha256": sha256_hash
                }
                ml_prediction = ml_service.predict(attachment_metadata)
                
                results.append({
                    "filename": original_filename,
                    "sha256": sha256_hash,
                    "is_suspicious": is_suspicious,
                    "ml_analysis": ml_prediction,
                    "vt_result": vt_result
                })
            except Exception as e:
                print(f"Error processing attachment {original_filename}: {e}")
            finally:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    
    except Exception as e:
        print(f"Error in attachment extraction: {e}")

    # 2. Fallback or metadata-only analysis for already parsed attachments
    parsed_attachments = email_record.get("attachments", []) or []
    if not results and parsed_attachments:
        for att in parsed_attachments:
            if isinstance(att, dict):
                attachment_meta = {
                    "filename": att.get("filename"),
                    "content_type": att.get("content_type", "application/octet-stream"),
                    "size": att.get("size", 0),
                    "sha256": att.get("sha256"),
                }
            elif isinstance(att, str):
                # Some parsers provide only attachment filenames.
                attachment_meta = {
                    "filename": att,
                    "content_type": "application/octet-stream",
                    "size": 0,
                    "sha256": "",
                }
            else:
                continue

            ml_prediction = ml_service.predict(attachment_meta)
            sha256_hash = str(attachment_meta.get("sha256") or "")
            results.append({
                "filename": attachment_meta.get("filename"),
                "sha256": sha256_hash or None,
                "ml_analysis": ml_prediction,
                "vt_result": virustotal.get_file_report(sha256_hash) if sha256_hash else {}
            })

    return {
        "count": len(results),
        "files": results,
    }
