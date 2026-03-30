# Análisis Técnico: Sistema de Ratings por Curso

## Problema

Los usuarios no tienen forma de calificar los cursos. Se requiere un sistema de ratings de 1 a 5 estrellas que muestre el promedio en la tarjeta de cada curso y permita enviar y consultar calificaciones desde el detalle del curso.

## Impacto Arquitectural

### Base de datos
- Nueva tabla `course_ratings` con FK a `courses`
- `user_id` nullable (preparado para auth futura)
- `CheckConstraint` en BD + validación Pydantic en API

### Backend
- Nuevo modelo SQLAlchemy `CourseRating`
- Nuevo schema Pydantic `RatingCreate / RatingResponse / RatingSummary`
- Método privado `_get_rating_stats()` en `CourseService` (reutilizable)
- Respuestas de `GET /courses` y `GET /courses/{slug}` extendidas con `average_rating` y `total_ratings`
- 2 endpoints nuevos: `POST /courses/{course_id}/ratings` y `GET /courses/{course_id}/ratings`

### Frontend
- Nuevas interfaces TypeScript: `Rating`, `RatingSummary`, `RatingCreate`
- Componente `StarRating` (display-only, reutilizable)
- Componente `CourseRatings` (`"use client"`, recibe datos iniciales del Server Component)
- `Course.tsx` muestra promedio en la tarjeta
- `CourseDetail.tsx` integra la sección completa de ratings
- `course/[slug]/page.tsx` hace fetch de ratings en paralelo con el curso

## Propuesta de Solución

Seguir el patrón existente del proyecto:
- Service Layer en Backend abstrae el acceso a datos
- Soft delete (`deleted_at`) en la nueva tabla
- Server Components para fetch inicial + Client Component solo para el formulario interactivo
- Validación en dos capas: `CheckConstraint` en PostgreSQL + `Field(ge=1, le=5)` en Pydantic

## Plan de Implementación

### Orden de dependencias

```
1. course_rating.py        — modelo SQLAlchemy
2. models/__init__.py      — registrar el modelo
3. models/course.py        — agregar relación ratings
4. alembic migration       — definir la migración
5. [aplicar migración]     — ejecutar contra la BD
6. schemas/rating.py       — validación Pydantic
7. course_service.py       — lógica de negocio
8. main.py                 — endpoints nuevos
9. [verificar backend]     — smoke test con curl
10. types/index.ts         — tipos TypeScript
11. StarRating component   — componente visual
12. CourseRatings component — sección completa
13. Course.tsx             — mostrar promedio en tarjeta
14. CourseDetail.tsx       — integrar CourseRatings
15. course/[slug]/page.tsx — fetch de ratings en paralelo
16. .env.local             — variable NEXT_PUBLIC_API_URL
17. [verificar frontend]   — npm run dev + npm run test
```

---

## Paso 1 — Modelo SQLAlchemy

**Crear:** `Backend/app/models/course_rating.py`

```python
from sqlalchemy import Column, Integer, Text, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from .base import BaseModel


class CourseRating(BaseModel):
    __tablename__ = 'course_ratings'

    course_id = Column(Integer, ForeignKey('courses.id'), nullable=False, index=True)
    user_id = Column(Integer, nullable=True)  # NULL hasta implementar auth
    rating = Column(Integer, nullable=False)
    review_text = Column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint('rating >= 1 AND rating <= 5', name='check_rating_range'),
    )

    course = relationship("Course", back_populates="ratings")

    def __repr__(self):
        return f"<CourseRating(id={self.id}, course_id={self.course_id}, rating={self.rating})>"
```

---

## Paso 2 — Registrar el modelo en `__init__.py`

**Modificar:** `Backend/app/models/__init__.py`

```python
from .base import BaseModel, Base
from .teacher import Teacher
from .course import Course
from .lesson import Lesson
from .course_teacher import course_teachers
from .course_rating import CourseRating

__all__ = [
    'BaseModel',
    'Base',
    'Teacher',
    'Course',
    'Lesson',
    'course_teachers',
    'CourseRating',
]
```

---

## Paso 3 — Agregar relación en `course.py`

**Modificar:** `Backend/app/models/course.py`

Agregar después de la relación `lessons`:

```python
ratings = relationship(
    "CourseRating",
    back_populates="course",
    cascade="all, delete-orphan"
)
```

---

## Paso 4 — Migración Alembic

**Crear:** `Backend/app/alembic/versions/0002_add_course_ratings_table.py`

