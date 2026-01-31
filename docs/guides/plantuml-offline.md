# Using PlantUML with AutoFix Mermaid

AutoFix Mermaid supports rendering PlantUML diagrams.
By default, it uses the public PlantUML server (`https://www.plantuml.com/plantuml`).
However, for offline usage or enhanced privacy, you can run a local PlantUML server.

## Offline Mode Requirements

To run PlantUML offline, you need:
1.  **Java Runtime Environment (JRE)** installed (Java 8 or newer).
2.  **Graphviz** installed (for rendering diagrams).
    - Windows: `choco install graphviz` or download installer.
    - macOS: `brew install graphviz`.
    - Linux: `sudo apt install graphviz`.

## Running the Local Server

You have two options to run the local server:

### Option A: Using the Built-in Script (Recommended)

This project includes a downloaded `plantuml.jar` in `assets/plantuml/`. You can start it easily:

1.  Open a terminal in the project root.
2.  Run:
    ```bash
    npm run start:plantuml
    ```
3.  The server will start at `http://localhost:8081`.

### Option B: Using Docker

If you prefer Docker and don't want to install Java/Graphviz locally:

1.  Run:
    ```bash
    docker-compose -f docker-compose.plantuml.yml up -d
    ```
2.  The server will start at `http://localhost:8081`.

## Configuring AutoFix Mermaid

1.  Open the AutoFix Mermaid application.
2.  In the toolbar, locate the "PlantUML Server" input field.
3.  Enter your local server URL: `http://localhost:8081`.
    - Note: If using the JAR script (Option A), ensure the URL is exactly `http://localhost:8081`.
    - If using Docker (Option B), it is also `http://localhost:8081`.
4.  The application will now render PlantUML diagrams using your local server.

## Troubleshooting

- **"Graphviz not found"**: Ensure `dot` command is in your system PATH.
- **"Java not found"**: Ensure `java` is in your system PATH.
- **Port 8081 in use**: Edit `scripts/start-plantuml.js` or `docker-compose.plantuml.yml` to change the port.
