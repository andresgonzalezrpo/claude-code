# CLAUDE.md — Platziflix Project Memory

Curso de Claude Code de Platzi, impartido por Eduardo Alvarez.
Plataforma educativa de distribución de cursos online con arquitectura multi-cliente sobre un único backend REST.

---

## Estructura del repositorio

```
/
├── Backend/        # FastAPI + PostgreSQL (Python)
├── Frontend/       # Next.js 15 (TypeScript)
├── Mobile/
│   ├── PlatziFlixiOS/      # SwiftUI (Swift)
│   └── PlatziFlixAndroid/  # Jetpack Compose (Kotlin)
└── CLAUDE.md
```

---

## Backend

- **Framework:** FastAPI 0.104+
- **Lenguaje:** Python 3.11+
- **Base de datos:** PostgreSQL 15 (Docker)
- **ORM:** SQLAlchemy 2.0 con soporte async
- **Migraciones:** Alembic
- **Servidor:** Uvicorn con hot reload
- **Gestor de dependencias:** uv
- **Puerto:** 8000

### Estructura interna

```
Backend/app/
├── main.py              # Entry point FastAPI
├── core/config.py       # Settings vía Pydantic
├── db/
│   ├── base.py          # Engine, SessionLocal, get_db()
│   └── seed.py          # Datos de ejemplo
├── models/              # SQLAlchemy models
│   ├── base.py          # BaseModel (id, timestamps, soft delete)
│   ├── course.py
│   ├── teacher.py
│   ├── lesson.py
│   └── course_teacher.py  # Tabla M2M
├── schemas/             # Pydantic schemas (request/response)
└── services/
    └── course_service.py  # Lógica de negocio (CourseService)
```

### Endpoints disponibles

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Mensaje de bienvenida |
| GET | `/health` | Estado del servidor + conexión DB + conteo de cursos |
| GET | `/courses` | Lista todos los cursos (sin relaciones) |
| GET | `/courses/{slug}` | Detalle de curso con teachers y lessons |

### Modelos de base de datos

```
courses ──< course_teachers >── teachers
   │
   └──< lessons
```

Todos los modelos tienen: `id`, `created_at`, `updated_at`, `deleted_at` (soft delete).

- **courses:** name, description, thumbnail, slug (unique, indexed)
- **teachers:** name, email (unique, indexed)
- **lessons:** course_id (FK), name, description, slug, video_url
- **course_teachers:** course_id, teacher_id (M2M junction)

### Patrones arquitectónicos

- Service Layer: `CourseService` abstrae el acceso a datos
- Dependency Injection: `FastAPI Depends` para DB sessions y servicios
- Soft Deletes: campo `deleted_at` en todos los modelos
- Joined load en queries para evitar N+1

### Docker

```bash
cd Backend && docker-compose up --build
```

Servicios: `db` (PostgreSQL 15, puerto 5432) + `api` (FastAPI, puerto 8000).
Credenciales DB: `platziflix_user` / `platziflix_password` / `platziflix_db`

---

## Frontend

- **Framework:** Next.js 15.3.3 con Turbopack
- **UI:** React 19
- **Lenguaje:** TypeScript 5
- **Estilos:** SASS/SCSS + CSS Modules
- **Testing:** Vitest + React Testing Library

### Estructura interna

```
Frontend/src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Home: lista de cursos
│   ├── course/[slug]/
│   │   ├── page.tsx                # Detalle de curso
│   │   ├── error.tsx
│   │   ├── loading.tsx
│   │   └── not-found.tsx
│   └── classes/[class_id]/
│       └── page.tsx                # Reproductor de video
├── components/
│   ├── Course/                     # Tarjeta de curso
│   ├── CourseDetail/               # Vista de detalle
│   └── VideoPlayer/                # Reproductor HTML5
├── types/index.ts                  # Interfaces TypeScript
└── styles/
    ├── reset.scss
    └── vars.scss
```

### Interfaces TypeScript

```typescript
interface Course {
  id: number; title: string; teacher: string;
  duration: number; thumbnail: string; slug: string;
}

interface Class {
  id: number; title: string; description: string;
  video: string; duration: number; slug: string;
}

interface CourseDetail extends Course {
  description: string;
  classes: Class[];
}
```

### Patrones arquitectónicos

- App Router con Server Components (async data fetching en página)
- `cache: "no-store"` en todos los fetch al backend
- CSS Modules para scoping de estilos por componente
- Error boundaries por ruta: `error.tsx`, `loading.tsx`, `not-found.tsx`

### Comandos

```bash
cd Frontend
npm install
npm run dev      # Turbopack dev server
npm run build
npm run test
```

---

## Mobile — iOS (PlatziFlixiOS)

- **Lenguaje:** Swift 5.9+
- **UI:** SwiftUI
- **Arquitectura:** Clean Architecture + MVVM
- **Red:** URLSession con async/await
- **Reactivo:** Combine + `@Published`

