export interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

export function getNetworkInformation(): NetworkInformationLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

/**
 * Retourne true sur connexion contrainte (mode économie de données, 2G ou slow-2g)
 * afin d'éviter le téléchargement automatique de médias lourds au chargement initial.
 */
export function isSlowOrConstrainedNetwork(
  connection: NetworkInformationLike | null = getNetworkInformation(),
): boolean {
  if (!connection) return false;
  if (connection.saveData === true) return true;
  const effectiveType = (connection.effectiveType ?? '').toLowerCase();
  return effectiveType === 'slow-2g' || effectiveType === '2g';
}
