# Especificación de Refactor V2: Pure Spatial Minimal & Optical Glow

**Documento:** `REFACTOR_V2_SPEC.md`  
**Proyecto:** Sharink (`Projects/sharink`)  
**Fecha:** 3 de septiembre de 2026  
**Objetivo:** Erradicar todo aspecto tosco (colores planos estilo Paint, halos estilo PowerPoint, ruido de áreas delimitadas) y simplificar hacia una sola dirección estética maestra: **espacial pura, orgánica, con óptica de luz real y sin interacción de arrastre**.

---

## 1. Decisiones de Diseño Críticas

| Aspecto Anterior | Problema Identificado | Nueva Solución (V2) |
|---|---|---|
| **Múltiples Temas** | Dispersión visual, falta de identidad sólida y acabados inconsistentes. | **Tema Único Maestro:** *Deep Space Obsidian* (`#08090d`). Un solo diseño pulido al milímetro con contrastes de lujo y tipografía refinada. |
| **Color de Nodos (Paint bucket)** | Relleno plano y saturado sin profundidad ni volumen. | **Sombreado Radial Orgánico con Núcleo Luminoso:** Cada nodo usa un gradiente radial SVG (`<radialGradient>`) con núcleo de luz translúcido que decae hacia un borde oscuro de cristal de 0.5px. |
| **Halo en Hover (PowerPoint)** | Círculos toscos con opacidades básicas. | **Difusión Óptica Real (Optical Bloom):** Gradiente radial de decaimiento exponencial combinado con filtro Gaussiano SVG (`feGaussianBlur`), simulando refracción de luz sobre una lente astronómica. |
| **Delimitaciones de Áreas (Hulls)** | Curvas y sombreados que generan un ruido visual sucio e innecesario. | **Relación Puramente Espacial:** Se eliminan por completo todas las líneas, sombras y polígonos de áreas. La relación se transmite 100% por **gravedad y proximidad espacial orgánica**. Solo una micro-etiqueta sutil marca el centro de gravedad del área. |
| **Manipulación de Nodos** | Arrastrar nodos desordenaba la composición y generaba fricción. | **Nodos Estables (Fijos / Sin Arrastre):** La física calcula la posición armónica de equilibrio y los nodos quedan fijados. Se mantiene el zoom y paneo suave de la cámara para explorar el lienzo. |
| **Datos Semilla** | Pocos ejemplos para notar el impacto de las vistas día/semana. | **Dataset Enriquecido (~20 Actividades):** Distribuidas a lo largo de una semana completa, cubriendo todo el espectro EM (-5 a +5) y mostrando la distribución semanal/mensual real. |

---

## 2. Anatomía Óptica del Nodo

Cada nodo circular de actividad se compone de 3 capas concéntricas matemáticas:

```
           [ 1. Difusión Óptica (Solo en Hover/Focus) ]
                 Filtro feGaussianBlur + Gradiente Exponencial (r + 18px)
                     . - ~ ~ ~ - .
                 . '               ' .
               /    [ 2. Anillo de Cristal ]  \
              |     Borde 0.5px blanco/15%     |
             |   ( [ 3. Núcleo Luminoso ] )   |
              |     Gradiente Radial:          |
               \    Centro: Color EM + Luz    /
                 .   Borde: Color profundo   .
                   ' - ~ ~ ~ - '
```

1. **Núcleo de Luz (`<radialGradient>`):**
   * Parada 0% (Centro focal): Tono EM con `stop-opacity: 0.95` y luminosidad elevada.
   * Parada 70%: Tono base de temperatura EM puro.
   * Parada 100% (Perímetro): Tono profundo que se funde con el fondo espacial.
2. **Anillo Perimetral de Cristal:** Trazado de `stroke-width: 0.5px`, color `rgba(255, 255, 255, 0.16)`.
3. **Bloom Óptico en Hover:** Resplandor difuso con decaimiento natural y desenfoque óptico (`stdDeviation="8"`).

---

## 3. Comportamiento Espacial y Física Gravitacional

