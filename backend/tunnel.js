const fs = require("node:fs");
const path = require("node:path");
const localtunnel = require("localtunnel");

const port = Number(process.env.PORT || 8787);
const urlFile = path.join(__dirname, "..", "tunnel-url.txt");

async function main() {
  const tunnel = await localtunnel({ port });
  fs.writeFileSync(urlFile, tunnel.url, "utf8");
  console.log(`Tunnel ready: ${tunnel.url}`);

  tunnel.on("close", () => {
    console.log("Tunnel closed");
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
