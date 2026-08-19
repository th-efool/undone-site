# Content Metadata & Embedding Architecture (Context-Aware Feed)

SideQuestHQ is a TikTok-style feed for learning. The user is already in the cohort, so we don't need to match them to a topic or domain. The goal of the embedding and metadata pipeline is purely **Situational Context Matching**.

When a user opens the app, the feed algorithm retrieves the most relevant chunk from their active cohorts based on their immediate situation (tired, commuting, 10-minute break, exploratory mood).

---

## 1. The Core Chunk Parameters

To power the feed, every chunk needs to be scored on dimensions that match human context, not academic domains.

### 1. Cognitive Load (Density)
* **What it powers:** "I'm tired → give me something lighter."
* **How it's calculated (Zero API Cost):** Deterministic math. `(Words per minute) * (Average word length / Vocabulary complexity)`. Faster talking + bigger words = High Cognitive Load.

### 2. Audio-Friendliness (Visual Dependence)
* **What it powers:** "I'm on a bus/walking → give me the audio-friendly part."
* **How it's calculated:** Vector Projection or Keyword heuristics. Does the transcript rely heavily on words like "look at this", "this graph", "here we see"? If yes, it has high visual dependence (not audio-friendly). If it's purely conversational or storytelling, it's highly audio-friendly.

### 3. Core vs. Exploratory (Tangent Level)
* **What it powers:** "I'm in the mood to explore → surface the exploratory part."
* **How it's calculated:** Vector similarity to the overarching "Core Definition" of the video. If the chunk's semantic vector is very close to the video's main summary vector, it's "Core". If it drifts away (a story, an analogy, an edge case), it's "Exploratory".

### 4. Semantic Completeness & Length
* **What it powers:** "I have 10 minutes → give me something that fits."
* **How it's calculated:** Duration of the chunk (objective).

---

## 2. The Cost-Optimized AI Pipeline

Processing a 19-hour video (thousands of chunks) must be cheap and fast. We **do not** query an LLM for every chunk.

1. **Semantic Chunking:** A script splits the long video into 1-to-5 minute segments based on transcript pauses, topic shifts, or timestamp chapters.
2. **Standard Embeddings (Fractions of a Cent):** Pass every chunk's text to a fast, cheap embedding model (e.g., `text-embedding-3-small`). 
3. **Local Metadata Calculation:**
   * Run the deterministic script for **Cognitive Load** (Words Per Minute).
   * Project the embedding vector to score **Audio-Friendliness** and **Exploratory Level**.
4. **Vector DB Storage:** Store the raw Vector + the calculated situational metadata in the database (e.g., pgvector).

```json
{
  "id": "chunk_123",
  "vector": [0.1, 0.2, -0.05, ...],
  "metadata": {
    "cohortId": "cohort_abc",
    "cognitive_load": 0.85,      // High = dense, Low = light
    "audio_friendly": 0.9,       // High = good for commuting
    "is_exploratory": 0.2,       // High = tangent/story, Low = critical path
    "duration_sec": 180
  }
}
```

---

## 3. Cohort Creation Wizard (Human Intervention)

When a human creator pastes a 19-hour playlist into the Cohort Creation Wizard, what do they actually do?

**They do not tag chunks.** They simply verify the **Baseline Setup**.

1. The system chunks the video and runs the cheap embedding pipeline.
2. **The Wizard shows a "Content Map":** It highlights which parts of the course the AI determined are "Heavy/Dense" vs "Light/Exploratory".
3. **The Creator's Role:** The creator might just want to set the pacing or priority of this cohort relative to others, or add overarching "Quests". 
4. If the AI misunderstood the video (e.g., marked a highly visual math lecture as "audio-friendly"), the creator can flip a global toggle: *"Mark entire cohort as highly visual."* This immediately mathematically penalizes the `audio_friendly` score of all chunks by `-0.5` without re-running any AI.
