# Plan de Implementación: Sistema de Ratings — Frontend

## Contexto técnico relevante

Tres observaciones críticas del código existente antes de las fases:

1. **URL hardcodeada**: `page.tsx` y `course/[slug]/page.tsx` usan `http://localhost:8000` directamente. El `.env.local` no existe. Debe resolverse antes de agregar nuevos fetches.
2. **SCSS global auto-importado**: `next.config.ts` prepend `@import "vars.scss"` en todos los archivos SCSS. Los nuevos CSS modules NO deben importar `vars.scss` manualmente o se duplicará causando error de compilación.
3. **Patrón de props en `Course.tsx`**: usa `Omit<CourseType, "slug">`. Agregar campos opcionales a `Course` impacta este tipo derivado — validar que no rompa el `Omit`.

---

## Fase F1 — Configuración de entorno

**Archivos afectados:**
- CREAR: `Frontend/.env.local`
- MODIFICAR: `Frontend/src/app/page.tsx`
- MODIFICAR: `Frontend/src/app/course/[slug]/page.tsx`

**Qué hace:**
Crea `.env.local` con `NEXT_PUBLIC_API_URL=http://localhost:8000`. Reemplaza las URLs hardcodeadas en ambas páginas existentes para consumir la variable de entorno.

**Dependencias:** Ninguna. Es prerequisito de todas las demás fases.

**Riesgos y consideraciones:**
- `NEXT_PUBLIC_` expone la variable al cliente. Es correcto aquí porque el backend es público, pero documentarlo.
- Requiere reiniciar `npm run dev` para que Turbopack tome la variable nueva.

---

## Fase F2 — Interfaces TypeScript

**Archivos afectados:**
- MODIFICAR: `Frontend/src/types/index.ts`

**Qué hace:**
- Agrega `average_rating?: number` y `total_ratings?: number` a `Course` (opcionales para no romper el tipo derivado `Omit<CourseType, "slug">` en `Course.tsx`).
- Agrega interface `Rating` con `id`, `course_id`, `rating` (1-5), `review_text?`, `created_at`.
- Agrega interface `RatingSummary` con `ratings`, `total`, `average`.
- Agrega interface `RatingCreate` con `rating` y `review_text?`.

**Dependencias:** F1 (convención, no técnica).

**Riesgos y consideraciones:**
- Confirmar con el backend que `/courses` ya devuelve `average_rating` y `total_ratings` antes de marcarlos como `required`.
- El `Home` page pasa campos individualmente (no usa spread), por lo que agregar opcionales no genera breaking change en el template.

---

## Fase F3 — Componente StarRating (display-only)

**Archivos a crear:**
- `Frontend/src/components/StarRating/StarRating.tsx`
- `Frontend/src/components/StarRating/StarRating.module.scss`
- `Frontend/src/components/StarRating/__test__/StarRating.test.tsx`

**Qué hace:**
Componente funcional sin `"use client"` que renderiza 5 estrellas a partir de un valor numérico. No tiene estado interno ni efectos. Reutilizable en la tarjeta de curso y en el detalle.

**Dependencias:** F2 (tipos, aunque el componente puede recibir primitivos).

**Riesgos y consideraciones:**
- Usar caracteres unicode (`★`/`☆`) o SVG inline — evita dependencias externas.
- El valor puede venir como float (ej. `3.7`). El componente debe manejar valores parciales.
- Incluir `role="img"` y `aria-label="X de 5 estrellas"` para accesibilidad.
- Tests con Vitest + RTL: importar `{ describe, it, expect }` de `"vitest"` siguiendo el patrón exacto de `Course.test.tsx`.
- **No importar `vars.scss`** en el CSS module — el `prependData` de `next.config.ts` ya lo inyecta.

---

## Fase F4 — Componente CourseRatings (interactivo)

**Archivos a crear:**
- `Frontend/src/components/CourseRatings/CourseRatings.tsx`
- `Frontend/src/components/CourseRatings/CourseRatings.module.scss`
- `Frontend/src/components/CourseRatings/__test__/CourseRatings.test.tsx`

**Qué hace:**
El único componente con `"use client"`. Recibe `initialData: RatingSummary` y `courseId: number` desde el Server Component padre. Gestiona el estado del formulario con `useState` y hace `fetch` client-side para el `POST` al endpoint de ratings. Reutiliza `StarRating` para el display del promedio.

