// Point d'entrée pour Vercel : chaque requête (voir vercel.json) est
// routée ici, et Vercel exécute l'app Express comme une fonction
// serverless. `src/index.ts` détecte `process.env.VERCEL` et n'appelle
// pas `app.listen()` dans ce contexte.
import app from '../src/index'

export default app
