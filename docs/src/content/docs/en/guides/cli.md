---
title: CLI Mode
description: Using Law Assistant from the command line.
---

The CLI (Command Line Interface) is ideal for developers, automation scripts, and quick queries without a browser.

## Basic Usage

### Interactive Mode

Start a persistent session where you can ask multiple questions:

```bash
pnpm cli
```

Once started, just type your question and hit Enter. Type `exit` or press `Ctrl+C` to quit.

### Single Query Mode

Ask a question directly as an argument:

```bash
pnpm cli "What are the rules for overtime pay in Japan?"
```

## Advanced Features

### Piping and Redirection

You can pipe questions from other commands or files:

```bash
# Ask from a text file
cat question.txt | pnpm cli

# Save response to a file
pnpm cli "Summarize the Civil Code Article 1" > summary.txt
```

### JSON Output

For automation, you might want structured data:

```bash
pnpm cli "Query" --json
```

## Configuration for CLI

The CLI uses the same `.env` configuration as the main server. Ensure `LLM_API_KEY` and `DATABASE_URL` are set.

The CLI also respects `ALLOWED_MCP_TOOLS`. If you want to disable specific tools for CLI sessions, you can use a separate `.env.cli` file:

```bash
# Run CLI with a specific environment file
DOTENV_CONFIG_PATH=.env.cli pnpm cli
```

## Use Cases

- **CI/CD Integration**: Automatically check legal compliance in documentation.
- **Local Research**: Fast lookup of law IDs and text.
- **Data Scraping**: Batch process multiple legal scenarios and save results.

## Next Steps

- Learn about [LINE Bot Integration](../../guides/line-bot/).
- See the [Full Environment Reference](../../config/environment/).
