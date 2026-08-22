# Your First Workflow — Register your first task and trigger its first run.

Welcome to Render Workflows! Follow these steps to register your first task and trigger its first run.

## 1. Install the Render CLI

You'll use the Render CLI to create a starter project with our Hello World template.

Use any of the following methods to install the Render CLI or upgrade to the latest version:

**Tab: Homebrew**

Run the following commands:

```shell
brew update
brew install render
```

**Tab: Linux/MacOS**

Run the following command:

```shell
curl -fsSL https://raw.githubusercontent.com/render-oss/cli/refs/heads/main/bin/install.sh | sh
```

**Tab: Direct download**

1. Open the CLI's [GitHub releases page](https://github.com/render-oss/cli/releases/).
2. Download the executable that corresponds to your system's architecture.

If you use an architecture besides those provided, you can build from source instead.

**Tab: Build from source**

> We recommend building from source only if no other installation method works for your system.

1. [Install the Go programming language](https://golang.org/doc/install) if you haven't already.

2. Clone and build the CLI project with the following commands:

   ```shell
   git clone git@github.com:render-oss/cli.git
   cd cli
   go build -o render
   ```

After installation completes, open a new terminal tab and run `render` with no arguments to confirm.

## 2. Initialize a starter project

1. From your machine's development directory, run `render workflows init` to generate a starter project with your first task definition:

    ```shell
    render workflows init
    ```

> *Command not found?* Make sure you've [upgraded](#1-install-the-render-cli) to the latest version of the Render CLI.

2. The `init` command prompts you for the following, in order:

| Prompt | Description |
| --- | --- |
| Prompt | Description |
| *Language* | Choose whichever supported language you prefer (currently TypeScript or Python). |
| *Template* | Choose *Hello World* for this tutorial. |
| *Output directory* | The CLI creates a new directory for your project at the specified path (default `./workflows-demo`). |
| *Install dependencies?* | Choose *Yes*. |
| *Initialize a Git repository?* | Choose *Yes*. |

> *Running in non-interactive mode?*
>
>     To skip prompts in scripts and agents, you can pass all options directly, like so:
>
>     ```shell
    render workflows init --confirm --language py --template hello-world --dir my-workflow --install-deps --git
    ```
>
>     For details, run `render help workflows init`.

3. Commit all of the files in your new project directory to Git:

    ```shell
    cd workflows-demo
    git add .
    git commit -m "Initial commit"
    ```

### The anatomy of a workflow

The following excerpts from `workflows init` starter projects illustrate the bare minimum syntax for defining a workflow:

**Tab: TypeScript**

```typescript
import { task, type TaskContext } from '@renderinc/sdk/workflows'

// Minimal task definition
const calculateSquare = task(
  { name: 'calculateSquare' },
  function calculateSquare(ctx: TaskContext, a: number): number {
    return a * a
  }
)
```

- You import `task` and the `TaskContext` type from the [Render SDK for TypeScript](/workflows-sdk-typescript), which is the template's only dependency aside from TypeScript itself.
- You define tasks by calling `task(...)` once for each, providing options and a function definition.
  - The function must take a `TaskContext` object as its first argument. Render provides this object to each task run automatically.
- No additional initialization is required when using the TypeScript SDK.

**Tab: Python**

```python
from render import TaskContext, Workflows

app = Workflows()

# Minimal task definition
@app.task
def calculate_square(ctx: TaskContext, a: int) -> int:
  return a * a

if __name__ == "__main__":
  app.start() # Workflow entry point
```

- You define a task by first initializing a `Workflows` app, then applying the `@app.task` decorator to any function.
  - The function must take a `TaskContext` object as its first argument. Render provides this object to each task run automatically.
- You call `app.start()` on startup to initiate both task registration and run execution on Render.
- The `Workflows` class and `TaskContext` type are imported from the [Render SDK for Python](/workflows-sdk-python), which is the template's only dependency.

## 3. Push your project

Render will deploy your project by pulling its source from a linked repo on GitHub, GitLab, or Bitbucket.

Create a new repository for your project with any of these providers and push your local repo to it.

## 4. Create a workflow service

1. In the [Render Dashboard](https://dashboard.render.com), click *New > Workflow*:

   [image: Creating a new workflow in the Render Dashboard]

   The workflow creation form appears.

2. Link the GitHub/GitLab/Bitbucket repo with your workflow's task definitions.

3. Complete the remainder of the creation form. See guidance for important fields:

------

###### Language

- Choose *Node* for TypeScript or *Python 3* for Python.
   - Choose *Docker* if you're deploying a workflow project that builds from a Dockerfile.
     - For details, see [Using Docker](#using-docker).

###### Region

All of your workflow's task runs will execute in the specified region. This determines which of your _other_ Render services they can reach over your private network.

###### Build Command

If you're using the *Hello World* template from `render workflows init`, this is the following:

   **Tab: TypeScript**

   ```bash
   npm install
   ```

   **Tab: Python**

   ```bash
   pip install -r requirements.txt
   ```

   Otherwise, provide the command that Render should use to install dependencies and build your code. You don't provide a build command if you're using [Docker](#using-docker).

###### Start Command

If you're using the *Hello World* template from `render workflows init`, this is the following:

   **Tab: TypeScript**

   ```bash
   npm start
   ```

   **Tab: Python**

   ```bash
   python main.py
   ```

   Otherwise, provide the command that Render should use to start your workflow.

------

4. Click *Deploy Workflow*. Render kicks off your workflow's first build, which includes registering your tasks.

That's it! After the build completes, your tasks are officially registered. You can view them from your workflow's *Tasks* page in the [Render Dashboard](https://dashboard.render.com):

[image: Viewing a registered task in the Render Dashboard]

## 5. Trigger a task run

Now that we've registered a task, let's run it! The quickest way to trigger our first run is in the [Render Dashboard](https://dashboard.render.com):

1. From your workflow's *Tasks* page, click a task to open its *Runs* page.
2. Click *Start Task* in the top-right corner of the page:

   [image: Running a task in the Render Dashboard]

   A dialog appears for providing the task's input arguments:

   [image: Providing input arguments for a task run in the Render Dashboard]

3. Provide the task's input arguments as a JSON array (e.g., `[5]` for a task that takes a single integer argument, or `[]` for a task that takes zero arguments).

4. Click *Start task*.

   Your new task run appears at the top of the *Runs* table.

### Next steps

Congratulations! You've registered your first workflow task and triggered its first run. Now it's time to start designing your own tasks and triggering runs from application code:

- [Define advanced tasks](/workflows-defining) with retries, chaining, and more.
- [Trigger task runs](/workflows-running) from your application code.
- [Test task runs locally](/workflows-local-development) for faster development.

## Using Docker

You can optionally build your workflow service from a Dockerfile. As with other Render service types, this is useful if you need to install libraries or perform build-time operations that aren't supported by Render's native language runtimes.

During [4. Create a workflow service](#4-create-a-workflow-service), note the following changes:

1. Set the *Language* field to *Docker*.
2. You do not provide a *Build Command* (the field is hidden entirely for Docker-based workflows).
3. Set your service's *Start Command* to the command that Render should use to start your workflow (e.g., `npm start` or `python main.py`).
    - *This field is currently always required*, even if your Dockerfile defines a `CMD`/`ENTRYPOINT` default.
4. Specify your *Dockerfile Path* if the Dockerfile isn't in your repo's root directory.

### Docker-specific limitations

We'll address these limitations in future releases:

- Workflows do not currently support [pulling a prebuilt Docker image](/deploying-an-image) from a container registry.
- It is not currently possible to create a Docker-based workflow service using the Render CLI or API (Dashboard only).
- Docker-based workflows do not currently support [local execution](/workflows-local-development) using the Render CLI's task server.

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

###### region

Each Render service runs in one of the following regions: *Oregon*, *Ohio*, *Virginia*, *Frankfurt*, or *Singapore*.

Services in the same region can communicate over their *private network*.

Related article: https://render.com/docs/regions.md

###### private network

Your Render services in the same *region* can reach each other without traversing the public internet, enabling faster and safer communication.

Related article: https://render.com/docs/private-network.md

###### build command

The command that Render runs to build your service from source.

Common examples include `npm install` for Node.js and `pip install -r requirements.txt` for Python.

Related article: https://render.com/docs/deploys.md#build-command

###### start command

The command that Render runs to start your built service in a newly deployed *instance*.

Common examples include `npm start` for Node.js and `gunicorn your_application.wsgi` for Python.

Related article: https://render.com/docs/deploys.md#start-command

###### run chaining

Triggering a new *task run* directly from an in-progress run.

All runs in a chain belong to the same *workflow*.

Related article: https://render.com/docs/workflows-defining.md#chaining-task-runs