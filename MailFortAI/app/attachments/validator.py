import mimetypes
import os
import re

# Common potentially dangerous extensions
SUSPICIOUS_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".vbs", ".vbe", ".js", ".jse", 
    ".wsf", ".wsh", ".scr", ".pif", ".msi", ".ps1", ".jar",
    ".hta", ".cpl", ".sh", ".bash", ".dll", ".sys"
}

def is_suspicious_file(file_path: str) -> bool:
    """
    Check if an attachment is suspicious based on its extension, format,
    double extensions, or mismatched MIME type.
    """
    if not os.path.exists(file_path):
        return False
        
    filename = os.path.basename(file_path).lower()
    
    # Check 1: Double extensions (e.g., invoice.pdf.exe)
    # Using regex to find filenames that look like they have multiple extensions
    # where the last one is suspicious.
    parts = filename.split('.')
    if len(parts) > 2:
        # If it has multiple dots, check the last extension against the second to last
        # A common trick is name.doc.exe or name.pdf.vbs
        last_ext = f".{parts[-1]}"
        if last_ext in SUSPICIOUS_EXTENSIONS:
            return True
            
    # Check 2: Direct executable/script extension check
    _, ext = os.path.splitext(filename)
    if ext in SUSPICIOUS_EXTENSIONS:
        return True
        
    # Check 3: Check MIME type vs extension mismatch for common doc types
    mime_type, _ = mimetypes.guess_type(file_path)
    
    # We only apply mismatch logic to files that mimetypes can identify 
    # to avoid false positives for custom extensions
    if mime_type:
        # If it's labeled as an executable mime type but the extension is innocent,
        # that's a huge red flag
        executable_mimes = [
            "application/x-msdownload",
            "application/x-executable",
            "application/x-sh",
            "application/javascript"
        ]
        
        if mime_type in executable_mimes and ext not in SUSPICIOUS_EXTENSIONS:
            return True
            
    return False
