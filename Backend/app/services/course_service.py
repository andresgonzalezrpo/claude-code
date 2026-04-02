from typing import List, Optional, Dict, Any
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.models.course import Course
from app.models.lesson import Lesson
from app.models.teacher import Teacher
from app.models.course_rating import CourseRating
from app.schemas.rating import RatingCreate


class CourseService:
    """
    Service class for handling course-related operations.
    Implements the contract specifications for course endpoints.
    """

    def __init__(self, db: Session):
        self.db = db

    def _get_rating_stats(self, course_ids: List[int]) -> Dict[int, Dict[str, Any]]:
        """
        Returns average_rating and total_ratings for a list of course IDs in a single query.
        """
        rows = (
            self.db.query(
                CourseRating.course_id,
                func.avg(CourseRating.rating).label("average_rating"),
                func.count(CourseRating.id).label("total_ratings"),
            )
            .filter(
                CourseRating.course_id.in_(course_ids),
                CourseRating.deleted_at.is_(None),
            )
            .group_by(CourseRating.course_id)
            .all()
        )
        return {
            row.course_id: {
                "average_rating": round(float(row.average_rating), 2) if row.average_rating else None,
                "total_ratings": row.total_ratings,
            }
            for row in rows
        }

    def create_rating(self, course_id: int, rating_data: RatingCreate) -> Dict[str, Any]:
        """
        Create a new rating for a course. Returns the created rating as a dict.
        Raises ValueError if the course does not exist.
        """
        course = self.db.query(Course).filter(Course.id == course_id, Course.deleted_at.is_(None)).first()
        if not course:
            raise ValueError(f"Course {course_id} not found")

        rating = CourseRating(
            course_id=course_id,
            user_id=None,
            rating=rating_data.rating,
            comment=rating_data.comment,
        )
        self.db.add(rating)
        self.db.commit()
        self.db.refresh(rating)

        return {
            "id": rating.id,
            "course_id": rating.course_id,
            "user_id": rating.user_id,
            "rating": rating.rating,
            "comment": rating.comment,
            "created_at": rating.created_at,
        }

    def get_ratings_by_course(self, course_id: int) -> List[Dict[str, Any]]:
        """
        Returns all ratings for a course. Raises ValueError if course does not exist.
        """
        course = self.db.query(Course).filter(Course.id == course_id, Course.deleted_at.is_(None)).first()
        if not course:
            raise ValueError(f"Course {course_id} not found")

        ratings = (
            self.db.query(CourseRating)
            .filter(CourseRating.course_id == course_id, CourseRating.deleted_at.is_(None))
            .all()
        )
        return [
            {
                "id": r.id,
                "course_id": r.course_id,
                "user_id": r.user_id,
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at,
            }
            for r in ratings
        ]

    def get_all_courses(self) -> List[Dict[str, Any]]:
        """
        Get all courses with basic information (no teachers or lessons).
        
        Returns:
            List of course dictionaries with: id, name, description, thumbnail, slug
        """
        courses = self.db.query(Course).filter(Course.deleted_at.is_(None)).all()

        course_ids = [c.id for c in courses]
        stats = self._get_rating_stats(course_ids) if course_ids else {}

        return [
            {
                "id": course.id,
                "name": course.name,
                "description": course.description,
                "thumbnail": course.thumbnail,
                "slug": course.slug,
                "average_rating": stats.get(course.id, {}).get("average_rating"),
                "total_ratings": stats.get(course.id, {}).get("total_ratings", 0),
            }
            for course in courses
        ]

    def get_course_by_slug(self, slug: str) -> Optional[Dict[str, Any]]:
        """
        Get course details by slug including teachers and lessons.
        
        Args:
            slug: The course slug
            
        Returns:
            Course dictionary with teachers and lessons, or None if not found
        """
        course = (
            self.db.query(Course)
            .options(
                joinedload(Course.teachers),
                joinedload(Course.lessons)
            )
            .filter(Course.slug == slug)
            .filter(Course.deleted_at.is_(None))
            .first()
        )
        
        if not course:
            return None

        stats = self._get_rating_stats([course.id]).get(course.id, {})

        return {
            "id": course.id,
            "name": course.name,
            "description": course.description,
            "thumbnail": course.thumbnail,
            "slug": course.slug,
            "teacher_id": [teacher.id for teacher in course.teachers],
            "average_rating": stats.get("average_rating"),
            "total_ratings": stats.get("total_ratings", 0),
            "classes": [
                {
                    "id": lesson.id,
                    "name": lesson.name,
                    "description": lesson.description,
                    "slug": lesson.slug
                }
                for lesson in course.lessons
                if lesson.deleted_at is None
            ]
        } 