```python
"""Add course_ratings table

Revision ID: a1b2c3d4e5f6
Revises: d18a08253457
Create Date: 2026-03-29 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'd18a08253457'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'course_ratings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('review_text', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.CheckConstraint('rating >= 1 AND rating <= 5', name='check_rating_range'),
        sa.ForeignKeyConstraint(
            ['course_id'], ['courses.id'],
            name='fk_course_ratings_course_id'
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_course_ratings_id', 'course_ratings', ['id'], unique=False)
    op.create_index('ix_course_ratings_course_id', 'course_ratings', ['course_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_course_ratings_course_id', table_name='course_ratings')
    op.drop_index('ix_course_ratings_id', table_name='course_ratings')
    op.drop_table('course_ratings')
```

---

## Paso 5 — Aplicar la migración

```bash
cd Backend
make migrate

# Verificar
docker-compose exec api bash -c "cd /app && uv run alembic -c app/alembic.ini current"
# Salida esperada: a1b2c3d4e5f6 (head)

docker-compose exec db psql -U platziflix_user -d platziflix_db -c "\d course_ratings"
```

---

## Paso 6 — Schemas Pydantic

**Crear:** `Backend/app/schemas/rating.py`

```python
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime


class RatingCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating de 1 a 5 estrellas")
    review_text: Optional[str] = Field(None, max_length=2000)

    @field_validator('rating')
    @classmethod
    def validate_rating_range(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError('El rating debe estar entre 1 y 5')
        return v


class RatingResponse(BaseModel):
    id: int
    course_id: int
    rating: int
    review_text: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class RatingSummary(BaseModel):
    ratings: List[RatingResponse]
    total: int
    average: Optional[float]
```

---

## Paso 7 — Métodos nuevos en `CourseService`

**Modificar:** `Backend/app/services/course_service.py`

**Imports a agregar:**
```python
from sqlalchemy import func
from app.models.course_rating import CourseRating
```

**Método privado `_get_rating_stats` (antes de `get_all_courses`):**
```python
def _get_rating_stats(self, course_id: int) -> Dict[str, Any]:
    result = (
        self.db.query(
            func.avg(CourseRating.rating).label("average"),
            func.count(CourseRating.id).label("total"),
        )
        .filter(
            CourseRating.course_id == course_id,
            CourseRating.deleted_at.is_(None),
        )
        .first()
    )
    total = result.total if result else 0
    average = round(float(result.average), 2) if result and result.average else None
    return {"average_rating": average, "total_ratings": total}
```

**`get_all_courses` actualizado:**
```python
def get_all_courses(self) -> List[Dict[str, Any]]:
    courses = self.db.query(Course).filter(Course.deleted_at.is_(None)).all()
    result = []
    for course in courses:
        stats = self._get_rating_stats(course.id)
        result.append({
            "id": course.id,
            "name": course.name,
            "description": course.description,
            "thumbnail": course.thumbnail,
            "slug": course.slug,
            "average_rating": stats["average_rating"],
            "total_ratings": stats["total_ratings"],
        })
    return result
```

**`get_course_by_slug` — agregar en el dict de retorno:**
```python
stats = self._get_rating_stats(course.id)
# añadir al dict:
"average_rating": stats["average_rating"],
"total_ratings": stats["total_ratings"],
```

**Método `create_rating`:**
```python
def create_rating(self, course_id: int, rating: int, review_text: Optional[str] = None) -> Dict[str, Any]:
    course = (
        self.db.query(Course)
        .filter(Course.id == course_id, Course.deleted_at.is_(None))
        .first()
    )
    if not course:
        raise ValueError(f"Course with id={course_id} not found")

    new_rating = CourseRating(course_id=course_id, rating=rating, review_text=review_text)
    self.db.add(new_rating)
    self.db.commit()
    self.db.refresh(new_rating)

    return {
        "id": new_rating.id,
        "course_id": new_rating.course_id,
        "rating": new_rating.rating,
        "review_text": new_rating.review_text,
        "created_at": new_rating.created_at,
    }
```

**Método `get_ratings_by_course`:**
```python
def get_ratings_by_course(self, course_id: int) -> Optional[Dict[str, Any]]:
    course = (
        self.db.query(Course)
        .filter(Course.id == course_id, Course.deleted_at.is_(None))
        .first()
    )
    if not course:
        return None

    ratings = (
        self.db.query(CourseRating)
        .filter(CourseRating.course_id == course_id, CourseRating.deleted_at.is_(None))
        .order_by(CourseRating.created_at.desc())
        .all()
    )
    stats = self._get_rating_stats(course_id)

    return {
        "ratings": [
            {
                "id": r.id,
                "course_id": r.course_id,
                "rating": r.rating,
                "review_text": r.review_text,
                "created_at": r.created_at,
            }
            for r in ratings
        ],
        "total": stats["total_ratings"],
        "average": stats["average_rating"],
    }
```

