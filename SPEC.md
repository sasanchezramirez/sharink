# Especificación Técnica y Funcional: Sharink

**Proyecto:** Sharink  
**Versión:** 1.0.0  
**Fecha de definición:** 3 de septiembre de 2026  
**Ubicación del proyecto:** `Projects/sharink`

---

## 1. Visión General del Producto

**Sharink** es una aplicación interactiva de análisis y visualización del tiempo que representa las actividades diarias del usuario como nodos circulares dinámicos en un espacio bidimensional gobernado por físicas (estilo grafo de Obsidian).

El objetivo es transformar el registro del tiempo en una experiencia visual, espacial e intuitiva que permita identificar de un vistazo:
1. En qué áreas de la vida se concentra el tiempo (tamaño de los nodos y distribución espacial).
2. Qué impacto o "temperatura" emocional/vital tiene cada actividad (espectro electromagnético: azul positivo a rojo negativo).
3. Cómo interactúan y se intersectan las distintas áreas de la vida cotidiana.

---

## 2. Historia de Usuario y Criterios de Aceptación

### Historia de Usuario
> **Como** usuario de la aplicación Sharink,  
> **necesito** visualizar en forma de distribución espacial nodos que correspondan a las actividades que realizo diariamente en mi vida,  
> **para** poder tener insights claros sobre lo que hago con mi tiempo y cómo afecta mi bienestar.

### Criterios de Aceptación (CA)

* **CA1. Grafo Dinámico:** Los nodos deben existir en un lienzo 2D con física de fuerzas interactiva (atracción, repulsión, inercia), similar al comportamiento del grafo de notas de Obsidian.
* **CA2. Proporción del Nodo:** Cada nodo representa una actividad individual. Su tamaño (radio) es directamente proporcional a la cantidad de horas invertidas.
* **CA3. Tooltip e Información en Hover:** Al posicionar el cursor sobre un nodo, se despliega una tarjeta/tooltip emergente con el nombre de la actividad y la cantidad exacta de horas dedicadas.
* **CA4. Agrupación Espacial por Áreas:** El espacio se subdivide en áreas o aspectos de la vida (ej. Trabajo, Salud, Ocio, Familia). Cada área cuenta con una sombra/región coloreada que agrupa sus nodos. El grafo incluye una leyenda con los colores de cada área. Se soportan degradados visuales para actividades que pertenezcan a la intersección de varias áreas.
* **CA5. Temperatura Vital (Espectro EM):** Cada nodo se colorea según una escala de temperatura que mide el impacto positivo o negativo de la actividad en la vida del usuario, basada en el espectro electromagnético:
  * **Azul / Violeta:** Máximo impacto positivo (+5).
  * **Cian / Verde / Amarillo:** Neutro o balanceado (0).
  * **Naranja / Rojo:** Máximo impacto negativo (-5).
* **CA6. Toolbar Lateral de Simulación:** Barra lateral interactiva que permite registrar nuevas actividades ingresando: nombre, número de horas, áreas de la vida asociadas y el valor en la escala de temperatura.
* **CA7. Herramientas de Gestión y Visualización:** El toolbar también incluye controles para:
  * Crear nuevas áreas/aspectos de la vida.
  * Ocultar o mostrar elementos del grafo (etiquetas de texto, sombras de áreas, filtros por área).

---

## 3. Asunciones y Reglas de Negocio Validadas

| ID | Aspecto | Definición Acordada |
|---|---|---|
| **A1** | **Ventana Temporal** | **Multi-vista:** Selector que permite alternar entre vista diaria (**Día**), consolidado semanal (**Semana**), resumen mensual (**Mes**) y acumulado total (**Global**). |
| **A2** | **Límite de Horas** | **Flexible y permisivo:** No bloquea el registro si la suma excede 24h (para admitir multitarea o aproximaciones), pero despliega un indicador visual de advertencia. |
| **A3** | **Multipertenencia** | Una actividad puede asignarse a una o más áreas de vida. Los nodos con múltiples áreas se sitúan físicamente en la frontera/intersección y usan degradados de color. |
| **A4** | **Selector de Temperatura** | Slider continuo de **-5 (Rojo/Negativo)** pasando por **0 (Verde/Neutro)** hasta **+5 (Azul/Positivo)** con vista previa en tiempo real. |
| **A5** | **Persistencia** | Almacenamiento local automático (**LocalStorage / IndexedDB** en navegador) sin requerir autenticación para una experiencia inmediata tipo sandbox. |
| **A6** | **Interacción por Clic** | Al hacer clic en un nodo se abre un panel lateral para editar todos sus atributos o eliminar la actividad. |
| **A7** | **Controles del Lienzo** | Soporta paneo (arrastrar fondo), zoom continuo (rueda del ratón / pinch), y arrastre manual de nodos (drag & drop) que reacciona con la física. |
| **A8** | **Ocultar Información** | Interruptores (toggles) para conmutar visibilidad de: (1) Nombres en nodos, (2) Sombras de áreas, (3) Nodos de áreas desmarcadas. |
| **A9** | **Nuevas Áreas** | El usuario define nombre y color base (con sugerencia automática de paleta accesible). |
| **A10** | **Enlaces entre Nodos** | Los nodos flotan sin aristas/líneas directas entre ellos; se agrupan por fuerzas de atracción hacia el centroide de su área de vida respectiva. |

---

## 4. Modelo de Datos

