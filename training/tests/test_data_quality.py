import unittest
from common import Row
from data_quality import cache_identity, curate_rows, dataset_fingerprint, exact_taxon, audit_rows

class DataQualityTest(unittest.TestCase):
    def test_scientific_synonym_is_exact_and_unambiguous(self):
        taxon = {'id': 553907, 'name': 'Neoboletus erythropus',
                 'matched_term': 'Neoboletus luridiformis luridiformis',
                 'rank': 'species', 'is_active': True, 'iconic_taxon_name': 'Fungi',
                 'names': [{'name': 'Neoboletus luridiformis',
                            'lexicon': 'scientific-names', 'is_valid': False}]}
        self.assertEqual(exact_taxon([taxon], 'Neoboletus luridiformis'), 553907)
        self.assertIsNone(exact_taxon([{**taxon, 'names': []}], 'Neoboletus luridiformis'))
        self.assertIsNone(exact_taxon([{**taxon, 'names': [{'name': 'Neoboletus luridiformis', 'lexicon': 'english'}]}], 'Neoboletus luridiformis'))
        self.assertIsNone(exact_taxon([taxon, {**taxon, 'id': 796595}], 'Neoboletus luridiformis'))

    def test_observation_cannot_cross_splits_even_with_different_photos(self):
        a = Row('boletus-edulis', 'a.jpg', 'one-find', '1', 'cc0', '', '', 'train')
        b = Row('boletus-edulis', 'b.jpg', 'one-find', '2', 'cc0', '', '', 'test')
        with self.assertRaises(ValueError): audit_rows([a, b])

    def test_exact_species_and_explicit_synonyms_only(self):
        taxon = {'id': 5, 'name': 'Collybia dealbata', 'matched_term': 'Clitocybe dealbata', 'rank': 'species', 'is_active': True, 'iconic_taxon_name': 'Fungi'}
        self.assertEqual(exact_taxon([taxon], 'Clitocybe dealbata'), 5)
        self.assertIsNone(exact_taxon([taxon], 'Clitocybe rivulosa'))
        for change in [{'is_active':False}, {'rank':'genus'}, {'iconic_taxon_name':'Plantae'}]:
            self.assertIsNone(exact_taxon([{**taxon, **change}], 'Clitocybe dealbata'))
    def test_cache_changes_with_taxon_license_and_sampling(self):
        a = cache_identity({'taxon_id':5}, 400, 1, {'cc-by'})
        for q, n, shots, licenses in [({'taxon_id':6},400,1,{'cc-by'}),({'taxon_id':5},800,1,{'cc-by'}),({'taxon_id':5},400,2,{'cc-by'}),({'taxon_id':5},400,1,{'cc0'})]:
            self.assertNotEqual(a, cache_identity(q,n,shots,licenses))
    def test_duplicate_content_cannot_cross_split_or_teach_two_labels(self):
        def row(label,photo,obs,split,sha):
            return Row(label, photo+'.jpg',obs,photo,'cc-by','author','https://example.org',split,image_sha256=sha)
        rows=[row('a','1','10','train','same'),row('a','2','20','test','same'),row('a','3','30','train','conflict'),row('b','4','40','test','conflict')]
        kept, report=curate_rows(rows)
        self.assertEqual([r.photo_id for r in kept], ['1'])
        self.assertEqual(report['duplicatesRemoved'],1)
        self.assertEqual(len(report['conflictingContent']),1)
        self.assertEqual(dataset_fingerprint(kept),dataset_fingerprint(list(reversed(kept))))
        self.assertNotEqual(dataset_fingerprint(kept),dataset_fingerprint([]))

if __name__=='__main__':unittest.main()
