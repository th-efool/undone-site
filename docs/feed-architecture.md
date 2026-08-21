# Core Architecture: Feed, Chunking, and Vector Recommendation System

This document outlines the theoretical architecture, mathematical formulae, and system design behind the pedagogical recommendation engine. It is designed to provide a high-level conceptual understanding of how content is processed, scored, and served, independent of underlying engineering implementation details.

## 1. Content Ingestion and Chunking

The learning platform does not serve monolithic content. Video and text materials are ingested and decomposed into discrete, atomic units called **Chunks**.

### The Chunk Model
A Chunk represents a conceptually isolated segment of learning material (e.g., a 2-minute explanation of a specific theorem, or a single coding exercise).

During ingestion:
1. The source material is segmented based on topical boundaries.
2. An AI pipeline evaluates each chunk against a predefined 12-dimensional pedagogical framework.
3. The evaluation yields a normalized feature vector for each chunk, mapping to continuous values between `0.0` and `1.0`.

## 2. Pedagogical Vector Space

Both the user's intent (represented by selected Channels) and the content (Chunks) exist in the same 12-dimensional continuous vector space. 

### Dimensions
The 12 dimensions are categorized into cognitive, structural, and behavioral traits:
- **Novelty** (Familiar -> Unfamiliar)
- **Scope** (Micro -> Macro)
- **Depth** (High-Level -> Deep)
- **Rigor** (Intuitive -> Theoretical)
- **Format** (Story -> Fact)
- **Density** (Light -> Dense)
- **Pacing** (Slow -> Fast)
- **Guidance** (Step-by-step -> Open-ended)
- **Constraint** (Blueprint -> Blank-canvas)
- **Abstraction** (Concrete -> Abstract)
- **Continuity** (Standalone -> Sequential)
- **Connectivity** (Singular -> Synthesis)

### The Target Vector Calculation
When a user requests a feed, the system calculates an ideal **Target Vector** based on three components:
1. **The Base Channel Vector**: The baseline matrix for the selected channel (e.g., the "Spark" channel naturally favors high novelty and low density).
2. **User Preferences**: Local modifiers chosen by the user. To prevent the algorithm from collapsing under extreme user inputs, these preferences are mathematically bounded.
3. **Chronobiological Shift (Time of Day)**: Modifies cognitive load dimensions based on human circadian rhythms.

**Target Vector Formula:**
Let $V_{base}$ be the channel's baseline vector.
Let $\Delta_{user}$ be the user's preference offset vector.
Let $W_{max}$ be the maximum allowed user influence weight (e.g., $0.25$).
Let $\Delta_{time}$ be the chronobiological offset vector.

$$ V_{target} = V_{base} + (\Delta_{user} \times W_{max}) + \Delta_{time} $$

*Note: The resulting $V_{target}$ is clamped strictly between `0.0` and `1.0`.*

## 3. Similarity Scoring & Retrieval

The system searches the database for chunks whose vectors most closely align with $V_{target}$.

### Cosine Similarity
The mathematical similarity between a candidate chunk vector $V_{chunk}$ and the target vector $V_{target}$ is computed using Cosine Similarity:

$$ \text{Similarity}(V_{chunk}, V_{target}) = \frac{V_{chunk} \cdot V_{target}}{||V_{chunk}|| \times ||V_{target}||} $$

This yields a base relevance score between `-1.0` and `1.0`.

### Weighted Composition
Because chunks belong to parent lessons, the final structural vector of a chunk is a weighted interpolation of its specific isolated vector and the broader context of its parent lesson.

Let $V_{lesson}$ be the vector of the parent video/lesson.
Let $W_{blend}$ be the time-blend weight (e.g., $0.30$ or $30\%$).

$$ V_{final} = (V_{lesson} \times W_{blend}) + (V_{chunk} \times (1 - W_{blend})) $$

This guarantees that a highly technical chunk inside a generally casual video retains some of its casual context.

## 4. Feed Engine and Anti-Fatigue Interleaving

Returning the raw top matches from the Cosine Similarity calculation would result in an optimal, but exhausting, user experience. The Feed Engine acts as a post-processing layer to inject progression logic and cognitive variation.

### Progression Gating
Sequential content is topologically sorted. If Chunk A is a prerequisite for Chunk B, the engine mathematically penalizes or excludes Chunk B from the feed until the user's progress state indicates Chunk A is completed.

### Anti-Fatigue Math
The engine tracks the cumulative cognitive load of the recently served chunks. If the moving average of the `rigor` or `density` dimensions exceeds a fatigue threshold, the engine temporarily penalizes dense candidates and boosts "palate cleanser" chunks.

Let $C_{fatigue}$ be the current accumulated cognitive load.
Let $P_{penalty}$ be the dynamic penalty applied to high-load candidates.

If $C_{fatigue} > \text{Threshold}$, then for all candidates where $V_{density} > 0.7$:
$$ \text{Final Score} = \text{Similarity Score} - P_{penalty} $$

## 5. Progress Tracking and Auto-Completion

When a user watches a video chunk, progress telemetry updates their state. A chunk is marked as fully consumed if the watch duration surpasses an auto-completion threshold.

**Completion Formula:**
Let $T_{total}$ be the total duration of the chunk in seconds.
Let $T_{watched}$ be the seconds watched.
Let $T_{remaining} = T_{total} - T_{watched}$.

A chunk is completed if:
$$ T_{remaining} \leq \min(15, T_{total} \times 0.15) $$

This formula ensures that users who skip the final few seconds (e.g., outro graphics) are credited with completion, while mathematically preventing an exploit where very short videos (under 30 seconds) could be skipped entirely.
