---
name: Sistema de Ratings — contexto de la feature
description: Plan de implementación del sistema de ratings 1-5 estrellas para Platziflix, decisiones clave de diseño
type: project
---

Se está implementando un sistema de ratings (1-5 estrellas) para Platziflix.

Decisiones de diseño acordadas:
- La tabla `course_ratings` usa `course_id` (int FK) en la URL de los endpoints, no el slug
- `user_id` es nullable (auth no implementada aún), para evitar una segunda migración futura
- La migración lleva `revision = 'a1b2c3d4e5f6'` y `down_revision = 'd18a08253457'` (la inicial)
- Los endpoints son POST/GET `/courses/{course_id}/ratings`
- `GET /courses` y `GET /courses/{slug}` se modifican para incluir `average_rating` y `total_ratings`
- `CourseRatings` es Client Component (`"use client"`) por el formulario interactivo; recibe datos iniciales como prop desde el Server Component para evitar loading state y mantener SEO

**Why:** Feature nueva sin fecha límite conocida, orientada a valor educativo.
**How to apply:** Al retomar esta feature, seguir el orden de dependencias del plan: BD → modelos → servicios → endpoints → frontend.
