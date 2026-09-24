import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from application.backend.app.core.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    guard_id = Column(Integer, ForeignKey("guards.id"), nullable=True, index=True)
    
    document_type = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, default=0, nullable=False)
    
    uploaded_by = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.datetime.now, nullable=False)
    
    guard = relationship("Guard", backref="documents")
