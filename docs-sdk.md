# Workflows SDK for TypeScript — Usage and symbol reference

Current version: 1.x

Other versions: [0.x](/docs/workflows-sdk-typescript/v0.md)

The Render SDK for TypeScript provides support for:

- Defining workflow tasks
- Triggering runs of those tasks from your other TypeScript code

## Install

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

## Defining tasks

The following symbols pertain to creating and registering tasks in your workflow service. For guidance on how to use them, see [Defining Workflow Tasks](/workflows-defining).

### The `task()` function

###### `task(options, func)`

Use `task()` to register a provided function (`func`) as a workflow task with the specified `options`.

*On success:* Returns a task definition. You can pass this value to [`ctx.run()`](#taskcontext-run) to chain runs of this task within another task.

```typescript
import { task, type TaskContext } from '@renderinc/sdk/workflows'

// Example with all options
const calculateSquare = task(
  {
    name: 'calculateSquare',
    retry: {
      maxRetries: 3,
      waitDurationMs: 1000,
      backoffScaling: 1.5
    },
    timeoutSeconds: 300,
    plan: 'flex'
  },
  function calculateSquare(ctx: TaskContext, a: number): number {
    return a * a
  }
)
```

------

###### *Function parameters*

---

###### Argument

`options`

###### Description

*Required.* An object containing configuration details for the task. Only `name` is required. See all supported options below.

---

###### Argument

`func`

###### Description

*Required.* The function to register as a task.

---

###### *Supported `options`*

---

###### Argument

`name`

###### Description

*Required.* The task's name. This affects the task's *slug*, which you use to reference the task when [triggering runs](/workflows-running#3-initialize-the-client-and-trigger-a-run). This value is not required to match the name of the function you provide as `func`.

---

###### Argument

`retry`

###### Description

An object containing retry settings for the task. See all supported settings below.

---

###### Argument

`timeoutSeconds`

###### Description

The timeout for the task's runs, in seconds. Must be between 30 seconds (`30`) and 24 hours (`86400`), inclusive. The default value is 2 hours.

---

###### Argument

`plan`

###### Description

The default instance type to use for the task's runs. One of the following:

- [*`flex`*](/workflows-limits#the-flex-instance-type): up to 1 CPU / up to 4 GB RAM
- *`starter`*: 0.5 CPU / 512 MB RAM
- *`standard`*: 1 CPU / 2 GB RAM
- *`2c-4g`*: 2 CPU / 4 GB RAM (formerly `pro`)
- *`2c-8g`*: 2 CPU / 8 GB RAM
- *`4c-8g`*: 4 CPU / 8 GB RAM (formerly `pro_plus`)
- *`4c-16g`*: 4 CPU / 16 GB RAM (formerly `pro_max`)

The default value is `standard`.

---

###### *Retry settings*

---

###### Argument

`maxRetries`

###### Description

The maximum number of retries to attempt for a given run of the task. The total number of attempts is up to `maxRetries + 1` (the initial attempt plus all retries).

---

###### Argument

`waitDurationMs`

###### Description

The base delay before attempting the first retry, in milliseconds.

---

###### Argument

`backoffScaling`

###### Description

The exponential backoff factor. After each retry, the previous delay is multiplied by this factor. For example, a factor of `1.5` increases the delay by 50% after each retry.

- If you provide a `retry` object but omit this field, the default value is `1.5`.
- If you omit the `retry` object entirely, the default value is `2`.

------

### The `TaskContext` object

Every task function must accept a `TaskContext` object as its first positional argument. Render automatically provides this object to each run (you do not provide it as an input).

The `TaskContext` object provides a single method, [`run()`](#taskcontext-run), which you use for run chaining:

###### `TaskContext.run(task, ...args)`

Chains a run of the specified task on a separate instance.

*On success:* Returns a Promise that resolves with the chained run's return value.

*Throws:* [`RenderError`](#rendererror), `Error`

It can also propagate ordinary errors if it cannot communicate with the task runtime.

```typescript
const sumSquares = task(
  { name: 'sumSquares' },
  async (ctx: TaskContext, a: number, b: number): Promise<number> => {
    const [first, second] = await Promise.all([
      ctx.run(calculateSquare, a), // highlight-line
      ctx.run(calculateSquare, b) // highlight-line
    ])
    return first + second
  }
)
```

------

###### `task`

*Required.* The `task()`-registered function to run, such as `calculateSquare` in the example above.

###### `...args`

All [input arguments](/workflows-defining#task-arguments) to pass to the task run, as _positional_ arguments:

```typescript
ctx.run(sumSquares, 2, 3)
```

------

## Triggering runs

Use the `Render` class to trigger and manage task runs from other TypeScript services, apps, or scripts. For end-to-end usage guidance, see [Triggering Task Runs](/workflows-running).

### The `Render` class

#### Constructor

###### `Render(options)`

Initializes a Render SDK client.

```typescript
import { Render } from '@renderinc/sdk'

// Basic initialization (uses RENDER_API_KEY from env)
const render = new Render()

// Initialization with API key
const renderWithToken = new Render({
  token: 'rnd_abc123...'
})
```

| Option | Description |
| --- | --- |
| `token` | The [API key](/api#1-create-an-api-key) to use for authentication. If omitted, the client automatically detects and uses the value of the `RENDER_API_KEY` environment variable. |

### Task methods

These methods are available on the `workflows` attribute of a `Render` object.

###### `startTask(taskSlug, inputData, signal)`

Kicks off a run of the registered task with the specified identifier, passing the specified arguments.

To instead run a task _and_ wait for it to complete, use [`workflows.runTask`](#runtask).

*On success:* Returns a [`TaskRunResult`](#the-taskrunresult-class) object representing the started run. You can `await` the run's result by calling `.get()` on this object.

*Throws:* `ClientError`, `ServerError`, `AbortError`

```typescript
// Trigger a run of calculateSquare with an input of 2
const startedRun = await render.workflows.startTask(
  'my-workflow/calculateSquare',
  [2]
)

const taskRunId: string = startedRun.taskRunId // Available immediately

const finishedRun = await startedRun.get()
console.log(finishedRun.results)
```

| Argument | Description |
| --- | --- |
| `taskSlug` | *Required.* The *slug* indicating the task to run, available from your task's page in the [Render Dashboard](https://dashboard.render.com):  [image: Task slug in the Render Dashboard]  Always has the format `{workflow-slug}/{task-name}` (e.g., `my-workflow/calculateSquare`). |
| `inputData` | *Required.* An array containing the task's [input arguments](/workflows-defining#task-arguments). Elements are positional based on the task's function signature. For a task that takes zero arguments, provide an empty array, `[]`. |
| `signal` | An optional `AbortSignal` used to cancel the request and any associated wait. For details, see [Canceling operations with `AbortSignal`](#canceling-operations-with-abortsignal). |

###### `runTask(taskSlug, inputData, signal)`

Starts the registered task with the specified identifier, waits for it to complete, and returns the result.

To instead kick off a run _without_ waiting for it to complete, use [`workflows.startTask`](#starttask).

*On success:* Returns a [`TaskRunDetails`](#the-taskrundetails-type) object for the completed task run.

*Throws:* [`ClientError`](#clienterror), [`ServerError`](#servererror), [`AbortError`](#aborterror)

```typescript
const taskRun = await render.workflows.runTask(
  'my-workflow/calculateSquare',
  [2]
)

console.log(taskRun.status)
console.log(taskRun.results)
```

| Argument | Description |
| --- | --- |
| `taskSlug` | *Required.* The *slug* indicating the task to run, available from your task's page in the [Render Dashboard](https://dashboard.render.com):  [image: Task slug in the Render Dashboard]  Always has the format `{workflow-slug}/{task-name}` (e.g., `my-workflow/calculateSquare`). |
| `inputData` | *Required.* An array containing the task's [input arguments](/workflows-defining#task-arguments). Elements are positional based on the task's function signature. For a task that takes zero arguments, provide an empty array, `[]`. |
| `signal` | An optional `AbortSignal` used to cancel the request and any associated wait. For details, see [Canceling operations with `AbortSignal`](#canceling-operations-with-abortsignal). |

###### `listTaskRuns(params)`

Lists task runs that match optional filters.

*On success:* Returns an array of [`TaskRunWithCursor`](#the-taskrunwithcursor-type) objects.

*Throws:* `ClientError`, `ServerError`

```typescript
const taskRuns = await render.workflows.listTaskRuns({
  limit: 10,
  ownerId: ['tea-d3jm7ai4d50c73fale60']
})

for (const item of taskRuns) {
  console.log(item.taskRun.id, item.cursor)
}
```

Supported fields on `params` include:

| Parameter | Description |
| --- | --- |
| `limit` | An integer specifying the maximum number of task runs to return. |
| `cursor` | A cursor string for pagination. Use this to retrieve the next page of results. |
| `taskSlug` | A list of task slugs to filter results by. Only task runs for these tasks will be returned. |
| `rootTaskRunId` | A list of root task run IDs to filter results by. Only runs in these execution chains will be returned. |
| `ownerId` | A list of workspace IDs to filter results by. Only task runs from these workspaces will be returned. |
| `workflowVersionId` | A list of workflow version IDs to filter results by. |
| `workflowId` | A list of workflow IDs to filter results by. |

###### `getTaskRun(taskRunId)`

Retrieves the details of the task run with the specified ID.

*On success:* Returns a [`TaskRunDetails`](#the-taskrundetails-type) object.

*Throws:* `ClientError`, `ServerError`

```typescript
const details = await render.workflows.getTaskRun('trn-abc123')
console.log(details.status, details.results)
```

| Argument | Description |
| --- | --- |
| `taskRunId` | *Required.* The ID of the task run to retrieve. Has the format `trn-abc123...` |

###### `cancelTaskRun(taskRunId)`

Cancels the root-level task run with the specified ID, along with all of its chained runs. This throws a `ClientError` if the root-level run is not found, or if it is not currently running.

*On success:* Returns `void`.

*Throws:* `ClientError`, `ServerError`

```typescript
const startedRun = await render.workflows.startTask('my-workflow/calculateSquare', [99])
await render.workflows.cancelTaskRun(startedRun.taskRunId)
```

| Argument | Description |
| --- | --- |
| `taskRunId` | *Required.* The ID of the root-level task run to cancel. Has the format `trn-abc123...` |

###### `taskRunEvents(taskRunIds, signal, options)`

Streams completion events for one or more task runs via [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) (SSE). Returns an async iterator that yields a [`TaskRunDetails`](#the-taskrundetails-type) object each time a specified task run reaches a terminal status.

The connection stays open until all events are received, you break out of the loop, or the stream is aborted.

*Throws:* `AbortError`, `Error`

```typescript
const run1 = await render.workflows.startTask('my-workflow/calculateSquare', [3])
const run2 = await render.workflows.startTask('my-workflow/calculateSquare', [6])
const pending = new Set([run1.taskRunId, run2.taskRunId])

for await (const event of render.workflows.taskRunEvents([...pending])) {
  console.log(event.status, event.id, event.results)
  pending.delete(event.id)
  if (pending.size === 0) break
}
```

------

###### `taskRunIds`

*Required.* A list of task run IDs to stream events for. Each ID has the format `trn-abc123...`

###### `signal`

Optional `AbortSignal` to stop the stream. For details, see [Canceling operations with `AbortSignal`](#canceling-operations-with-abortsignal).

###### `options`

Optional reconnection settings for connection failures:

- `maxRetries` (default: `5`)
- `initialDelayMs` (default: `250`)
- `backoffFactor` (default: `2`)
- `maxDelayMs` (default: `16000`)

------

### The `TaskRunResult` class

Represents a started task run before completion.

You typically obtain a `TaskRunResult` from [`workflows.startTask`](#starttask).

#### Properties and methods

| Member | Description |
| --- | --- |
| `taskRunId` | The started task run's ID, available immediately. |
| `get()` | Waits for completion and returns a `TaskRunDetails` object. The first call starts waiting; subsequent calls return the same Promise. |

### Canceling operations with `AbortSignal`

The [`startTask`](#starttask), [`runTask`](#runtask), and [`taskRunEvents`](#taskrunevents) methods each accept an optional `AbortSignal` parameter. You can use this to terminate the corresponding method call if it's no longer needed (for example, to enforce a frontend timeout or respond to a user-initiated cancellation).

```typescript
const controller = new AbortController()

// Set a 30-second timeout for the entire operation
const timeout = setTimeout(() => controller.abort(), 30_000)

try {
  const result = await render.workflows.runTask(
    'my-workflow/processData',
    [largeDataset],
    controller.signal
  )
  console.log(result.status, result.results)
} catch (err) {
  if (err instanceof AbortError) {
    console.log('Operation timed out or was canceled')
  }
} finally {
  clearTimeout(timeout)
}
```

When a `signal` is passed to `startTask`, it applies to both the initial HTTP request _and_ any subsequent wait via [`TaskRunResult.get()`](#the-taskrunresult-class). This means a single `AbortController` can cancel the full lifecycle of starting a task and waiting for its result.

> *Terminating a client-side method call does _not_ cancel any corresponding task runs.* Runs continue executing on Render until they complete, time out, or are canceled with [`workflows.cancelTaskRun`](#canceltaskrun).

## Additional types

### The `TaskRunWithCursor` type

Represents an item returned by [`workflows.listTaskRuns`](#listtaskruns). It pairs a task run with the cursor for that item.

#### Properties

| Property | Description |
| --- | --- |
| `taskRun` | The [`TaskRun`](#the-taskrun-type) returned in this item. |
| `cursor` | The cursor associated with this item. Provide it as `cursor` in a subsequent `listTaskRuns()` call to continue listing task runs. |

### The `TaskRun` type

Summarizes the state of a task run. Obtained in one of the following ways:

- The `taskRun` property of a [`TaskRunWithCursor`](#the-taskrunwithcursor-type) returned by [`workflows.listTaskRuns`](#listtaskruns)

To get a run's full details including results, call [`workflows.getTaskRun`](#gettaskrun) with the run's ID to obtain a [`TaskRunDetails`](#the-taskrundetails-type) object.

#### Properties

| Property | Description |
| --- | --- |
| `id` | The ID of the task run. Has the format `trn-abc123...` |
| `taskId` | The ID of the run's associated task. Has the format `tsk-abc123...` |
| `status` | The current status of the task run (e.g., `pending`, `running`, `completed`, `failed`, `canceled`). |
| `startedAt` | The timestamp when the task run started executing. Not present if `status` is `pending`. |
| `completedAt` | The timestamp when the task run finished (successfully or otherwise). Present only if `status` is one of `completed`, `failed`, or `canceled`. |
| `parentTaskRunId` | The ID of this run's parent run, if this run was chained. For a root-level run, this value is the root run's ID or empty. |
| `rootTaskRunId` | The ID of the root task run in this run's execution chain. For a root-level run, this value matches `id`. |
| `retries` | The number of times the task run has retried so far. For a newly started run, this is typically `0`. |
| `attempts` | An array of `TaskAttempt` objects representing each execution attempt so far (including retries). |

### The `TaskRunDetails` type

Provides the full details of a task run. Obtained in one of the following ways:

- Calling the [`workflows.runTask`](#runtask) method:

  ```typescript
  const taskRunDetails = await render.workflows.runTask('my-workflow/calculateSquare', [2])
  ```

- Calling `.get()` on a [`TaskRunResult`](#the-taskrunresult-class) returned by [`workflows.startTask`](#starttask):

  ```typescript
  const startedRun = await render.workflows.startTask('my-workflow/calculateSquare', [2])
  const taskRunDetails = await startedRun.get() // highlight-line
  ```

- Calling the [`workflows.getTaskRun`](#gettaskrun) method:

  ```typescript
  const taskRunDetails = await render.workflows.getTaskRun('trn-abc123')
  ```

- Iterating over events from the [`workflows.taskRunEvents`](#taskrunevents) method:

  ```typescript
  for await (const taskRunDetails of render.workflows.taskRunEvents(['trn-abc123'])) {
    console.log(taskRunDetails.status)
  }
  ```

#### Properties

*A `TaskRunDetails` object includes all of the same properties as a [`TaskRun`](#the-taskrun-type) object, plus:*

| Property | Description |
| --- | --- |
| `results` | An array containing the task's return value(s). This value is always an empty array if `status` is not `completed`. |
| `input` | The argument values that were passed to the task run, as an array matching the positional arguments of the task's function signature. |
| `error` | The error message if the task run failed. Present only if `status` is `failed`. |
| `attempts` | An array of `TaskAttemptDetails` objects (more detailed than the `TaskAttempt` array on [`TaskRun`](#the-taskrun-type)) representing each individual execution attempt for this run, including retries. |

### The `ListTaskRunsParams` type

Represents the query object passed to [`workflows.listTaskRuns`](#listtaskruns). See the [`listTaskRuns`](#listtaskruns) reference for descriptions of each supported field.

Fields include `limit`, `cursor`, `taskSlug`, `rootTaskRunId`, `ownerId`, `workflowVersionId`, and `workflowId`.

### Error types

Errors raised by the SDK have one of the types listed below. `RenderError` is the parent class for `ClientError` and `ServerError`. `AbortError` is a separate error type.

```typescript
import {
  RenderError, // Parent class for other errors besides AbortError
  ClientError,
  ServerError,
  AbortError
} from '@renderinc/sdk'
```

------

###### `RenderError`

The base class for all errors raised by the SDK.

###### `ClientError`

Raised when a request to the Render API returns a 400-level error code. Common causes include:

- Invalid API key
- Invalid task identifier
- Invalid task arguments
- Invalid action (for example, canceling a task run that is already completed)

###### `ServerError`

Raised when a request to the Render API returns a 500-level error code.

###### `AbortError`

Raised when an SDK operation is [canceled with an `AbortSignal`](#canceling-operations-with-abortsignal).

------


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

###### run chaining

Triggering a new *task run* directly from an in-progress run.

All runs in a chain belong to the same *workflow*.

Related article: https://render.com/docs/workflows-defining.md#chaining-task-runs

###### instance type

Specifies the RAM and CPU available to your service's *instances*.

Common instance types for a new web service include:

- *Free*: 512 MB RAM / 0.1 CPU
- *Starter*: 512 MB RAM / 0.5 CPU
- *Standard*: 2 GB RAM / 1 CPU

For the full list, see the [pricing page](/pricing#services).

Related article: https://render.com/docs/compute-plans.md

###### instance

A containerized environment that runs your service's code on Render.

You can select from a range of *instance types* with different compute specs.