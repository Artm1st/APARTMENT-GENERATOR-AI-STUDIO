# Hybrid Qualitative Encoder — política de costo y trazabilidad

## Objetivo

Conservar una experiencia humana y cualitativa sin convertir cada respuesta del usuario en una llamada a IA. El sistema debe obtener la mayor parte del `HouseholdDesignProfile` mediante lógica local, reproducible y auditable.

## Regla de arquitectura

```text
Cuestionario estructurado
        ↓
Encoder determinista (0 tokens)
        ↓
Perfil + confianza
        ↓
¿Hay texto libre útil o baja confianza?
        ├── No → continuar sin IA
        └── Sí → una sola interpretación semántica corta
                    ↓
               Profile Fusion
                    ↓
          HouseholdDesignProfile
```

## Distribución objetivo aproximada

- 80 % determinista: cuestionario, scores, reglas, geometría, RNE, ranking.
- 15 % IA ligera: interpretación opcional de texto libre o ambigüedad.
- 5 % IA generativa: síntesis de programa/estrategias y explicaciones cuando realmente aporten valor.

No es una cuota rígida; es una orientación de diseño del software.

## Encoder determinista

Las respuestas cualitativas se convierten a variables normalizadas sin IA.

Ejemplos internos:

```text
low    → 0.25
medium → 0.60
high   → 0.90
```

Variables como privacidad o adaptabilidad pueden combinar varias respuestas con pesos explícitos. El usuario nunca necesita ver números si no desea hacerlo.

Cada métrica conserva:

- valor;
- confianza;
- fuente (`questionnaire`, `semantic_ai`, `fused`);
- evidencia breve.

## Confianza y decisión de gastar tokens

El sistema calcula `structuredConfidence` según completitud de respuestas obligatorias.

La IA semántica se recomienda únicamente cuando:

1. el perfil estructurado tiene confianza menor a 0.85; o
2. existe una narrativa familiar opcional con suficiente información (mínimo 24 caracteres tras normalización).

Un cuestionario completo sin texto libre puede resolverse con **0 llamadas de IA** para esta etapa.

## Narrativa familiar opcional

Pregunta prevista:

> ¿Hay algo importante sobre cómo vive tu familia que no hayamos preguntado?

Máximo: 800 caracteres.

La narrativa sirve para capturar circunstancias difíciles de expresar en opciones cerradas, por ejemplo:

- independencia parcial de un adulto mayor;
- supervisión visual de niños;
- horarios incompatibles;
- actividades domésticas especiales;
- mascotas;
- formas particulares de convivencia.

## Llamada semántica ligera

La llamada recibe únicamente:

- texto libre normalizado (≤800 caracteres);
- nombres de las métricas permitidas;
- una instrucción breve para extracción estructurada.

No recibe:

- RNE completo;
- bibliografía;
- geometría del plano;
- historial de conversación;
- todos los candidatos generados;
- documentación extensa del proyecto.

Salida esperada:

```json
{
  "metrics": {
    "privacy": 0.8,
    "socialLiving": 0.7
  },
  "confidence": 0.9,
  "evidence": {
    "privacy": ["adulto mayor requiere independencia"]
  }
}
```

Las métricas sin evidencia suficiente se omiten.

## Fusión

Por defecto:

```text
70 % cuestionario estructurado
30 % interpretación semántica
```

La IA enriquece; no sustituye una respuesta explícita. El peso semántico debe permanecer configurable y limitado.

## Caché

Antes de producción se debe calcular un hash del perfil + narrativa. Si el usuario vuelve a generar alternativas sin cambiar esas entradas, debe reutilizarse la interpretación previa en vez de volver a llamar al modelo.

## Separación de responsabilidades

```text
IA semántica
→ interpretar lenguaje humano ambiguo

Código determinista
→ métricas, fusión, reglas, RNE, geometría, scoring y trazabilidad
```

La aplicación debe seguir funcionando con un perfil estructurado aunque el servicio de IA no esté disponible.

## Métricas iniciales

- `privacy`
- `socialLiving`
- `adaptability`
- `accessibility`
- `cooking`
- `storage`
- `costSensitivity`
- `remoteWork`
- `visitorExposure`

Estas métricas son variables de diseño, no indicadores normativos.

## Próximos pasos

1. Conectar el encoder al flujo del cuestionario UI.
2. Persistir/cachar el perfil y la interpretación semántica.
3. Convertir las métricas en pesos para `DesignProtocolEvaluator`.
4. Detectar contradicciones importantes y pedir una aclaración puntual en lugar de hacer más llamadas a IA.
5. Medir uso real de tokens por sesión antes de optimizar prematuramente.
