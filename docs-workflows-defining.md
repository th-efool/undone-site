# Defining Workflow Tasks — Specify units of work to run on Render.

Current version: 1.x

Other versions: [0.x](/docs/workflows-defining/v0.md)

After you [create your first workflow](/workflows-tutorial), you can start defining your own tasks. This article describes supported syntax and configuration options.

## First: Install the Render SDK

> *The Render SDK is currently available for TypeScript and Python.*
>
> SDKs for additional languages are planned for future releases.

The Render SDK is required to define and register workflow tasks.

**Tab: TypeScript**

From your TypeScript project directory:

```shell
npm install @renderinc/sdk
```

(Or `pnpm install`, `bun add`, etc.)

*If you already have the SDK installed,* make sure you're using version `^1.0` or later:

```shell
npm install @renderinc/sdk@latest
```

After installing, make sure `@renderinc/sdk` is listed as a dependency in your `package.json` file at version `^1.0` or later.

**Tab: Python**

From your Python project directory:

```shell
pip install render
```

*If you already have the SDK installed,* make sure you're using version `1.0.1` or later:

```shell
pip install --upgrade render
```

After installing, make sure to add `render>=1.0.1` as a dependency in your application's `requirements.txt`, `pyproject.toml`, or equivalent.

## Basic example

Let's start with a "minimum viable workflow" that defines a single task:

**Tab: TypeScript**

```typescript
import { task, type TaskContext } from '@renderinc/sdk/workflows'

const calculateSquare = task(
  { name: 'calculateSquare' },
  function calculateSquare(ctx: TaskContext, a: number): number {
    return a * a
  }
)
```

This includes everything required to define a workflow:

