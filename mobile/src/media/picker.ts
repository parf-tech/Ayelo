import * as ImagePicker from 'expo-image-picker';

export type PickedImage = { uri: string; mimeType: string | null; fileSize: number | null };
export type PickSource = 'library' | 'camera';
export type PickResult =
  | { kind: 'picked'; image: PickedImage }
  | { kind: 'cancelled' }
  | { kind: 'denied' };

/** Vidéo choisie : `durationSeconds` est null quand le système ne la donne pas (le serveur la mesure alors lui-même). */
export type PickedVideo = PickedImage & { durationSeconds: number | null };
export type PickVideoResult = { kind: 'picked'; video: PickedVideo } | { kind: 'cancelled' };

/**
 * Sélection d'une image (galerie ou caméra) derrière une fonction simple, remplaçable dans les tests.
 * La galerie utilise le sélecteur système (aucune permission requise) ; la caméra demande la permission.
 */
export async function pickImage(source: PickSource): Promise<PickResult> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.8,
    allowsMultipleSelection: false,
  };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { kind: 'denied' };
    result = await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front });
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { kind: 'cancelled' };
  return { kind: 'picked', image: { uri: asset.uri, mimeType: asset.mimeType ?? null, fileSize: asset.fileSize ?? null } };
}

/**
 * Choix d'une vidéo dans la galerie (sélecteur système : aucune permission). Durée plafonnée à 30 secondes par le sélecteur quand
 * il le sait, 720 pt sur iOS (`H264_1280x720`) pour rester sous 50 Mo ; l'écran vérifie tout de même durée, poids et format, et le
 * serveur reste juge.
 */
export async function pickVideo(): Promise<PickVideoResult> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsMultipleSelection: false,
    videoMaxDuration: 30,
    videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { kind: 'cancelled' };
  return {
    kind: 'picked',
    video: {
      uri: asset.uri,
      mimeType: asset.mimeType ?? null,
      fileSize: asset.fileSize ?? null,
      durationSeconds: typeof asset.duration === 'number' ? Math.max(1, Math.ceil(asset.duration / 1000)) : null,
    },
  };
}