```typescript
// Modelo de Área o Aspecto de la Vida
interface LifeArea {
  id: string;              // Identificador único (ej: "area-salud")
  name: string;            // Nombre (ej: "Salud y Deporte")
  color: string;           // Color hexadecimal para sombra y leyenda
  visible: boolean;        // Estado de visualización en el lienzo
}

// Escala de Temperatura (-5 a +5)
type TemperatureScore = number; // Rango [-5, 5]

// Modelo de Actividad / Nodo
interface Activity {
  id: string;              // Identificador único
  name: string;            // Nombre de la actividad (ej: "Gimnasio")
  hours: number;           // Horas dedicadas (determina radio del nodo)
  areaIds: string[];       // 1 o más áreas asociadas (determina posición e intersección)
  temperature: TemperatureScore; // Valor -5 a +5 (determina color EM)
  date: string;            // Fecha en formato ISO YYYY-MM-DD
  notes?: string;          // Notas o reflexiones opcionales
}

// Configuración de Visualización
interface ViewportSettings {
  viewMode: 'day' | 'week' | 'month' | 'global';
  selectedDate: string;
  showLabels: boolean;
  showAreaHulls: boolean;
  activeAreaFilters: string[];
}
```

---

## 5. Arquitectura del Sistema de Físicas y Renderizado

### 5.1 Motor de Simulación (Force-Directed Graph)
Basado en simulación de fuerzas (D3-force / Physics Engine 2D):
* **Fuerza de Centroide por Área (`d3.forceX`, `d3.forceY`):** Cada área de vida posee un punto focal en el lienzo 2D. Las actividades son atraídas hacia el centroide del área correspondiente. Si una actividad pertenece a $N$ áreas, su atracción se calcula hacia el promedio ponderado de sus centroides.
* **Fuerza de Colisión (`d3.forceCollide`):** Evita superposición entre nodos circulares, calculando un radio efectivo: $R = \text{RadioBase} + \sqrt{\text{horas}} \times \text{FactorEscala}$.
* **Fuerza de Repulsión Many-Body (`d3.forceManyBody`):** Permite que los nodos floten orgánicamente y se acomoden sin amontonarse.
* **Arrastre (Drag):** Al arrastrar un nodo, este fija temporalmente su posición (`fx`, `fy`) y recalcula suavemente las posiciones de sus vecinos.

### 5.2 Renderizado de Sombras y Regiones de Áreas (Hulls / Blobs)
* **Cálculo de Regiones:** Se computa un casco convexo (*Convex Hull*) o *Voronoi Cell* suavizado alrededor de los nodos pertenecientes a cada área con un margen de padding.
* **Degradados:** Los nodos pertenecientes a múltiples áreas generan intersecciones visuales donde las capas de sombreado se mezclan mediante modos de fusión (*blend-mode: screen* o degradados radiales/lineales SVG).

### 5.3 Mapeo de Color (Espectro EM)
Función de interpolación continua de color:
$$\text{Color}(T) \quad \text{donde } T \in [-5, +5]$$
* $T = -5$: `#EF4444` (Rojo puro / Infrarrojo cercano)
* $T = -2.5$: `#F97316` (Naranja)
* $T = 0$: `#EAB308` / `#10B981` (Amarillo / Verde neutro)
* $T = +2.5$: `#06B6D4` (Cian)
* $T = +5$: `#3B82F6` a `#6366F1` (Azul profundo / Violeta)

---

## 6. Diseño de Interfaz de Usuario (Layout)

```
+-----------------------------------------------------------------------------------+
|  SHARINK  | [ < Hoy > ] [ Día | Semana | Mes | Global ]        [ Horas: 18.5 / 24h ]|
+-------------------------------------------------------------+---------------------+
|                                                             |  TOOLBAR LATERAL    |
|   ( Lienzo Interactivo 2D con Zoom y Paneo )                |                     |
|                                                             |  [ + Nueva Actividad]
|         .-''''-.                     .-''''-.               |  * Nombre: [      ] |
|       .'  Área  '.                 .'  Área  '.             |  * Horas:  [ 2.5  ] |
|      /  Trabajo   \               /   Salud   \             |  * Áreas:  [x]Salud |
|     |   ( )   (O)  |             |     (o)     |            |  * Temp: [-5====+5] |
|      \    (o)     /               \   ( )     /             |  [ Guardar Nodo   ] |
|       '.        .'                 '.       .'              |---------------------|
|         '-....-'                     '-...-'                |  [ + Nueva Área   ] |
|                       Leyenda:                              |  * Nombre & Color   |
|                 [ ] Trabajo  [ ] Salud  [ ] Ocio            |---------------------|
|                 Escala EM: [ Rojo ---- Azul ]               |  HERRAMIENTAS VISTA |
|                                                             |  [x] Ver Etiquetas  |
|                                                             |  [x] Ver Sombras    |
+-------------------------------------------------------------+---------------------+
```

---

## 7. Plan Tecnológico Sugerido

* **Frontend:** React + Vite con TypeScript.
* **Lienzo y Físicas:** Canvas API o SVG reactivo integrado con `d3-force` y `d3-shape`.
* **Estilos:** Tailwind CSS para una interfaz limpia, moderna y oscura (tipo Obsidian dark mode).
* **Gestión de Estado:** Zustand para control reactivo de actividades, áreas y configuraciones del viewport.
* **Persistencia:** LocalStorage sincronizado automáticamente.
