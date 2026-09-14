# Design Knowledge Layer — arquitectura de conocimiento para Engine v2

## Objetivo

La aplicación no debe limitarse a encajar ambientes ni a aprobar chequeos normativos. Su objetivo es producir propuestas habitables, explicables y técnicamente orientadas para familias que normalmente no tienen acceso a información arquitectónica especializada.

La prioridad de esta etapa será **familia + habitar + diseño arquitectónico + RNE**. BIM queda explícitamente fuera del alcance funcional actual hasta que exista un modelo técnico suficientemente maduro para justificarlo.

## Jerarquía de decisión

```text
1. Perfil familiar y forma de habitar
   composición del hogar, rutinas, privacidad, visitas, cocina,
   trabajo/estudio en casa, crecimiento, accesibilidad, presupuesto

2. Restricciones obligatorias
   RNE + parámetros urbanísticos + condiciones del lote

3. Habitabilidad y desempeño
   circulación, privacidad, accesibilidad, iluminación, ventilación,
   mobiliario, almacenamiento, acústica y eficiencia de servicios

4. Estrategia de diseño arquitectónico
   gradientes, umbrales, secuencias, centralidades, patios, núcleos,
   relación interior-exterior, flexibilidad y carácter espacial

5. Generación y evaluación
   tipologías distintas → candidatos → validación → explicación
```

Una solución solo puede llamarse **viable** cuando cumple la capa 2 con los datos disponibles. Las capas 1, 3 y 4 determinan su calidad arquitectónica y pertinencia para la familia.

## BIM fuera del alcance actual

Por decisión de producto, BIM no se usará en esta etapa como etiqueta comercial, criterio de score ni promesa de interoperabilidad. La aplicación actual todavía no representa con suficiente rigor un modelo técnico BIM completo, y forzar esa capa puede introducir complejidad sin mejorar la calidad del prediseño residencial.

Se mantiene únicamente como posible línea futura cuando existan:

- topología y semántica constructiva maduras;
- niveles, estructura y elementos persistentes;
- modelado técnico más completo;
- exportación IFC real;
- flujo probado con software especializado.

Hasta entonces, la interfaz debe hablar de **prediseño arquitectónico**, **viabilidad preliminar** y **chequeo RNE**, no de cumplimiento BIM.

## Fuentes normativas y oficiales prioritarias

### Perú — normativa y habitabilidad

- Reglamento Nacional de Edificaciones (RNE), Ministerio de Vivienda, Construcción y Saneamiento.
- Norma Técnica A.010 — Condiciones Generales de Diseño, RM N.° 191-2021-VIVIENDA.
- Norma Técnica A.020 — Vivienda, RM N.° 188-2021-VIVIENDA.
- Norma Técnica A.120 — Accesibilidad Universal en Edificaciones y modificaciones vigentes.
- Guía para el diseño de viviendas accesibles, RM N.° 228-2026-VIVIENDA.
- Parámetros urbanísticos y edificatorios municipales: siempre deben ser inputs del proyecto y no inferencias del modelo.

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

## Entrada principal: cuestionario familiar

La siguiente versión del asistente no debe comenzar preguntando solamente por dormitorios o metros cuadrados. Debe construir primero un `HouseholdDesignProfile` mediante preguntas simples y cotidianas.

Ejemplos:

- ¿Cuántas personas vivirán normalmente aquí?
- ¿Cómo está compuesto el hogar: una persona, pareja, familia, multigeneracional o compartido?
- ¿Reciben visitas con frecuencia?
- ¿Prefieren una casa muy integrada o con mayor privacidad?
- ¿La cocina es un espacio social o principalmente de servicio?
- ¿Alguien trabaja o estudia regularmente desde casa?
- ¿Esperan que el hogar crezca o cambie en los próximos años?
- ¿La vivienda se construirá completa o por etapas?
- ¿Quieren priorizar accesibilidad desde el inicio?
- ¿Necesitan mucho almacenamiento?
- ¿El presupuesto inicial debe ser especialmente contenido?

Las respuestas no dibujan directamente el plano. Se transforman en **pesos de diseño, relaciones funcionales y estrategias tipológicas**.

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
- posibilidad de aislar cocina cuando la familia prioriza olores/ruido/servicio;
- capacidad de recibir visitas sin invadir dormitorios.

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
```

La app debe enseñar mientras diseña, sin intentar reemplazar al arquitecto cuando el proyecto requiera desarrollo profesional, cálculo, especialidades o licencia.

## Próximos componentes de software

1. `DesignKnowledgeRegistry` — principios con provenance.
2. `HouseholdQuestionnaire` — preguntas no técnicas para la familia.
3. `HouseholdDesignProfile` — síntesis de necesidades y preferencias.
4. `DesignProtocolEvaluator` — evaluadores por dimensión.
5. `RuleRegistry` — RNE y parámetros con versiones.
6. `DesignExplanation` — explica score y trade-offs.
7. `TypologyStrategy` — genera alternativas realmente distintas: lineal, patio, núcleo central, banda de servicios, vivienda evolutiva, etc.

## Principio de producto

La herramienta no debe prometer “diseño automático perfecto”. Su valor es democratizar una primera capa de conocimiento arquitectónico: ayudar a una familia a entender restricciones, comparar opciones y partir de una propuesta espacial razonable, trazable y adaptable antes de pasar a desarrollo técnico profesional.
