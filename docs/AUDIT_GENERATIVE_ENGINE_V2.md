# Auditoría técnica — Generative Engine v2

Fecha de revisión: 2026-09-14

Rama de trabajo: `refactor/generative-engine-v2`

## Resumen ejecutivo

La aplicación ya tiene una base valiosa: editor 2D, visualización Three.js, generación asistida por Gemini, relajación espacial, validadores preliminares y exportación DXF/SVG. El problema principal no está en la interfaz sino en el modelo de datos y en la separación de responsabilidades.

Actualmente se mezclan cuatro conceptos distintos:

1. Programa arquitectónico (qué espacios existen y qué relaciones se desean).
2. Geometría real (muros, caras, contactos, vanos y circulación).
3. Normativa (RNE y parámetros urbanísticos aplicables al proyecto concreto).
4. Metadatos BIM/intercambio (IFC, NDI, TDI, clasificación y propiedades).

El resultado es que el sistema puede declarar una solución como conectada, ventilada, conforme RNE o compatible BIM sin que la geometría demuestre esas condiciones.

---

## P0 — Críticos antes de presentar la app como normativa/BIM

### P0.1 — El validador RNE contiene reglas presentadas como obligaciones sin trazabilidad suficiente

Archivo: `src/utils/validators.ts`

- Se codifican áreas mínimas de dormitorio principal = 9 m², dormitorio secundario = 6 m², cocina = 4.5 m², sala/comedor = 10 m² y baño = 1.6 m² como si fueran reglas directas de A.020.
- La A.020 vigente (RM 188-2021-VIVIENDA) establece en su art. 10 que las dimensiones deben ser suficientes para mobiliario, circulación, actividades y evacuación; no conviene presentar todos esos umbrales internos como si fueran literalmente el artículo citado.
- El código atribuye iluminación/ventilación al “Art. 16”; en la RM 188-2021-VIVIENDA esa exigencia está en el art. 12.4. El art. 16 trata ascensores.
- El código solo comprueba 10% de área nominal de ventana y no comprueba correctamente la abertura efectiva mínima hacia exterior del 5%.
- Una ventana se contabiliza aunque esté sobre un muro interior o contra otro ambiente.

Fuente jurídica base vigente consultada: RM 188-2021-VIVIENDA / Norma Técnica A.020. El MVCS mantiene A.020 RM 188-2021 en su listado RNE; la RM 214-2025-VIVIENDA publicó un proyecto de modificación, por lo que no debe sustituirse automáticamente la norma vigente por ese proyecto.

Acción: crear un `RuleRegistry` versionado con `source`, `article`, `status` (`mandatory`, `project_parameter`, `design_recommendation`) y fecha/versión normativa.

### P0.2 — Los retiros y el “coeficiente máximo de edificación” no pueden inferirse genéricamente del RNE

Archivos: `src/App.tsx`, `src/utils/generators.ts`, `src/utils/validators.ts`

- La app inicia con retiros fijos 4.0 / 2.0 / 1.5 / 1.5 m.
- El generador aleatorio también inventa retiros a partir de listas.
- El validador llama “Coeficiente Máximo de Edificación” a una comparación contra el área rectangular entre retiros.
- El comentario habla de “70%”, pero el código falla recién al superar 100% del área edificable y advierte al 90%.

Estos valores dependen de parámetros urbanísticos, zonificación, certificado municipal y tipología; deben ser inputs de proyecto, no una regla nacional inventada.

Acción: separar `SiteConstraints` de `RneRules` y exigir procedencia de los parámetros del lote.

### P0.3 — “Plan BIM Chile / IFC” es actualmente metadata decorativa, no interoperabilidad BIM

Archivos: `src/utils/validators.ts`, `src/utils/exporters.ts`, `src/components/EditorSidebar.tsx`

- El DXF escribe comentarios como `IfcProject`, `IfcWallStandardCase`, `IfcSpace`, etc., pero no crea un archivo IFC.
- Los códigos `BIM_ESP_PRIV_DORM`, `BIM_COM_VANO_PUERTA`, etc. están codificados localmente y no deben presentarse como códigos oficiales sin mapearlos a la matriz oficial correspondiente.
- La interfaz afirma que cada componente posee identificadores IFC y garantiza compatibilidad CAD/BIM, aunque los objetos no tienen GlobalId IFC, relaciones espaciales, placement IFC, property sets IFC ni jerarquía Project/Site/Building/Storey.
- `NDI 2 (Conceptual)` / `NDI 3 (Técnico)` se asigna por tipo de componente en lugar de derivarse de los requisitos de información, etapa, TDI y matriz aplicable.

Acción: renombrar temporalmente esta función como “Preparación de metadatos BIM” y no “cumplimiento IFC”. Implementar IFC real después de estabilizar la topología geométrica.

### P0.4 — No existe una topología de muros compartidos

Archivos: `src/components/FloorPlanCanvas.tsx`, `src/components/ThreeDView.tsx`, `src/utils/exporters.ts`

Cada ambiente es un rectángulo cerrado con cuatro paredes propias.

Consecuencias:

