const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const JAR_PATH = path.join(__dirname, '../assets/plantuml/plantuml.jar');
const PORT = 8081;

// Check if Java is installed
const checkJava = spawn('java', ['-version']);

checkJava.on('error', () => {
  console.error('❌ Error: Java is not installed or not in PATH.');
  console.error('   Please install Java (JRE 8+) to run the PlantUML server.');
  process.exit(1);
});

checkJava.on('close', (code) => {
  if (code !== 0) {
    // Java might exist but returned error on version check (unlikely but possible)
  }

  console.log(`🚀 Starting PlantUML Server on port ${PORT}...`);
  console.log(`   JAR: ${JAR_PATH}`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log('   (Press Ctrl+C to stop)');

  if (!fs.existsSync(JAR_PATH)) {
    console.error(`❌ Error: plantuml.jar not found at ${JAR_PATH}`);
    process.exit(1);
  }

  // Run: java -jar plantuml.jar -picoweb:8081:127.0.0.1
  // -picoweb starts the simple embedded server
  const server = spawn('java', ['-jar', JAR_PATH, `-picoweb:${PORT}:127.0.0.1`]);

  server.stdout.on('data', (data) => {
    console.log(`[PlantUML] ${data}`);
  });

  server.stderr.on('data', (data) => {
    // PlantUML often prints info to stderr
    console.log(`[PlantUML] ${data}`);
  });

  server.on('close', (code) => {
    console.log(`PlantUML server exited with code ${code}`);
  });
});
