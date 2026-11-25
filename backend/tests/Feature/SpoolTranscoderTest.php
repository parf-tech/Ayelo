<?php

use App\Services\Media\SpoolTranscoder;
use Illuminate\Support\Str;

/**
 * Passerelle vers le conteneur `transcode` par dossier partagé (docs/14-DEPLOYMENT.md : « le worker lui passe les fichiers par volume »).
 * Protocole (le script du conteneur, infra/transcode/, applique le même) :
 *   in/<id>.src  octets reçus          in/<id>.job  demande {"kind":"audio|video"}, créée en dernier (renommage atomique)
 *   in/<id>.run  demande en cours      out/<id>.bin résultat, out/<id>.json {"mime","duration_ms"},
 *   out/<id>.ok  résultat complet      out/<id>.err traitement refusé (jamais de contenu du fichier)
 */
beforeEach(function () {
    $this->dir = sys_get_temp_dir().'/spool-test-'.Str::uuid();
    mkdir($this->dir.'/in', 0777, true);
    mkdir($this->dir.'/out', 0777, true);
    $this->spool = new SpoolTranscoder($this->dir);
    $this->id = (string) Str::uuid();
});

afterEach(function () {
    foreach (glob($this->dir.'/*/*') ?: [] as $file) {
        @unlink($file);
    }
    @rmdir($this->dir.'/in');
    @rmdir($this->dir.'/out');
    @rmdir($this->dir);
});

it('dépose les octets puis la demande, la demande en dernier', function () {
    expect($this->spool->state($this->id))->toBe('absent');

    $this->spool->submit($this->id, 'audio', 'RAW');

    expect(file_get_contents("{$this->dir}/in/{$this->id}.src"))->toBe('RAW');
    expect(json_decode(file_get_contents("{$this->dir}/in/{$this->id}.job"), true))->toBe(['kind' => 'audio']);
    expect(glob($this->dir.'/in/*.tmp'))->toBe([]);
    expect($this->spool->state($this->id))->toBe('pending');
});

it('reste en attente tant que le conteneur travaille (demande prise en charge)', function () {
    $this->spool->submit($this->id, 'video', 'RAW');
    rename("{$this->dir}/in/{$this->id}.job", "{$this->dir}/in/{$this->id}.run");

    expect($this->spool->state($this->id))->toBe('pending');
});

it('lit le résultat une fois la marque « ok » posée, et pas avant', function () {
    $this->spool->submit($this->id, 'audio', 'RAW');
    file_put_contents("{$this->dir}/out/{$this->id}.bin", 'CLEAN');
    file_put_contents("{$this->dir}/out/{$this->id}.json", json_encode(['mime' => 'audio/mp4', 'duration_ms' => 12_345]));
    expect($this->spool->state($this->id))->toBe('pending');

    touch("{$this->dir}/out/{$this->id}.ok");

    expect($this->spool->state($this->id))->toBe('done');
    expect($this->spool->collect($this->id))->toBe(['bytes' => 'CLEAN', 'mime' => 'audio/mp4', 'duration_ms' => 12_345]);
});

it('signale un traitement refusé', function () {
    $this->spool->submit($this->id, 'audio', 'RAW');
    file_put_contents("{$this->dir}/out/{$this->id}.err", 'unreadable');

    expect($this->spool->state($this->id))->toBe('failed');
});

it('un résultat illisible ou incomplet lève une erreur plutôt que de renvoyer des octets douteux', function () {
    file_put_contents("{$this->dir}/out/{$this->id}.bin", 'CLEAN');
    file_put_contents("{$this->dir}/out/{$this->id}.json", '{pas du json');
    touch("{$this->dir}/out/{$this->id}.ok");

    expect(fn () => $this->spool->collect($this->id))->toThrow(RuntimeException::class);
});

it('l’âge de la demande se compte depuis le dépôt', function () {
    $this->spool->submit($this->id, 'audio', 'RAW');
    touch("{$this->dir}/in/{$this->id}.src", time() - 90);

    expect($this->spool->ageSeconds($this->id))->toBeGreaterThanOrEqual(90)->toBeLessThan(100);
    expect($this->spool->ageSeconds((string) Str::uuid()))->toBe(0);
});

it('supprime tous les fichiers du média', function () {
    $this->spool->submit($this->id, 'audio', 'RAW');
    foreach (['bin', 'json', 'ok', 'err'] as $ext) {
        file_put_contents("{$this->dir}/out/{$this->id}.$ext", 'x');
    }

    $this->spool->discard($this->id);

    expect(glob($this->dir.'/*/*'))->toBe([])->and($this->spool->state($this->id))->toBe('absent');
});

it('refuse un identifiant qui n’est pas un UUID (aucun chemin construit) et un type inconnu', function () {
    foreach (['../../etc/passwd', 'a/b', '', 'x.src', str_repeat('a', 40)] as $bad) {
        expect(fn () => $this->spool->submit($bad, 'audio', 'RAW'))->toThrow(InvalidArgumentException::class);
        expect(fn () => $this->spool->state($bad))->toThrow(InvalidArgumentException::class);
    }
    expect(fn () => $this->spool->submit($this->id, 'subtitle', 'RAW'))->toThrow(InvalidArgumentException::class);
    expect(glob($this->dir.'/*/*'))->toBe([]);
});

it('signale un dossier partagé absent', function () {
    $spool = new SpoolTranscoder($this->dir.'/inexistant');

    expect(fn () => $spool->submit($this->id, 'audio', 'RAW'))->toThrow(RuntimeException::class);
});
