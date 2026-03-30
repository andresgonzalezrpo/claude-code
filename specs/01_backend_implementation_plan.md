# Plan de Implementación: Sistema de Ratings — Backend

## Contexto de patrones identificados

- Todos los modelos heredan de `BaseModel` (id, created_at, updated_at, deleted_at).
- El soft delete es obligatorio: `deleted_at` en lugar de `DELETE`.
- El service layer construye y retorna diccionarios explícitos, no instancias ORM.
- Los endpoints usan `Depends()` para inyección de servicio.
- Alembic usa `down_revision` encadenado; la migración inicial tiene revision `d18a08253457`.

---

## Fase B1 — Modelo SQLAlchemy

**Archivos afectados:**
- CREAR: `Backend/app/models/course_rating.py`
- MODIFICAR: `Backend/app/models/course.py`
- MODIFICAR: `Backend/app/models/__init__.py`

**Qué hace:**
Define la tabla `course_ratings` como modelo ORM heredando de `BaseModel`. Agrega la relación `ratings` en `Course` con `back_populates`. Registra `CourseRating` en el `__init__.py` para que Alembic lo detecte en autogenerate.

**Dependencias:** Ninguna. Es la base de todo lo demás.

**Riesgos y consideraciones:**
- `user_id` debe ser nullable desde el inicio (auth no implementada). Si se define `NOT NULL` ahora, una migración futura requeriría `ALTER COLUMN` problemático con datos existentes.
- El campo `rating` debe tener `CheckConstraint('rating >= 1 AND rating <= 5')` a nivel de columna.
- La relación en `Course` no debe usar `joinedload` por defecto para evitar cargar todos los ratings en `GET /courses`.
- No agregar `cascade="all, delete-orphan"`: los ratings son datos históricos y deben permanecer aunque el curso tenga soft delete.

---

## Fase B2 — Migración Alembic

**Archivos afectados:**
- CREAR: `Backend/app/alembic/versions/0002_add_course_ratings_table.py`

**Qué hace:**
Crea la tabla `course_ratings` con sus columnas, FK a `courses`, índices y la restricción CHECK. Define `upgrade()` y `downgrade()`. El `down_revision` apunta a `d18a08253457`.

**Dependencias:** Fase B1 debe estar completa.

**Riesgos y consideraciones:**
- Si se usa `alembic revision --autogenerate`, Alembic genera un ID aleatorio. Usar `--rev-id a1b2c3d4e5f6` para mantener el ID acordado o editar el archivo generado.
- El `downgrade()` debe eliminar índices en orden inverso antes de `drop_table`.
- Probar `alembic downgrade -1` antes de continuar con fases posteriores.

---

## Fase B3 — Schemas Pydantic

**Archivos afectados:**
- CREAR: `Backend/app/schemas/rating.py`
- CREAR: `Backend/app/schemas/__init__.py` (si no existe)

**Qué hace:**
Define tres schemas:
- `RatingCreate`: validación de entrada con `rating` en rango 1-5.
- `RatingResponse`: representación de un rating individual con todos sus campos.
- `RatingSummary`: resumen con `average_rating` y `total_ratings`.

**Dependencias:** Independiente de las fases anteriores. Puede hacerse en paralelo con B1.

**Riesgos y consideraciones:**
- Verificar versión de Pydantic en `pyproject.toml` — la sintaxis de validadores difiere entre v1 y v2.
- El proyecto actualmente no tiene schemas Pydantic activos en endpoints. Introducirlos solo para ratings crea inconsistencia arquitectural — documentarlo como deuda técnica.

---

## Fase B4 — Métodos en CourseService

**Archivos afectados:**
- MODIFICAR: `Backend/app/services/course_service.py`

**Qué hace:**
Agrega tres métodos nuevos y modifica dos existentes:
- `_get_rating_stats(course_id)`: método privado con `AVG` y `COUNT` para un curso.
- `create_rating(course_id, rating_data)`: crea registro en `course_ratings`, valida existencia del curso.
- `get_ratings_by_course(course_id)`: retorna lista de ratings de un curso.
- `get_all_courses()`: incorpora `average_rating` y `total_ratings` via `_get_rating_stats`.
- `get_course_by_slug()`: incorpora `average_rating` y `total_ratings` en la respuesta de detalle.

**Dependencias:** Fase B1 (modelo importado), Fase B3 (schemas para tipado).

**Riesgos y consideraciones:**
- **Riesgo crítico de performance:** llamar a `_get_rating_stats` por cada curso en un loop introduce N+1 queries. La solución correcta es un `GROUP BY course_id` en una sola query y cruzar resultados en Python.
- `create_rating` es el primer método de escritura en el service layer. Definir explícitamente que el `db.commit()` vive en el servicio, no en el router.
- El `course_id` en los nuevos métodos es entero (no slug), coherente con la decisión de diseño.

---

## Fase B5 — Endpoints en main.py

**Archivos afectados:**
- MODIFICAR: `Backend/app/main.py`

**Qué hace:**
Agrega dos nuevos endpoints:
- `POST /courses/{course_id}/ratings` con `status_code=201`: recibe `RatingCreate`, retorna `RatingResponse`.
- `GET /courses/{course_id}/ratings`: retorna lista de `RatingResponse`.

**Dependencias:** Todas las fases anteriores.

**Riesgos y consideraciones:**
- El orden de rutas importa: `GET /courses/{slug}` (string) puede colisionar con rutas que usen `{course_id}` (int) si no hay type hint explícito `course_id: int` en FastAPI.
- `POST` debe retornar `HTTP 404` si el curso no existe y `HTTP 422` si el rating está fuera de rango (Pydantic lo maneja automáticamente).
- Si el proyecto escala, mover endpoints a `APIRouter` separados sería la siguiente mejora arquitectural.

---

## Orden de ejecución y dependencias

```
B1 (Modelo)
    |
    +--> B2 (Migración)   [requiere modelo para autogenerate]
    |
    +--> B3 (Schemas)     [puede ir en paralelo con B1]
    |
    v
B4 (Service)              [requiere B1 y B3]
    |
    v
B5 (Endpoints)            [requiere B4]
```

Antes de ejecutar B2 en un entorno con datos, verificar que `alembic downgrade -1` funciona como rollback.
