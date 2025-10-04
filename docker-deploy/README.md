# Miningcore Docker Stack

This folder contains a self-contained Docker Compose deployment of the Miningcore pool stack, including:

- Miningcore (custom build with Octa/BCH/BTC configuration)
- Stratum UI (`webui` and Next.js `webui2`)
- Supporting services (Postgres, Grafana, Prometheus, nginx)
- Sample node configurations for Bitcoin, Bitcoin Cash, Digibyte, and placeholders for Octa & Alephium data directories

## Quick start

```bash
cd docker-deploy
# (optional) adjust sample configs under ./coins and ./miningcore/config
# build & start the stack
sudo docker compose up -d --build
```

All default credentials/passwords are set to `Password@1313`. Please review `docker-compose.yml` and the configs before exposing the stack publicly.

### Services

| Service    | URL                             | Notes                                 |
|------------|----------------------------------|---------------------------------------|
| Miningcore API | `http://localhost:4000/api`  | Pool API and Prometheus metrics       |
| Web UI 2   | `http://localhost:5000/`         | Next.js dashboard                     |
| Legacy Web UI | `http://localhost:3000/`      | Angular-based interface                |
| Grafana    | `http://localhost:3001/`         | Username: `admin`, Password: `Password@1313` |
| nginx index | `http://localhost/`             | Links to plan and docs                |

### Data directories

The `./coins/**` folders are bind-mounted into the corresponding node containers. The provided configuration files supply RPC credentials and baseline settings, but block data will sync from scratch.

- `coins/btc/bitcoin.conf`
- `coins/bch/bch.conf`
- `coins/dgb/digibyte.conf`
- `coins/octa/` and `coins/alph/` contain `.gitkeep` placeholders so you can drop DAG/chain data later.

### Customising

- Update RPC usernames/passwords if you intend to run in production.
- Adjust pool definitions in `./miningcore/config/config.json` and `./miningcore/coins.json`.
- For alternative hosts/IPs, tweak the `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_STRATUM_HOST` variables in `docker-compose.yml`.

### Teardown

```bash
cd docker-deploy
sudo docker compose down
```

This stops containers but leaves chain data under `./coins` and persistent volumes intact.
