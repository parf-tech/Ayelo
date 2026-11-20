import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useNavigationContainerRef, usePathname, useRouter } from 'expo-router';
import { useAuth } from '../auth/AuthProvider';
import { guardArea } from '../flow/authGuard';
import { pushDestination } from './pushRouting';

type Response = Notifications.NotificationResponse;
type Live = { decision: 'wait' | 'allow' | 'redirect'; pathname: string; router: { push: (href: never) => void } };

/** Lecture défensive : la notification vient du système, sa forme n'est pas garantie. */
function dataOf(notification: unknown): unknown {
  return (notification as { request?: { content?: { data?: unknown } } } | null | undefined)?.request?.content?.data;
}

function identifierOf(response: unknown): string | null {
  const id = (response as { notification?: { request?: { identifier?: unknown } } } | null | undefined)?.notification?.request?.identifier;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * Appel du module de notifications, sans jamais laisser remonter d'exception : certaines plateformes n'ont pas toutes les
 * méthodes (le web n'a pas `getLastNotificationResponse`), et une exception ici ferait tomber la mise en page racine, donc
 * toute l'application. Meilleur effort, comme l'enregistrement du jeton.
 */
function attempt<T>(call: () => T): T | undefined {
  try {
    return call();
  } catch {
    return undefined;
  }
}

/**
 * Traite un toucher, une seule fois par notification. Sans session ouverte ou pendant l'onboarding (garde `guardArea`),
 * le toucher est consommé sans navigation : il n'est pas rejoué plus tard, à la connexion.
 */
function consume(response: Response, live: Live, handled: Set<string>): void {
  const id = identifierOf(response);
  if (id !== null) {
    if (handled.has(id)) return;
    handled.add(id);
  }
  attempt(() => Notifications.clearLastNotificationResponse());
  if (live.decision !== 'allow') return;
  const href = pushDestination(dataOf(response?.notification));
  if (href === null || href === live.pathname) return; // rien à ouvrir, ou conversation déjà affichée
  try {
    live.router.push(href as never);
  } catch {
    // Navigation pas encore prête : le toucher est perdu, sans autre conséquence.
  }
}

/**
 * Vrai quand le navigateur racine est monté : avant, `router.push` lève (« Attempted to navigate before mounting the Root
 * Layout »). Même condition que celle qu'expo-router teste avant de naviguer.
 */
function useNavigationReady(): boolean {
  const ref = useNavigationContainerRef();
  const [ready, setReady] = useState(() => ref.isReady());
  useEffect(() => {
    if (ready) return;
    const sync = () => {
      if (ref.isReady()) setReady(true);
    };
    sync(); // devenu prêt entre le rendu et l'effet
    return ref.addListener('state', sync);
  }, [ready, ref]);
  return ready;
}

/**
 * Réception des notifications push (le jeton est enregistré par `usePushRegistration`).
 *  - Premier plan : une notification qui vise la conversation déjà ouverte n'affiche rien ; sans session ouverte (ou pendant
 *    l'onboarding) rien ne s'affiche non plus. Android n'affiche pas la bannière sans son : le son accompagne donc la bannière.
 *  - Toucher : un message ouvre `/conversation/{id}` (voir `pushDestination`). Un appel ou un `data` mal formé n'ouvre rien.
 *  - Démarrage à froid : le toucher qui a lancé l'application est relu une fois, une fois la session restaurée et le
 *    navigateur monté (un toucher reçu avant est conservé, pas perdu).
 * Aucune permission demandée, aucun contenu de message manipulé, aucune trace.
 */
export function usePushReception(): void {
  const { state } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const navigationReady = useNavigationReady();
  // Navigateur pas monté (démarrage à froid) : même attente que pendant la restauration de la session.
  const decision = navigationReady ? guardArea(state, 'app').kind : 'wait';

  // Valeurs courantes, lues par les rappels du système (installés une seule fois).
  const live = useRef<Live>({ decision, pathname, router });
  const handled = useRef(new Set<string>());
  const waiting = useRef<Response | null>(null);

  useEffect(() => {
    live.current = { decision, pathname, router };
  });

  useEffect(() => {
    attempt(() =>
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          const { decision: now, pathname: here } = live.current;
          const target = pushDestination(dataOf(notification));
          const show = now === 'allow' && !(target !== null && target === here);
          return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
        },
      }),
    );

    const receive = (response: Response | null) => {
      if (!response) return;
      if (live.current.decision === 'wait') {
        waiting.current = response; // session en cours de restauration : on attend son verdict
        return;
      }
      consume(response, live.current, handled.current);
    };
    const subscription = attempt(() => Notifications.addNotificationResponseReceivedListener(receive));
    attempt(() => receive(Notifications.getLastNotificationResponse()));

    return () => {
      attempt(() => subscription?.remove());
      attempt(() => Notifications.setNotificationHandler(null));
    };
  }, []);

  // Verdict de la session connu : le toucher mis en attente est traité (une seule fois).
  useEffect(() => {
    if (decision === 'wait' || waiting.current === null) return;
    const response = waiting.current;
    waiting.current = null;
    consume(response, live.current, handled.current);
  }, [decision]);
}