---

## Paso 8 — Endpoints nuevos en `main.py`

**Modificar:** `Backend/app/main.py`

**Import a agregar:**
```python
from app.schemas.rating import RatingCreate, RatingResponse, RatingSummary
```

**Endpoints a agregar al final del archivo:**
```python
@app.post("/courses/{course_id}/ratings", response_model=RatingResponse, status_code=201)
def create_rating(
    course_id: int,
    body: RatingCreate,
    course_service: CourseService = Depends(get_course_service),
) -> dict:
    try:
        return course_service.create_rating(
            course_id=course_id,
            rating=body.rating,
            review_text=body.review_text,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/courses/{course_id}/ratings", response_model=RatingSummary)
def get_course_ratings(
    course_id: int,
    course_service: CourseService = Depends(get_course_service),
) -> dict:
    result = course_service.get_ratings_by_course(course_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return result
```

---

## Paso 9 — Verificación del Backend

```bash
docker-compose restart api
docker-compose logs api | tail -20

# GET /courses incluye campos nuevos
curl http://localhost:8000/courses
# Cada objeto debe tener "average_rating": null, "total_ratings": 0

# Crear rating válido
curl -X POST http://localhost:8000/courses/1/ratings \
  -H "Content-Type: application/json" \
  -d '{"rating": 5, "review_text": "Excelente curso"}'
# HTTP 201

# Rating fuera de rango → 422
curl -X POST http://localhost:8000/courses/1/ratings \
  -H "Content-Type: application/json" \
  -d '{"rating": 6}'

# Consultar ratings
curl http://localhost:8000/courses/1/ratings
# {"ratings": [...], "total": 1, "average": 5.0}

# Curso inexistente → 404
curl -X POST http://localhost:8000/courses/999/ratings \
  -H "Content-Type: application/json" \
  -d '{"rating": 4}'
```

---

## Paso 10 — Tipos TypeScript

**Modificar:** `Frontend/src/types/index.ts`

Extender `Course` con campos de rating:
```typescript
export interface Course {
  id: number;
  title: string;
  teacher: string;
  duration: number;
  thumbnail: string;
  slug: string;
  average_rating: number | null;
  total_ratings: number;
}
```

Agregar al final:
```typescript
export interface Rating {
  id: number;
  course_id: number;
  rating: number;
  review_text: string | null;
  created_at: string;
}

export interface RatingSummary {
  ratings: Rating[];
  total: number;
  average: number | null;
}

export interface RatingCreate {
  rating: number;  // 1-5
  review_text?: string;
}
```

---

## Paso 11 — Componente `StarRating`

**Crear:** `Frontend/src/components/StarRating/StarRating.tsx`

```tsx
import styles from "./StarRating.module.scss";

interface StarRatingProps {
  average: number | null;
  total: number;
  size?: "sm" | "md" | "lg";
}

export const StarRating = ({ average, total, size = "md" }: StarRatingProps) => {
  if (average === null || total === 0) {
    return (
      <span className={`${styles.noRating} ${styles[size]}`}>
        Sin calificaciones
      </span>
    );
  }

  return (
    <div className={`${styles.container} ${styles[size]}`}>
      <div className={styles.stars} aria-label={`${average} de 5 estrellas`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={star <= Math.round(average) ? styles.starFilled : styles.starEmpty}
            aria-hidden="true"
          >
            {star <= Math.round(average) ? "★" : "☆"}
          </span>
        ))}
      </div>
      <span className={styles.score}>{average.toFixed(1)}</span>
      <span className={styles.total}>({total})</span>
    </div>
  );
};
```

**Crear:** `Frontend/src/components/StarRating/StarRating.module.scss`

```scss
.container {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stars {
  display: flex;
  gap: 1px;
  line-height: 1;
}

.starFilled { color: #f5a623; }
.starEmpty  { color: #d1d5db; }

.score {
  font-weight: 600;
  color: #374151;
}

.total {
  color: #6b7280;
}

.noRating {
  color: #9ca3af;
  font-style: italic;
}

.sm { font-size: 0.75rem; }
.md { font-size: 0.875rem; }
.lg { font-size: 1.125rem; gap: 6px; }
```

---

## Paso 12 — Componente `CourseRatings`

**Crear:** `Frontend/src/components/CourseRatings/CourseRatings.tsx`

