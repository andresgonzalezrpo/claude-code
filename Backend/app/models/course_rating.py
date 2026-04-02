from sqlalchemy import Column, Integer, String, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from .base import BaseModel


class CourseRating(BaseModel):
    __tablename__ = "course_ratings"
    __table_args__ = (
        CheckConstraint('rating >= 1 AND rating <= 5', name='check_rating_range'),
    )

    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    user_id = Column(Integer, nullable=True)  # nullable: auth no implementada aún
    rating = Column(Integer, nullable=False)
    comment = Column(String, nullable=True)

    course = relationship("Course", back_populates="ratings")