- Dos ambientes adyacentes generan dos muros superpuestos.
- Una puerta puede abrir un muro del ambiente A mientras el muro duplicado de B permanece sólido.
- El DXF dibuja perímetros cerrados por habitación, no un sistema de muros arquitectónicos.
- No existe una entidad única de muro compartido ni una cara exterior/interior comprobable.

Acción: introducir topología `WallSegment`, `SpaceBoundary`, `Opening` y `AdjacencyEdge` derivada de geometría.

### P0.5 — Ventanas y puertas generadas sin comprobar el muro real

Archivo: `server.ts`

Después de la respuesta de Gemini:

- Las puertas se asignan cíclicamente a `bottom`, `top`, `left`, `right` según índice de conexión.
- Las ventanas se añaden por defecto en `top` con offset aleatorio.
- No se verifica si una puerta enfrenta al `targetRoomId`.
- No se verifica si una ventana da al exterior, retiro o pozo de luz.

Acción: Gemini debe devolver relaciones y requisitos, no caras de muro. Los vanos deben crearse después del layout, usando segmentos compartidos/exteriores reales.

---

## P1 — Fallos funcionales del motor geométrico

### P1.1 — La relajación magnética no garantiza una planta válida

Archivo: `src/utils/physics.ts`

El algoritmo resuelve fuerzas entre centros y bounding boxes. Una conexión lógica se interpreta como atracción, pero no se exige longitud mínima de contacto ni se comprueba conectividad peatonal.

Acción: usar la física solo como heurística inicial. El resultado debe pasar por un `constraint solver` / optimizador discreto con condiciones de aceptación.

### P1.2 — La generación se detiene por tiempo, no por convergencia

Archivo: `src/App.tsx`

Después de generar se activa la física y se detiene aproximadamente a los 1.8 s. No existe un criterio basado en energía, número de colisiones, cumplimiento de adyacencias o mejora de score.

Acción: `solveUntilStable(maxIterations, tolerance)` y aceptar únicamente candidatos cuyo score supere umbrales.

### P1.3 — Las conexiones pueden quedar asimétricas o rotas

Archivos: `src/components/EditorSidebar.tsx`, `src/App.tsx`

- Cambiar una conexión manual modifica solo el ambiente seleccionado.
- Eliminar un ambiente no limpia los IDs de `connections` de los demás ni los `targetRoomId` de puertas.

Acción: administrar relaciones mediante un grafo central con operaciones `connect`, `disconnect`, `removeNode`.

### P1.4 — El “dibujador de pasillos” conecta por proximidad, no por intersección/contacto

Archivo: `src/components/FloorPlanCanvas.tsx`

Los tres centros de ambientes más cercanos dentro de la ordenación se añaden como conexiones aunque el segmento no toque físicamente esos espacios.

Acción: detectar intersección/adyacencia con la geometría del corredor y crear conexiones solo cuando exista contacto válido.

### P1.5 — Resize puede producir estados geométricos inválidos

Archivo: `src/components/FloorPlanCanvas.tsx`

- Los manejadores diagonales sobrescriben cálculos previos y no vuelven a aplicar un mínimo robusto.
- El resize no aplica los límites edificables igual que el movimiento.
- No reubica ni valida vanos/muebles tras cambios de tamaño.

Acción: una única función pura `resizeSpace()` con constraints y validación posterior.

### P1.6 — Mobiliario no valida huella ni circulación

Archivo: `src/components/FloorPlanCanvas.tsx`

El arrastre limita el centro del mueble, no su bounding box rotado. Puede atravesar paredes. Tampoco hay colisión entre muebles, puerta-mueble ni franjas de uso/maniobra.

Acción: bounding boxes rotados + clearances por tipo de mueble.

### P1.7 — El fallback de IA puede ocultar el fallo real

Archivo: `server.ts`

Si Gemini falla, la API genera silenciosamente un programa procedural y responde como plano válido. Esto dificulta diagnosticar errores de API/modelo y puede confundir al usuario.

Acción: devolver `generationSource: "gemini" | "procedural-fallback"` y mostrarlo en UI.

### P1.8 — Endpoint generativo sin controles para despliegue público

Archivo: `server.ts`

No hay autenticación, rate limiting, cuotas por sesión ni límites de prompt/proyecto. Si se publica, terceros pueden consumir la cuota de Gemini mediante `/api/generate-floorplan`.

Acción: antes de producción agregar rate limiting, validación de payload, límites de tamaño y política de cuota/autenticación según el modo de publicación.

---

## P2 — Calidad, reproducibilidad y mantenimiento

### P2.1 — Aleatoriedad no reproducible

Se utiliza `Math.random()` para generación, ventanas, posiciones y IDs. Un mismo input no genera un caso reproducible para depuración.

Acción: introducir `seed` y PRNG determinista.

### P2.2 — No existe suite de tests

`package.json` no incluye framework de pruebas; `lint` es solo `tsc --noEmit`.

Prioridad de tests:

1. geometría de contactos;
2. colisiones;
3. vanos exteriores/interiores;
4. reglas RNE con fixtures;
5. graph integrity;
6. exportación DXF;
7. snapshots de programas generados.

