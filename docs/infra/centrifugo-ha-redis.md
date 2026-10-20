# Centrifugo High-Availability Upgrade Plan: Memory to Redis / Valkey Engine

## 1. Context and Single-Node Memory Engine Boundary

In Phase 3 initial staging and production rollout, Centrifugo operates with a **single-node memory engine**:
- Memory engine stores channel history, short recovery queues, and connection presence in process memory.
- Running two independent memory-engine containers behind a round-robin load balancer is **NOT** a cluster: messages published on Node A will not be delivered to clients connected to Node B.
- Therefore, single-node memory engine operates strictly as `replicas: 1`.

When scaling beyond a single node is authorized for horizontal scalability and high availability, the engine must be upgraded to **Redis** or **Valkey**.

---

## 2. Target Multi-Node Architecture

```
                    [ Public Load Balancer / Reverse Proxy ]
                               |             |
                     +---------+             +---------+
                     |                                 |
         [ Centrifugo Node 1 ]             [ Centrifugo Node 2 ]
                     \                                 /
                      \                               /
            [ Authenticated TLS-protected Redis / Valkey Cluster ]
                    (Primary / Replica with Sentinel or Valkey Cluster)
```

---

## 3. Centrifugo v6 Configuration for Redis Engine

In `centrifugo.config.json` (or via environment variables), replace the default memory engine with:

```json
{
  "engine": {
    "type": "redis",
    "redis": {
      "address": [
        "rediss://default:PASSWORD@redis-node-1.internal:6379",
        "rediss://default:PASSWORD@redis-node-2.internal:6379"
      ],
      "password": "${REDIS_PASSWORD}",
      "tls": true,
      "connect_timeout": "5s",
      "read_timeout": "3s",
      "write_timeout": "3s",
      "idle_timeout": "60s"
    }
  }
}
```

### Redis Sentinel Alternative (for HA Primary/Replica Failover)

```json
{
  "engine": {
    "type": "redis",
    "redis": {
      "sentinel": {
        "master_name": "mymaster",
        "sentinel_addresses": [
          "redis-sentinel-1.internal:26379",
          "redis-sentinel-2.internal:26379",
          "redis-sentinel-3.internal:26379"
        ],
        "sentinel_password": "${REDIS_SENTINEL_PASSWORD}"
      },
      "password": "${REDIS_PASSWORD}",
      "tls": true
    }
  }
}
```

---

## 4. Operational Migration Procedure (Zero-Downtime)

1. **Pre-flight Readiness:**
   - Provision managed Redis / Valkey cluster with TLS enabled and password authentication.
   - Verify network latency between application/Centrifugo subnets and Redis (< 2ms).
   - Verify Redis memory sizing: at least 2 GB RAM reserved for channel history and presence keys.

2. **Configuration Update in Staging:**
   - Deploy Centrifugo with `engine.type: redis` in staging.
   - Run verification suite: multi-client publish and subscribe across separate nodes.

3. **Production Cutover:**
   - Deploy Centrifugo Node 1 with Redis engine.
   - Verify connection and Redis pub/sub streams.
   - Scale Centrifugo to `replicas: 2+`.
   - Update reverse proxy upstream to load balance across all Centrifugo nodes.

4. **Rollback Plan:**
   - If Redis connection degrades or fails, revert `engine.type` to `memory` and scale down to 1 node.
   - PostgreSQL outbox worker will continue retrying undelivered messages; no messages are lost during cutover or rollback.
