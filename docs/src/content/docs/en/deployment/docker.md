---
title: Docker Deployment
description: Deploying Law Assistant using Docker and Docker Compose.
---

We recommend using Docker for deploying Law Assistant in production. This ensures a consistent environment for the Node.js server, PostgreSQL, and all bundled MCP servers.

## Single-Container Strategy

For simplicity, we provide a "batteries-included" Docker setup that runs the application and the database in a unified way (managed by `supervisord` inside the container).

### Using `docker-compose-demo.yaml`

This is the recommended method for most users.

1.  **Clone the Repo**:
    ```bash
    git clone https://github.com/lijunjie2232/mylawer.git
    cd mylawer
    ```

2.  **Configure Environment**:
    Open `docker-compose-demo.yaml` and fill in the placeholders:
    - `LLM_API_KEY`: Your provider key.
    - `LLM_BASE_URL`: (Optional) Custom endpoint.
    - `POSTGRES_PASSWORD`: A secure password for the internal DB.
    - `JWT_SECRET`: A long random string.

3.  **Launch**:
    ```bash
    docker-compose -f docker-compose-demo.yaml up -d --build
    ```

## Persistence

By default, the demo compose file creates a volume for PostgreSQL. This ensures your chat history and user accounts survive container restarts.

```yaml
# In docker-compose-demo.yaml
volumes:
  postgres_data:
    driver: local
```

## Advanced Deployment

If you already have a PostgreSQL instance and want to run only the application in Docker:

1.  Modify the `Dockerfile_demo` to remove the postgres installation steps.
2.  Set `DATABASE_URL` to your external instance.
3.  Ensure the application container can network-reach the database.

## Troubleshooting

### Logs
Check the status of all processes (App, Postgres, MCP Servers) inside the container:
```bash
docker logs -f las
```

### Database Initialization
On the first run, the container executes `RUN_MIGRATIONS=true` and `INIT_ADMIN=true`. If these fail, check your `DATABASE_URL` and ensure the postgres process has started successfully.

## Next Steps

- Review the [Security & Auth checklist](../../deployment/security/).
- Explore the [API Reference](../../reference/api/).