1. We import the `task` function and `TaskContext` type from the Render SDK.
2. We call `task(...)` to register a function as a task (in this case, `calculateSquare`).
    - *The first parameter* to `task(...)` is an object containing configuration options (only `name` is required). For other supported options, see [Configuring task behavior](#configuring-task-behavior).
    - *The second parameter* is the task function itself. This function must take a `TaskContext` object as its first argument (Render provides this object to each task run automatically).

**Tab: Python**

```python
from render import TaskContext, Workflows

app = Workflows()

@app.task
def calculate_square(ctx: TaskContext, a: int) -> int:
  return a * a

if __name__ == "__main__":
  app.start()
```

This includes everything required to define a workflow:

1. We import the `Workflows` class and `TaskContext` type from the Render SDK, then initialize a `Workflows` object as `app`.
2. We apply the `@app.task` decorator to register a function as a task (in this case, `calculate_square`).
    - The decorator accepts a number of optional arguments (see [Configuring task behavior](#configuring-task-behavior)).
    - The task function must take a `TaskContext` object as its first argument (Render provides this object to each task run automatically).
3. We call `app.start()` in our code's entry point.
    - On Render, this is what kicks off the task registration process _and_ the execution of each run.

## Organizing tasks

You can define your workflow's tasks across multiple files in your project repo:

**Tab: TypeScript**

```typescript
import { task, type TaskContext } from '@renderinc/sdk/workflows'

export const add = task(
  { name: 'add' },
  function add(ctx: TaskContext, a: number, b: number): number {
    return a + b
  }
)
```

```typescript
import { task, type TaskContext } from '@renderinc/sdk/workflows'

export const capitalize = task(
  { name: 'capitalize' },
  function capitalize(ctx: TaskContext, s: string): string {
    return s.toUpperCase()
  }
)
```

```typescript
import './math-tasks'
import './text-tasks'
```

In this example, task definitions are distributed across two files: `math-tasks.ts` and `text-tasks.ts`. By setting your workflow's start command to run the JS output of `index.ts`, you ensure that all tasks are imported and registered.

**Tab: Python**

```python
from render import TaskContext, Workflows

app = Workflows()

@app.task
def add(ctx: TaskContext, a: int, b: int) -> int:
  return a + b
```

```python
from render import TaskContext, Workflows

app = Workflows()

@app.task
def capitalize(ctx: TaskContext, s: str) -> str:
  return s.upper()
```

```python
from render import Workflows
from math_tasks import app as math_app
from text_tasks import app as text_app

app = Workflows.from_workflows(math_app, text_app) # highlight-line

if __name__ == "__main__":
  app.start() # SDK entry point
```

In this example, task definitions are distributed across two files: `math_tasks.py` and `text_tasks.py`.

To register all of your tasks, your workflow's entry point (commonly `main.py`) imports and incorporates the `Workflows` apps from each other file using the [`Workflows.from_workflows()`](/workflows-sdk-python#workflowsfrom-workflows) method.

## Task arguments

*Every task function must take a `TaskContext` object as its first argument:*

**Tab: TypeScript**

```typescript
import { task, type TaskContext } from '@renderinc/sdk/workflows'

const myTask = task(
  { name: 'myTask' },
  function myTask(ctx: TaskContext): number { // highlight-line
    // ...
  }
)
```

**Tab: Python**

```python
from render import TaskContext, Workflows

app = Workflows()

@app.task
def my_task(ctx: TaskContext) -> int: # highlight-line
  # ...
```

 Render passes this object to each task run automatically.

*A task function can define any number of _additional_ arguments.* This example task takes three additional arguments of different types:

**Tab: TypeScript**

```typescript
const myTask = task(
  { name: 'myTask' },
  function myTask(ctx: TaskContext, a: number, b: string, c: boolean): number { // highlight-line
    // ...
  }
)
```

**Tab: Python**

```python
@app.task
def my_task(ctx: TaskContext, arg1: int, arg2: str, arg3: bool) -> int: # highlight-line
  # ...
```

You provide values for these arguments whenever you [trigger](/workflows-running#triggering-a-task-run) or [chain](/workflows-defining#chaining-task-runs) a task run.

You can set default values for arguments:

**Tab: TypeScript**

```typescript
const myTask = task(
  { name: 'myTask' },
  function myTask(ctx: TaskContext, arg1: number = 3): number { // highlight-line
    // ...
  }
)
```

**Tab: Python**

```python
@app.task
def my_task(ctx: TaskContext, arg1: int = 3) -> int: # highlight-line
  # ...
```

### Argument format requirements

- A task's argument types (and its return type) must be JSON-serializable.
    - Argument values are passed to a task run's instance as JSON, and a task run's result is returned as JSON.
- The combined size of all arguments passed to a single task run cannot exceed *4 MB*.
    - Otherwise, the run fails with an error.

## Configuring task behavior

### Instance type (compute specs)

By default, task runs execute on the *Standard* instance type (1 CPU, 2 GB RAM).

You can specify a different instance type to use for a given task with the following syntax:

**Tab: TypeScript**

```typescript
const myTask = task(
  {
    name: 'myTask',
    plan: '2c-4g' // highlight-line
  },
  function myTask(ctx: TaskContext, a: number): number {
    return a * a
  }
)
```

**Tab: Python**

```python
@app.task(
  plan="2c-4g" # highlight-line
)
def my_task(ctx: TaskContext, a: int) -> int:
  return a * a
```

The following instance types are available for workflow tasks:

- [*`flex`*](/workflows-limits#the-flex-instance-type): up to 1 CPU / up to 4 GB RAM
- *`starter`*: 0.5 CPU / 512 MB RAM
- *`standard`*: 1 CPU / 2 GB RAM
- *`2c-4g`*: 2 CPU / 4 GB RAM (formerly `pro`)
- *`2c-8g`*: 2 CPU / 8 GB RAM
- *`4c-8g`*: 4 CPU / 8 GB RAM (formerly `pro_plus`)
- *`4c-16g`*: 4 CPU / 16 GB RAM (formerly `pro_max`)

See [pricing details](/workflows-limits#instance-types-compute-specs).

### Timeout

By default, a task run times out after 2 hours if its function hasn't returned yet. You can override this on a per-task basis to any value between *30 seconds* and *24 hours*.

**Tab: TypeScript**

Provide your task's timeout to `task(...)` via the `timeoutSeconds` option:

```typescript
const myTask = task(
  {
    name: 'myTask',
    timeoutSeconds: 86400 // 24 hours in seconds
  },
  function myTask(ctx: TaskContext, a: number): number {
    return a * a
  }
)
```

**Tab: Python**

Provide your task's timeout to the `@app.task` decorator via the `timeout_seconds` argument:

```python
@app.task(
  timeout_seconds=86400 # 24 hours in seconds
)
def my_task(ctx: TaskContext, a: int) -> int:
  return a * a
```

### Retry logic

Task runs can automatically *retry* if they fail. Render considers a run to have failed in any case where its function does not complete normally. This includes:

- The task function raises an exception or throws an error.
- The run [times out](#timeout).
- The run exceeds its instance's [compute limits](#instance-type-compute-specs).
- The run's underlying instance encounters an unexpected error.

#### Default retry behavior

If you don't customize a task's retry behavior, it uses the following defaults:

- Retry a failed run up to three times (i.e., four total attempts).
- Wait one second before attempting the first retry.
- Double the wait time after each retry (i.e., one second, two seconds, four seconds).

#### Customizing retries

You can customize retry behavior on a per-task basis. Every run of a task uses the same retry settings.

Provide retry settings with the following syntax:

**Tab: TypeScript**

```typescript
import { task, type TaskContext } from '@renderinc/sdk/workflows'

const flipCoin = task(
  {
    name: 'flipCoin',
    retry: {
      maxRetries: 3, // Retry up to 3 times (i.e., 4 total attempts)
      waitDurationMs: 1000, // Set a base retry delay of 1 second
      backoffScaling: 1.5 // Increase delay by 50% after each retry (1s, 1.5s, 2.25s)
    }
  },
  function flipCoin(ctx: TaskContext): string {
    if (Math.random() < 0.5) {
      throw new Error('Flipped tails! Retrying.')
    }
    return 'Flipped heads!'
  }
)
```

**Tab: Python**

```python
from render import Retry, TaskContext, Workflows
import random

app = Workflows()

@app.task(
  retry=Retry(
    max_retries=3, # Retry up to 3 times (i.e., 4 total attempts)
    wait_duration_ms=1000, # Set a base retry delay of 1 second
    backoff_scaling=1.5 # Increase delay by 50% after each retry (1s, 1.5s, 2.25s)
  )
)
def flip_coin(ctx: TaskContext) -> str:
  if random.random() < 0.5:
    raise Exception("Flipped tails! Retrying.")
  return "Flipped heads!"
```

This contrived example defines a task that "flips a coin" and raises an exception/error when it "flips tails", causing the run to fail and retry according to its settings.

## Chaining task runs

A task run can trigger _additional_ task runs as part of its execution. These *chained runs* each execute in their own instance and return their result to their parent run:

```timeline
run_agent() (start +0s, run 30s, end +30s) [root]
├── gather_context() (start +1s, run 9s, end +10s)
│   ├── search_web() (start +2s, run 8s, end +10s)
│   └── fetch_docs() (start +2s, run 7s, end +9s)
├── execute_skills() (start +11s, run 8s, end +19s)
└── compose_response() (start +20s, run 9s, end +29s)
```

All tasks in a run chain must belong to the same workflow service.

*Chaining runs is an essential part of Render Workflows.* It enables you to quickly fan out independent units of work across distributed compute, then roll up the entirety of that work into a unified result.

### When to chain runs

Chaining runs is most useful when different parts of a larger job benefit from their own compute resources and/or [retry](#retry-logic) boundaries.

For simpler, resource-light jobs, it can be more efficient to define the entirety of your logic in a single task.

### How to chain runs

The `TaskContext` object passed to each task function provides a `run` method that you use to chain additional runs.

Let's look at an example:

**Tab: TypeScript**

The simple `sumSquares` task below chains two parallel runs of the `calculateSquare` task:

```typescript
import { task, type TaskContext } from '@renderinc/sdk/workflows'

const calculateSquare = task(
  { name: 'calculateSquare' },
  function calculateSquare(ctx: TaskContext, a: number): number {
    return a * a
  }
)

// A task that chains two parallel runs
const sumSquares = task(
  { name: 'sumSquares' },
  async function sumSquares(ctx: TaskContext, a: number, b: number): Promise<number> {
    const [result1, result2] = await Promise.all([
      ctx.run(calculateSquare, a),
      ctx.run(calculateSquare, b)
    ])
    return result1 + result2
  }
)
```

- Chain a run by passing the corresponding task definition to `ctx.run()` (such as `calculateSquare` above).
  - You provide the run's arguments as additional parameters after the task definition.
  - You can `await` the Promise returned by `ctx.run()` to obtain the chained run's return value.
- Any task function that chains runs should be defined as `async`.
  - Otherwise, it can't `await` the results of its chained runs.

**Tab: Python**

The simple `sum_squares` task below chains two parallel runs of the `calculate_square` task:

```python
from render import TaskContext, Workflows
import asyncio

app = Workflows()

# A task that chains two parallel runs
@app.task
async def sum_squares(ctx: TaskContext, a: int, b: int) -> int: # Must be async to await chained runs
  result1, result2 = await asyncio.gather(
    ctx.run(calculate_square, a),
    ctx.run(calculate_square, b)
  )
  return result1 + result2

@app.task
def calculate_square(ctx: TaskContext, a: int) -> int:
  return a * a
```

- Chain a run by passing the corresponding task definition to `ctx.run()` (such as `calculate_square` above).
  - You provide the run's arguments as additional parameters after the task definition.
  - You can `await` the result returned by `ctx.run()` to obtain the chained run's return value.
- Any task function that chains runs should be defined as `async`.
  - Otherwise, it can't `await` the results of its chained runs.

> *Want to trigger a run of a task from a _different_ workflow?*
>
> This requires instead using the Render SDK or Render API, as described in [Running Workflow Tasks](/workflows-running). Note that this is not tracked as a chaining relationship when visualizing task execution in the [Render Dashboard](https://dashboard.render.com).

### Parallel runs

When chaining runs, you'll often want to chain multiple at once to distribute independent work. Common examples include processing batches of images or analyzing different sections of a large data set.

**Tab: TypeScript**

To chain parallel runs in TypeScript, use `Promise.all`, `Promise.allSettled`, or a similar concurrency utility.

In this example, the `processPhotoUpload` task chains a separate `processImage` run for each element in its `imageUrls` argument:

```typescript
import { task, type TaskContext } from '@renderinc/sdk/workflows'

const processImage = task(
  { name: 'processImage' },
  function processImage(ctx: TaskContext, imageUrl: string): {
    url: string
    thumbnailUrl: string
    success: boolean
  } {
    // Image processing logic goes here
    return {
      url: imageUrl,
      thumbnailUrl: `${imageUrl}_thumb.jpg`,
      success: true
    }
  }
)

const processPhotoUpload = task(
  { name: 'processPhotoUpload' },
  async function processPhotoUpload(ctx: TaskContext, imageUrls: string[]): Promise<{
    total: number
    processed: number
    failed: number
    results: Array<{ url: string; thumbnailUrl: string; success: boolean }>
  }> {
    // Process all images in parallel by chaining a run for each
    const results = await Promise.all( // highlight-line
      imageUrls.map((url) => ctx.run(processImage, url)) // highlight-line
    ) // highlight-line

    const numSuccessful = results.filter((r) => r.success).length
    const numFailed = results.length - numSuccessful

    return {
      total: imageUrls.length,
      processed: numSuccessful,
      failed: numFailed,
      results
    }
  }
)
```

*If you don't use `Promise.all` or a similar function, chained runs execute serially.*

For example:

```typescript
const sumSquaresSlower = task(
  { name: 'sumSquaresSlower' },
  async function sumSquaresSlower(ctx: TaskContext, a: number, b: number): Promise<number> {
    // ⚠️ Not parallel!
    const result1 = await ctx.run(calculateSquare, a)
    const result2 = await ctx.run(calculateSquare, b) // Executes after first run completes
    return result1 + result2
  }
)

const calculateSquare = task(
  { name: 'calculateSquare' },
  function calculateSquare(ctx: TaskContext, a: number): number {
    return a * a
  }
)
```

**Tab: Python**

To chain parallel runs in Python, use `asyncio.gather`, `asyncio.TaskGroup`, or a similar concurrency utility.

In this example, the `process_photo_upload` task chains a separate `process_image` run for each element in its `image_urls` argument:

```python
from render import TaskContext, Workflows
import asyncio

app = Workflows()

@app.task
async def process_photo_upload(ctx: TaskContext, image_urls: list[str]) -> dict:
  # Process all images in parallel by chaining a run for each
  results = await asyncio.gather( # highlight-line
    *[ctx.run(process_image, url) for url in image_urls] # highlight-line
  ) # highlight-line

  num_successful = sum(1 for r in results if r["success"])
  num_failed = len(results) - num_successful

  return {
    "total": len(image_urls),
    "processed": num_successful,
    "failed": num_failed,
    "results": results
  }

@app.task
def process_image(ctx: TaskContext, image_url: str) -> dict:

  # Image processing logic goes here

  return {
    "url": image_url,
    "thumbnail_url": f"{image_url}_thumb.jpg",
    "success": True
  }
```

*If you don't use `asyncio.gather` or a similar function, chained runs execute serially.*

For example:

```python
@app.task
async def sum_squares_slower(ctx: TaskContext, a: int, b: int) -> int:
  # ⚠️ Not parallel!
  result1 = await ctx.run(calculate_square, a)
  result2 = await ctx.run(calculate_square, b) # Executes after first run completes
  return result1 + result2

@app.task
def calculate_square(ctx: TaskContext, a: int) -> int:
  return a * a
```

Serial execution _is_ helpful when one run depends on the result of another. However, it can significantly slow execution for runs that are completely independent. *Parallelize wherever your use case allows.*

---

##### Appendix: Glossary definitions

###### task

A function you can execute on its own compute as part of a *workflow*.

Each execution of a task is called a *run*.

Related article: https://render.com/docs/workflows-defining.md

###### task run

A single execution of a workflow *task*.

A run spins up in its own *instance*, executes, returns a value, and is deprovisioned.

Related article: https://render.com/docs/workflows-running.md

###### instance type

Specifies the RAM and CPU available to your service's *instances*.

Common instance types for a new web service include:

- *Free*: 512 MB RAM / 0.1 CPU
- *Starter*: 512 MB RAM / 0.5 CPU
- *Standard*: 2 GB RAM / 1 CPU

For the full list, see the [pricing page](/pricing#services).

Related article: https://render.com/docs/compute-plans.md

###### run chaining

Triggering a new *task run* directly from an in-progress run.

All runs in a chain belong to the same *workflow*.

Related article: https://render.com/docs/workflows-defining.md#chaining-task-runs

###### instance

A containerized environment that runs your service's code on Render.

You can select from a range of *instance types* with different compute specs.