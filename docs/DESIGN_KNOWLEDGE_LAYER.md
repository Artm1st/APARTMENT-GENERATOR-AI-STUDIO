# Design Knowledge Layer — arquitectura de conocimiento para Engine v2

## Objetivo

La aplicación no debe limitarse a encajar ambientes ni a aprobar chequeos normativos. Su objetivo es producir propuestas habitables, explicables y técnicamente viables para familias que normalmente no tienen acceso a información arquitectónica especializada.

La calidad del diseño se construirá con capas separadas para evitar confundir obligaciones legales, buenas prácticas, preferencias familiares y requisitos de información BIM.

## Jerarquía de decisión

```text
1. Restricciones obligatorias
   RNE + parámetros urbanísticos + condiciones del lote

2. Habitabilidad y desempeño
   circulación, privacidad, accesibilidad, iluminación, ventilación,
   mobiliario, almacenamiento, acústica, eficiencia de servicios

3. Estrategia de habitar
   composición familiar, rutinas, visitantes, cocina, trabajo en casa,
   convivencia, intimidad, crecimiento y construcción progresiva

4. Diseño arquitectónico
   gradientes, umbrales, secuencias, centralidades, patios, núcleos,
   relación interior-exterior, flexibilidad y carácter espacial

5. BIM / información
   estructura semántica, requisitos de información, clasificación,
   trazabilidad, IFC y entregables
```

Una solución solo puede llamarse **viable** cuando cumple la capa 1. Las capas 2–4 determinan su calidad arquitectónica. La capa 5 hace que el producto sea trazable e interoperable; no sustituye el diseño.

## Fuentes normativas y oficiales prioritarias

### Perú — normativa de diseño

- Reglamento Nacional de Edificaciones (RNE), Ministerio de Vivienda, Construcción y Saneamiento.
- Norma Técnica A.010 — Condiciones Generales de Diseño, RM N.° 191-2021-VIVIENDA.
- Norma Técnica A.020 — Vivienda, RM N.° 188-2021-VIVIENDA.
- Norma Técnica A.120 — Accesibilidad Universal en Edificaciones y modificaciones vigentes.
- Guía para el diseño de viviendas accesibles, RM N.° 228-2026-VIVIENDA.
- Parámetros urbanísticos y edificatorios municipales: siempre deben ser inputs del proyecto y no inferencias del modelo.

### Perú — BIM

Para un producto orientado principalmente al contexto peruano, la referencia BIM primaria debe ser **Plan BIM Perú / Guía Nacional BIM**, porque adapta ISO 19650 al contexto de inversiones públicas peruanas y proporciona formatos de requisitos de información y matriz de Nivel de Información Necesaria.

Planbim Chile puede conservarse como referencia secundaria de interoperabilidad y como antecedente metodológico, especialmente en TDI/NDI e intercambio IFC, pero no debería sustituir el marco peruano cuando el proyecto está ubicado en Perú.

### Chile — referencia interoperable

- Estándar BIM para Proyectos Públicos, Planbim CORFO Chile, v1.1 (2019).

La arquitectura del software debe permitir adapters de jurisdicción (`PE`, `CL`) para evitar mezclar requisitos de países distintos.

## Corpus de diseño arquitectónico inicial

No se almacenarán capítulos completos ni contenido protegido. El sistema guardará **principios parafraseados**, cada uno acompañado de su referencia bibliográfica y alcance.

### Habitar, relaciones sociales y configuración espacial

- Bill Hillier & Julienne Hanson — *The Social Logic of Space*.
- Herman Hertzberger — *Lessons for Students in Architecture*.

Aplicaciones computables:

- gradiente público → semi-privado → privado;
- profundidad desde ingreso hasta espacios íntimos;
- evitar dormitorios como espacios de paso;
- legibilidad de accesos y umbrales;
- integración/segregación relativa de espacios.

### Patrones de habitabilidad

- Christopher Alexander et al. — *A Pattern Language*.

Aplicaciones computables:

- núcleo social reconocible;
- transición entre interior y exterior;
- espacios intermedios;
- relación entre cocina y convivencia;
- luz, orientación y escala doméstica.

No se usarán los patrones como recetas rígidas. Se convertirán en heurísticas contextuales con pesos ajustables.

### Adaptabilidad y vivienda evolutiva

- N. John Habraken — *Supports: An Alternative to Mass Housing* y principios de Open Building.

Aplicaciones computables:

- distinguir soporte estable de particiones adaptables;
- detectar zonas potenciales de ampliación;
- favorecer instalaciones agrupadas para permitir cambios futuros;
- habitaciones con proporciones reutilizables;
- capacidad de subdividir/integrar sin inutilizar la circulación.

## Perfil de hogar

La siguiente versión del asistente no debería preguntar únicamente “cuántos dormitorios”. Debe construir un `HouseholdDesignProfile` simplificado.

Ejemplos de preguntas no técnicas:

