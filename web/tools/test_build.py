#!/usr/bin/env python3
"""Tests du générateur du site (emplacements nommés des mentions légales et catalogue).

Utilisation : python web/tools/test_build.py -v   (bibliothèque standard uniquement).
"""
import importlib.util
import re
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location('build', HERE / 'build.py')
build = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(build)

BLOCK_KEYS = {'terms_publisher', 'terms_pricing', 'terms_liability', 'terms_governing_law', 'terms_changes'}
# Champs « ligne » qui contiennent une adresse : saisis sur plusieurs lignes dans le panneau d'administration.
ADDRESS_KEYS = {'foot_publisher', 'foot_host', 'support_postal_address', 'privacy_controller'}


def render_all():
    """Rend les 16 pages (8 pages, FR et EN) en repartant d'un registre vide."""
    build.FOUND.clear()
    return {(lang, key): build.render(lang, key) for key in build.PATHS for lang in ('fr', 'en')}


def keys_in(html):
    return set(re.findall(r'data-legal(?:-block)?="([a-z0-9_]+)"', html))


class FillTest(unittest.TestCase):
    def setUp(self):
        self.here = build.out_path('fr', 'terms')

    def test_line_marker_is_tagged(self):
        out = build.fill('<p>x {{contact_privacy_email|a}} y</p>', 'fr', self.here, 'terms')
        self.assertIn('<mark class="todo" data-legal="contact_privacy_email">[À COMPLÉTER : a]</mark>', out)

    def test_line_marker_english_text(self):
        out = build.fill('<p>x {{contact_privacy_email|a}} y</p>', 'en', build.out_path('en', 'terms'), 'terms')
        self.assertIn('<mark class="todo" data-legal="contact_privacy_email">[TO BE COMPLETED: a]</mark>', out)

    def test_block_marker_is_wrapped(self):
        out = build.fill('<p>{{terms_pricing|a}}</p>', 'fr', self.here, 'terms')
        self.assertIn('<div data-legal-block="terms_pricing"><p><mark class="todo">[À COMPLÉTER : a]</mark></p></div>', out)

    def test_unknown_key_fails(self):
        with self.assertRaises(ValueError):
            build.fill('<p>{{zzz_inconnue|a}}</p>', 'fr', self.here, 'terms')

    def test_block_marker_must_stand_alone(self):
        with self.assertRaises(ValueError):
            build.fill('<p>texte {{terms_pricing|a}}</p>', 'fr', self.here, 'terms')

    def test_marker_without_hint_fails(self):
        with self.assertRaises(ValueError):
            build.fill('<p>{{contact_privacy_email}}</p>', 'fr', self.here, 'terms')


class PagesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pages = render_all()
        cls.catalog = build.catalog()

    def test_fr_en_pages_share_slot_keys(self):
        for key in build.PATHS:
            self.assertEqual(keys_in(self.pages[('fr', key)]), keys_in(self.pages[('en', key)]), 'page ' + key)

    def test_no_raw_braces_left(self):
        for (lang, key), html in self.pages.items():
            self.assertNotIn('{{', html, f'{lang}/{key}')
            self.assertNotIn('}}', html, f'{lang}/{key}')

    def test_catalog_matches_pages(self):
        union = set()
        for html in self.pages.values():
            union |= keys_in(html)
        slots = self.catalog['slots']
        self.assertEqual(set(slots), union)
        self.assertEqual(self.catalog['version'], 1)
        for key, slot in slots.items():
            self.assertRegex(key, r'^[a-z][a-z0-9_]*$')
            for field in ('label', 'hint'):
                for lang in ('fr', 'en'):
                    self.assertTrue(slot[field][lang].strip(), f'{key}.{field}.{lang}')
            self.assertIn(slot['kind'], ('line', 'block'), key)
            self.assertEqual(slot['max'], 5000 if slot['kind'] == 'block' else 300, key)
            self.assertIn(key, self.catalog['groups'][slot['group']], key)
            self.assertTrue(slot['pages'], key)
        grouped = [k for keys in self.catalog['groups'].values() for k in keys]
        self.assertEqual(sorted(grouped), sorted(slots))

    def test_address_fields_are_multiline(self):
        for key, slot in self.catalog['slots'].items():
            self.assertIsInstance(slot['multiline'], bool, key)
        multiline = {k for k, s in self.catalog['slots'].items() if s['multiline']}
        self.assertEqual(multiline, ADDRESS_KEYS)
        for key in ADDRESS_KEYS:
            self.assertEqual(self.catalog['slots'][key]['kind'], 'line', key)  # un bloc est déjà une zone de texte

    def test_catalog_pages_are_the_rendered_files(self):
        self.assertEqual(len(self.catalog['pages']), 16)
        self.assertNotIn('404.html', self.catalog['pages'])
        for rel in self.catalog['pages']:
            self.assertTrue((build.ROOT / rel).parent.exists(), rel)
        self.assertIn('legal/terms.html', self.catalog['pages'])
        self.assertIn('en/legal/terms.html', self.catalog['pages'])
        self.assertIn('index.html', self.catalog['pages'])

    def test_banner_is_tagged(self):
        for (lang, key), html in self.pages.items():
            self.assertEqual(html.count('data-legal-banner'), 1, f'{lang}/{key}')
            self.assertIn('<div class="banner" role="note" data-legal-banner><div class="wrap"><p>', html)

    def test_block_keys(self):
        blocks = {k for k, s in self.catalog['slots'].items() if s['kind'] == 'block'}
        self.assertEqual(blocks, BLOCK_KEYS)
        # Un champ « ligne » ne doit jamais occuper seul un paragraphe : il aurait dû être un bloc.
        for (lang, key), html in self.pages.items():
            self.assertNotRegex(html, r'<p><mark class="todo" data-legal="[a-z0-9_]+">[^<]*</mark></p>', f'{lang}/{key}')

    def test_brand_name_replaces_the_name_placeholder(self):
        for (lang, key), html in self.pages.items():
            self.assertNotIn('[Nom]', html, f'{lang}/{key}')
            self.assertNotIn('[Name]', html, f'{lang}/{key}')

    def test_only_the_banner_example_keeps_a_bare_todo_marker(self):
        # Hors emplacement nommé, le seul marqueur « À COMPLÉTER » restant est l'exemple expliqué dans la bannière.
        for (lang, key), html in self.pages.items():
            bare = re.findall(r'<mark class="todo">\[(?:À COMPLÉTER|TO BE COMPLETED)\]</mark>', html)
            inside_blocks = re.findall(r'<div data-legal-block="[a-z0-9_]+"><p><mark class="todo">\[[^\]]+\]</mark></p></div>', html)
            self.assertEqual(len(bare), 1, f'{lang}/{key}')
            self.assertEqual(html.count('class="todo"'), len(bare) + len(inside_blocks) + len(re.findall(r'data-legal="', html)), f'{lang}/{key}')


if __name__ == '__main__':
    unittest.main()
