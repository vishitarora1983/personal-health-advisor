from sqlalchemy import Column, Integer, Boolean, ForeignKey, UniqueConstraint
from database import Base


class JointProfileMember(Base):
    __tablename__ = "joint_profile_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    joint_profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    member_profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    is_primary = Column(Boolean, default=False, nullable=False)

    __table_args__ = (
        UniqueConstraint("joint_profile_id", "member_profile_id", name="uq_joint_member"),
    )