```tsx
"use client";

import { useState } from "react";
import { StarRating } from "@/components/StarRating/StarRating";
import { Rating, RatingSummary, RatingCreate } from "@/types";
import styles from "./CourseRatings.module.scss";

interface CourseRatingsProps {
  courseId: number;
  initialData: RatingSummary;
}

export const CourseRatings = ({ courseId, initialData }: CourseRatingsProps) => {
  const [data, setData] = useState<RatingSummary>(initialData);
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRating === 0) {
      setError("Debes seleccionar una calificación");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: RatingCreate = {
      rating: selectedRating,
      review_text: reviewText.trim() || undefined,
    };

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}/ratings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) throw new Error("Error al enviar la calificación");

      const newRating: Rating = await response.json();

      const updatedRatings = [newRating, ...data.ratings];
      const newTotal = data.total + 1;
      const newAverage =
        updatedRatings.reduce((sum, r) => sum + r.rating, 0) / newTotal;

      setData({
        ratings: updatedRatings,
        total: newTotal,
        average: Math.round(newAverage * 100) / 100,
      });

      setSelectedRating(0);
      setReviewText("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("No se pudo enviar la calificación. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Calificaciones</h2>
        <StarRating average={data.average} total={data.total} size="lg" />
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <p className={styles.formLabel}>Califica este curso:</p>

        <div className={styles.starPicker}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className={
                star <= (hoveredRating || selectedRating)
                  ? styles.starPickerFilled
                  : styles.starPickerEmpty
              }
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              onClick={() => setSelectedRating(star)}
              aria-label={`Calificar con ${star} estrella${star > 1 ? "s" : ""}`}
            >
              {star <= (hoveredRating || selectedRating) ? "★" : "☆"}
            </button>
          ))}
        </div>

        <textarea
          className={styles.reviewInput}
          placeholder="Escribe tu reseña (opcional, máximo 2000 caracteres)"
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          maxLength={2000}
          rows={4}
        />

        {error && <p className={styles.errorMessage}>{error}</p>}
        {success && <p className={styles.successMessage}>Calificación enviada. Gracias.</p>}

        <button
          type="submit"
          className={styles.submitButton}
          disabled={isSubmitting || selectedRating === 0}
        >
          {isSubmitting ? "Enviando..." : "Enviar calificación"}
        </button>
      </form>

      {data.ratings.length > 0 && (
        <div className={styles.ratingsList}>
          <h3 className={styles.ratingsTitle}>
            {data.total} {data.total === 1 ? "calificación" : "calificaciones"}
          </h3>
          {data.ratings.map((rating) => (
            <div key={rating.id} className={styles.ratingItem}>
              <div className={styles.ratingItemHeader}>
                <StarRating average={rating.rating} total={1} size="sm" />
                <span className={styles.ratingDate}>
                  {new Date(rating.created_at).toLocaleDateString("es-MX", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              {rating.review_text && (
                <p className={styles.reviewText}>{rating.review_text}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
```

**Crear:** `Frontend/src/components/CourseRatings/CourseRatings.module.scss`

```scss
.container {
  margin-top: 2rem;
  padding: 1.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fafafa;
}

.header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 1.5rem;
}

.formLabel {
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.starPicker {
  display: flex;
  gap: 4px;
}

.starPickerFilled,
.starPickerEmpty {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 2rem;
  line-height: 1;
  padding: 0;
  transition: transform 0.1s ease;

  &:hover { transform: scale(1.15); }
}

.starPickerFilled { color: #f5a623; }
.starPickerEmpty  { color: #d1d5db; }

.reviewInput {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  }
}

.errorMessage   { color: #dc2626; font-size: 0.875rem; margin: 0; }
.successMessage { color: #16a34a; font-size: 0.875rem; margin: 0; }

.submitButton {
  align-self: flex-start;
  padding: 0.5rem 1.25rem;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover:not(:disabled) { background: #4f46e5; }
  &:disabled { background: #a5b4fc; cursor: not-allowed; }
}

.ratingsList {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ratingsTitle {
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.5rem 0;
}

.ratingItem {
  padding: 0.75rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ratingItemHeader {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.ratingDate  { font-size: 0.75rem; color: #9ca3af; }
.reviewText  { font-size: 0.875rem; color: #4b5563; margin: 0; line-height: 1.5; }
```

---

## Paso 13 — Actualizar `Course.tsx`

**Modificar:** `Frontend/src/components/Course/Course.tsx`

