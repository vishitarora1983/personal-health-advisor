"""
JointProfileMember model — links household member UserProfiles to a joint UserProfile.

Design notes:
  - A joint profile is a regular UserProfile row with is_joint=True.
  - Each household member (adult, child) has their own individual UserProfile.
  - JointProfileMember stores the many-to-many mapping between the joint profile
    and its member profiles.

Retired field — is_primary:
  - The is_primary column existed in earlier versions to designate which member's
    qualitative preferences (diet_type, allergies) would be copied to the joint
    profile. This caused silent data loss: non-primary members' allergies and
    dietary restrictions were discarded.
  - The column is no longer used. Preferences are now merged algorithmically:
      allergies     = union of all members' allergies
      diet_type     = strictest diet type among all members
                      (vegan > vegetarian > pescatarian > paleo > keto > mediterranean > none)
      cooking_skill = minimum skill level among members
      etc. (see Overview spec, Section 6 for the full merge rules)
  - The is_primary column still exists in the SQLite database for backward
    compatibility with pre-redesign data. SQLAlchemy silently ignores DB columns
    that are not declared in the ORM model — no migration needed to drop it.
  - Do NOT re-add is_primary to this model.

Anchor member for non-mergeable household fields:
  - For fields that cannot be merged algorithmically (meals_per_day, snacks_per_day,
    meals_to_repeat), the system uses the member with the lowest JointProfileMember.id
    for a given joint_profile_id as the "household anchor". This is determined at
    query time via ORDER BY id ASC LIMIT 1, not stored as a column.
"""

from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from database import Base


class JointProfileMember(Base):
    __tablename__ = "joint_profile_members"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    joint_profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=False,
        comment="The joint UserProfile (is_joint=True) that owns this membership.",
    )
    member_profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=False,
        comment="An individual household member's UserProfile.",
    )

    __table_args__ = (
        UniqueConstraint(
            "joint_profile_id",
            "member_profile_id",
            name="uq_joint_member",
            # Ensures each member appears at most once per joint profile.
        ),
    )

    def __repr__(self):
        return (
            f"<JointProfileMember("
            f"id={self.id}, "
            f"joint_profile_id={self.joint_profile_id}, "
            f"member_profile_id={self.member_profile_id}"
            f")>"
        )
