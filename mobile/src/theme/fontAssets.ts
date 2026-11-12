import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { fontFamily } from './tokens';

/**
 * Polices de l'identité (Poppins, SIL OFL). Import par graisse (jamais la racine du paquet : Metro embarquerait
 * les 18 variantes, soit environ 2,7 Mo). Les noms de famille viennent des jetons (design/tokens.json).
 * Seules les quatre graisses utilisées par l'échelle typographique sont chargées.
 */
export const FONT_ASSETS = {
  [fontFamily[400]]: Poppins_400Regular,
  [fontFamily[500]]: Poppins_500Medium,
  [fontFamily[600]]: Poppins_600SemiBold,
  [fontFamily[700]]: Poppins_700Bold,
};
