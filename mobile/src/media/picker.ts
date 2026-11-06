import * as ImagePicker from 'expo-image-picker';

export type PickedImage = { uri: string; mimeType: string | null; fileSize: number | null };
export type PickSource = 'library' | 'camera';
export type PickResult =
  | { kind: 'picked'; image: PickedImage }
  | { kind: 'cancelled' }
  | { kind: 'denied' };

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
