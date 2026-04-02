from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class RatingCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class RatingResponse(BaseModel):
    id: int
    course_id: int
    user_id: Optional[int]
    rating: int
    comment: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class RatingSummary(BaseModel):
    average_rating: Optional[float]
    total_ratings: int