- ¿Cuántas personas vivirán normalmente aquí?
- ¿Es una familia nuclear, multigeneracional o vivienda compartida?
- ¿Reciben visitas con frecuencia?
- ¿La cocina es un espacio social o principalmente de servicio?
- ¿Alguien necesita trabajar o estudiar regularmente desde casa?
- ¿Esperan que la vivienda crezca en el futuro?
- ¿Prefieren mayor privacidad o espacios más integrados?
- ¿La construcción será completa o por etapas?
- ¿Quieren priorizar accesibilidad universal desde el inicio?

Estas respuestas no dibujan directamente el plano: modifican pesos, relaciones y estrategias que luego evalúa el motor.

## Protocolos de evaluación propuestos

### P1 — Acceso y recorrido

- todo ambiente principal debe ser alcanzable desde el ingreso por una red continua de puertas;
- dormitorios no deben funcionar como paso obligado hacia otros espacios;
- recorridos de servicio deben evitar atravesar zonas privadas cuando exista una alternativa razonable;
- penalizar circulación residual excesiva.

### P2 — Privacidad

Medir `privacy depth` desde el acceso:

```text
ingreso → social → transición → privado
```

Una solución donde dormitorio y baño íntimo se exponen directamente al ingreso recibe penalización aunque geométricamente sea válida.

### P3 — Vida familiar

Evaluar si el núcleo social responde al perfil familiar:

- sala/comedor/cocina abierta, semiabierta o separada según preferencias;
- visibilidad y proximidad cuando hay convivencia intensa;
- posibilidad de aislar cocina cuando la familia prioriza olores/ruido/servicio.

No existe una única planta “correcta”. El motor debe producir familias tipológicas distintas.

### P4 — Adaptabilidad

Crear un `AdaptabilityScore` basado en:

- habitaciones con proporciones reutilizables;
- estructura de circulación que sobreviva a cambios de uso;
- núcleos húmedos compactos;
- posibilidad de separar o unir espacios;
- reserva de borde para ampliación en vivienda unifamiliar;
- accesibilidad a instalaciones sin demoler grandes áreas.

### P5 — Accesibilidad y ciclo de vida

Cuando se active prioridad universal/enhanced:

- rutas sin barreras;
- dimensiones de maniobra verificables;
- dormitorio y baño esencial accesibles;
- posibilidad de uso autónomo de espacios principales.

Las dimensiones concretas deben provenir del Rule Registry oficial correspondiente, no de heurísticas bibliográficas.

### P6 — Viabilidad normativa

La UI debe distinguir claramente:

```text
✓ Cumple regla verificada
△ Requiere parámetro municipal
○ Recomendación de diseño
★ Preferencia familiar
```

Nunca mostrar “Cumple RNE” si faltan datos que el RNE o la municipalidad necesitan para verificar el caso.

### P7 — BIM

BIM se aplicará después de estabilizar la geometría:

- Project / Site / Building / Storey;
- Spaces, Walls, Doors, Windows con IDs persistentes;
- clasificación y properties con procedencia;
- Nivel de Información Necesaria por uso/entregable;
- exportación IFC real;
- DXF se mantiene como CAD y no se etiqueta como IFC.

## Explicabilidad para usuarios no arquitectos

Cada alternativa debería poder responder:

> ¿Por qué esta planta está recomendada?

Ejemplo:

```text
Alternativa A — 86/100

Viabilidad
✓ Sin solapamientos
✓ Dentro del área edificable
✓ Todos los ambientes conectados
△ Falta confirmar parámetro municipal de área libre

Habitar
✓ Zona social cerca del ingreso
✓ Dormitorios protegidos de visitas
✓ Cocina conectada al comedor
△ Lavandería tiene recorrido largo

Adaptabilidad
✓ Dormitorio secundario puede convertirse en estudio
✓ Núcleo húmedo agrupado
○ Posible ampliación posterior hacia patio posterior

BIM
✓ Espacios y vanos tienen IDs persistentes
○ IFC todavía no generado
```

La app debe enseñar mientras diseña, sin intentar reemplazar al arquitecto cuando el proyecto requiera desarrollo profesional, cálculo, especialidades o licencia.

## Próximos componentes de software

1. `DesignKnowledgeRegistry` — principios con provenance.
2. `HouseholdDesignProfile` — necesidades del hogar.
3. `DesignProtocolEvaluator` — evaluadores por dimensión.
4. `RuleRegistry` — RNE y parámetros con versiones.
5. `JurisdictionAdapter` — Perú / Chile sin mezclar reglas.
6. `DesignExplanation` — explica score y trade-offs.
7. `TypologyStrategy` — genera alternativas realmente distintas: lineal, patio, núcleo central, banda de servicios, etc.
8. `BimInformationProfile` — requisitos de información independientes del score arquitectónico.

## Principio de producto

La herramienta no debe prometer “diseño automático perfecto”. Su valor es democratizar una primera capa de conocimiento arquitectónico: ayudar a una familia a entender restricciones, comparar opciones y partir de una propuesta espacial razonable, trazable y adaptable antes de pasar a desarrollo técnico profesional.
