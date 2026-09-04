# Especificación de Refactor de Diseño: Sharink (Aesthetic & Minimal)

**Documento:** `REFACTOR_DESIGN_SPEC.md`  
**Proyecto:** Sharink (`Projects/sharink`)  
**Enfoque:** Rediseño estético integral — eliminación de patrones genéricos de IA, minimalismo radical, fluidez visual y arquitectura de interfaz no intrusiva.

---

## 1. Diagnóstico y Principios del Rediseño

### Problemas del diseño anterior (Look genérico de IA):
* **Sidebar estático pesado (384px):** Robaba un tercio de la pantalla, rompiendo la sensación inmersiva del grafo.
* **Efectos 3D y gradientes estridentes:** Brillos artificiales tipo "esferas de plástico" en los nodos.
* **Sombras de áreas toscas:** Trazados gruesos con bordes punteados pesados que ensuciaban el espacio visual.
* **Bordes y cards saturadas:** Colores estridentes y sombras genéricas que restaban sofisticación.

### Nuevos Principios de Diseño:
1. **Lienzo 100% Inmersivo:** El grafo es el protagonista absoluto; el espacio bidimensional ocupa todo el viewport.
2. **Dock Flotante Minimalista (Estilo Raycast / Dynamic Island):** Los controles flotan de forma compacta y se expanden suavemente solo cuando se interactúa con ellos.
3. **Constelación Sutil:** Los nodos se comportan como cuerpos celestes discretos que solo ganan presencia e intensidad en hover o interacción.
4. **Trazados Fluidos Ultra-finos:** Las regiones de vida se definen mediante curvas cerradas continuas de 1px apenas visibles, manteniendo la máxima limpieza visual.
5. **Motor de 4 Temas Estéticos:** Selector interactivo para cambiar instantáneamente la atmósfera visual.

---

## 2. Sistema de 4 Temas Visuales (Theme Engine)

Se implementa un context/hook de temas con soporte de persistencia local y 4 identidades estéticas refinadas:

### 2.1 Tema 1: `linear` (Minimalismo Linear / Raycast)
* **Atmósfera:** Negro abisal profundo (`#08090a`), bordes casi imperceptibles (`rgba(255, 255, 255, 0.07)`), tarjetas en `#101216`.
* **Acentos:** Índigo y azul eléctrico sutil (`#5e6ad2`, `#38bdf8`).
* **Sensación:** Software de clase mundial, precisión, sobriedad y máxima elegancia.

### 2.2 Tema 2: `zen` (Orgánico / Slate Calm)
* **Atmósfera:** Grafito mate suave (`#111418`), bordes neutros cálidos (`rgba(255, 255, 255, 0.05)`), tarjetas en `#181c22`.
* **Acentos:** Salvia, ámbar apagado y verde oliva calmado (`#2dd4bf`, `#a3e635`).
* **Sensación:** Calma visual, bienestar, bajo contraste relajante para uso prolongado.

### 2.3 Tema 3: `editorial` (Swiss Precision / Monocromo Técnico)
* **Atmósfera:** Carbón neutro de laboratorio (`#0c0d0e`), rejilla técnica sutil de fondo opcional, tipografía monospace rigurosa.
* **Acentos:** Monocromo puro con acento único blanco cálido (`#fafafa`) y gris titanio.
* **Sensación:** Cuaderno de laboratorio arquitectónico, herramienta de medición técnica.

### 2.4 Tema 4: `hacker` (Cyberpunk / Terminal CRT Minimal)
* **Atmósfera:** Negro puro de fósforo (`#000200`), acentos en verde terminal fósforo (`#22c55e`, `#4ade80`), acentos secundarios ámbar CRT (`#f59e0b`).
* **Micro-detalles:** Tipografía monospace terminal, micro-bordes verdes de 1px translúcidos (`rgba(34, 197, 94, 0.15)`), aura retro-futurista sutil sin excesos de glitch.

