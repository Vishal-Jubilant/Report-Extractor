"""
SQLAlchemy 2.0 Declarative Models for RTGS PROJECT1.
- Avoids redundant indexes on columns with UNIQUE constraints (PostgreSQL automatically creates unique index).
- Foreign keys with ON DELETE CASCADE.
- Clean timestamps with timezone.
"""
from datetime import datetime
from typing import List
from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class AccountCode(Base):
    __tablename__ = "account_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # unique=True creates a UNIQUE b-tree index automatically in PostgreSQL. Redundant index=True omitted.
    holder_name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    account_code: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<AccountCode(id={self.id}, holder_name='{self.holder_name}', code='{self.account_code}')>"


class Enterprise(Base):
    __tablename__ = "enterprises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_name: Mapped[str] = mapped_column(String(100), nullable=True, default="", index=True)
    # unique=True creates a UNIQUE b-tree index automatically in PostgreSQL. Redundant index=True omitted.
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # 1-to-many relationship with cascade delete
    banks: Mapped[List["EnterpriseBank"]] = relationship(
        "EnterpriseBank",
        back_populates="enterprise",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Enterprise(id={self.id}, code='{self.code}', name='{self.name}')>"


class EnterpriseBank(Base):
    __tablename__ = "enterprise_banks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    enterprise_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("enterprises.id", ondelete="CASCADE"), nullable=False, index=True
    )
    bank_name: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    enterprise: Mapped["Enterprise"] = relationship("Enterprise", back_populates="banks")

    __table_args__ = (
        UniqueConstraint("enterprise_id", "bank_name", name="uq_enterprise_bank"),
    )

    def __repr__(self) -> str:
        return f"<EnterpriseBank(id={self.id}, enterprise_id={self.enterprise_id}, bank='{self.bank_name}')>"


class Bank(Base):
    __tablename__ = "banks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Bank(id={self.id}, name='{self.name}')>"
