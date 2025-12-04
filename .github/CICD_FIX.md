# CI/CD Pipeline - Configuration Corrigée

## 🔧 Problème Résolu

L'erreur `denied: permission_denied: The requested installation does not exist` a été corrigée en modifiant la configuration du workflow GitHub Actions.

## ✅ Solutions Implémentées

### 1. **Permissions Correctes pour le Job**

Le job `build` dispose maintenant des permissions nécessaires :

```yaml
permissions:
  contents: read
  packages: write      # Permission d'écrire dans GHCR
  id-token: write      # Pour l'authentification
```

### 2. **Utilisation de l'Action Docker Login**

Au lieu d'utiliser une commande shell manuelle, nous utilisons l'action officielle `docker/login-action@v2` qui gère mieux l'authentification :

```yaml
- name: Login to GitHub Container Registry
  uses: docker/login-action@v2
  with:
    registry: ${{ env.REGISTRY }}
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
```

**Avantages :**
- Gestion automatique des credentials
- Meilleur support du `GITHUB_TOKEN`
- Pas besoin de conversion manuelle du username en minuscules

### 3. **Actions Modernes pour Build et Push**

Utilisation de `docker/build-push-action@v4` avec :
- Support du cache GitHub Actions
- Metadata automatiques
- Tags multiples
- Labels standardisés

## 📋 Structure du Pipeline

Le workflow contient 4 jobs :

1. **trufflehog** : Scan des secrets dans le code
2. **trivy** : Scan de sécurité (vulnérabilités)
3. **build** : Build et push des images Docker vers GHCR
4. **deploy** : Déploiement (uniquement sur main)

## 🔑 Pas de PAT Nécessaire

Avec cette configuration, **aucun Personal Access Token (PAT) supplémentaire n'est requis**. Le `GITHUB_TOKEN` fourni automatiquement par GitHub Actions est suffisant grâce aux permissions correctes.

## 🚀 Pour Utiliser ce Workflow

1. Le fichier est déjà créé dans `.github/workflows/cicd.yml`
2. Committez et pushez vos changements
3. Le workflow se déclenchera automatiquement sur :
   - Push sur `main` ou `develop`
   - Pull requests vers `main`

## 📦 Images Docker Générées

Les images seront disponibles sur :
- `ghcr.io/[votre-organisation]/[repo]/backend:[tag]`
- `ghcr.io/[votre-organisation]/[repo]/frontend:[tag]`

Les tags générés incluent :
- Nom de la branche
- SHA du commit
- Version sémantique (si applicable)

## 🔐 Sécurité

- Les scans TruffleHog et Trivy s'exécutent avant le build
- Les résultats Trivy sont uploadés vers GitHub Security
- Le déploiement ne se fait que sur la branche `main`