---

## 3. Rediseño del Grafo: "Constelación Sutil"

### 3.1 Nodos
* **Morfología:** Círculos planos de tono mate con una translucidez base (`opacity: 0.85`), sin brillos falsos de esferas 3D.
* **Proporcionalidad:** Radio escalado mediante escala logarítmica/raíz cuadrada suavizada para armonía geométrica ($R \in [16\text{px}, 52\text{px}]$).
* **Interacción (Hover & Drag):**
  * Al pasar el cursor, el nodo expande suavemente un halo exterior difuminado (resplandor de 8px) correspondiente a su temperatura EM.
  * La tipografía de la actividad aparece en micro-sans o monospace con tracking elegante.
* **Nodos Multi-área:** En lugar de degradados llamativos, presentan un anillo perimetral segmentado o una suave bicromía en su borde.

### 3.2 Trazados Fluidos de Áreas (Hulls)
* **Geometría:** Curvas splines cerradas (*Catmull-Rom Closed*) calculadas sobre los centroides y vértices exteriores de los nodos del área.
* **Estilo:** Línea continua ultra-fina (1px) con opacidad muy baja (`stroke-opacity: 0.25`), sin trazos punteados gruesos. Relleno con transparencia extrema (`fill-opacity: 0.03`), logrando una delimitación casi espectral.

### 3.3 Escala EM de Temperatura
* Integración fluida con los 4 temas.
* Escala continua de 5 paradas: Azul cósmico (+5) $\to$ Cian $\to$ Neutro temático $\to$ Ámbar $\to$ Rojo carmesí tenue (-5).

---

## 4. Arquitectura de Interfaz: Dock Flotante / Island (Raycast Style)

### 4.1 Barra Superior Etérea
* Altura reducida (48px), completamente translúcida con `backdrop-filter: blur(16px)`.
* Selector de periodo (Día / Semana / Mes / Global) condensado como píldora segmentada ultra-limpia.
* Indicador de tiempo total como micro-medidor minimalista.
* Selector de Tema conmutador rápido (Linear, Zen, Editorial, Hacker).

### 4.2 Dock Flotante Inferior (Floating Island)
* Centrado horizontalmente en la parte inferior del viewport.
* Elementos del Dock:
  1. **+ Actividad:** Despliega un popover flotante minimalista para registrar rápidamente una actividad (Nombre, Horas, Áreas, Temperatura con slider elegante).
  2. **Aspectos:** Menú flotante para activar/desactivar áreas o agregar nuevas.
  3. **Filtros & Vista:** Toggles rápidos para ocultar etiquetas y trazos de áreas.
  4. **Físicas:** Botón play/pause y centrar vista.
* Al presionar una acción del dock, se despliega una tarjeta flotante estilo *spotlight/popover* sin bloquear el resto de la pantalla.
* Soporte para atajos de teclado (`Cmd/Ctrl + K`, `Escape` para cerrar, `Space` para pausar física).

---

## 5. Plan de Ejecución del Refactor

1. **Tokens y Sistema de Temas:**
   - Crear `src/context/ThemeContext.tsx` con soporte para `linear`, `zen`, `editorial`, `hacker`.
   - Adaptar variables CSS y paletas en `src/index.css` y `tailwind.config.js`.
2. **Rediseño del GraphCanvas:**
   - Actualizar SVG render para trazos de 1px fluidos y nodos tipo constelación con halos en hover.
   - Retirar elementos toscos de la leyenda e integrarlos como micro-anotaciones en el lienzo.
3. **Reemplazo del Sidebar por el Dock Flotante:**
   - Crear `src/components/FloatingDock.tsx` y popovers modulares.
   - Refactorizar `src/components/TopBar.tsx` para una presencia ultra-etérea y ligera.
4. **Pruebas y Verificación de Compilación:**
   - Verificar compilación limpia sin advertencias (`npm run build`).