* **Sin interacción de arrastre (No-Drag):** El cursor es de navegación (`default` o `pointer`), no de agarre (`grab`).
* **Fuerza de Agrupación por Áreas:** Cada área de vida proyecta un pozo de gravedad suave hacia su posición cardinal en el lienzo:
  * Trabajo & Carrera: Noroeste
  * Salud & Deporte: Noreste
  * Desarrollo Personal: Suroeste
  * Social & Familia: Sureste
  * Ocio & Desconexión: Centro-Sur
* **Intersecciones:** Las actividades con múltiples áreas se sitúan con precisión física en los puntos de equilibrio entre los centros gravitacionales correspondientes.
* **Estabilización Rápida:** La simulación D3 converge con rapidez (`alphaDecay: 0.05`) para que los nodos alcancen una posición fija y armónica sin vibraciones eternas.

---

## 4. Dataset Semilla (~20 Actividades Semanales)

El conjunto de datos cubrirá de Lunes a Domingo de la semana en curso:

| Día | Actividad | Horas | Áreas | Temp (-5 a +5) |
|---|---|---|---|---|
| Lun | Deep Work Arquitectura | 4.0 | Trabajo | +4.5 (Flujo) |
| Lun | Entrenamiento Pesas | 1.5 | Salud | +4.8 (Vital) |
| Lun | Standup & Slack | 1.5 | Trabajo | -2.0 (Fricción) |
| Mar | Prototipado UX | 3.5 | Trabajo, Crecimiento | +4.0 (Flujo) |
| Mar | Corrida Matutina 5k | 0.8 | Salud | +5.0 (Trascendente) |
| Mar | Scroll Redes / Procrastinación | 2.0 | Ocio | -4.5 (Drenante) |
| Mié | Refactor Backend | 5.0 | Trabajo | +3.5 (Foco) |
| Mié | Almuerzo con Amigos | 1.5 | Social, Salud | +4.0 (Conexión) |
| Mié | Burocracia y Finanzas | 1.2 | Trabajo | -3.5 (Tedioso) |
| Jue | Lectura Ensayo Filosofía | 1.0 | Crecimiento | +4.2 (Inspiración) |
| Jue | Sesión de Debugging Crítico | 3.0 | Trabajo | -1.5 (Neutro/Tensión) |
| Jue | Meditación & Movilidad | 0.7 | Salud, Crecimiento | +4.5 (Paz) |
| Vie | Demo y Lanzamiento Sprint | 2.5 | Trabajo | +3.8 (Logro) |
| Vie | Cena Familiar | 3.0 | Social | +5.0 (Cálido) |
| Vie | Videojuegos / Desconexión | 2.5 | Ocio | +2.0 (Neutro positivo) |
| Sáb | Senderismo en Montaña | 4.0 | Salud, Ocio | +5.0 (Plenitud) |
| Sáb | Práctica de Guitarra | 1.5 | Crecimiento, Ocio | +4.0 (Creativo) |
| Sáb | Discusión o Conflicto Imprevisto | 1.0 | Social | -4.0 (Amargo) |
| Dom | Planificación de la Semana | 1.5 | Crecimiento, Trabajo | +3.5 (Claridad) |
| Dom | Cine & Descanso | 2.5 | Ocio | +3.0 (Regenerativo) |

---

## 5. Plan de Refactor Técnico

1. **Eliminar ThemeContext y multitemas:** Unificar todo el CSS y componentes en torno a una sola paleta *Deep Space Obsidian*.
2. **Definir filtros SVG de óptica real:** `<feGaussianBlur>`, filtros de refracción y `<radialGradient>` dinámicos para los nodos en `GraphCanvas.tsx`.
3. **Eliminar el renderizado de Hulls:** Remover todo cálculo de trazados/sombras de áreas. La agrupación será exclusivamente espacial mediante fuerzas gravitacionales centradas.
4. **Desactivar el drag de nodos:** Eliminar el handler de arrastre; los nodos son fijos y contemplativos.
5. **Cargar el dataset de 20 actividades:** Enriquecer `src/utils/storage.ts` con las 20 actividades distribuidas en la semana.
6. **Verificar compilación limpia y sin errores:** `npm run build`.