```tsx
import styles from "./Course.module.scss";
import { Course as CourseType } from "@/types";
import { StarRating } from "@/components/StarRating/StarRating";

type CourseProps = Omit<CourseType, "slug">;

export const Course = ({
  id,
  title,
  teacher,
  duration,
  thumbnail,
  average_rating,
  total_ratings,
}: CourseProps) => {
  return (
    <article className={styles.courseCard}>
      <div className={styles.thumbnailContainer}>
        <img src={thumbnail} alt={title} className={styles.thumbnail} />
      </div>
      <div className={styles.courseInfo}>
        <h2 className={styles.courseTitle}>{title}</h2>
        <p className={styles.teacher}>Profesor: {teacher}</p>
        <p className={styles.duration}>Duración: {duration} minutos</p>
        <StarRating average={average_rating} total={total_ratings} size="sm" />
      </div>
    </article>
  );
};
```

---

## Paso 14 — Actualizar `CourseDetail.tsx`

**Modificar:** `Frontend/src/components/CourseDetail/CourseDetail.tsx`

Agregar imports:
```tsx
import { StarRating } from "@/components/StarRating/StarRating";
import { CourseRatings } from "@/components/CourseRatings/CourseRatings";
import { RatingSummary } from "@/types";
```

Agregar `ratingsData` a las props del componente:
```tsx
interface CourseDetailComponentProps {
  course: CourseDetail;
  ratingsData: RatingSummary;
}
```

Agregar `<StarRating>` debajo del nombre del profesor:
```tsx
<StarRating average={course.average_rating} total={course.total_ratings} size="md" />
```

Agregar `<CourseRatings>` como último hijo del contenedor principal:
```tsx
<CourseRatings courseId={course.id} initialData={ratingsData} />
```

---

## Paso 15 — Actualizar `course/[slug]/page.tsx`

**Modificar:** `Frontend/src/app/course/[slug]/page.tsx`

Agregar fetch de ratings en paralelo con el del curso:

```tsx
import { RatingSummary } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Dentro del componente async, después de obtener courseData:
const ratingsRes = await fetch(
  `${API_URL}/courses/${courseData.id}/ratings`,
  { cache: "no-store" }
);
const ratingsData: RatingSummary = ratingsRes.ok
  ? await ratingsRes.json()
  : { ratings: [], total: 0, average: null };

return <CourseDetailComponent course={courseData} ratingsData={ratingsData} />;
```

---

## Paso 16 — Variable de entorno

**Verificar o crear:** `Frontend/.env.local`

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Paso 17 — Verificación final del Frontend

```bash
cd Frontend
npm run dev

# Verificar en http://localhost:3000:
# 1. Tarjetas de cursos muestran "Sin calificaciones"
# 2. Detalle del curso muestra la sección "Calificaciones" con formulario
# 3. Hover sobre estrellas activa el estado visual
# 4. Enviar sin seleccionar estrellas muestra error inline
# 5. Enviar rating válido agrega el item a la lista de inmediato
# 6. Refrescar: el rating persiste (viene del backend)
# 7. El promedio en el header se actualiza tras el submit

npm run test  # los tests existentes deben seguir pasando
```

---

## Contrato de API actualizado

### Endpoints nuevos

```
POST /courses/{course_id}/ratings
Content-Type: application/json
Body: { "rating": 4, "review_text": "Excelente" }
Response 201: { "id": 1, "course_id": 1, "rating": 4, "review_text": "...", "created_at": "..." }
Response 404: curso no encontrado
Response 422: rating fuera de rango (1-5)

GET /courses/{course_id}/ratings
Response 200: { "ratings": [...], "total": 42, "average": 4.3 }
Response 404: curso no encontrado
```

### Responses modificados

`GET /courses` — cada objeto agrega:
```json
{ "average_rating": 4.3, "total_ratings": 42 }
```

`GET /courses/{slug}` — agrega:
```json
{ "average_rating": 4.3, "total_ratings": 42 }
```

---

## Notas de diseño

**`course_id` (int) en la URL de ratings, no el slug** — los ratings tienen FK a `courses.id`. El slug es identificador de presentación del recurso principal, no de los recursos subordinados.

**`user_id` nullable desde el inicio** — evita una migración adicional cuando se implemente auth. La constraint `CHECK` aplica solo a `rating`.

**`_get_rating_stats` privado** — query de agregación reutilizada por `get_all_courses` y `get_course_by_slug`. Punto exacto donde agregar caché cuando la carga crezca.

**`CourseRatings` como `"use client"` con datos iniciales** — el formulario de star picker requiere estado local. Pasar `initialData` desde el Server Component elimina el loading state inicial y mantiene la lista de ratings indexable por buscadores (SSR).
