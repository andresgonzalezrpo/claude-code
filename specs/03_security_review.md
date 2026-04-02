# Security Review — Sistema de Ratings

Revisión de seguridad sobre los cambios introducidos en la rama `feat/nueva-rama` para el sistema de ratings (fases B1–B5).

## Alcance

Archivos revisados:
- `app/models/course_rating.py`
- `app/models/course.py`
- `app/models/__init__.py`
- `app/schemas/rating.py`
- `app/services/course_service.py`
- `app/main.py`
- `app/alembic/versions/0002_add_course_ratings_table.py`
- `Makefile`

## Metodología

1. Identificación de vectores de ataque en los cambios del PR
2. Filtrado paralelo de falsos positivos por vector
3. Umbral de reporte: confianza ≥ 8/10

Vectores analizados:
- SQL injection
- Command injection
- Input validation / data exposure
- XSS
- Authentication / authorization bypass

## Hallazgos

No se identificaron vulnerabilidades de seguridad de alta confianza (≥ 0.8) en los cambios de este PR.

### Vectores descartados

**SQL Injection** — descartado.
SQLAlchemy ORM usa parámetros vinculados en todas las queries. No hay interpolación directa de input de usuario en SQL. Los `course_id` son type-hinted como `int` en FastAPI; valores no enteros son rechazados por el framework antes de llegar al service layer.

**Command Injection** — descartado.
El target `make create-migration` del Makefile acepta input interactivo exclusivamente de desarrolladores con acceso shell local. No existe vector de input no confiable. Confianza: 1/10.

**Input Validation** — descartado.
Pydantic v2 valida `rating` en rango 1–5 automáticamente vía `Field(ge=1, le=5)`. FastAPI retorna HTTP 422 antes de ejecutar lógica de negocio si el payload es inválido.

**Data Exposure (`/health`)** — no alcanza umbral.
El endpoint `/health` expone `str(e)` de excepciones de base de datos en la respuesta JSON. Bajo condiciones específicas de fallo del driver psycopg2, la cadena de conexión podría incluir credenciales. Confianza: 7/10 — por debajo del umbral de reporte.

**XSS** — descartado.
El campo `comment` no se renderiza en el frontend React. React auto-escapa contenido de texto por defecto; no se usa `dangerouslySetInnerHTML`.

## Recomendación de seguimiento

Al implementar la capa de autenticación, reemplazar la exposición del error raw en `/health`:

```python
# Actual — expone str(e) directamente
health_status["database_error"] = str(e)

# Recomendado
health_status["database_error"] = "database connection failed"
```

Este cambio está fuera del scope del PR actual ya que el patrón es pre-existente.
