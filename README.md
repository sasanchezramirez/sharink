# Sharink 🌌

Visualizador espacial de actividades diarias y distribución del tiempo basado en grafos dinámicos con físicas (estilo Obsidian) y mapa de calor vital en el espectro electromagnético.

---

## 🚀 Características Implementadas

* **CA1. Grafo Dinámico:** Simulación de físicas con D3 (`d3-force`), colisiones orgánicas, atracción hacia centros de aspectos de vida y repulsión natural. Arrastre de nodos, zoom y paneo continuo.
* **CA2. Proporcionalidad del Tiempo:** Nodos circulares con radio proporcional a las horas dedicadas a cada actividad.
* **CA3. Tooltip e Información en Hover:** Tarjetas emergentes interactivas con el nombre de la actividad, horas dedicadas, áreas de vida asociadas, temperatura y notas reflexivas.
* **CA4. Agrupación por Aspectos de Vida (Hulls):** Regiones sombreadas orgánicas con degradados para actividades que pertenecen a la intersección de varios aspectos. Leyenda dinámica.
* **CA5. Temperatura Vital (Espectro EM):** Mapeo continuo de color desde **Rojo (-5, drenante/negativo)** hasta **Azul (+5, positivo/flujo)** pasando por verde y neutro.
* **CA6. Toolbar Lateral de Simulación:** Panel para añadir nuevas actividades en tiempo real con slider interactivo de temperatura y selector de aspectos.
* **CA7. Herramientas de Visualización y Gestión:** Añadir nuevos aspectos de vida con colores personalizables, ocultar/mostrar etiquetas, ocultar sombras y filtros por área.
* **Asunción A1. Multi-vista Temporal:** Selector para navegar entre vista de **Día**, **Semana**, **Mes** y acumulado **Global**.

---

## 🛠️ Ejecución Local

```bash
cd Projects/sharink
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

Para compilar para producción:
```bash
npm run build
```

---

## 📁 Estructura del Proyecto

* `SPEC.md`: Especificación técnica y funcional aprobada.
* `src/components/GraphCanvas.tsx`: Motor de simulación física D3, renderizado SVG, hulls suavizados y degradados.
* `src/components/Toolbar.tsx`: Barra lateral tipo simulador (CA6, CA7).
* `src/components/TopBar.tsx`: Cabecera con selector multi-vista (Día/Semana/Mes/Global), fecha y contador de 24h.
* `src/components/EditActivityModal.tsx`: Modal para editar o eliminar actividades al hacer clic sobre un nodo.
* `src/utils/colors.ts`: Interpolación de color del espectro electromagnético.
* `src/utils/storage.ts`: Persistencia en `localStorage` y datos semilla iniciales.