### P2.3 — TypeScript permisivo

`tsconfig.json` no activa `strict`, `noUncheckedIndexedAccess`, etc. Además el backend usa `any` en puntos críticos del plan generado.

Acción: schemas runtime + TypeScript strict progresivo.

### P2.4 — El schema de Gemini es insuficiente

`server.ts` pide “posicionamiento inicial” en el system prompt, pero el `responseSchema` no contiene `x` ni `y`; luego el backend ignora cualquier intención espacial y coloca todo alrededor de un círculo de radio 2 m.

Acción: no pedir coordenadas a Gemini. Pedir programa, zonas, prioridades, cardinalidad, restricciones y relaciones con pesos.

---

## P3 — Presentación / visualización

- El muro perimetral y el portón central de 4 m son supuestos visuales fijos.
- La vista 3D reconstruye muros por ambiente y hereda la duplicación topológica.
- La ventana 3D usa geometría de “frame” sólida que puede tapar el vidrio visualmente.
- El nombre del repositorio sugiere “apartment”, pero el modelo actual solo representa una planta sin niveles, escaleras ni `BuildingStorey`.

---

## Arquitectura objetivo v2

```text
User Brief
   ↓
AI Program Interpreter
   ↓
ArchitecturalProgram
   ├── spaces
   ├── zones
   ├── adjacency requirements
   ├── preferences
   └── project constraints
   ↓
Rule Registry
   ├── RNE mandatory rules
   ├── municipal/site parameters
   ├── accessibility/fire rules
   └── design recommendations
   ↓
Candidate Generator
   ↓
Geometry / Topology Engine
   ├── spaces
   ├── walls
   ├── shared boundaries
   ├── exterior boundaries
   ├── openings
   └── circulation graph
   ↓
Validator + Scoring
   ↓
N candidate solutions
   ↓
Best candidates
   ↓
2D / 3D / DXF
   ↓
BIM mapping / IFC exporter
```

## Nuevo contrato de datos propuesto

Gemini no debe generar `Room` directamente. Debe generar un `ArchitecturalProgram` similar a:

```ts
interface ArchitecturalProgram {
  projectType: "single_family_house" | "apartment_unit";
  spaces: ProgramSpace[];
  relations: SpatialRelation[];
  preferences: DesignPreference[];
}

interface ProgramSpace {
  id: string;
  type: SpaceType;
  label: string;
  targetArea?: number;
  minArea?: number;
  minWidth?: number;
  privacy: "public" | "semi_private" | "private" | "service";
  requiresExteriorOpening?: boolean;
}

interface SpatialRelation {
  a: string;
  b: string;
  kind: "must_touch" | "prefer_touch" | "must_not_touch" | "direct_access" | "near";
  weight: number;
}
```

Después, el motor geométrico genera la representación física.

## Score propuesto para candidatos

```text
Hard constraints
- sin solapamientos
- dentro de polígono edificable
- dimensiones normativas verificadas
- accesos válidos
- vanos de ventilación realmente exteriores

Soft score / 100
- 25 adyacencias
- 20 circulación
- 15 compacidad
- 15 iluminación/orientación
- 10 privacidad
- 10 eficiencia de área
- 5 regularidad constructiva
```

Un candidato que falle un hard constraint no se presenta como solución válida.

---

## Orden de implementación recomendado

### Fase 1 — Integridad geométrica

1. Crear tipos de dominio v2.
2. Crear grafo de relaciones bidireccional.
3. Crear detección de contacto/shared boundaries.
4. Crear clasificador de borde interior/exterior.
5. Generar puertas solo sobre muros compartidos.
6. Generar ventanas solo sobre muros exteriores válidos.

### Fase 2 — Normativa trazable

1. Rehacer `validators.ts` como registry de reglas.
2. Corregir referencias A.020.
3. Separar normativa de criterios recomendados.
4. Separar parámetros urbanísticos del RNE.
5. Añadir provenance/versiones.

### Fase 3 — Generación multi-candidato

1. Gemini → `ArchitecturalProgram`.
2. Crear 10–30 candidatos geométricos.
3. Solver + score.
4. Mostrar 3 mejores alternativas.

### Fase 4 — BIM real

1. Modelo de `Project / Site / Building / Storey`.
2. IDs persistentes.
3. Walls/Openings/Spaces semánticos.
4. Property sets y clasificación con fuente verificable.
5. Export IFC real y validación IFC.
6. Mantener DXF como intercambio CAD, sin presentarlo como IFC.

---

## Decisión de producto recomendada

Mientras se implementa v2, la UI debería usar lenguaje prudente:

- “Chequeo preliminar RNE” en vez de “Plano Conforme RNE”.
- “Metadatos BIM preliminares” en vez de “Estándar Plan BIM Chile / compatibilidad IFC garantizada”.
- “Distribución generativa conceptual” en vez de “plano arquitectónico resuelto”.

Esto mantiene el valor de la demo sin afirmar un nivel de validación que el motor todavía no puede demostrar.