**Dependencias:** F2 (interfaces), F3 (StarRating como dependencia de render).

**Riesgos y consideraciones:**
- Este componente no puede importar módulos exclusivos del servidor.
- Sin autenticación actualmente, el `user_id` del rating es undefined — usar campo anónimo hasta implementar auth.
- Para tests, mockear `fetch` con `vi.fn()` — distinto al patrón de `Course.test.tsx` que no hace fetches.

---

## Fase F5 — Integración en Course.tsx (tarjeta del listado)

**Archivos afectados:**
- MODIFICAR: `Frontend/src/components/Course/Course.tsx`
- MODIFICAR: `Frontend/src/components/Course/Course.module.scss`
- MODIFICAR: `Frontend/src/components/Course/__test__/Course.test.tsx`

**Qué hace:**
Agrega `StarRating` debajo de la duración en la tarjeta cuando `average_rating` esté presente. Actualiza el test para cubrir el caso con y sin rating.

**Dependencias:** F2 (tipos), F3 (StarRating).

**Riesgos y consideraciones:**
- `CourseProps` usa `Omit<CourseType, "slug">`. Al agregar campos opcionales a `CourseType`, se heredan automáticamente sin breaking change.
- El card tiene `min-height: 420px`. Agregar el componente de estrellas puede requerir ajustar dimensiones o el `gap` en `.courseInfo`.
- El test existente pasa mocks sin `average_rating`. Como es opcional no rompe, pero actualizar el test para el nuevo caso de render.

---

## Fase F6 — Integración en CourseDetail y page.tsx

**Archivos afectados:**
- MODIFICAR: `Frontend/src/app/course/[slug]/page.tsx`
- MODIFICAR: `Frontend/src/components/CourseDetail/CourseDetail.tsx`
- MODIFICAR: `Frontend/src/components/CourseDetail/CourseDetail.module.scss`

**Qué hace:**
En `page.tsx`: agrega fetch de ratings en paralelo con el del curso usando `Promise.all`. Pasa `ratingSummary` como prop a `CourseDetailComponent`.

En `CourseDetail.tsx`: agrega `ratingSummary: RatingSummary` a las props. Renderiza `StarRating` en el header (junto al profesor) y `CourseRatings` al final del componente pasando `initialData={ratingSummary}` y `courseId={course.id}`.

**Dependencias:** Todas las fases anteriores. El backend completo (B5) debe estar corriendo.

**Riesgos y consideraciones:**
- Usar `Promise.allSettled` en lugar de `Promise.all` si el endpoint de ratings puede no estar listo, para evitar que caiga el error boundary (`error.tsx`).
- `generateMetadata` en `page.tsx` ya llama `getCourseData` por separado — no duplicar ratings fetch aquí.
- `CourseDetail.tsx` es Server Component. Importar `CourseRatings` (`"use client"`) desde un Server Component es válido — Next.js maneja el boundary automáticamente. **No agregar `"use client"` a `CourseDetail.tsx`.**
- Si hay otros lugares que renderizan `CourseDetailComponent` directamente, fallarán en TypeScript al agregar el nuevo prop requerido.

---

## Orden de implementación y dependencias

```
F1 (entorno)
    |
F2 (tipos)
    |
    +---> F3 (StarRating)
    |         |
    |         +---> F5 (Course card)
    |         |
    +---> F4 (CourseRatings)
              |
              +---> F6 (integración final)
```

Las fases F3 y F4 pueden desarrollarse en paralelo una vez completada F2. F5 puede completarse antes de F6.

---

## Consideraciones transversales

- **Variables de color**: No importar `vars.scss` en ningún CSS module nuevo. El `prependData` de `next.config.ts` lo inyecta automáticamente en cada archivo SCSS.
- **Patrón de tests**: Importar `describe/it/expect` de `"vitest"`, usar `@testing-library/jest-dom` para matchers adicionales. Mantener esta convención en todos los nuevos tests.
- **Sin barrel files**: Los componentes existentes se importan por ruta directa (`@/components/Course/Course`). No crear archivos `index.ts` de re-exportación.
- **Accesibilidad**: El componente `StarRating` debe tener atributos ARIA adecuados para no introducir regresiones en elementos ya existentes.