### Estructura interna (Clean Architecture)

```
PlatziFlixiOS/
├── Domain/
│   ├── Models/          # Course, Teacher, Class, Lesson (Identifiable, Equatable)
│   └── Repositories/    # CourseRepositoryProtocol (interfaz)
├── Data/
│   ├── Entities/        # DTOs decodables desde JSON
│   ├── Mappers/         # DTO → Domain Model
│   └── Repositories/    # RemoteCourseRepository (implementación)
├── Presentation/
│   ├── Views/           # CourseListView, CourseCardView, DesignSystem
│   └── ViewModels/      # CourseListViewModel (@MainActor, ObservableObject)
└── Services/
    ├── NetworkService.swift   # Protocolo HTTP
    ├── APIEndpoint.swift      # Protocolo de endpoints
    └── NetworkManager.swift   # Implementación URLSession
```

### CourseListViewModel

```swift
@MainActor class CourseListViewModel: ObservableObject {
  @Published var courses: [Course] = []
  @Published var isLoading: Bool
  @Published var errorMessage: String?
  @Published var searchText: String   // debounce 300ms
  // filteredCourses, isEmpty, isLoadingCourses (computed)
}
```

---

## Mobile — Android (PlatziFlixAndroid)

- **Lenguaje:** Kotlin (JVM 11)
- **UI:** Jetpack Compose + Material 3
- **Arquitectura:** Clean Architecture + MVVM + MVI
- **Red:** Retrofit 2.9.0 + OkHttp
- **Imágenes:** Coil para Compose
- **Estado:** StateFlow
- **Min SDK:** 24 (Android 7.0) / Target SDK: 35

### Estructura interna (Clean Architecture)

```
app/src/main/java/com/espaciotiago/platziflixandroid/
├── domain/
│   ├── models/Course.kt              # Data class dominio
│   └── repositories/CourseRepository.kt  # Interface
├── data/
│   ├── entities/CourseDTO.kt         # JSON DTO
│   ├── mappers/CourseMapper.kt       # DTO → Domain
│   ├── network/
│   │   ├── ApiService.kt             # Retrofit interface
│   │   └── NetworkModule.kt          # Configuración Retrofit
│   └── repositories/
│       ├── RemoteCourseRepository.kt
│       └── MockCourseRepository.kt   # Para desarrollo
├── presentation/courses/
│   ├── components/                   # CourseCard, ErrorMessage, LoadingIndicator
│   ├── screen/CourseListScreen.kt
│   ├── state/CourseListUiState.kt    # State + Events (MVI)
│   └── viewmodel/CourseListViewModel.kt
├── di/AppModule.kt                   # DI manual (no Hilt), flag USE_MOCK_DATA
└── ui/theme/                         # Color, Type, Spacing, Theme (Material 3)
```

### CourseListViewModel (MVI)

```kotlin
// UiState
data class CourseListUiState(
  val courses: List<Course> = emptyList(),
  val isLoading: Boolean = false,
  val isRefreshing: Boolean = false,
  val error: String? = null
)

// UiEvents: LoadCourses, RefreshCourses, ClearError
```

### Configuración de red

- Emulador: `http://10.0.2.2:8000/`
- Dispositivo físico: `http://192.168.1.XXX:8000/`
- `network_security_config.xml` permite HTTP en desarrollo

---

## Contrato de API (compartido por todos los clientes)

### GET /courses

```json
[
  {
    "id": 1,
    "name": "Curso de React",
    "description": "...",
    "thumbnail": "https://...",
    "slug": "curso-de-react"
  }
]
```

### GET /courses/{slug}

```json
{
  "id": 1,
  "name": "Curso de React",
  "description": "...",
  "thumbnail": "https://...",
  "slug": "curso-de-react",
  "teacher_id": [1, 2],
  "classes": [
    {
      "id": 1,
      "name": "Clase 1",
      "description": "...",
      "slug": "clase-1"
    }
  ]
}
```

---

## Flujo de datos general

```
Usuario
  → ViewModel / Server Component
  → Repository / fetch()
  → HTTP GET /courses o /courses/{slug}
  → FastAPI → CourseService
  → SQLAlchemy → PostgreSQL
  → JSON → DTO → Domain Model → UI
```

---

## Datos de ejemplo (seed)

- 3 Teachers: Juan Pérez, María García, Carlos Rodríguez
- 3 Courses: React, Python, JavaScript
- 6+ Lessons distribuidas entre los cursos

---

## Convenciones del proyecto

- Soft delete en BD: nunca `DELETE`, siempre marcar `deleted_at`
- Slugs como identificadores en URLs (no IDs numéricos)
- Los tres clientes consumen la misma API REST sin adaptaciones por cliente
- Ambos móviles tienen repositorio mock (`MockCourseRepository`) para desarrollo sin backend
- Los tests de componentes viven junto al componente en carpeta `__test__/`
- Especificaciones de API en `Backend/specs/00_contracts.md`
