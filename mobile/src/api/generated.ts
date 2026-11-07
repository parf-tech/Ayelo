// Pont entre le contrat OpenAPI généré (openapi.d.ts, produit par `npm run api:types`) et le code de l'application.
// Les types de ce fichier n'existent qu'à la compilation : aucun effet à l'exécution.
import type { operations } from './openapi';

export type OperationId = keyof operations;

type JsonContent<T> = T extends { content: { 'application/json': infer B } } ? B : never;

/** Corps JSON de la requête de l'opération `K` (ex. 'auth.login'). */
export type OpRequest<K extends OperationId> = operations[K] extends { requestBody?: infer R }
  ? JsonContent<NonNullable<R>>
  : never;

/** Corps JSON de la réponse `S` (200 par défaut) de l'opération `K`. */
export type OpResponse<K extends OperationId, S extends number = 200> = operations[K]['responses'] extends infer R
  ? S extends keyof R
    ? JsonContent<R[S]>
    : never
  : never;

/** Élément d'un tableau (ex. `Item<OpResponse<'match.index'>['data']>`). */
export type Item<T> = T extends readonly (infer I)[] ? I : never;

/**
 * Le contrat généré reste la base ; `Over` corrige les champs que le générateur élargit ou décrit mal
 * (ex. `age` typé string, énumérations réduites à string). Une clé de `Over` absente du contrat est une erreur
 * de compilation : si le contrat change, le compilateur le signale ici.
 */
export type Refine<Base, Over extends { [P in keyof Over]: P extends keyof Base ? unknown : never }> = Omit<
  Base,
  keyof Over
> &
  Over;
