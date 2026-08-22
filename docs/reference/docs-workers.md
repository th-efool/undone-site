# Background Workers — Offload asynchronous tasks to a separate service listening on a queue.


> *Looking to run high-volume distributed tasks?*
>
> [Render Workflows](/workflows) provides an all-in-one worker model with managed queuing, automatic retries, and rapid spin-up.

*Background workers* are services that run continuously (like a [web service](web-services) or a [private service](private-services)), but they don't receive any incoming network traffic. Instead, these services usually poll a task queue (such as one backed by a [Render Key Value](key-value) instance) and process new tasks as they come in:

[image: Diagram of a background worker polling a task queue]

Background workers help to keep your apps responsive by offloading long-running, asynchronous tasks from your services in the critical request path.

Common worker tasks include:

- Processing media files
- Generating reports
- Interacting with third-party APIs, such as Stripe, Twilio, or AI models

## Popular worker frameworks

You can use the frameworks below to simplify polling a task queue backed by a Redis®-like store (such as [Render Key Value](key-value)).

| Language | Framework |
| --- | --- |
| *Python* | Celery ([see quickstart](/deploy-celery)) |
| *Ruby* | Sidekiq ([see quickstart](/deploy-rails-sidekiq)) |
| *Node.js* | [BullMQ](https://bullmq.io/) |
| *Go* | [Asynq](https://github.com/hibiken/asynq) |
| *Elixir* | [Oban](https://hexdocs.pm/oban/Oban.html) *Note:* This framework integrates with Render Postgres instead of Key Value. |
| *Rust* | [apalis](https://github.com/geofmureithi/apalis) |
