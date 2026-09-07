# Contexto de Sesión y Handover: Proyecto Sharink

**Documento:** `SESSION_CONTEXT.md`  
**Ubicación:** `Projects/sharink/SESSION_CONTEXT.md`  
**Fecha:** 3 de septiembre de 2026  
**Entorno:** Arch Linux / Omarchy

---

## 1. Visión y Propósito del Proyecto
* **Nombre:** Sharink
* **Ubicación local:** `Projects/sharink`
* **Objetivo:** Visualizador espacial interactivo de actividades diarias y distribución del tiempo basado en grafos de fuerzas dinámicas (estilo Obsidian) y mapa de calor vital en el espectro electromagnético.

---

## 2. Decisiones de Diseño y UI Validadas
* **Tema Único Maestro (Deep Space Obsidian):** Fondo ébano cálido (`#0c0d13`) con una cuadrícula sutil de micropuntos (`dot-grid`) para dar sentido de escala y profundidad espacial. Sin múltiples temas.
* **Nodos "Flat-Matte" Contemporáneos:** Círculos limpios y planos con borde de 1px (`rgba(255,255,255,0.3)`). Se eliminaron al 100% las esferas 3D brillantes y los falsos halos estilo PowerPoint.
* **Aura Suave por Defecto:** Cada nodo proyecta en reposo un halo sutil de luz difuminada con filtro Gaussiano (`opacity: 22%`), que se intensifica orgánicamente en hover (`opacity: 55%`).
* **Escala Cromática Natural Cálida (Sin tonos índigos/violetas fríos):**
  * `-5.0` (Drenante / Negativo): **Rojo cálido** (`#ef4444`)
  * `-2.5` (Fricción): **Naranja brillante** (`#f97316`)
  * ` 0.0` (Neutro / Balance): **Amarillo solar** (`#eab308`)
  * `+2.5` (Energizante): **Verde vivo** (`#22c55e`)
  * `+5.0` (Flujo / Inspirador): **Azul puro** (`#0284c7`)
* **Relación Puramente Espacial:** Sin sombras, polígonos ni líneas punteadas delimitando áreas. Los nodos se agrupan únicamente por gravedad hacia los centroides de sus aspectos de vida.
* **Nodos Fijos (Sin Drag):** La física calcula la posición armónica de equilibrio y los nodos se quedan fijos. El usuario navega con zoom y paneo continuo.
* **Floating Dock (Estilo Raycast / Dynamic Island):** Barra flotante inferior con accesos rápidos (`+ Actividad`, `Aspectos`, `Filtros`).

---

## 3. Lógica de Acumulación y Agregación Temporal Implementada
* **Intra-Día (Mismo Día):** Si una actividad ya fue registrada en la fecha actual (ej. "Cocina & Nutrición"), al ingresar más horas no crea un nodo nuevo, sino que se suma al nodo existente del día. El modal muestra feedback en vivo y autocompleta aspectos y temperatura.
* **Consolidación Multi-Periodo:**
  * En vista **Día**: Se ven las actividades individuales de esa fecha.
  * En vista **Semana, Mes o Global**: Todas las entradas con el mismo nombre se consolidan automáticamente en **un solo nodo acumulativo** con la suma total de horas y temperatura ponderada.
* **Dataset Semilla:** 20 actividades realistas distribuidas de Lunes a Domingo para probar inmediatamente las vistas de Día y Semana.

---

## 4. Estado Actual del Código
* **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + D3.js. Compila al 100% sin advertencias (`npm run build`).
* **Documentación y Specs en el repositorio:**
  * `SPEC.md`: Especificación funcional inicial.
  * `REFACTOR_V2_SPEC.md`: Especificación estética refinada (espacio puro, discos mate, escala cromática).
  * `BACKEND_SPEC.md`: Especificación completa de la arquitectura de Backend en Python (FastAPI + SQLModel + PostgreSQL).

---

## 5. Tarea Pendiente para la Próxima Sesión
* **Implementar el Backend en Python:**
  1. Crear la estructura en `Projects/sharink/backend/`.
  2. Implementar FastAPI + SQLModel con modelos `User`, `Activity`, `LifeArea` y tabla intermedia `activity_areas`.
  3. Mover la lógica de acumulación intra-día (`POST /api/activities`) y consolidación temporal en SQL (`GET /api/activities?view=week`) al backend.
  4. Conectar el frontend mediante llamadas `fetch` a la API REST.
