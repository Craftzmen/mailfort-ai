from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from datetime import datetime, timezone
from app.database import Base

class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True, index=True)
    sender = Column(String, index=True)
    subject = Column(String)
    body = Column(Text)
    analysis_result = Column(JSON)  # stores final analysis dictionary
    verdict = Column(String, index=True)  # "Safe", "Suspicious", "Malicious"
    
    # Forensic & Blockchain upgrades
    blockchain_tx_id = Column(String, nullable=True)
    evidence_hash = Column(String, nullable=True)
    forensic_report = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
