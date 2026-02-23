"""
User model — authentication credentials and account-level settings.

This model stores authentication data and per-user preferences that apply
across all profiles. Dietary and health data belongs on UserProfile, not here.

family_meal_workflow controls how joint profile meal plans are generated:
  "hybrid"   — LLM generates base meals with per-component nutrition; PuLP LP
                solver allocates optimal portions per member. More precise.
                This is the default and recommended mode.
  "llm_only" — LLM generates base meals and per-member servings in a single
                pass. Faster but less mathematically precise. Suitable for
                households with simple dietary differences.

This column requires a migration for existing SQLite databases.
See Phase 1 spec, Section 7 (Database Migration) for instructions. In
development, the simplest path is to delete the DB file and let SQLAlchemy
recreate it via Base.metadata.create_all() on the next backend startup.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from database import Base

# Valid values for family_meal_workflow.
# Validation is enforced at the API/schema layer (Pydantic), not at the DB
# layer, because SQLite does not support CHECK constraints by default.
# Any value that is not in this set should be treated as "hybrid" by API code.
VALID_WORKFLOWS = frozenset({"hybrid", "llm_only"})
WORKFLOW_DEFAULT = "hybrid"


class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    hashed_password = Column(
        String(255),
        nullable=True,  # null for Google OAuth-only users who have not set a password
    )
    display_name = Column(
        String(100),
        nullable=False,
    )
    google_sub = Column(
        String(255),
        unique=True,
        nullable=True,
        index=True,
        comment="Google OAuth subject identifier. Null for email/password-only users.",
    )
    is_active = Column(
        Boolean,
        default=True,
        comment="Soft-delete flag. Inactive users cannot log in.",
    )
    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )
    family_meal_workflow = Column(
        String(20),
        nullable=False,
        default=WORKFLOW_DEFAULT,
        # server_default writes a DEFAULT clause into the CREATE TABLE / ALTER TABLE
        # DDL statement so that rows inserted via raw SQL (e.g., test fixtures,
        # seed scripts, manual inserts) also receive the correct default value.
        # Both default (Python-level) and server_default (DB-level) are set to
        # ensure consistent behavior regardless of access path.
        server_default=WORKFLOW_DEFAULT,
        comment=(
            "Controls joint profile meal generation strategy. "
            "Valid values: 'hybrid' (LLM + PuLP LP solver), 'llm_only' (LLM only). "
            "Applies only to joint profile generation; solo profiles are unaffected. "
            "Managed via GET/PATCH /settings/workflow."
        ),
    )

    # Relationships
    profiles = relationship(
        "UserProfile",
        back_populates="owner",
        cascade="all, delete-orphan",
    )
