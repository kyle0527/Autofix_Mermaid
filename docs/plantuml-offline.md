# Using PlantUML with AutoFix Mermaid

AutoFix Mermaid supports rendering PlantUML diagrams.
By default, it uses the public PlantUML server (`https://www.plantuml.com/plantuml`).
However, for offline usage or enhanced privacy, you can run a local PlantUML server.

## Running a Local PlantUML Server

### Using Docker Compose (Recommended)

This project includes a `docker-compose.plantuml.yml` file to easily start a local PlantUML server.

1.  Ensure you have Docker and Docker Compose installed.
2.  Run the following command in the project root:

    ```bash
    docker-compose -f docker-compose.plantuml.yml up -d
    ```

3.  The server will start at `http://localhost:8081`.

### Manual Docker Run

Alternatively, you can run it directly with Docker:

```bash
docker run -d -p 8081:8080 plantuml/plantuml-server:jetty
```

## Configuring AutoFix Mermaid

1.  Open the AutoFix Mermaid application.
2.  In the toolbar, locate the "PlantUML Server" input field (next to Diagram Size).
3.  Enter your local server URL: `http://localhost:8081`.
4.  The application will now render PlantUML diagrams using your local server.

## Offline Capability

Once the local server is running and configured, you can use the PlantUML rendering feature without an internet connection.
Mermaid rendering is always offline-capable as it runs entirely in the browser.
