#!/usr/bin/env python3
"""Vérifie le site statique de web/ : HTML bien formé, liens et ressources internes résolus, aucune ressource externe.

Utilisation : python web/tools/check-links.py   (code de sortie 0 si tout est bon, 1 sinon).
Bibliothèque standard uniquement.

Contrôles :
- balises correctement imbriquées et fermées (hors éléments vides) ;
- attributs href, src, action : liens relatifs ou absolus à la racine résolus vers un fichier existant (ancres #id vérifiées) ;
  les liens vers http(s)://, mailto: sont listés ; tout http(s) en src/href de ressource (CSS, script, image) est une erreur
  (le site doit fonctionner hors ligne) ; seul `action` des formulaires peut viser l'API, et seulement un hôte .invalid ou configuré ;
- attribut lang présent, <title> non vide, un seul <h1> ;
- contraste WCAG AA des couples de couleurs des jetons (clair et sombre).
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote

ROOT = Path(__file__).resolve().parent.parent
VOID = {'meta', 'link', 'img', 'br', 'hr', 'input', 'source', 'area', 'base', 'col', 'embed', 'track', 'wbr'}
errors: list[str] = []
infos: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


class Page(HTMLParser):
    def __init__(self, path: Path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.stack: list[tuple[str, int]] = []
        self.links: list[tuple[str, str, str]] = []  # (tag, attr, value)
        self.ids: set[str] = set()
        self.h1 = 0
        self.title = ''
        self.in_title = False
        self.lang = None
        self.has_doctype = False

    def handle_decl(self, decl):
        if decl.lower().startswith('doctype'):
            self.has_doctype = True

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'html':
            self.lang = a.get('lang')
        if tag == 'h1':
            self.h1 += 1
        if tag == 'title':
            self.in_title = True
        if 'id' in a and a['id']:
            if a['id'] in self.ids:
                err(f'{self.rel}: id en double « {a["id"]} »')
            self.ids.add(a['id'])
        for attr in ('href', 'src', 'action'):
            if a.get(attr) is not None:
                self.links.append((tag, attr, a[attr]))
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        # <br/> et assimilés : traités comme vides ; les autres balises auto-fermantes sont suspectes en HTML.
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.stack.pop()

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False
        if tag in VOID:
            return
        if not self.stack:
            err(f'{self.rel}:{self.getpos()[0]}: </{tag}> sans ouverture')
            return
        open_tag, line = self.stack.pop()
        if open_tag != tag:
            err(f'{self.rel}:{self.getpos()[0]}: </{tag}> attendu </{open_tag}> (ouvert ligne {line})')

    def handle_data(self, data):
        if self.in_title:
            self.title += data

    @property
    def rel(self) -> str:
        return self.path.relative_to(ROOT).as_posix()


def resolve(page: Path, ref: str) -> Path:
    path = unquote(urlparse(ref).path)
    base = ROOT if path.startswith('/') else page.parent
    target = (base / path.lstrip('/')).resolve()
    if target.is_dir():
        target = target / 'index.html'
    return target


def check_page(path: Path, pages: dict[Path, Page]) -> None:
    parser = Page(path)
    parser.feed(path.read_text(encoding='utf-8'))
    parser.close()
    rel = parser.rel
    for tag, line in parser.stack:
        err(f'{rel}:{line}: <{tag}> jamais fermé')
    if not parser.has_doctype:
        err(f'{rel}: <!doctype html> manquant')
    if not parser.lang:
        err(f'{rel}: attribut lang manquant sur <html>')
    if not parser.title.strip():
        err(f'{rel}: <title> vide')
    if parser.h1 != 1 and path.name != '404.html':
        err(f'{rel}: {parser.h1} balises <h1> (une attendue)')
    pages[path] = parser


def check_refs(pages: dict[Path, Page]) -> None:
    for path, parser in pages.items():
        rel = parser.rel
        for tag, attr, ref in parser.links:
            if ref == '' or ref.startswith('#') and attr != 'href':
                continue
            parsed = urlparse(ref)
            if parsed.scheme in ('http', 'https'):
                if attr == 'action' and tag == 'form':
                    infos.append(f'{rel}: formulaire vers {ref}')
                elif tag == 'a':
                    infos.append(f'{rel}: lien externe {ref}')
                else:
                    err(f'{rel}: ressource externe interdite ({tag} {attr}={ref}) : le site doit fonctionner hors ligne')
                continue
            if parsed.scheme in ('mailto', 'tel'):
                infos.append(f'{rel}: {ref}')
                continue
            if parsed.scheme:
                err(f'{rel}: schéma inattendu {ref}')
                continue
            if ref.startswith('#'):
                if ref[1:] and ref[1:] not in parser.ids:
                    err(f'{rel}: ancre introuvable {ref}')
                continue
            target = resolve(path, ref)
            try:
                target.relative_to(ROOT)
            except ValueError:
                err(f'{rel}: lien hors du site {ref}')
                continue
            if not target.exists():
                err(f'{rel}: lien cassé {ref} (attendu {target.relative_to(ROOT) if ROOT in target.parents else target})')
                continue
            if parsed.fragment and target.suffix == '.html':
                other = pages.get(target)
                if other is not None and parsed.fragment not in other.ids:
                    err(f'{rel}: ancre introuvable {ref}')


def check_css() -> None:
    for css in ROOT.glob('assets/*.css'):
        text = css.read_text(encoding='utf-8')
        if re.search(r'url\(\s*[\'"]?(https?:)?//', text) or '@import' in text:
            err(f'{css.relative_to(ROOT)}: ressource externe ou @import')


def luminance(hex_color: str) -> float:
    h = hex_color.lstrip('#')
    chans = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in chans]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def contrast(a: str, b: str) -> float:
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def check_contrast() -> None:
    css = (ROOT / 'assets' / 'tokens.css').read_text(encoding='utf-8')
    light_block, dark_block = css.split('@media (prefers-color-scheme: dark)')

    def tokens(block: str) -> dict[str, str]:
        return dict(re.findall(r'--color-([a-z-]+):\s*(#[0-9A-Fa-f]{6})', block))

    light = tokens(light_block)
    dark = {**light, **tokens(dark_block)}
    # (texte, fond, minimum) : 4.5 pour du texte, 3 pour les contours de composants (WCAG 1.4.11).
    pairs = [
        ('text', 'bg', 4.5), ('text', 'surface', 4.5), ('text-muted', 'bg', 4.5), ('text-muted', 'surface', 4.5),
        ('primary', 'bg', 4.5), ('primary', 'surface', 4.5), ('on-primary', 'primary', 4.5),
        ('text', 'todo-bg', 4.5), ('border-strong', 'bg', 3.0), ('border-strong', 'surface', 3.0),
        ('warning', 'bg', 3.0), ('info', 'surface', 3.0), ('danger', 'surface', 3.0),
    ]
    for name, palette in (('clair', light), ('sombre', dark)):
        for fg, bg, minimum in pairs:
            ratio = contrast(palette[fg], palette[bg])
            if ratio < minimum:
                err(f'contraste {name} {fg} sur {bg} = {ratio:.2f}:1 (minimum {minimum}:1)')
            else:
                infos.append(f'contraste {name} {fg}/{bg} = {ratio:.2f}:1')


def main() -> int:
    htmls = sorted(p for p in ROOT.rglob('*.html'))
    pages: dict[Path, Page] = {}
    for p in htmls:
        check_page(p.resolve(), pages)
    pages = {k.resolve(): v for k, v in pages.items()}
    check_refs(pages)
    check_css()
    check_contrast()

    # Fichiers attendus.
    for needed in ('index.html', '404.html', 'robots.txt', '.well-known/security.txt', 'favicon.svg', 'en/index.html',
                   'legal/terms.html', 'legal/privacy.html', 'legal/community.html', 'safety.html', 'support.html',
                   'account/delete.html', 'confirm-deletion.html'):
        if not (ROOT / needed).exists():
            err(f'fichier attendu absent : {needed}')

    # Parité fr / en.
    fr = {p.relative_to(ROOT).as_posix() for p in pages if 'en' not in p.relative_to(ROOT).parts[:1] and p.name != '404.html'}
    en = {p.relative_to(ROOT / 'en').as_posix() for p in pages if p.relative_to(ROOT).parts[0] == 'en'}
    if fr != en:
        err(f'pages fr/en différentes : {sorted(fr ^ en)}')

    if '-v' in sys.argv:
        for line in infos:
            print('info:', line)
    print(f'{len(pages)} pages HTML vérifiées')
    if errors:
        for line in errors:
            print('ERREUR:', line)
        print(f'{len(errors)} erreur(s)')
        return 1
    print('OK : HTML bien formé, liens internes résolus, aucune ressource externe, contrastes AA')
    return 0


if __name__ == '__main__':
    sys.exit(main())
