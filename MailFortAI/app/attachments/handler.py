import base64
import hashlib
import os
import uuid
from typing import Any, List


def extract_attachments(email_data: dict) -> List[str]:
    """
    Extract attachments from an email dictionary and save them temporarily.
    Expects the email dict to have an 'attachments' key which is a list of dicts.
    Each attachment dict should have 'filename' and optionally 'content' (base64 encoded).
    
    Returns a list of file paths to the temporarily saved attachments.
    """
    temp_dir = os.path.join("data", "cache", "attachments")
    os.makedirs(temp_dir, exist_ok=True)
    
    saved_paths: List[str] = []
    
    attachments = email_data.get("attachments") or []
    if not isinstance(attachments, list):
        return saved_paths

    for att in attachments:
        if not isinstance(att, dict):
            continue
            
        filename = att.get("filename")
        if not filename:
            filename = f"unnamed_{uuid.uuid4().hex[:8]}.bin"
            
        content_b64 = att.get("content", "")
        
        # We append a UUID to the filename to avoid collisions
        safe_filename = f"{uuid.uuid4().hex[:8]}_{filename}"
        file_path = os.path.join(temp_dir, safe_filename)
        
        try:
            if content_b64:
                file_content = base64.b64decode(content_b64)
            else:
                # If no content, just write an empty file to satisfy tests/mocking
                file_content = b""
                
            with open(file_path, "wb") as f:
                f.write(file_content)
                
            saved_paths.append(file_path)
        except Exception as e:
            # Avoid breaking processing completely if one attachment fails
            print(f"Error saving attachment {filename}: {e}")
            
    return saved_paths


def calculate_hash(file_path: str) -> dict[str, str]:
    """
    Calculate MD5 and SHA256 hashes of a file.
    
    Returns:
        dict: {"md5": "...", "sha256": "..."}
    """
    md5_hash = hashlib.md5()
    sha256_hash = hashlib.sha256()
    
    if not os.path.exists(file_path):
        return {"md5": "", "sha256": ""}
        
    try:
        with open(file_path, "rb") as f:
            # Read in blocks to handle potentially large files
            for byte_block in iter(lambda: f.read(4096), b""):
                md5_hash.update(byte_block)
                sha256_hash.update(byte_block)
                
        return {
            "md5": md5_hash.hexdigest(),
            "sha256": sha256_hash.hexdigest()
        }
    except Exception as e:
        print(f"Error calculating hash for {file_path}: {e}")
        return {"md5": "", "sha256": ""}
