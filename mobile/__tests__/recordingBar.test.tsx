import { act, fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { RecordingBar } from '../src/features/messages/RecordingBar';
import type { RecordingSession } from '../src/media/voiceRecorder';
import { renderThemed } from './helpers/render';

/** Barre d'enregistrement : durée écoulée, arrêt automatique à 2 minutes, envoi, annulation, abandon à la fermeture de l'écran. */

jest.mock('../src/media/voiceRecorder', () => ({ MAX_VOICE_SECONDS: 120 }));

const RECORDING = { uri: 'file:///v.m4a', durationSeconds: 5 };

function session(): RecordingSession & { stop: jest.Mock; cancel: jest.Mock } {
  return { stop: jest.fn(async () => RECORDING), cancel: jest.fn(async () => undefined) };
}

const tick = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('RecordingBar', () => {
  it('affiche la durée écoulée en m:ss, mise à jour en continu', async () => {
    await renderThemed(<RecordingBar session={session()} onSend={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByTestId('recording-time')).toHaveTextContent('0:00');
    await tick(3_000);
    expect(screen.getByTestId('recording-time')).toHaveTextContent('0:03');
    await tick(62_000);
    expect(screen.getByTestId('recording-time')).toHaveTextContent('1:05');
    expect(screen.queryByTestId('recording-limit')).toBeNull();
  });

  it('« Envoyer » arrête l’enregistrement et remet le fichier, une seule fois', async () => {
    const s = session();
    const onSend = jest.fn();
    await renderThemed(<RecordingBar session={s} onSend={onSend} onCancel={jest.fn()} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('recording-send'));
    });
    expect(s.stop).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith(RECORDING);
    expect(s.cancel).not.toHaveBeenCalled();
  });

  it('« Annuler » abandonne l’enregistrement sans rien remettre', async () => {
    const s = session();
    const onSend = jest.fn();
    const onCancel = jest.fn();
    await renderThemed(<RecordingBar session={s} onSend={onSend} onCancel={onCancel} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('recording-cancel'));
    });
    expect(s.cancel).toHaveBeenCalledTimes(1);
    expect(s.stop).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('à 2 minutes l’enregistrement s’arrête seul ; la note reste à envoyer ou à annuler, sans rien envoyer d’office', async () => {
    const s = session();
    const onSend = jest.fn();
    await renderThemed(<RecordingBar session={s} onSend={onSend} onCancel={jest.fn()} />);

    await tick(119_000);
    expect(s.stop).not.toHaveBeenCalled();

    await tick(2_000);
    expect(s.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('recording-limit')).toHaveTextContent('Durée maximale atteinte (2 minutes)');
    expect(screen.getByTestId('recording-time')).toHaveTextContent('2:00');
    expect(onSend).not.toHaveBeenCalled();

    await tick(10_000);
    expect(s.stop).toHaveBeenCalledTimes(1);
  });

  it('après l’arrêt automatique, « Envoyer » remet la note déjà arrêtée, sans second arrêt', async () => {
    const s = session();
    const onSend = jest.fn();
    await renderThemed(<RecordingBar session={s} onSend={onSend} onCancel={jest.fn()} />);
    await tick(121_000);

    await act(async () => {
      fireEvent.press(screen.getByTestId('recording-send'));
    });

    expect(s.stop).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith(RECORDING);
  });

  it('fermer l’écran pendant l’enregistrement l’abandonne et rend le micro', async () => {
    const s = session();
    const view = await renderThemed(<RecordingBar session={s} onSend={jest.fn()} onCancel={jest.fn()} />);
    await act(async () => view.unmount());
    expect(s.cancel).toHaveBeenCalledTimes(1);
  });

  it('fermer l’écran après l’envoi ne l’abandonne pas une seconde fois', async () => {
    const s = session();
    const view = await renderThemed(<RecordingBar session={s} onSend={jest.fn()} onCancel={jest.fn()} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('recording-send'));
    });
    await act(async () => view.unmount());
    expect(s.cancel).not.toHaveBeenCalled();
  });

  it('annonce l’enregistrement aux lecteurs d’écran avec la durée, et nomme chaque bouton', async () => {
    await renderThemed(<RecordingBar session={session()} onSend={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByTestId('recording-bar')).toHaveAccessibleName('Enregistrement en cours, 0:00');
    expect(screen.getByLabelText('Annuler l’enregistrement')).toBeOnTheScreen();
    expect(screen.getByLabelText('Envoyer le message vocal')).toBeOnTheScreen();
  });
});
