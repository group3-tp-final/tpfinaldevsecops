# Clicker Game Platform – DevSecOps Edition

Plateforme web reposant sur un backend Go, un frontend statique servi par Nginx et une base de données PostgreSQL.  
Le projet est entièrement conteneurisé, scanné via des outils DevSecOps et déployé automatiquement grâce à un pipeline CI/CD GitHub Actions vers Coolify.


---

### Vue générale
```
                ┌─────────────────────┐
                │      Frontend       │
                │  Nginx (port 80)    │
                └─────────┬──────────┘
                          │ HTTP
                          ▼
                ┌─────────────────────┐
                │     Backend API     │
                │ Go (port 8081/3000) │
                └─────────┬──────────┘
                          │ TCP
                          ▼
                ┌─────────────────────┐
                │    PostgreSQL 15    │
                │     clicker DB      │
                └─────────────────────┘
```

### Composants
- **Frontend** — Application statique (HTML/CSS/JS) servie via Nginx
- **Backend** — API REST en Go (logique du jeu, leaderboard, achievements)
- **Base de données** — PostgreSQL 15
- **Orchestration** — Docker & Docker Compose
- **CI/CD** — GitHub Actions + GHCR
- **Sécurité** — Trufflehog (secrets), Trivy (SAST)
- **Déploiement** — Coolify (plates-formes containerisées)

---

## Technologies

| Domaine | Technologie |
|--------|-------------|
| Backend | Go 1.21 |
| Frontend | Nginx stable-alpine |
| Base de données | PostgreSQL 15 |
| Orchestration | Docker / Docker Compose |
| Registry | GitHub Container Registry (GHCR) |
| CI/CD | GitHub Actions |
| Audit sécurité | Trivy, Trufflehog |
| Déploiement | Coolify |

---

## Installation & exécution locale

### 1. Créer un fichier `.env` (NON versionné)
Ce fichier contient les secrets locaux.  
Le fichier `.env.example` est fourni comme modèle.

#### Exemple `.env`
```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=clicker
POSTGRES_DB=clicker

DB_HOST=database
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=clicker
DB_NAME=clicker

PORT=8081
```

### 2. Lancer l’application
```
docker compose up --build
```

### 3. Accès aux services
| Service | URL |
|--------|-----|
| Frontend | http://localhost:33000 |
| Backend API | http://localhost:8081 |
| PostgreSQL | localhost:5432 |

---

## Endpoints Backend (API REST)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/leaderboard` | Renvoie le classement |
| POST | `/api/scores` | Enregistre un score |
| GET | `/api/achievements` | Liste les achievements |
| GET | `/api/achievements/:username` | Achievements utilisateur |

---

## Gestion des secrets (pas de bétise Guillaume)

- Les secrets NE DOIVENT PAS être commités  
- `.env` est ignoré via `.gitignore`
- `.env.example` est versionné comme modèle
- Le CI scanne automatiquement le code via **Trufflehog**

Ainsi, la sécurité est respectée tout en documentant les variables nécessaires.

---

## Pipeline CI/CD — GitHub Actions

Le pipeline s’exécute sur :

- `main`  
- `develop`  
- `feature/*`
- `refacto/*`

### Étapes CI

####  1. Trufflehog  
Scan des secrets potentiels dans le repository.

#### 2. Trivy  
Scan des vulnérabilités HIGH/CRITICAL dans le code et les dépendances.

#### 3. Build Docker  
Build backend Go (multi-stage → image légère).

#### 4. Push GHCR  
Push de l'image `tpfinal-backend:latest` dans GHCR.

### Étape CD

#### 5. Déploiement automatique  
Via webhook → déclenche un redeploy automatique dans Coolify.

---

## Structure du projet

```
.
├── backend/                # API Go (Dockerfile + sources)
├── frontend/               # Frontend Nginx + assets
├── database/               # Scripts init SQL
├── .github/workflows/      # CI/CD
│   └── cicd.yml
├── docker-compose.yml
├── .env.example
└── README.md
```

---


## Administration

Accès administrateur fourni à :  
**guillaume@twelveparsecs.co**
**chmawete2@gmail.com**
**galdric.tingaud@gmail.com**
**romainlannoy@outlook.fr**

Pour supervision des pipelines, logs et secrets.

---