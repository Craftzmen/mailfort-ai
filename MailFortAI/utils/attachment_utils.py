from __future__ import annotations

from email.message import Message
from typing import List



def extract_attachments_from_eml(message: Message) -> List[str]:
    """Extract attachment filenames from an .eml email message."""
    attachments: List[str] = []
    for part in message.walk():
        filename = part.get_filename()
        if filename:
            attachments.append(filename)
    return attachments


def extract_attachments_from_msg(msg_obj: object) -> List[str]:
    """Extract attachment filenames from an extract_msg Message object."""
    attachments: List[str] = []
    for attachment in getattr(msg_obj, "attachments", []):
        filename = getattr(attachment, "longFilename", None) or getattr(attachment, "filename", None)
        if filename:
            attachments.append(filename)
    return attachments
