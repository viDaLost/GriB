import unittest
from unittest.mock import patch
from download_inat import resolve_taxon

class TaxonResolutionTest(unittest.TestCase):
    def test_search_term_does_not_replace_exact_scientific_synonym(self):
        a = {'id': 553907, 'name': 'Neoboletus erythropus',
             'matched_term': 'Neoboletus luridiformis luridiformis',
             'rank': 'species', 'is_active': True, 'iconic_taxon_name': 'Fungi'}
        b = {**a, 'id': 796595, 'name': 'Neoboletus xanthopus',
             'matched_term': 'Neoboletus luridiformis discolor'}
        scientific = {'name': 'Neoboletus luridiformis', 'lexicon': 'scientific-names', 'is_valid': False}
        with patch('download_inat.api_get', side_effect=[{'results': [a, b]},
                {'results': [{**a, 'names': [scientific]}]},
                {'results': [{**b, 'names': []}]}]) as api:
            self.assertEqual(resolve_taxon('Neoboletus luridiformis'), 553907)
            self.assertEqual(api.call_count, 3)
        with patch('download_inat.api_get', side_effect=[{'results': [a, b]},
                {'results': [{**a, 'names': [scientific]}]},
                {'results': [{**b, 'names': [scientific]}]}]):
            self.assertIsNone(resolve_taxon('Neoboletus luridiformis'))

if __name__ == '__main__': unittest.main()
