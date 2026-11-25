<?php

// Photo d'essai du banc de charge (3000 x 2000, bruitée, toujours la même) : un ré-encodage représentatif d'un téléphone.
// Écrit le JPEG sur la sortie standard.
$image = imagecreatetruecolor(3000, 2000);
mt_srand(1);
for ($k = 0; $k < 40000; $k++) {
    $x = mt_rand(0, 2999);
    $y = mt_rand(0, 1999);
    imagefilledrectangle($image, $x, $y, $x + mt_rand(2, 60), $y + mt_rand(2, 60), mt_rand(0, 0xFFFFFF));
}
imagejpeg($image, null, 90);
